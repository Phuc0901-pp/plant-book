import 'dart:async';
import 'package:flutter/material.dart';
import '../models/plant.dart';
import '../models/plant_log.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import '../utils/theme.dart';
import '../components/loading_indicator.dart';
import '../components/log_edit_dialog.dart';
import '../components/audit_history_view.dart';
import '../components/video_player_view.dart';

class PlantDetailPage extends StatefulWidget {
  final Plant plant;

  const PlantDetailPage({super.key, required this.plant});

  @override
  State<PlantDetailPage> createState() => _PlantDetailPageState();
}

class _PlantDetailPageState extends State<PlantDetailPage> {
  final ApiService _apiService = ApiService();
  StreamSubscription? _wsSubscription;
  bool _isLoading = true;
  List<PlantLog> _logs = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadLogs();

    // Listen to real-time events to reload logs
    _wsSubscription = WebSocketService().stream.listen((event) {
      final ev = event['event'];
      if (ev == 'plants_updated' || ev == 'new_care_log') {
        if (mounted) _loadLogs();
      }
    });
  }

  @override
  void dispose() {
    _wsSubscription?.cancel();
    super.dispose();
  }

  Future<void> _loadLogs() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final logs = await _apiService.fetchPlantLogs(widget.plant.id);
      setState(() {
        _logs = logs;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Không thể tải nhật ký chăm sóc cây.';
        _isLoading = false;
      });
    }
  }

  void _openAddLogDialog() {
    showDialog<bool>(
      context: context,
      builder: (context) => LogEditDialog(
        plantIds: [widget.plant.id],
        farmName: widget.plant.farmName,
      ),
    ).then((success) {
      if (success == true) {
        _loadLogs();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã thêm nhật ký chăm sóc mới!'), backgroundColor: AppTheme.green),
        );
      }
    });
  }

  void _openEditLogDialog(PlantLog log) {
    showDialog<bool>(
      context: context,
      builder: (context) => LogEditDialog(
        plantIds: [widget.plant.id],
        log: log,
        farmName: widget.plant.farmName,
      ),
    ).then((success) {
      if (success == true) {
        _loadLogs();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã cập nhật nhật ký chăm sóc và lưu vết lịch sử!'), backgroundColor: AppTheme.userAccent),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    Color healthColor;
    if (widget.plant.healthStatus == 'Tốt') {
      healthColor = AppTheme.green;
    } else if (widget.plant.healthStatus == 'Cần chú ý') {
      healthColor = AppTheme.amber;
    } else {
      healthColor = AppTheme.red;
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('Chi tiết Cây #${widget.plant.displayName}'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadLogs,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Plant Info Card
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
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            widget.plant.plantType,
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textMain),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: healthColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: healthColor.withOpacity(0.3)),
                            ),
                            child: Text(
                              widget.plant.healthStatus,
                              style: TextStyle(color: healthColor, fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                          )
                        ],
                      ),
                      if (widget.plant.plantVariety != null && widget.plant.plantVariety!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Giống cây: ${widget.plant.plantVariety}',
                          style: const TextStyle(fontSize: 14, color: AppTheme.textMuted),
                        ),
                      ],
                      const SizedBox(height: 12),
                      const Divider(color: AppTheme.grayBorder),
                      const SizedBox(height: 12),
                      _infoRow(Icons.calendar_today_rounded, 'Tuổi cây', '${widget.plant.plantAge ?? '—'} năm'),
                      const SizedBox(height: 8),
                      _infoRow(Icons.location_on_rounded, 'Vị trí', widget.plant.location ?? '—'),
                      const SizedBox(height: 8),
                      _infoRow(Icons.water_drop_rounded, 'Lần tưới gần nhất', widget.plant.lastWatered ?? 'Chưa ghi nhận'),
                      const SizedBox(height: 8),
                      _infoRow(Icons.opacity_rounded, 'Lần bón phân gần nhất', widget.plant.lastFertilized ?? 'Chưa ghi nhận'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              
              // 2. Logs header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Nhật ký chăm sóc',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textMain),
                  ),
                  ElevatedButton.icon(
                    onPressed: _openAddLogDialog,
                    icon: const Icon(Icons.add_rounded, size: 16),
                    label: const Text('Ghi nhật ký', style: TextStyle(fontSize: 12)),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    ),
                  )
                ],
              ),
              const SizedBox(height: 12),
              
              // 3. Logs List
              _isLoading
                  ? const SizedBox(
                      height: 150,
                      child: LoadingIndicator(message: 'Tải lịch sử nhật ký...'),
                    )
                  : _error != null
                      ? Container(
                          padding: const EdgeInsets.symmetric(vertical: 24),
                          alignment: Alignment.center,
                          child: Text(_error!, style: const TextStyle(color: AppTheme.red)),
                        )
                      : _logs.isEmpty
                          ? Container(
                              padding: const EdgeInsets.symmetric(vertical: 40),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: AppTheme.grayBorder),
                              ),
                              alignment: Alignment.center,
                              child: const Column(
                                children: [
                                  Icon(Icons.edit_note_rounded, size: 48, color: AppTheme.textMuted),
                                  SizedBox(height: 8),
                                  Text(
                                    'Chưa có nhật ký nào cho cây này.',
                                    style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                                  ),
                                ],
                              ),
                            )
                          : ListView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _logs.length,
                              itemBuilder: (context, index) {
                                final log = _logs[index];
                                final detailVal = _formatLogDetails(log.logType, log.details);

                                return Card(
                                  elevation: 0,
                                  margin: const EdgeInsets.only(bottom: 12),
                                  color: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    side: const BorderSide(color: AppTheme.grayBorder, width: 1),
                                  ),
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        // Header: Type + Date + Edit Button
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Row(
                                              children: [
                                                Container(
                                                  padding: const EdgeInsets.all(6),
                                                  decoration: BoxDecoration(
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
                                        const SizedBox(height: 12),
                                        
                                        // Detail values
                                        if (detailVal.isNotEmpty) ...[
                                          Text(
                                            'Chi tiết: $detailVal',
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                          ),
                                          const SizedBox(height: 4),
                                        ],
                                        
                                        // Notes
                                        if (log.note != null && log.note!.isNotEmpty) ...[
                                          Text(
                                            'Ghi chú: ${log.note}',
                                            style: const TextStyle(fontSize: 13, color: AppTheme.textMain),
                                          ),
                                          const SizedBox(height: 8),
                                        ],

                                        // Photos/Videos display
                                        if (log.mediaUrls.isNotEmpty) ...[
                                          const SizedBox(height: 4),
                                          SizedBox(
                                            height: 72,
                                            child: ListView.builder(
                                              scrollDirection: Axis.horizontal,
                                              itemCount: log.mediaUrls.length,
                                              itemBuilder: (context, index) {
                                                final url = log.mediaUrls[index];
                                                final isVideo = url.toLowerCase().endsWith('.mp4') || url.toLowerCase().contains('/video/');
                                                return GestureDetector(
                                                  onTap: () {
                                                    if (isVideo) {
                                                      Navigator.push(
                                                        context,
                                                        MaterialPageRoute(
                                                          builder: (_) => VideoPlayerWebviewPage(videoUrl: url),
                                                        ),
                                                      );
                                                    } else {
                                                      showDialog(
                                                        context: context,
                                                        builder: (context) => Dialog(
                                                          backgroundColor: Colors.transparent,
                                                          child: Stack(
                                                            alignment: Alignment.center,
                                                            children: [
                                                              InteractiveViewer(
                                                                child: Image.network(url, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, size: 100, color: Colors.white)),
                                                              ),
                                                              Positioned(
                                                                top: 10,
                                                                right: 10,
                                                                child: CircleAvatar(
                                                                  backgroundColor: Colors.black54,
                                                                  child: IconButton(
                                                                    icon: const Icon(Icons.close, color: Colors.white),
                                                                    onPressed: () => Navigator.pop(context),
                                                                  ),
                                                                ),
                                                              ),
                                                            ],
                                                          ),
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
                                                      border: Border.all(color: AppTheme.grayBorder),
                                                      image: isVideo
                                                          ? null
                                                          : DecorationImage(
                                                              image: NetworkImage(url),
                                                              fit: BoxFit.cover,
                                                            ),
                                                    ),
                                                    child: isVideo
                                                        ? const Center(
                                                            child: Icon(Icons.play_circle_fill_rounded, size: 32, color: AppTheme.green),
                                                          )
                                                        : null,
                                                  ),
                                                );
                                              },
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                        ],
                                        
                                        // Action buttons
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.end,
                                          children: [
                                            TextButton.icon(
                                              onPressed: () => _openEditLogDialog(log),
                                              icon: const Icon(Icons.edit_rounded, size: 14),
                                              label: const Text('Sửa nhật ký', style: TextStyle(fontSize: 12)),
                                              style: TextButton.styleFrom(
                                                foregroundColor: AppTheme.userAccent,
                                                padding: EdgeInsets.zero,
                                              ),
                                            )
                                          ],
                                        ),
                                        
                                        // Audit History Timeline
                                        if (log.editHistory.isNotEmpty)
                                          AuditHistoryView(history: log.editHistory),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            )
            ],
          ),
        ),
      ),
    );
  }

  String _formatLogDetails(String logType, Map<String, dynamic> details) {
    if (details.isEmpty) return '';
    final List<String> parts = [];
    
    if (logType == 'Tưới nước') {
      final method = details['method'];
      final amount = details['amount'];
      if (method != null && method.toString().isNotEmpty) parts.add('Cách tưới: $method');
      if (amount != null) parts.add('Lượng nước: $amount lít');
    } else if (logType == 'Bón phân') {
      final name = details['fertilizer_name'];
      final amount = details['amount'];
      final unit = details['unit'] ?? 'kg';
      if (name != null && name.toString().isNotEmpty) parts.add('Loại phân: $name');
      if (amount != null) parts.add('Lượng bón: $amount $unit');
    } else if (logType == 'Phun thuốc') {
      final name = details['pesticide_name'];
      final amount = details['amount'];
      final unit = details['unit'] ?? 'lít';
      if (name != null && name.toString().isNotEmpty) parts.add('Loại thuốc: $name');
      if (amount != null) parts.add('Lượng phun: $amount $unit');
    } else if (logType == 'Bệnh cây') {
      final name = details['disease_name'];
      final severity = details['severity'];
      final desc = details['description'];
      if (name != null && name.toString().isNotEmpty) parts.add('Tên bệnh: $name');
      if (severity != null && severity.toString().isNotEmpty) parts.add('Mức độ: $severity');
      if (desc != null && desc.toString().isNotEmpty) parts.add('Mô tả: $desc');
    } else if (logType == 'Tỉa cành/lá' || logType == 'Tỉa quả/hoa') {
      final reason = details['reason'];
      final amount = details['amount'];
      if (reason != null && reason.toString().isNotEmpty) parts.add('Lý do: $reason');
      if (amount != null && amount != 0) parts.add('Số lượng: $amount');
    } else {
      final val = details['value'] ?? details['method'] ?? details['fertilizer'] ?? details['pesticide'] ?? details['reason'] ?? details['disease'];
      if (val != null) parts.add('$val');
    }
    return parts.join(' | ');
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppTheme.textMuted),
        const SizedBox(width: 8),
        Text('$label: ', style: const TextStyle(fontSize: 13, color: AppTheme.textMuted)),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textMain),
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
        return Icons.content_cut_rounded;
      case 'Tỉa quả/hoa':
        return Icons.grain_rounded;
      case 'Bệnh cây':
        return Icons.error_outline_rounded;
      default:
        return Icons.edit_note_rounded;
    }
  }
}
