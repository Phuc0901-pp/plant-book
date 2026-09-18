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
import '../pages/admin/admin_audit_logs_page.dart';
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
          // Microsoft Fluent Dark Slate Header
          Container(
            padding: const EdgeInsets.only(top: 48, bottom: 18, left: 18, right: 18),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF0B132B), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              border: Border(bottom: BorderSide(color: Color(0xFF334155), width: 1.2)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.25), blurRadius: 8, offset: const Offset(0, 3))
                    ],
                  ),
                  child: Image.asset(
                    'assets/images/logo.png',
                    height: 26,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(Icons.eco_rounded, color: AppTheme.green, size: 26),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'TANBAO AgTech',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15, letterSpacing: -0.2),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: Color(0xFF10B981),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 5),
                          const Text('Admin Trực Tuyến • Pro', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10.5, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // 10 Admin Modules Navigation List
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
              children: [
                _drawerSectionTitle('TỔNG QUAN & BẢN ĐỒ'),
                _drawerItem(context, Icons.dashboard_rounded, 'Dashboard Tổng quan', 'dashboard', const AdminDashboardPage()),
                _drawerItem(context, Icons.map_rounded, 'Quản lý GIS Trang trại', 'gis', const AdminGisPage()),

                _drawerSectionTitle('QUẢN LÝ NÔNG HỘ & CÂY TRỒNG'),
                _drawerItem(context, Icons.people_alt_rounded, 'Quản lý Nông hộ & Phân quyền', 'users', const AdminUserPage()),
                _drawerItem(context, Icons.eco_rounded, 'Danh sách Cây trồng & Nhật ký', 'plants', const AdminPlantPage()),

                _drawerSectionTitle('IOT & CƠ SỞ DỮ LIỆU'),
                _drawerItem(context, Icons.sensors_rounded, 'Cảm biến IoT 3 tầng đất', 'devices', const AdminDevicePage()),
                _drawerItem(context, Icons.storage_rounded, 'CSDL & Redis Telemetry', 'database', const AdminDatabasePage()),

                _drawerSectionTitle('TÀI CHÍNH & QUY CHUẨN'),
                _drawerItem(context, Icons.tune_rounded, 'Cấu hình Schemas & VietGAP', 'schemas', const AdminSchemaPage()),
                _drawerItem(context, Icons.attach_money_rounded, 'Quản trị Chi phí & Vật tư', 'cost', const AdminCostPage()),
                _drawerItem(context, Icons.photo_library_rounded, 'Thư viện Media & Quét AI', 'media', const AdminMediaPage()),

                _drawerSectionTitle('AN NINH & AUDIT'),
                _drawerItem(context, Icons.security_rounded, 'Nhật ký An ninh & Audit Logs', 'audit_logs', const AdminAuditLogsPage()),
              ],
            ),
          ),

          // Brand Signature Footer
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: const BoxDecoration(
              color: Color(0xFF0B132B),
              border: Border(top: BorderSide(color: Color(0xFF334155), width: 1.2)),
            ),
            child: Column(
              children: [
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.logout_rounded, color: Color(0xFFF87171), size: 18),
                  title: const Text('Đăng xuất Admin', style: TextStyle(color: Color(0xFFF87171), fontWeight: FontWeight.w700, fontSize: 12.5)),
                  onTap: () {
                    Navigator.pushAndRemoveUntil(
                      context,
                      MaterialPageRoute(builder: (_) => const LoginPage()),
                      (route) => false,
                    );
                  },
                ),
                const SizedBox(height: 2),
                const Text(
                  'v1.2.4 • Enterprise Edition\nSổ Nông Tân Bảo © 2026',
                  style: TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w600, height: 1.3),
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
      padding: const EdgeInsets.only(left: 10, top: 10, bottom: 4),
      child: Text(
        title,
        style: const TextStyle(color: Color(0xFF64748B), fontSize: 9.5, fontWeight: FontWeight.w800, letterSpacing: 0.8),
      ),
    );
  }

  Widget _drawerItem(BuildContext context, IconData icon, String label, String routeKey, Widget targetPage) {
    final bool isActive = activeRoute == routeKey;
    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      decoration: BoxDecoration(
        color: isActive ? const Color(0xFF0F766E).withOpacity(0.2) : Colors.transparent,
        borderRadius: BorderRadius.circular(9),
        border: isActive ? Border.all(color: const Color(0xFF14B8A6).withOpacity(0.5)) : null,
      ),
      child: ListTile(
        dense: true,
        visualDensity: const VisualDensity(horizontal: 0, vertical: -2),
        leading: Icon(icon, color: isActive ? const Color(0xFF34D399) : const Color(0xFF94A3B8), size: 18),
        title: Text(
          label,
          style: TextStyle(
            color: isActive ? Colors.white : const Color(0xFFCBD5E1),
            fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
            fontSize: 12.5,
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

