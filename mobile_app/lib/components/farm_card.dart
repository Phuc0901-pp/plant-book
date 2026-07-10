import 'package:flutter/material.dart';
import '../models/farm.dart';
import '../utils/theme.dart';

class FarmCard extends StatelessWidget {
  final Farm farm;
  final VoidCallback? onTap;

  const FarmCard({
    super.key,
    required this.farm,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final areaString = farm.area != null 
        ? '${farm.area!.toStringAsFixed(0)} m²' 
        : '0 m²';

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppTheme.grayBorder, width: 1),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.home_work_rounded,
                    color: AppTheme.greenDark,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      farm.name,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textMain,
                      ),
                    ),
                  ),
                ],
              ),
              if (farm.description != null && farm.description!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  farm.description!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppTheme.textMuted,
                  ),
                ),
              ],
              const SizedBox(height: 12),
              const Divider(color: AppTheme.grayBorder, height: 1),
              const SizedBox(height: 12),
              Row(
                children: [
                  _infoItem(Icons.aspect_ratio_rounded, areaString),
                  const SizedBox(width: 24),
                  _infoItem(Icons.nature_rounded, '${farm.plantCount ?? 0} cây'),
                ],
              )
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoItem(IconData icon, String value) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppTheme.textMuted),
        const SizedBox(width: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppTheme.textMain,
          ),
        ),
      ],
    );
  }
}
