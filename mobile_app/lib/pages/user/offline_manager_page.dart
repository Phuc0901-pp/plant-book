import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../utils/theme.dart';
import '../../services/cache_service.dart';
import '../../services/offline_sync_service.dart';
import '../../components/loading_indicator.dart';

class OfflineManagerPage extends StatefulWidget {
  const OfflineManagerPage({super.key});

  @override
  State<OfflineManagerPage> createState() => _OfflineManagerPageState();
}

class _OfflineManagerPageState extends State<OfflineManagerPage> {
  final CacheService _cache = CacheService();
  final OfflineSyncService _syncService = OfflineSyncService();

  bool _isLoading = false;
  bool _isSyncing = false;
  String? _statusMessage;
  double _syncProgress = 0.0;
  String _syncProgressText = '';

  @override
  void initState() {
    super.initState();
    _refreshStats();
  }

  void _refreshStats() {
    setState(() {});
  }

  Future<void> _downloadAllData() async {
    setState(() {
      _isLoading = true;
      _statusMessage = 'Đang tải toàn bộ dữ liệu nông hộ về máy...';
    });

    final res = await _syncService.downloadAllForOffline();

    if (mounted) {
      setState(() {
        _isLoading = false;
        _statusMessage = res['message'] as String;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message'] as String),
          backgroundColor: res['success'] == true ? AppTheme.greenDark : AppTheme.red,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _syncPendingQueue() async {
    final queue = _cache.getPendingLogs();
    if (queue.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không có thao tác nào đang chờ đồng bộ.'),
          backgroundColor: AppTheme.greenDark,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() {
      _isSyncing = true;
      _syncProgress = 0.0;
      _syncProgressText = 'Bắt đầu đẩy ${queue.length} tác vụ...';
    });

    final res = await _syncService.syncPendingQueue(
      onProgress: (current, total) {
        if (mounted) {
          setState(() {
            _syncProgress = current / total;
            _syncProgressText = 'Đang xử lý $current / $total tác vụ...';
          });
        }
      },
    );

    if (mounted) {
      setState(() {
        _isSyncing = false;
        _statusMessage = res['message'] as String;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message'] as String),
          backgroundColor: res['success'] == true ? AppTheme.greenDark : AppTheme.red,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _removePendingItem(int index) async {
    await _cache.removePendingLog(index);
    setState(() {});
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Đã hủy bỏ thao tác trong hàng đợi ngoại tuyến.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final stats = _cache.getCacheStats();
    final lastSync = _cache.getLastSyncTime();
    final pendingLogs = _cache.getPendingLogs();

    final dateFormat = DateFormat('HH:mm - dd/MM/yyyy');
    final lastSyncStr = lastSync != null ? dateFormat.format(lastSync) : 'Chưa đồng bộ lần nào';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF064E3B),
        title: const Text('Chế Độ Ngoại Tuyến (Offline Hub)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Làm mới',
            onPressed: _refreshStats,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Status Banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F172A), Color(0xFF1E293B), Color(0xFF064E3B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 10, offset: const Offset(0, 4)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: pendingLogs.isNotEmpty ? Colors.amber.withOpacity(0.2) : const Color(0xFF10B981).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              pendingLogs.isNotEmpty ? Icons.cloud_queue_rounded : Icons.cloud_done_rounded,
                              color: pendingLogs.isNotEmpty ? Colors.amberAccent : const Color(0xFF10B981),
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                pendingLogs.isNotEmpty ? 'CÓ ${pendingLogs.length} TÁC VỤ CHỜ ĐẨY' : 'SẴN SÀNG LÀM VIỆC NGOẠI TUYẾN',
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13.5),
                              ),
                              Text(
                                'Lần lưu cuối: $lastSyncStr',
                                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11.5),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Divider(color: Colors.white12),
                  const SizedBox(height: 6),
                  const Text(
                    '💡 Ứng dụng tự động lưu trữ thông tin trang trại, cây trồng, vật tư để bạn có thể xem hồ sơ và ghi nhật ký bình thường khi ở giữa vườn/rẫy không có sóng 4G.',
                    style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 12, height: 1.4),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // 2. Pre-cache Action Button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                onPressed: _isLoading || _isSyncing ? null : _downloadAllData,
                icon: _isLoading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.download_for_offline_rounded, size: 22),
                label: Text(
                  _isLoading ? 'Đang tải dữ liệu...' : 'TẢI DỮ LIỆU ĐỂ ĐI RẪY (PRE-CACHE)',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 2,
                ),
              ),
            ),
            const SizedBox(height: 20),

            // 3. Cache Storage Stats 2x2 Grid
            const Text(
              'DỮ LIỆU ĐÃ LƯU TRÊN BỘ NHỚ THIẾT BỊ',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
            ),
            const SizedBox(height: 10),

            Row(
              children: [
                Expanded(
                  child: _buildStatCard(
                    icon: Icons.home_work_rounded,
                    color: AppTheme.greenDark,
                    bgColor: AppTheme.greenLight,
                    title: 'Trang Trại',
                    count: '${stats['farms']} vườn',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildStatCard(
                    icon: Icons.park_rounded,
                    color: AppTheme.blue,
                    bgColor: AppTheme.blueLight,
                    title: 'Cây Trồng',
                    count: '${stats['plants']} cây',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildStatCard(
                    icon: Icons.history_edu_rounded,
                    color: AppTheme.amber,
                    bgColor: AppTheme.amberLight,
                    title: 'Nhật Ký Đã Lưu',
                    count: '${stats['logs']} bản ghi',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildStatCard(
                    icon: Icons.inventory_2_rounded,
                    color: const Color(0xFF7C3AED),
                    bgColor: const Color(0xFFF3E8FF),
                    title: 'Kho Vật Tư',
                    count: '${stats['supplies']} loại',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // 4. Pending Sync Queue Section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Text(
                      'HÀNG ĐỢI CHỜ ĐỒNG BỘ',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: pendingLogs.isNotEmpty ? AppTheme.amberLight : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${pendingLogs.length}',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.bold,
                          color: pendingLogs.isNotEmpty ? AppTheme.amber : AppTheme.textMuted,
                        ),
                      ),
                    ),
                  ],
                ),
                if (pendingLogs.isNotEmpty)
                  TextButton.icon(
                    onPressed: _isSyncing ? null : _syncPendingQueue,
                    icon: _isSyncing
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.sync_rounded, size: 18),
                    label: const Text('Đồng bộ ngay', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5)),
                  ),
              ],
            ),
            const SizedBox(height: 8),

            if (_isSyncing) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.green.withOpacity(0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_syncProgressText, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
                        Text('${(_syncProgress * 100).toStringAsFixed(0)}%', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    LinearProgressProgressIndicator(
                      value: _syncProgress,
                      backgroundColor: const Color(0xFFE2E8F0),
                      color: AppTheme.greenDark,
                      minHeight: 6,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            if (pendingLogs.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.grayBorder),
                ),
                child: Column(
                  children: [
                    Icon(Icons.check_circle_outline_rounded, size: 36, color: AppTheme.green.withOpacity(0.8)),
                    const SizedBox(height: 8),
                    const Text('Hàng đợi trống · Toàn bộ dữ liệu đã được cập nhật đồng bộ.', style: TextStyle(color: AppTheme.textMuted, fontSize: 12.5)),
                  ],
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: pendingLogs.length,
                itemBuilder: (ctx, idx) {
                  final log = pendingLogs[idx];
                  final logType = log['logType'] as String? ?? 'Chăm sóc';
                  final treeCode = log['treeCode'] as String? ?? 'Cây #${log['plantId']}';
                  final note = log['note'] as String? ?? '';
                  final timestamp = log['timestamp'] as String? ?? '';
                  final timeStr = timestamp.isNotEmpty ? dateFormat.format(DateTime.tryParse(timestamp) ?? DateTime.now()) : '';

                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.edit_note_rounded, color: Color(0xFFD97706), size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    logType,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF0F172A)),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    '($treeCode)',
                                    style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                  ),
                                ],
                              ),
                              if (note.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  note,
                                  style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                              const SizedBox(height: 3),
                              Text(
                                'Tạo lúc: $timeStr',
                                style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline_rounded, color: AppTheme.red, size: 20),
                          tooltip: 'Hủy bỏ',
                          onPressed: () => _removePendingItem(idx),
                        ),
                      ],
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required IconData icon,
    required Color color,
    required Color bgColor,
    required String title,
    required String count,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.grayBorder),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 6, offset: const Offset(0, 2)),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(count, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.bold, color: AppTheme.textMain), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text(title, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class LinearProgressProgressIndicator extends StatelessWidget {
  final double value;
  final Color backgroundColor;
  final Color color;
  final double minHeight;
  final BorderRadius borderRadius;

  const LinearProgressProgressIndicator({
    super.key,
    required this.value,
    required this.backgroundColor,
    required this.color,
    required this.minHeight,
    required this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: borderRadius,
      child: LinearProgressIndicator(
        value: value,
        backgroundColor: backgroundColor,
        valueColor: AlwaysStoppedAnimation<Color>(color),
        minHeight: minHeight,
      ),
    );
  }
}