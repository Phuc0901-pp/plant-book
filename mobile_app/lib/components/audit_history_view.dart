import 'package:flutter/material.dart';
import '../models/plant_log.dart';
import '../utils/theme.dart';

class AuditHistoryView extends StatelessWidget {
  final List<EditHistory> history;

  const AuditHistoryView({super.key, required this.history});

  String _formatDateTime(String isoStr) {
    try {
      final dt = DateTime.parse(isoStr).toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')} - ${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    } catch (e) {
      return isoStr;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (history.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        Row(
          children: [
            const Icon(Icons.history_rounded, size: 18, color: AppTheme.userAccent),
            const SizedBox(width: 8),
            Text(
              'Lịch sử chỉnh sửa (${history.length} lần)',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: AppTheme.userAccent,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: history.length,
          itemBuilder: (context, index) {
            // Reverse history to show newest edits first
            final item = history[history.length - 1 - index];
            final prev = item.previousVersion;
            
            // Format previous details value
            final prevVal = prev['details'] != null
                ? (prev['details']['value'] ?? 
                   prev['details']['method'] ?? 
                   prev['details']['fertilizer'] ?? 
                   prev['details']['pesticide'] ?? 
                   prev['details']['reason'] ?? 
                   prev['details']['disease'] ?? '—')
                : '—';

            return IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Timeline line & circle
                  Column(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: AppTheme.userAccent,
                          shape: BoxShape.circle,
                        ),
                      ),
                      Expanded(
                        child: Container(
                          width: 2,
                          color: index == history.length - 1 
                              ? Colors.transparent 
                              : AppTheme.userAccent.withOpacity(0.3),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 12),
                  
                  // Content box
                  Expanded(
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.userAccentSoft,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppTheme.userAccent.withOpacity(0.15)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                item.editedByName,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.textMain,
                                ),
                              ),
                              Text(
                                _formatDateTime(item.editedAt),
                                style: const TextStyle(
                                  fontSize: 10,
                                  color: AppTheme.textMuted,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Nội dung trước khi sửa:',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textMuted,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '• Hoạt động: ${prev['log_type'] ?? '—'} (Ngày: ${prev['log_date']?.toString().substring(0, 10) ?? '—'})',
                            style: const TextStyle(fontSize: 11, color: AppTheme.textMain),
                          ),
                          Text(
                            '• Chi tiết: $prevVal',
                            style: const TextStyle(fontSize: 11, color: AppTheme.textMain),
                          ),
                          if (prev['note'] != null && prev['note'].toString().trim().isNotEmpty)
                            Text(
                              '• Ghi chú: ${prev['note']}',
                              style: const TextStyle(fontSize: 11, color: AppTheme.textMain),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}
