import 'package:flutter/material.dart';
import '../models/plant.dart';
import '../utils/theme.dart';

class PlantCard extends StatelessWidget {
  final Plant plant;
  final VoidCallback? onLogTap;
  final VoidCallback? onNfcTap;

  const PlantCard({
    super.key,
    required this.plant,
    this.onLogTap,
    this.onNfcTap,
  });

  @override
  Widget build(BuildContext context) {
    // Health status badge color config
    Color badgeBg;
    Color badgeText;
    
    switch (plant.healthStatus) {
      case 'Tốt':
        badgeBg = const Color(0xFFDCFCE7);
        badgeText = const Color(0xFF15803D);
        break;
      case 'Cần chú ý':
        badgeBg = const Color(0xFFFEF3C7);
        badgeText = const Color(0xFFB45309);
        break;
      case 'Bệnh':
        badgeBg = const Color(0xFFFEE2E2);
        badgeText = const Color(0xFFB91C1C);
        break;
      default:
        badgeBg = const Color(0xFFEFF6FF);
        badgeText = const Color(0xFF1D4ED8);
    }

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
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text(
                      'Cây #${plant.displayName}',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textMain,
                      ),
                    ),
                    if (plant.nfcUid != null) ...[
                      const SizedBox(width: 6),
                      const Icon(Icons.tag_rounded, size: 16, color: AppTheme.green),
                    ],
                  ],
                ),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: badgeBg,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: badgeText.withOpacity(0.2), width: 1),
                      ),
                      child: Text(
                        plant.healthStatus,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: badgeText,
                        ),
                      ),
                    ),
                    PopupMenuButton<String>(
                      icon: const Icon(Icons.more_vert_rounded, color: AppTheme.textMuted),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onSelected: (value) {
                        if (value == 'log' && onLogTap != null) {
                          onLogTap!();
                        } else if (value == 'nfc' && onNfcTap != null) {
                          onNfcTap!();
                        }
                      },
                      itemBuilder: (context) => [
                        const PopupMenuItem(
                          value: 'log',
                          child: Row(
                            children: [
                              Icon(Icons.edit_note_rounded, size: 20, color: AppTheme.green),
                              SizedBox(width: 8),
                              Text('Ghi nhật ký'),
                            ],
                          ),
                        ),
                        const PopupMenuItem(
                          value: 'nfc',
                          child: Row(
                            children: [
                              Icon(Icons.tag_rounded, size: 20, color: Colors.blue),
                              SizedBox(width: 8),
                              Text('Định danh NFC'),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.eco_rounded, size: 14, color: AppTheme.textMuted),
                const SizedBox(width: 6),
                Text(
                  plant.plantType,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                ),
                if (plant.plantVariety != null && plant.plantVariety!.isNotEmpty) ...[
                  const SizedBox(width: 4),
                  Text(
                    '(${plant.plantVariety})',
                    style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                  ),
                ]
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.calendar_today_rounded, size: 14, color: AppTheme.textMuted),
                const SizedBox(width: 6),
                Text(
                  'Tuổi cây: ${plant.plantAge ?? '—'} năm',
                  style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.location_on_rounded, size: 14, color: AppTheme.textMuted),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Vị trí: ${plant.location ?? '—'}',
                    style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
