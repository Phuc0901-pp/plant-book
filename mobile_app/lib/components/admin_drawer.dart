import 'package:flutter/material.dart';
import '../utils/theme.dart';
import '../pages/admin/admin_dashboard_page.dart';
import '../pages/admin/admin_user_page.dart';
import '../pages/admin/admin_gis_page.dart';
import '../pages/admin/admin_plant_page.dart';
import '../pages/admin/admin_device_page.dart';
import '../pages/admin/admin_schema_page.dart';
import '../pages/admin/admin_cost_page.dart';
import '../pages/admin/admin_database_page.dart';
import '../pages/admin/admin_media_page.dart';
import '../pages/login_page.dart';

class AdminDrawer extends StatelessWidget {
  final String activeRoute;

  const AdminDrawer({super.key, required this.activeRoute});

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: const Color(0xFF0F172A),
      child: Column(
        children: [
          // Admin Profile Header
          Container(
            padding: const EdgeInsets.only(top: 50, bottom: 20, left: 20, right: 20),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF064E3B), Color(0xFF047857)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 8, offset: const Offset(0, 3))
                    ],
                  ),
                  child: Image.asset(
                    'assets/images/logo.png',
                    height: 28,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(Icons.eco_rounded, color: AppTheme.green, size: 28),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text('TANBAO AgTech', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                      SizedBox(height: 2),
                      Text('Hệ thống Quản trị Enterprise', style: TextStyle(color: Colors.white70, fontSize: 11)),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // 9 Admin Modules Menu List
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
              children: [
                _drawerSectionTitle('TỔNG QUAN & BẢN ĐỒ'),
                _drawerItem(context, Icons.dashboard_rounded, 'Dashboard Overview', 'dashboard', const AdminDashboardPage()),
                _drawerItem(context, Icons.map_rounded, 'Quản lý GIS Trang trại', 'gis', const AdminGisPage()),

                _drawerSectionTitle('QUẢN LÝ NÔNG HỘ & CÂY TRỒNG'),
                _drawerItem(context, Icons.people_rounded, 'Quản lý Nông hộ & PRO', 'users', const AdminUserPage()),
                _drawerItem(context, Icons.eco_rounded, 'Danh sách Cây trồng', 'plants', const AdminPlantPage()),

                _drawerSectionTitle('IOT & CƠ SỞ DỮ LIỆU'),
                _drawerItem(context, Icons.sensors_rounded, 'Cảm biến IoT 3 tầng đất', 'devices', const AdminDevicePage()),
                _drawerItem(context, Icons.storage_rounded, 'CSDL & Redis Telemetry', 'database', const AdminDatabasePage()),

                _drawerSectionTitle('TÀI CHÍNH & TIÊU CHUẨN'),
                _drawerItem(context, Icons.tune_rounded, 'Cấu hình Schemas & VietGAP', 'schemas', const AdminSchemaPage()),
                _drawerItem(context, Icons.attach_money_rounded, 'Quản trị Chi phí Đầu tư', 'cost', const AdminCostPage()),
                _drawerItem(context, Icons.photo_library_rounded, 'Thư viện Media & Quét AI', 'media', const AdminMediaPage()),
              ],
            ),
          ),

          // Brand Signature Footer
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Colors.white12)),
            ),
            child: Column(
              children: [
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.logout_rounded, color: Colors.redAccent, size: 20),
                  title: const Text('Đăng xuất khỏi Admin', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 13)),
                  onTap: () {
                    Navigator.pushAndRemoveUntil(
                      context,
                      MaterialPageRoute(builder: (_) => const LoginPage()),
                      (route) => false,
                    );
                  },
                ),
                const SizedBox(height: 6),
                const Text(
                  'Sổ Nông Tân Bảo · Bản quyền © 2026 TBSG Agtech',
                  style: TextStyle(color: Colors.white54, fontSize: 10.5, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _drawerSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 12, top: 12, bottom: 6),
      child: Text(
        title,
        style: const TextStyle(color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.8),
      ),
    );
  }

  Widget _drawerItem(BuildContext context, IconData icon, String label, String routeKey, Widget targetPage) {
    final bool isActive = activeRoute == routeKey;
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        color: isActive ? AppTheme.green.withOpacity(0.2) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        border: isActive ? Border.all(color: AppTheme.green.withOpacity(0.4)) : null,
      ),
      child: ListTile(
        dense: true,
        leading: Icon(icon, color: isActive ? AppTheme.green : Colors.white70, size: 20),
        title: Text(
          label,
          style: TextStyle(
            color: isActive ? Colors.white : Colors.white70,
            fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
            fontSize: 13,
          ),
        ),
        onTap: () {
          Navigator.pop(context); // Close drawer
          if (!isActive) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => targetPage),
            );
          }
        },
      ),
    );
  }
}
