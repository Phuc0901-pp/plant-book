import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class ProUpgradeModal extends StatelessWidget {
  final String featureName;

  const ProUpgradeModal({super.key, required this.featureName});

  static void show(BuildContext context, String featureName) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => ProUpgradeModal(featureName: featureName),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.amber.shade200),
            ),
            child: const Icon(Icons.workspace_premium_rounded, color: Colors.amber, size: 40),
          ),
          const SizedBox(height: 14),
          const Text(
            '👑 Kích hoạt Tính năng Nông hộ PRO',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Tài khoản NORMAL quản lý theo quy mô Toàn Vườn. Tính năng $featureName dành riêng cho Nông hộ PRO.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              color: AppTheme.textMuted,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 20),

          // Feature list preview
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppTheme.grayBorder),
            ),
            child: Column(
              children: const [
                _FeatureRow(icon: Icons.sensors_rounded, text: 'Mở khóa Cảm biến Đất 3 Tầng (10cm, 20cm, 30cm)'),
                SizedBox(height: 8),
                _FeatureRow(icon: Icons.picture_as_pdf_rounded, text: 'Xuất Báo cáo VietGAP 1-Chạm có mã QR'),
                SizedBox(height: 8),
                _FeatureRow(icon: Icons.qr_code_scanner_rounded, text: 'Quản lý riêng từng cây & Mã QR/NFC từng gốc'),
              ],
            ),
          ),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('⚡ Đã gửi yêu cầu Nâng cấp PRO tới Admin! Admin sẽ phê duyệt trong giây lát.'),
                    backgroundColor: AppTheme.green,
                  ),
                );
              },
              icon: const Icon(Icons.star_rounded, size: 18),
              label: const Text('Gửi Yêu cầu Nâng cấp PRO 👑'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.greenDark,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  final IconData icon;
  final String text;

  const _FeatureRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppTheme.green),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
          ),
        ),
      ],
    );
  }
}
