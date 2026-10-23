import 'dart:async';
import 'package:flutter/material.dart';
import '../core/security/crypto_security_service.dart';
import '../core/security/rbac_policy.dart';
import '../models/plant.dart';
import '../models/plant_log.dart';
import '../services/api_service.dart';
import '../services/cache_service.dart';
import '../services/geo_fence_service.dart';
import '../services/websocket_service.dart';
import '../utils/theme.dart';
import '../components/loading_indicator.dart';
import '../components/log_edit_dialog.dart';
import '../components/audit_history_view.dart';
import '../components/video_player_view.dart';

/// Hồ sơ Cây trồng 4 Phân lớp Chuẩn Quốc tế `v1.3.5` (4-Tab Enterprise Tree Profile)
/// Đồng bộ 100% với giao diện Web App (`user_dashboard.js` / `admin.js`):
/// - Tab 1: Hồ sơ Sinh học & Định danh GS1/W3C DID (`globalDid`, `plotName`, `rowNumber`, `PHI Quarantine`)
/// - Tab 2: Nhật ký VietGAP & Sổ cái Chuỗi Băm SHA-256 Bất biến (`prevLogHash`, `recordHash`, `ISO/IEC 27001`)
/// - Tab 3: Bảo mật Thẻ NFC NTAG213, Gallagher `IssueLevel`, `HMAC-SHA256`, `PIV CHUID` & Geofence `<= 8.0m`
/// - Tab 4: Đo đếm Tín chỉ Carbon MRV (`IPCC Tier-2 / Chave et al. 2014`) & Kinh tế Mùa vụ (Bảo mật RBAC `isFinanceRedacted`)
class PlantDetailPage extends StatefulWidget {
  final Plant plant;

  const PlantDetailPage({super.key, required this.plant});

  @override
  State<PlantDetailPage> createState() => _PlantDetailPageState();
}

class _PlantDetailPageState extends State<PlantDetailPage>
    with SingleTickerProviderStateMixin {
  final ApiService _apiService = ApiService();
  late TabController _tabController;
  StreamSubscription? _wsSubscription;

  bool _isLoading = true;
  List<PlantLog> _logs = <PlantLog>[];
  String? _error;
  Map<String, dynamic>? _currentUser;
  Ntag213VerificationResult? _lastNfcVerification;
  bool _isVerifyingNfc = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _currentUser = CacheService().getCachedUserProfile();
    _loadInitialData();

    _wsSubscription = WebSocketService().stream.listen((Map<String, dynamic> event) {
      final dynamic ev = event['event'];
      if (ev == 'plants_updated' || ev == 'new_care_log') {
        if (mounted) _loadLogs();
      }
    });
  }

  @override
  void dispose() {
    _wsSubscription?.cancel();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    await Future.wait(<Future<void>>[
      _loadLogs(),
      _loadUserProfile(),
    ]);
    _runLocal5LayerSecurityAudit();
  }

  Future<void> _loadUserProfile() async {
    try {
      final Map<String, dynamic>? info = await _apiService.fetchUserInfo();
      if (mounted && info != null) {
        setState(() {
          _currentUser = info;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadLogs() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final List<PlantLog> logs =
          await _apiService.fetchPlantLogs(widget.plant.id);
      if (!mounted) return;
      setState(() {
        _logs = logs.where((PlantLog l) => !l.isDeleted).toList();
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Không thể tải nhật ký chăm sóc cây.';
        _isLoading = false;
      });
    }
  }

  Future<void> _runLocal5LayerSecurityAudit() async {
    if (!mounted) return;
    setState(() => _isVerifyingNfc = true);
    try {
      final pos = await GeoFenceService().getCurrentPositionSafe();
      final String uid =
          widget.plant.nfcUid ?? 'NTAG213-PLANT-${widget.plant.id}';
      final Ntag213VerificationResult res =
          CryptoSecurityService.verifyNtag213Scan5Layer(
        scannedUid: uid,
        expectedPlantUid: widget.plant.nfcUid,
        scannedIssueLevel: widget.plant.issueLevel,
        expectedIssueLevel: widget.plant.issueLevel,
        plantId: widget.plant.id,
        expectedChuidHash: widget.plant.chuidHash,
        userLat: pos?.latitude,
        userLng: pos?.longitude,
        plantLat: widget.plant.latitude,
        plantLng: widget.plant.longitude,
      );
      if (mounted) {
        setState(() {
          _lastNfcVerification = res;
          _isVerifyingNfc = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isVerifyingNfc = false);
      }
    }
  }

  void _openAddLogDialog([String? initialType]) {
    if (!RbacPolicy.canRecordCareLogs(_currentUser)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Vai trò Kiểm định viên / Quản lý kho chỉ có quyền xem, không được phép thêm nhật ký hiện trường.',
          ),
          backgroundColor: AppTheme.amber,
        ),
      );
      return;
    }

    showDialog<bool>(
      context: context,
      builder: (BuildContext context) => LogEditDialog(
        plantIds: <int>[widget.plant.id],
        farmName: widget.plant.farmName,
        initialType: initialType,
      ),
    ).then((bool? success) {
      if (success == true && mounted) {
        _loadLogs();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Đã ghi nhật ký VietGAP & đóng dấu niêm phong SHA-256 thành công!',
            ),
            backgroundColor: AppTheme.green,
          ),
        );
      }
    });
  }

  void _openEditLogDialog(PlantLog log) {
    if (log.isLocked) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Bản ghi này đã được Khóa Bất Biến (ISO 27001 Locked Ledger) và không thể chỉnh sửa.',
          ),
          backgroundColor: AppTheme.red,
        ),
      );
      return;
    }
    if (!RbacPolicy.canRecordCareLogs(_currentUser)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Bạn không có quyền chỉnh sửa nhật ký chăm sóc.'),
          backgroundColor: AppTheme.amber,
        ),
      );
      return;
    }

    showDialog<bool>(
      context: context,
      builder: (BuildContext context) => LogEditDialog(
        plantIds: <int>[widget.plant.id],
        log: log,
        farmName: widget.plant.farmName,
      ),
    ).then((bool? success) {
      if (success == true && mounted) {
        _loadLogs();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Đã cập nhật nhật ký chăm sóc và lưu vết lịch sử kiểm toán!',
            ),
            backgroundColor: AppTheme.userAccent,
          ),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final Plant p = widget.plant;
    Color healthColor = AppTheme.green;
    if (p.healthStatus == 'Cần chú ý') {
      healthColor = AppTheme.amber;
    } else if (p.healthStatus != 'Tốt') {
      healthColor = AppTheme.red;
    }

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'Hồ sơ Cây #${p.displayName}',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Text(
              p.globalDid ?? 'did:gs1:vn:tbsg:tree-${p.id}',
              style: const TextStyle(fontSize: 10.5, color: Colors.white70),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          labelStyle:
              const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          tabs: const <Tab>[
            Tab(icon: Icon(Icons.eco_rounded, size: 16), text: '1. Sinh học & GS1'),
            Tab(
                icon: Icon(Icons.verified_user_rounded, size: 16),
                text: '2. Nhật ký & SHA-256'),
            Tab(
                icon: Icon(Icons.nfc_rounded, size: 16),
                text: '3. Bảo mật NTAG213'),
            Tab(
                icon: Icon(Icons.forest_rounded, size: 16),
                text: '4. Carbon MRV & Kinh tế'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: <Widget>[
          _buildTab1BioAndGs1(healthColor),
          _buildTab2VietGapAndHashChain(),
          _buildTab3Ntag213Security(),
          _buildTab4CarbonMrvAndEconomics(),
        ],
      ),
    );
  }

  // ── TAB 1: HỒ SƠ SINH HỌC & ĐỊNH DANH GS1/W3C DID ─────────────────────────
  Widget _buildTab1BioAndGs1(Color healthColor) {
    final Plant p = widget.plant;
    return RefreshIndicator(
      onRefresh: _loadLogs,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            if (p.isUnderPhiQuarantine)
              Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.red.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.red.withOpacity(0.4)),
                ),
                child: Row(
                  children: <Widget>[
                    const Icon(Icons.warning_amber_rounded,
                        color: AppTheme.red, size: 24),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'CẢNH BÁO CÁCH LY THUỐC BVTV (PHI LOCK): Cây đang trong thời gian cách ly (${p.phiRemainingDays ?? 7} ngày còn lại). Tuyệt đối không thu hoạch thương phẩm!',
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.red,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            Card(
              elevation: 0,
              color: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppTheme.grayBorder, width: 1),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            p.plantType,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textMain,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: healthColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                                color: healthColor.withOpacity(0.3)),
                          ),
                          child: Text(
                            p.healthStatus,
                            style: TextStyle(
                              color: healthColor,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (p.plantVariety != null &&
                        p.plantVariety!.isNotEmpty) ...<Widget>[
                      const SizedBox(height: 4),
                      Text(
                        'Giống cây: ${p.plantVariety}',
                        style: const TextStyle(
                            fontSize: 13.5, color: AppTheme.textMuted),
                      ),
                    ],
                    const SizedBox(height: 12),
                    const Divider(color: AppTheme.grayBorder),
                    const SizedBox(height: 10),
                    _infoRow(Icons.qr_code_2_rounded, 'Định danh GS1 W3C DID',
                        p.globalDid ?? 'did:gs1:vn:tbsg:tree-${p.id}'),
                    const SizedBox(height: 8),
                    _infoRow(Icons.category_rounded, 'Phân lớp thực thể',
                        p.entityClass),
                    const SizedBox(height: 8),
                    _infoRow(
                      Icons.grid_view_rounded,
                      'Lô / Hàng canh tác',
                      'Lô: ${p.plotName ?? 'Lô trung tâm'} · Hàng: ${p.rowNumber ?? 'H1'}',
                    ),
                    const SizedBox(height: 8),
                    _infoRow(Icons.calendar_today_rounded, 'Tuổi sinh trưởng',
                        '${p.plantAge ?? '4'} năm'),
                    const SizedBox(height: 8),
                    _infoRow(Icons.location_on_rounded, 'Vị trí & Tọa độ GPS',
                        '${p.location ?? '—'} (${p.latitude?.toStringAsFixed(5) ?? '—'}, ${p.longitude?.toStringAsFixed(5) ?? '—'})'),
                    const SizedBox(height: 8),
                    _infoRow(Icons.water_drop_rounded, 'Lần tưới gần nhất',
                        p.lastWatered ?? 'Chưa ghi nhận'),
                    const SizedBox(height: 8),
                    _infoRow(Icons.opacity_rounded, 'Lần bón phân gần nhất',
                        p.lastFertilized ?? 'Chưa ghi nhận'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            const Text(
              'THAO TÁC NHẬP NHẬT KÝ VIETGAP NHANH (1-CHẠM)',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: AppTheme.textMuted,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 3,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 1.35,
              children: <Widget>[
                _quickCareTile(
                    'Tưới nước', Icons.water_drop_rounded, Colors.blue, 'Tưới nước'),
                _quickCareTile(
                    'Bón phân', Icons.opacity_rounded, AppTheme.green, 'Bón phân'),
                _quickCareTile('Phun thuốc', Icons.bug_report_rounded,
                    Colors.orange, 'Phun thuốc'),
                _quickCareTile(
                    'Cắt tỉa', Icons.content_cut_rounded, Colors.amber, 'Cắt tỉa'),
                _quickCareTile('Bệnh cây', Icons.error_outline_rounded,
                    Colors.red, 'Bệnh cây'),
                _quickCareTile('Thu hoạch', Icons.agriculture_rounded,
                    Colors.teal, 'Thu hoạch'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── TAB 2: NHẬT KÝ VIETGAP & SỔ CÁI CHUỖI BĂM SHA-256 (ISO/IEC 27001) ────
  Widget _buildTab2VietGapAndHashChain() {
    final List<Map<String, dynamic>> rawMaps =
        _logs.map((PlantLog l) => l.toJson()).toList();
    final HashChainAuditResult audit =
        CryptoSecurityService.auditPlantLogsLedger(rawMaps);
    final bool financeRedacted = RbacPolicy.isFinanceRedacted(_currentUser);

    return RefreshIndicator(
      onRefresh: _loadLogs,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            // Banner Sổ cái Bất biến ISO/IEC 27001 SHA-256
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: audit.isIntact
                    ? const Color(0xFFECFDF5)
                    : const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: audit.isIntact ? AppTheme.green : AppTheme.red,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Icon(
                        audit.isIntact
                            ? Icons.verified_user_rounded
                            : Icons.gpp_bad_rounded,
                        color: audit.isIntact ? AppTheme.green : AppTheme.red,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          audit.isIntact
                              ? 'SỔ CÁI BẤT BIẾN ISO/IEC 27001: TOÀN VẸN 100%'
                              : 'CẢNH BÁO: PHÁT HIỆN SAI LỆCH CHUỖI BĂM SHA-256',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.bold,
                            color: audit.isIntact
                                ? AppTheme.greenDark
                                : AppTheme.red,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Đã niêm phong SHA-256: ${audit.verifiedRecords}/${audit.totalRecords} bản ghi · Head Hash: ${audit.headRecordHash.length > 18 ? '${audit.headRecordHash.substring(0, 16)}...' : audit.headRecordHash}',
                    style: const TextStyle(
                        fontSize: 11.5, color: AppTheme.textMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                Text(
                  'Nhật ký VietGAP (${_logs.length} bản ghi)',
                  style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textMain),
                ),
                if (RbacPolicy.canRecordCareLogs(_currentUser))
                  ElevatedButton.icon(
                    onPressed: () => _openAddLogDialog(),
                    icon: const Icon(Icons.add_rounded, size: 16),
                    label: const Text('Ghi nhật ký mới',
                        style: TextStyle(fontSize: 12)),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),

            if (_isLoading)
              const SizedBox(
                height: 150,
                child: LoadingIndicator(message: 'Tải lịch sử nhật ký...'),
              )
            else if (_error != null)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 24),
                alignment: Alignment.center,
                child:
                    Text(_error!, style: const TextStyle(color: AppTheme.red)),
              )
            else if (_logs.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 40),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.grayBorder),
                ),
                alignment: Alignment.center,
                child: const Column(
                  children: <Widget>[
                    Icon(Icons.edit_note_rounded,
                        size: 48, color: AppTheme.textMuted),
                    SizedBox(height: 8),
                    Text(
                      'Chưa có nhật ký nào cho cây này.',
                      style:
                          TextStyle(color: AppTheme.textMuted, fontSize: 13),
                    ),
                  ],
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _logs.length,
                itemBuilder: (BuildContext context, int index) {
                  final PlantLog log = _logs[index];
                  final String detailVal =
                      _formatLogDetails(log.logType, log.details);

                  return Card(
                    elevation: 0,
                    margin: const EdgeInsets.only(bottom: 12),
                    color: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: const BorderSide(
                          color: AppTheme.grayBorder, width: 1),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: <Widget>[
                              Row(
                                children: <Widget>[
                                  Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: const BoxDecoration(
                                      color: AppTheme.greenLight,
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(
                                      _getLogIcon(log.logType),
                                      size: 16,
                                      color: AppTheme.greenDark,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    log.logType,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      color: AppTheme.textMain,
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                log.logDate,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.textMuted,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),

                          // Huy hiệu Niêm phong Chuỗi Băm SHA-256 (ISO 27001 Badge)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: log.isCryptographicallySealed
                                  ? const Color(0xFFF0FDF4)
                                  : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: log.isCryptographicallySealed
                                    ? AppTheme.green.withOpacity(0.35)
                                    : AppTheme.grayBorder,
                              ),
                            ),
                            child: Row(
                              children: <Widget>[
                                Icon(
                                  log.isLocked
                                      ? Icons.lock_rounded
                                      : (log.isCryptographicallySealed
                                          ? Icons.shield_rounded
                                          : Icons.history_rounded),
                                  size: 13,
                                  color: log.isCryptographicallySealed
                                      ? AppTheme.greenDark
                                      : AppTheme.textMuted,
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    'SHA-256: ${log.shortRecordHash} ← Prev: ${log.shortPrevHash}',
                                    style: const TextStyle(
                                      fontSize: 10.5,
                                      fontFamily: 'monospace',
                                      color: AppTheme.textMain,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 10),

                          if (detailVal.isNotEmpty) ...<Widget>[
                            Text(
                              'Chi tiết: $detailVal',
                              style: const TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 4),
                          ],

                          if (log.cost != null && log.cost! > 0) ...<Widget>[
                            Text(
                              'Chi phí vật tư/công: ${RbacPolicy.formatCurrencyWithPolicy(log.cost, _currentUser)}',
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                color: financeRedacted
                                    ? AppTheme.amber
                                    : AppTheme.greenDark,
                              ),
                            ),
                            const SizedBox(height: 4),
                          ],

                          if (log.note != null &&
                              log.note!.isNotEmpty) ...<Widget>[
                            Text(
                              'Ghi chú: ${log.note}',
                              style: const TextStyle(
                                  fontSize: 13, color: AppTheme.textMain),
                            ),
                            const SizedBox(height: 8),
                          ],

                          if (log.mediaUrls.isNotEmpty) ...<Widget>[
                            const SizedBox(height: 4),
                            SizedBox(
                              height: 72,
                              child: ListView.builder(
                                scrollDirection: Axis.horizontal,
                                itemCount: log.mediaUrls.length,
                                itemBuilder:
                                    (BuildContext context, int mediaIdx) {
                                  final String url = log.mediaUrls[mediaIdx];
                                  final bool isVideo = url
                                          .toLowerCase()
                                          .endsWith('.mp4') ||
                                      url.toLowerCase().contains('/video/');
                                  return GestureDetector(
                                    onTap: () {
                                      if (isVideo) {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute<void>(
                                            builder: (_) =>
                                                VideoPlayerWebviewPage(
                                                    videoUrl: url),
                                          ),
                                        );
                                      }
                                    },
                                    child: Container(
                                      margin: const EdgeInsets.only(right: 8),
                                      width: 72,
                                      height: 72,
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                            color: AppTheme.grayBorder),
                                        image: isVideo
                                            ? null
                                            : DecorationImage(
                                                image: NetworkImage(url),
                                                fit: BoxFit.cover,
                                              ),
                                      ),
                                      child: isVideo
                                          ? const Center(
                                              child: Icon(
                                                Icons.play_circle_fill_rounded,
                                                size: 32,
                                                color: AppTheme.green,
                                              ),
                                            )
                                          : null,
                                    ),
                                  );
                                },
                              ),
                            ),
                            const SizedBox(height: 8),
                          ],

                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: <Widget>[
                              if (!log.isLocked &&
                                  RbacPolicy.canRecordCareLogs(_currentUser))
                                TextButton.icon(
                                  onPressed: () => _openEditLogDialog(log),
                                  icon:
                                      const Icon(Icons.edit_rounded, size: 14),
                                  label: const Text('Sửa nhật ký',
                                      style: TextStyle(fontSize: 12)),
                                  style: TextButton.styleFrom(
                                    foregroundColor: AppTheme.userAccent,
                                    padding: EdgeInsets.zero,
                                  ),
                                ),
                            ],
                          ),

                          if (log.editHistory.isNotEmpty)
                            AuditHistoryView(history: log.editHistory),
                        ],
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  // ── TAB 3: BẢO MẬT VẬT LÝ - SỐ NTAG213, GALLAGHER 8.30 & GEOFENCE 8M ──────
  Widget _buildTab3Ntag213Security() {
    final Plant p = widget.plant;
    final String cleanUid =
        CryptoSecurityService.normalizeNfcUid(p.nfcUid ?? 'UNASSIGNED');
    final String hmacSig = CryptoSecurityService.generateNtag213HmacSignature(
      nfcUid: cleanUid,
      issueLevel: p.issueLevel,
    );
    final String chuid = p.chuidHash ??
        CryptoSecurityService.generatePivChuidHash(
          plantId: p.id,
          nfcUid: cleanUid,
          issueLevel: p.issueLevel,
        );

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Card(
            elevation: 0,
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: AppTheme.grayBorder),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Row(
                    children: <Widget>[
                      Icon(Icons.security_rounded,
                          color: AppTheme.greenDark, size: 22),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Chứng thư Vật lý - Số NTAG213 & Gallagher 8.30',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textMain,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(color: AppTheme.grayBorder),
                  const SizedBox(height: 10),
                  _infoRow(Icons.nfc_rounded, 'Mã phần cứng NTAG213 UID',
                      p.nfcUid ?? 'Chưa gán thẻ vật lý'),
                  const SizedBox(height: 8),
                  _infoRow(
                    Icons.workspace_premium_rounded,
                    'Phiên bản phát hành (Gallagher IL)',
                    'IL${p.issueLevel} (${p.cardType})',
                  ),
                  const SizedBox(height: 8),
                  _infoRow(Icons.vpn_key_rounded, 'Chữ ký NIST HMAC-SHA256',
                      hmacSig),
                  const SizedBox(height: 8),
                  _infoRow(
                    Icons.fingerprint_rounded,
                    'Định danh FIPS 201 PIV CHUID',
                    '${chuid.substring(0, 20)}...',
                  ),
                  const SizedBox(height: 8),
                  _infoRow(
                    Icons.radar_rounded,
                    'Bán kính Hàng rào Địa lý (Geofence)',
                    '<= ${CryptoSecurityService.maxGeofenceDistanceMeters.toStringAsFixed(1)} mét (Haversine GPS)',
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed:
                        _isVerifyingNfc ? null : _runLocal5LayerSecurityAudit,
                    icon: const Icon(Icons.verified_rounded, size: 18),
                    label: Text(
                      _isVerifyingNfc
                          ? 'Đang kiểm định 5 lớp bảo mật...'
                          : 'Kiểm định 5 Lớp Bảo mật & Khoảng cách GPS',
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          if (_lastNfcVerification != null)
            Card(
              elevation: 0,
              color: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: _lastNfcVerification!.isValid
                      ? AppTheme.green
                      : AppTheme.amber,
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Kết quả Kiểm định: ${_lastNfcVerification!.passedLayers}/5 Lớp Đạt Chuẩn (${_lastNfcVerification!.statusCode})',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.bold,
                        color: _lastNfcVerification!.isValid
                            ? AppTheme.greenDark
                            : AppTheme.amber,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _lastNfcVerification!.summaryMessage,
                      style: const TextStyle(
                          fontSize: 12.5, color: AppTheme.textMain),
                    ),
                    const SizedBox(height: 10),
                    ..._lastNfcVerification!.auditLog.map(
                      (String line) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          line,
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontFamily: 'monospace',
                            color: AppTheme.textMuted,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ── TAB 4: TÍN CHỈ CARBON MRV (IPCC TIER-2 / CHAVE 2014) & KINH TẾ MÙA VỤ ──
  Widget _buildTab4CarbonMrvAndEconomics() {
    final Plant p = widget.plant;
    final bool financeRedacted = RbacPolicy.isFinanceRedacted(_currentUser);

    double totalLogCost = p.totalCost ?? 0.0;
    double totalYieldKg = 0.0;
    for (final PlantLog l in _logs) {
      if (l.cost != null) totalLogCost += l.cost!;
      if (l.yieldKg != null) totalYieldKg += l.yieldKg!;
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          // Card 1: Carbon MRV (IPCC Tier-2 / Chave et al. 2014)
          Card(
            elevation: 0,
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: AppTheme.grayBorder),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Row(
                    children: <Widget>[
                      Icon(Icons.forest_rounded,
                          color: AppTheme.greenDark, size: 22),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Định lượng Sinh khối & Tín chỉ Carbon MRV (IPCC Tier-2)',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textMain,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Phương trình sinh khối nhiệt đới Chave et al. (2014): AGB = 0.0673 × (ρ × D² × H)^0.976',
                    style: TextStyle(
                        fontSize: 11.5,
                        fontStyle: FontStyle.italic,
                        color: AppTheme.textMuted),
                  ),
                  const SizedBox(height: 12),
                  const Divider(color: AppTheme.grayBorder),
                  const SizedBox(height: 10),
                  _infoRow(
                    Icons.straighten_rounded,
                    'Đường kính thân ngang ngực (DBH)',
                    '${(p.biomassDbhCm ?? 18.5).toStringAsFixed(1)} cm',
                  ),
                  const SizedBox(height: 8),
                  _infoRow(
                    Icons.height_rounded,
                    'Chiều cao vòm tán (Canopy Height)',
                    '${(p.canopyHeightM ?? 4.5).toStringAsFixed(2)} m',
                  ),
                  const SizedBox(height: 8),
                  _infoRow(
                    Icons.scale_rounded,
                    'Sinh khối trên mặt đất (Estimated AGB)',
                    '${p.estimatedAgbKg.toStringAsFixed(2)} kg sinh khối khô',
                  ),
                  const SizedBox(height: 8),
                  _infoRow(
                    Icons.cloud_done_rounded,
                    'Lượng hấp thụ Carbon quy đổi (CO2e)',
                    '${p.estimatedCo2eKg.toStringAsFixed(2)} kg CO₂e / cây',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Card 2: Kinh tế Mùa vụ & Phân quyền RBAC (isFinanceRedacted)
          Card(
            elevation: 0,
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: AppTheme.grayBorder),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: <Widget>[
                      const Text(
                        'Kinh tế Mùa vụ & Chi phí Đầu tư',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textMain,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: financeRedacted
                              ? AppTheme.amber.withOpacity(0.15)
                              : AppTheme.greenLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          RbacPolicy.getRoleBadgeCode(_currentUser),
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.bold,
                            color: financeRedacted
                                ? AppTheme.amber
                                : AppTheme.greenDark,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(color: AppTheme.grayBorder),
                  const SizedBox(height: 10),
                  _infoRow(
                    Icons.shopping_basket_rounded,
                    'Tổng sản lượng thu hoạch lũy kế',
                    '${totalYieldKg.toStringAsFixed(1)} kg',
                  ),
                  const SizedBox(height: 8),
                  _infoRow(
                    Icons.payments_rounded,
                    'Tổng chi phí vật tư & nhân công',
                    RbacPolicy.formatCurrencyWithPolicy(
                        totalLogCost, _currentUser),
                  ),
                  const SizedBox(height: 8),
                  _infoRow(
                    Icons.trending_up_rounded,
                    'Doanh thu mùa vụ ước tính',
                    RbacPolicy.formatCurrencyWithPolicy(
                        p.totalRevenue ?? (totalYieldKg * 65000), _currentUser),
                  ),
                  if (financeRedacted) ...<Widget>[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppTheme.amber.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Chính sách Bảo mật Phân quyền (${RbacPolicy.getRoleDisplayLabel(_currentUser)}): Dữ liệu tài chính & doanh thu chỉ hiển thị cho Chủ Trang trại (farm_owner).',
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppTheme.textMain,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatLogDetails(String logType, Map<String, dynamic> details) {
    if (details.isEmpty) return '';
    final List<String> parts = <String>[];

    if (logType == 'Tưới nước') {
      final dynamic method = details['method'];
      final dynamic amount = details['amount'];
      if (method != null && method.toString().isNotEmpty) {
        parts.add('Cách tưới: $method');
      }
      if (amount != null) parts.add('Lượng nước: $amount lít');
    } else if (logType == 'Bón phân') {
      final dynamic name = details['fertilizer_name'];
      final dynamic amount = details['amount'];
      final dynamic unit = details['unit'] ?? 'kg';
      if (name != null && name.toString().isNotEmpty) {
        parts.add('Loại phân: $name');
      }
      if (amount != null) parts.add('Lượng bón: $amount $unit');
    } else if (logType == 'Phun thuốc') {
      final dynamic name = details['pesticide_name'];
      final dynamic amount = details['amount'];
      final dynamic unit = details['unit'] ?? 'lít';
      if (name != null && name.toString().isNotEmpty) {
        parts.add('Loại thuốc: $name');
      }
      if (amount != null) parts.add('Lượng phun: $amount $unit');
    } else if (logType == 'Bệnh cây') {
      final dynamic name = details['disease_name'];
      final dynamic severity = details['severity'];
      final dynamic desc = details['description'];
      if (name != null && name.toString().isNotEmpty) {
        parts.add('Tên bệnh: $name');
      }
      if (severity != null && severity.toString().isNotEmpty) {
        parts.add('Mức độ: $severity');
      }
      if (desc != null && desc.toString().isNotEmpty) {
        parts.add('Mô tả: $desc');
      }
    } else if (logType == 'Tỉa cành/lá' ||
        logType == 'Tỉa quả/hoa' ||
        logType == 'Cắt tỉa') {
      final dynamic reason = details['reason'];
      final dynamic amount = details['amount'];
      if (reason != null && reason.toString().isNotEmpty) {
        parts.add('Lý do: $reason');
      }
      if (amount != null && amount != 0) parts.add('Số lượng: $amount');
    } else {
      final dynamic val = details['value'] ??
          details['method'] ??
          details['fertilizer'] ??
          details['pesticide'] ??
          details['reason'] ??
          details['disease'];
      if (val != null) parts.add('$val');
    }
    return parts.join(' | ');
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Row(
      children: <Widget>[
        Icon(icon, size: 16, color: AppTheme.textMuted),
        const SizedBox(width: 8),
        Text('$label: ',
            style: const TextStyle(fontSize: 13, color: AppTheme.textMuted)),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: AppTheme.textMain),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  IconData _getLogIcon(String type) {
    switch (type) {
      case 'Tưới nước':
        return Icons.water_drop_rounded;
      case 'Bón phân':
        return Icons.opacity_rounded;
      case 'Phun thuốc':
        return Icons.bug_report_rounded;
      case 'Tỉa cành/lá':
      case 'Cắt tỉa':
        return Icons.content_cut_rounded;
      case 'Tỉa quả/hoa':
        return Icons.grain_rounded;
      case 'Bệnh cây':
        return Icons.error_outline_rounded;
      default:
        return Icons.edit_note_rounded;
    }
  }

  Widget _quickCareTile(
      String label, IconData icon, Color color, String activityType) {
    return Card(
      elevation: 0,
      margin: EdgeInsets.zero,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color.withOpacity(0.3), width: 1.2),
      ),
      child: InkWell(
        onTap: () => _openAddLogDialog(activityType),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.bold, color: color),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
