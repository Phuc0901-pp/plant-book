import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/theme.dart';
import '../../components/loading_indicator.dart';
import '../login_page.dart';
import '../dashboard_page.dart';
import 'admin_user_list_page.dart';
import 'admin_device_list_page.dart';
import 'admin_schema_list_page.dart';

class AdminDashboardPage extends StatefulWidget {
  const AdminDashboardPage({super.key});

  @override
  State<AdminDashboardPage> createState() => _AdminDashboardPageState();
}

class _AdminDashboardPageState extends State<AdminDashboardPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  int _totalPlants = 0;
  int _healthyPlants = 0;
  int _watchPlants = 0;
  int _totalFarms = 0;
  int _totalUsers = 0;
  int _totalDevices = 0;

  @override
  void initState() {
    super.initState();
    _loadMetrics();
  }

  Future<void> _loadMetrics() async {
    setState(() => _isLoading = true);
    try {
      final plants = await _apiService.fetchPlants();
      final farms = await _apiService.fetchFarms();
      final users = await _apiService.fetchUsers();
      final devices = await _apiService.fetchDevices();

      int healthy = 0;
      int watch = 0;
      for (final p in plants) {
        if (p.healthStatus == 'Tốt') {
          healthy++;
        } else if (p.healthStatus == 'Cần chú ý') {
          watch++;
        }
      }

      setState(() {
        _totalPlants = plants.length;
        _healthyPlants = healthy;
        _watchPlants = watch;
        _totalFarms = farms.length;
        _totalUsers = users.length;
        _totalDevices = devices.length;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleLogout() async {
    await _apiService.logout();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (context) => const LoginPage()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('TANBAO AgTech — Admin', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadMetrics,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang tải chỉ số hệ thống...')
          : RefreshIndicator(
              onRefresh: _loadMetrics,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header greeting card
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppTheme.greenDark, AppTheme.green],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Xin chào, Quản trị viên!',
                            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Hệ thống quản lý đang chạy ổn định. Thời gian cập nhật: ${DateTime.now().hour}:${DateTime.now().minute.toString().padLeft(2, '0')}',
                            style: const TextStyle(color: Colors.white70, fontSize: 12),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton.icon(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const DashboardPage()),
                              );
                            },
                            icon: const Icon(Icons.swap_horiz_rounded, size: 16),
                            label: const Text('Vào cổng Nông hộ (Farmer View)'),
                            style: ElevatedButton.styleFrom(
                              foregroundColor: AppTheme.greenDark,
                              backgroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Grid stats metrics
                    const Text(
                      'CHỈ SỐ HỆ THỐNG',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
                    ),
                    const SizedBox(height: 8),
                    GridView.count(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      childAspectRatio: 1.5,
                      children: [
                        _metricCard('Tổng cây trồng', _totalPlants.toString(), Icons.eco_rounded, Colors.green),
                        _metricCard('Sức khỏe Tốt', _healthyPlants.toString(), Icons.check_circle_rounded, AppTheme.green),
                        _metricCard('Cần theo dõi', _watchPlants.toString(), Icons.warning_rounded, AppTheme.amber),
                        _metricCard('Trang trại', _totalFarms.toString(), Icons.landscape_rounded, Colors.blue),
                        _metricCard('Người dùng', _totalUsers.toString(), Icons.people_rounded, Colors.purple),
                        _metricCard('Thiết bị IOT', _totalDevices.toString(), Icons.sensors_rounded, Colors.orange),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Admin control sections
                    const Text(
                      'DANH MỤC QUẢN TRỊ',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
                    ),
                    const SizedBox(height: 8),
                    _adminMenuTile(
                      icon: Icons.people_rounded,
                      color: Colors.purple,
                      title: 'Quản lý tài khoản Nông hộ',
                      subtitle: 'Xem danh sách, chỉnh sửa thông tin & phê duyệt tài khoản nông hộ.',
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const AdminUserListPage()),
                        );
                      },
                    ),
                    _adminMenuTile(
                      icon: Icons.sensors_rounded,
                      color: Colors.orange,
                      title: 'Quản lý Thiết bị IOT',
                      subtitle: 'Đăng ký thiết bị cảm biến và giám sát trạng thái kết nối mạng.',
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const AdminDeviceListPage()),
                        );
                      },
                    ),
                    _adminMenuTile(
                      icon: Icons.tune_rounded,
                      color: Colors.teal,
                      title: 'Cấu hình thuộc tính (Schemas)',
                      subtitle: 'Thiết lập các trường thuộc tính động cho từng giống cây & nhật ký.',
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const AdminSchemaListPage()),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _metricCard(String label, String value, IconData icon, Color color) {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppTheme.grayBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  label,
                  style: const TextStyle(fontSize: 11, color: AppTheme.textMuted, fontWeight: FontWeight.w600),
                ),
                Icon(icon, size: 20, color: color),
              ],
            ),
            Text(
              value,
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color),
            ),
          ],
        ),
      ),
    );
  }

  Widget _adminMenuTile({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 0,
      color: Colors.white,
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppTheme.grayBorder),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 22),
        ),
        title: Text(
          title,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.textMain),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            subtitle,
            style: const TextStyle(fontSize: 11, color: AppTheme.textMuted, height: 1.3),
          ),
        ),
        trailing: const Icon(Icons.chevron_right_rounded, color: AppTheme.textMuted),
        onTap: onTap,
      ),
    );
  }
}
