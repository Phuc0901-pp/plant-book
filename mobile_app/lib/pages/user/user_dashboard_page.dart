import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../utils/theme.dart';
import '../../core/constants/app_constants.dart';
import '../../components/common/welcome_banner.dart';
import '../../components/farm_card.dart';
import '../../components/plant_card.dart';
import '../../components/common/pro_upgrade_modal.dart';
import '../../components/loading_indicator.dart';
import '../../components/qr_nfc_scanner.dart';
import '../../components/log_edit_dialog.dart';
import '../../models/farm.dart';
import '../../models/plant.dart';
import '../../services/api_service.dart';
import '../ai_chat_page.dart';

class UserDashboardPage extends StatefulWidget {
  final Function(int) onNavigateTab;

  const UserDashboardPage({super.key, required this.onNavigateTab});

  @override
  State<UserDashboardPage> createState() => _UserDashboardPageState();
}

class _UserDashboardPageState extends State<UserDashboardPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  List<Farm> _farms = [];
  List<Plant> _plants = [];
  Map<String, dynamic>? _userProfile;
  Map<String, dynamic>? _supplyAnalytics;

  final NumberFormat _currencyFormat = NumberFormat.currency(
    locale: 'vi_VN',
    symbol: 'đ',
    decimalDigits: 0,
  );

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait<dynamic>([
        _apiService.fetchFarms(),
        _apiService.fetchPlants(),
        _apiService.fetchUserInfo(),
        _apiService.fetchSupplyAnalytics(period: 'month'),
      ]);

      if (mounted) {
        setState(() {
          _farms = results[0] as List<Farm>;
          _plants = results[1] as List<Plant>;
          _userProfile = results[2] as Map<String, dynamic>?;
          _supplyAnalytics = results[3] as Map<String, dynamic>?;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _openScanner() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => QrScannerPage(availablePlants: _plants),
      ),
    );
  }

  void _openQuickCareLog() {
    final defaultPlantId = _plants.isNotEmpty ? [_plants.first.id] : <int>[];
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => LogEditDialog(
        plantIds: defaultPlantId,
        farmName: _plants.isNotEmpty ? _plants.first.plantType : 'Trang trại Nông hộ',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const LoadingIndicator(message: 'Đang tải bảng chỉ số ERP thực địa...');
    }

    final bool isPro = _userProfile?['account_tier'] == 'pro';
    final userName = _userProfile?['full_name'] ?? _userProfile?['name'] ?? 'Nông hộ';

    // Calculate KPI metrics
    final totalPlants = _plants.length;
    final sickPlants = _plants.where((p) => p.healthStatus.toLowerCase().contains('bệnh') || p.healthStatus.toLowerCase().contains('chú ý')).length;

    double totalArea = 0;
    for (final f in _farms) {
      totalArea += f.area;
    }

    final totalExpense = _supplyAnalytics?['total_cost'] ?? 0;
    final quarantineCount = _plants.where((p) => (p.phiRemainingDays ?? 0) > 0).length;

    return RefreshIndicator(
      onRefresh: _loadDashboardData,
      color: AppTheme.greenDark,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Welcome Banner
            WelcomeBanner(userName: userName, accountTier: _userProfile?['account_tier'] as String?),
            const SizedBox(height: 16),

            // 2. Offline / Online Sync Status Banner
            _buildSyncStatusBanner(),
            const SizedBox(height: 16),

            // 3. Section Header: Macro KPI Cards
            const Text(
              'CHỈ SỐ NÔNG TRẠI & TÀI CHÍNH ERP',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.bold,
                color: AppTheme.textMuted,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 10),

            // 4. 2x2 ERP KPI Metrics Grid
            Row(
              children: [
                Expanded(
                  child: _buildKpiCard(
                    icon: Icons.park_rounded,
                    iconColor: AppTheme.green,
                    bgColor: AppTheme.greenLight,
                    title: 'Tổng Cây Trồng',
                    value: ' cây',
                    subtext: sickPlants > 0 ? '⚠️  cây cần chú ý' : '✓ 100% Khỏe mạnh',
                    subtextColor: sickPlants > 0 ? AppTheme.amber : AppTheme.greenDark,
                    onTap: () => widget.onNavigateTab(1),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildKpiCard(
                    icon: Icons.landscape_rounded,
                    iconColor: AppTheme.blue,
                    bgColor: AppTheme.blueLight,
                    title: 'Quy Mô Vùng Trồng',
                    value: totalArea > 0 ? ' ha' : ' Vườn',
                    subtext: ' Trang trại hoạt động',
                    subtextColor: const Color(0xFF1E40AF),
                    onTap: () => widget.onNavigateTab(1),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildKpiCard(
                    icon: Icons.payments_rounded,
                    iconColor: AppTheme.amber,
                    bgColor: AppTheme.amberLight,
                    title: 'Chi Phí Mùa Vụ',
                    value: _currencyFormat.format(totalExpense),
                    subtext: 'Khấu trừ kho tự động',
                    subtextColor: AppTheme.amber,
                    onTap: () => widget.onNavigateTab(3),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildKpiCard(
                    icon: Icons.verified_user_rounded,
                    iconColor: quarantineCount > 0 ? AppTheme.red : AppTheme.green,
                    bgColor: quarantineCount > 0 ? AppTheme.redLight : AppTheme.greenLight,
                    title: 'VietGAP / PHI',
                    value: quarantineCount > 0 ? ' Cách ly' : 'An Toàn',
                    subtext: quarantineCount > 0 ? 'Đang đếm ngược PHI' : 'Đạt chuẩn thu hoạch',
                    subtextColor: quarantineCount > 0 ? AppTheme.red : AppTheme.greenDark,
                    onTap: () => widget.onNavigateTab(2),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // 5. Smart Agro-Advisory Weather Card
            _buildWeatherAdvisoryCard(),
            const SizedBox(height: 20),

            // 6. Quick Operation Hub (4 Large Buttons)
            const Text(
              'THAO TÁC THỰC ĐỊA NHANH (1-CHẠM)',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.bold,
                color: AppTheme.textMuted,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _buildQuickActionButton(
                    icon: Icons.qr_code_scanner_rounded,
                    color: AppTheme.green,
                    bgColor: AppTheme.greenLight,
                    title: 'Quét QR/NFC',
                    subtitle: 'Định danh cây',
                    onTap: _openScanner,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildQuickActionButton(
                    icon: Icons.mic_rounded,
                    color: AppTheme.amber,
                    bgColor: AppTheme.amberLight,
                    title: 'Ghi Nhật Ký',
                    subtitle: 'Nói tiếng Việt',
                    onTap: _openQuickCareLog,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildQuickActionButton(
                    icon: Icons.inventory_2_rounded,
                    color: AppTheme.blue,
                    bgColor: AppTheme.blueLight,
                    title: 'Kho Vật Tư',
                    subtitle: 'Quét OCR AI',
                    onTap: () => widget.onNavigateTab(3),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildQuickActionButton(
                    icon: Icons.psychology_alt_rounded,
                    color: const Color(0xFF10B981),
                    bgColor: const Color(0xFFECFDF5),
                    title: 'Bé Mầm AI',
                    subtitle: 'Hỏi kỹ thuật',
                    onTap: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const AiChatPage()));
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),

            // 7. Section: My Farms
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'TRANG TRẠI CANH TÁC',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
                ),
                TextButton(
                  onPressed: () => widget.onNavigateTab(1),
                  child: const Text('Xem tất cả →', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
                ),
              ],
            ),
            const SizedBox(height: 6),

            if (_farms.isEmpty)
              Container(
                padding: const EdgeInsets.all(20),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.grayBorder, width: 1.2)),
                child: const Text('Chưa khởi tạo trang trại nào.', style: TextStyle(color: AppTheme.textMuted, fontSize: 13.5)),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _farms.length > 2 ? 2 : _farms.length,
                itemBuilder: (context, idx) {
                  final farm = _farms[idx];
                  return FarmCard(
                    farm: farm,
                    onTap: () => widget.onNavigateTab(1),
                  );
                },
              ),

            const SizedBox(height: 20),

            // 8. Section: Plants
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'DANH SÁCH CÂY GẦN ĐÂY',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
                ),
                Text(' cây', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
              ],
            ),
            const SizedBox(height: 8),

            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _plants.length > 3 ? 3 : _plants.length,
              itemBuilder: (context, idx) {
                final plant = _plants[idx];
                return PlantCard(
                  plant: plant,
                  onLogTap: () {
                    if (!isPro) {
                      ProUpgradeModal.show(context, 'quản lý từng cây riêng lẻ & Thẻ QR/NFC');
                    }
                  },
                );
              },
            ),

            const SizedBox(height: 28),
            Center(
              child: Text(
                AppConstants.appFooter,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 11.5, color: AppTheme.textMuted, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSyncStatusBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFBBF7D0), width: 1.2),
      ),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: Color(0xFF10B981),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Máy chủ kết nối trực tuyến · Sẵn sàng ghi ngoại tuyến ngoài vườn',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF166534)),
            ),
          ),
          const Icon(Icons.cloud_done_rounded, color: Color(0xFF10B981), size: 18),
        ],
      ),
    );
  }

  Widget _buildKpiCard({
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required String title,
    required String value,
    required String subtext,
    required Color subtextColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.grayBorder, width: 1.2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(10)),
                  child: Icon(icon, color: iconColor, size: 20),
                ),
                const Icon(Icons.chevron_right_rounded, color: Color(0xFFCBD5E1), size: 20),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textMain),
            ),
            const SizedBox(height: 2),
            Text(
              title,
              style: const TextStyle(fontSize: 12, color: AppTheme.textMuted, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Text(
              subtext,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: subtextColor),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWeatherAdvisoryCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF064E3B), Color(0xFF047857)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF064E3B).withOpacity(0.2),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: const [
                  Icon(Icons.wb_sunny_rounded, color: Color(0xFFFDE047), size: 22),
                  SizedBox(width: 8),
                  Text(
                    'Khí tượng Nông nghiệp (Open-Meteo)',
                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
                child: const Text('Real-time', style: TextStyle(fontSize: 10.5, color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: const [
              Text('31°C', style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Colors.white)),
              SizedBox(width: 14),
              Expanded(
                child: Text(
                  'Trời nắng nhẹ · Độ ẩm: 72% · Khả năng mưa: 15% · Gió Đông Nam',
                  style: TextStyle(fontSize: 12, color: Color(0xFFD1FAE5), height: 1.3),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: const [
                Icon(Icons.tips_and_updates_rounded, color: Color(0xFFFDE047), size: 18),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Khuyến nghị: Thời tiết thuận lợi để tưới gốc và bón phân hữu cơ.',
                    style: TextStyle(fontSize: 11.5, color: Colors.white, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionButton({
    required IconData icon,
    required Color color,
    required Color bgColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.grayBorder, width: 1.2),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: bgColor, shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 6),
            Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: AppTheme.textMain)),
            const SizedBox(height: 2),
            Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 9.5, color: AppTheme.textMuted)),
          ],
        ),
      ),
    );
  }
}
