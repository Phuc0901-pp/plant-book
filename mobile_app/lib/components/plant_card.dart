import 'package:flutter/material.dart';
import '../models/plant.dart';
import '../utils/theme.dart';
import '../core/theme/fluent_icons.dart';

class PlantCard extends StatelessWidget {
  final Plant plant;
  final VoidCallback? onTap;
  final VoidCallback? onLogTap;
  final VoidCallback? onNfcTap;

  const PlantCard({
    super.key,
    required this.plant,
    this.onTap,
    this.onLogTap,
    this.onNfcTap,
  });

  @override
  Widget build(BuildContext context) {
    // Health status badge color config (Fluent 2 Pastels)
    Color badgeBg;
    Color badgeText;
    String badgeLabel = plant.healthStatus;

    if (plant.healthStatus.toLowerCase().contains('tốt') || plant.healthStatus.toLowerCase().contains('khỏe')) {
      badgeBg = AppTheme.mintPastel;
      badgeText = AppTheme.mintText;
    } else if (plant.healthStatus.toLowerCase().contains('chú ý')) {
      badgeBg = AppTheme.butterPastel;
      badgeText = AppTheme.butterText;
    } else if (plant.healthStatus.toLowerCase().contains('bệnh')) {
      badgeBg = AppTheme.rosePastel;
      badgeText = AppTheme.roseText;
    } else {
      badgeBg = AppTheme.skyPastel;
      badgeText = AppTheme.skyText;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.fluentBorder, width: 0.8),
        boxShadow: AppTheme.fluentShadow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Left: Plant Squircle Avatar
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppTheme.mintPastel,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: const LucideIcon(
                    LucideIconName.sprout,
                    size: 22,
                    color: AppTheme.fluentEmerald,
                  ),
                ),
                const SizedBox(width: 12),

                // Center: Plant Info
                Expanded(
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
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w800,
                                  color: AppTheme.fluentTextMain,
                                  letterSpacing: -0.2,
                                ),
                              ),
                              if (plant.nfcUid != null) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppTheme.skyPastel,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: const [
                                      LucideIcon(LucideIconName.tag, size: 10, color: AppTheme.skyText),
                                      SizedBox(width: 2),
                                      Text(
                                        'NFC',
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w800,
                                          color: AppTheme.skyText,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                          // Status Badge
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: badgeBg,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              badgeLabel,
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: badgeText,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),

                      Text(
                        '${plant.plantType}${plant.plantVariety != null && plant.plantVariety!.isNotEmpty ? " · ${plant.plantVariety}" : ""}',
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.fluentTextSecondary,
                        ),
                      ),
                      const SizedBox(height: 6),

                      Row(
                        children: [
                          const LucideIcon(LucideIconName.mapPin, size: 12, color: AppTheme.fluentTextMuted),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              plant.location ?? 'Vườn Nông hộ',
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppTheme.fluentTextMuted,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (plant.plantAge != null) ...[
                            const SizedBox(width: 8),
                            Text(
                              '${plant.plantAge} năm tuổi',
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppTheme.fluentTextMuted,
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Bottom 1-Touch Action Bar
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          if (onNfcTap != null)
                            InkWell(
                              onTap: onNfcTap,
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF3F2F1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(
                                  children: const [
                                    LucideIcon(LucideIconName.scan, size: 12, color: AppTheme.fluentTextMuted),
                                    SizedBox(width: 4),
                                    Text('Ghi NFC', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.fluentTextMain)),
                                  ],
                                ),
                              ),
                            ),
                          if (onLogTap != null) ...[
                            const SizedBox(width: 6),
                            InkWell(
                              onTap: onLogTap,
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppTheme.mintPastel,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(
                                  children: const [
                                    LucideIcon(LucideIconName.edit, size: 12, color: AppTheme.mintText),
                                    SizedBox(width: 4),
                                    Text('Ghi nhật ký', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.mintText)),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
