import 'package:flutter/material.dart';
import '../models/plant.dart';
import '../utils/theme.dart';

class PlantCard extends StatelessWidget {
  final Plant plant;
  final VoidCallback? onLogTap;

  const PlantCard({
    super.key,
    required this.plant,
    this.onLogTap,
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
                Text(
                  'Cây #${plant.displayName}',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textMain,
                  ),
                ),
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
            if (onLogTap != null) ...[
              const SizedBox(height: 12),
              const Divider(color: AppTheme.grayBorder, height: 1),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: onLogTap,
                  icon: const Icon(Icons.edit_note_rounded, size: 18),
                  label: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ) == null ? const Text('Ghi nhật ký') : const Text('Ghi nhật ký'),
                  style: TextButton.styleFrom(
                    foregroundColor: AppTheme.userAccent,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  ),
                ),
              )
            ]
          ],
        ),
      ),
    );
  }
}
