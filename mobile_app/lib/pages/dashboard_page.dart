import 'package:flutter/material.dart';
import '../components/navigation/user_bottom_nav.dart';
import '../core/theme/app_theme.dart';
import 'user/user_dashboard_page.dart';
import 'user/user_farm_detail_page.dart';
import 'user/user_supplies_page.dart';
import 'user/user_logs_page.dart';
import 'settings_page.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  int _currentIndex = 0;

  void _onTabTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    switch (_currentIndex) {
      case 0:
        body = UserDashboardPage(onNavigateTab: _onTabTapped);
        break;
      case 1:
        body = const UserFarmDetailPage();
        break;
      case 2:
        body = const UserSuppliesPage();
        break;
      case 3:
        body = const UserLogsPage();
        break;
      case 4:
        body = const SettingsPage();
        break;
      default:
        body = UserDashboardPage(onNavigateTab: _onTabTapped);
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Image.asset(
                'assets/images/logo.png',
                height: 24,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Icon(Icons.eco_rounded, color: AppTheme.green, size: 24),
              ),
            ),
            const SizedBox(width: 10),
            const Text('Sổ Nông Điện Tử', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_active_rounded, color: Colors.amber),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('🔔 Hệ thống Thông báo tự chủ & Cảnh báo khẩn đã kích hoạt!'), backgroundColor: AppTheme.green),
              );
            },
          ),
        ],
      ),
      body: body,
      bottomNavigationBar: UserBottomNav(
        currentIndex: _currentIndex,
        onTap: _onTabTapped,
      ),
    );
  }
}
