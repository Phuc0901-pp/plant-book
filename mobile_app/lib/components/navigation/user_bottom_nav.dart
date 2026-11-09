import 'package:flutter/material.dart';
import '../../core/theme/fluent_icons.dart';
import '../../utils/theme.dart';

class UserBottomNav extends StatelessWidget {
  final int currentIndex;
  final Function(int) onTap;

  const UserBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.96),
        border: const Border(
          top: BorderSide(color: AppTheme.fluentBorder, width: 0.8),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0C0F172A),
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(0, LucideIconName.sprout, 'Tổng quan'),
              _buildNavItem(1, LucideIconName.tree, 'Vùng trồng'),
              _buildNavItem(2, LucideIconName.fileText, 'Nhật ký'),
              _buildNavItem(3, LucideIconName.package, 'Kho vật tư'),
              _buildNavItem(4, LucideIconName.settings, 'Cài đặt'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, LucideIconName icon, String label) {
    final bool isSelected = currentIndex == index;
    final Color activeColor = AppTheme.fluentEmerald;
    final Color inactiveColor = AppTheme.fluentTextMuted;

    return Expanded(
      child: InkWell(
        onTap: () => onTap(index),
        borderRadius: BorderRadius.circular(16),
        splashColor: AppTheme.mintPastel.withOpacity(0.5),
        highlightColor: Colors.transparent,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                decoration: BoxDecoration(
                  color: isSelected ? AppTheme.mintPastel : Colors.transparent,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: LucideIcon(
                  icon,
                  size: 20,
                  color: isSelected ? activeColor : inactiveColor,
                  strokeWidth: isSelected ? 2.2 : 1.8,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected ? activeColor : inactiveColor,
                  letterSpacing: -0.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
