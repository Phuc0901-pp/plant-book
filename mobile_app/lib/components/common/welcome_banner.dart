import 'package:flutter/material.dart';
import '../../core/theme/fluent_icons.dart';
import '../../utils/theme.dart';
import '../../pages/ai_chat_page.dart';

class WelcomeBanner extends StatelessWidget {
  final String userName;
  final String? accountTier;

  const WelcomeBanner({
    super.key,
    required this.userName,
    this.accountTier,
  });

  @override
  Widget build(BuildContext context) {
    final bool isPro = accountTier == 'pro';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color(0xFFE6F4EA), // Mint pastel
            Color(0xFFF0FDF4),
            Color(0xFFFEF9C3), // Warm butter sunshine
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFCEEAD6), width: 0.8),
        boxShadow: AppTheme.fluentShadow,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Left: Friendly Greeting & Live Chibi Weather Pill
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Top Weather Pill & Account Badge
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.88),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: const [
                          BoxShadow(color: Color(0x080F172A), blurRadius: 4, offset: Offset(0, 1))
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          ChibiWeatherWidget(type: ChibiWeatherType.sun, size: 16),
                          SizedBox(width: 4),
                          Text(
                            '29°C · Nắng đẹp · Ẩm 68%',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF107C41),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isPro ? const Color(0xFFFEF08A) : Colors.white.withOpacity(0.85),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isPro ? const Color(0xFFFACC15) : const Color(0xFFE2E8F0),
                          width: 0.8,
                        ),
                      ),
                      child: Text(
                        isPro ? 'PRO 👑' : 'NORMAL',
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                          color: isPro ? const Color(0xFF854D0E) : AppTheme.fluentTextMuted,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Main Greeting Text
                Text(
                  'Xin chào, $userName 👋',
                  style: const TextStyle(
                    color: Color(0xFF0F3D23),
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Vườn cây đang phát triển rất tốt. Chúc bạn một ngày canh tác hiệu quả!',
                  style: TextStyle(
                    color: Color(0xFF2E5A40),
                    fontSize: 12,
                    height: 1.35,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 12),

          // Right: Official Mascot Bé Mầm (Tapping opens AI Chat)
          Tooltip(
            message: 'Bấm để trò chuyện với Bé Mầm AI',
            child: BeMamMascotWidget(
              size: 64,
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AiChatPage()),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
