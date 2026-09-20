import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../services/api_service.dart';
import '../../models/plant.dart';
import '../../models/farm.dart';
import '../../utils/theme.dart';
import '../../components/loading_indicator.dart';
import '../login_page.dart';
import '../dashboard_page.dart';
import 'admin_user_page.dart';
import 'admin_plant_page.dart';
import 'admin_gis_page.dart';
import 'admin_device_page.dart';
import 'admin_schema_page.dart';
import 'admin_cost_page.dart';
import 'admin_database_page.dart';
import 'admin_media_page.dart';
import 'admin_audit_logs_page.dart';
import '../../components/admin_drawer.dart';

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
  int _totalCropTypes = 0;

  List<Plant> _plants = [];
  List<Farm> _farms = [];
  Map<String, int> _cropCounts = {};
  Map<String, int> _cropHealthyCounts = {};
  Farm? _selectedFarmForPreview;

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
      final Map<String, int> cropCounts = {};
      final Map<String, int> cropHealthy = {};

      for (final p in plants) {
        final type = p.plantType.trim().isNotEmpty ? p.plantType.trim() : 'Chưa phân loại';
        cropCounts[type] = (cropCounts[type] ?? 0) + 1;

        if (p.healthStatus == 'Tốt') {
          healthy++;
          cropHealthy[type] = (cropHealthy[type] ?? 0) + 1;
        } else if (p.healthStatus == 'Cần chú ý') {
          watch++;
        }
      }

      setState(() {
        _plants = plants;
        _farms = farms;
        _totalPlants = plants.length;
        _healthyPlants = healthy;
        _watchPlants = watch;
        _totalFarms = farms.length;
        _totalUsers = users.length;
        _totalDevices = devices.length;
        _cropCounts = cropCounts;
        _cropHealthyCounts = cropHealthy;
        _totalCropTypes = cropCounts.keys.length;
        if (farms.isNotEmpty && _selectedFarmForPreview == null) {
          _selectedFarmForPreview = farms.first;
        }
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

  String _getCropEmoji(String cropType) {
    final lower = cropType.toLowerCase();
    if (lower.contains('sầu riêng')) return '🥑';
    if (lower.contains('cà phê') || lower.contains('coffee')) return '☕';
    if (lower.contains('ca cao') || lower.contains('cacao')) return '🍫';
    if (lower.contains('bơ')) return '🥑';
    if (lower.contains('bưởi') || lower.contains('cam') || lower.contains('chanh')) return '🍊';
    if (lower.contains('tiêu') || lower.contains('hồ tiêu')) return '🌿';
    if (lower.contains('mít')) return '🍈';
    if (lower.contains('chuối')) return '🍌';
    if (lower.contains('xoài')) return '🥭';
    if (lower.contains('lúa')) return '🌾';
    if (lower.contains('rau')) return '🥬';
    return '🌱';
  }

  void _navigateToFarmerView() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DashboardPage(
          isAdminView: true,
          viewingFarmName: _selectedFarmForPreview?.name ?? 'Tất cả trang trại',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      drawer: const AdminDrawer(activeRoute: 'dashboard'),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        titleSpacing: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 4,
                  ),
                ],
              ),
              child: Image.asset(
                'assets/images/logo.png',
                height: 22,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Icon(Icons.eco_rounded, color: AppTheme.green, size: 20),
              ),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'TANBAO AgTech Admin',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, letterSpacing: -0.2),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            tooltip: 'Làm mới dữ liệu',
            onPressed: _loadMetrics,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, size: 20),
            tooltip: 'Đăng xuất',
            onPressed: _handleLogout,
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang kết nối Cockpit điều hành...')
          : RefreshIndicator(
              onRefresh: _loadMetrics,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // 1. Role Transition Banner & Farm Context Switcher
                    _buildRoleTransitionBanner(),
                    const SizedBox(height: 16),

                    // 2. Operational Value Chain Flowchart (Chuỗi quy trình 5 bước)
                    _buildSectionHeader('QUY TRÌNH VẬN HÀNH CHUỖI GIÁ TRỊ', 'Sơ đồ luồng 5 bước khép kín từ Nông trại đến Xuất khẩu'),
                    const SizedBox(height: 10),
                    _buildValueChainFlowchart(),
                    const SizedBox(height: 20),

                    // 3. Core KPIs Dashboard (Microsoft Fluent Metrics)
                    _buildSectionHeader('TỔNG QUAN HỆ THỐNG AGTECH', 'Chỉ số cốt lõi và trạng thái vận hành thời gian thực'),
                    const SizedBox(height: 10),
                    _buildCoreKpiRow(),
                    const SizedBox(height: 10),
                    _buildSecondaryKpiRow(),
                    const SizedBox(height: 20),

                    // 4. Crop Breakdown Section
                    _buildSectionHeader('CƠ CẤU & PHÂN BỔ LOẠI CÂY TRỒNG', 'Chạm vào loại cây để lọc danh mục quản lý chuyên sâu'),
                    const SizedBox(height: 10),
                    _buildCropBreakdownSection(),
                    const SizedBox(height: 20),

                    // 5. 2-Column Microsoft Fluent Admin Grid
                    _buildSectionHeader('DANH MỤC ĐIỀU HÀNH TẬP TRUNG', 'Trung tâm chỉ huy & quản trị 9 phân hệ chức năng'),
                    const SizedBox(height: 12),
                    _buildFluentAdminGrid(),
                    const SizedBox(height: 24),

                    // 6. Footer Branding
                    _buildFooter(),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildSectionHeader(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 3.5,
              height: 13,
              decoration: BoxDecoration(
                color: const Color(0xFF0F766E),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 7),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF334155),
                  letterSpacing: 0.7,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 3),
        Padding(
          padding: const EdgeInsets.only(left: 10.5),
          child: Text(
            subtitle,
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF64748B),
              height: 1.25,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRoleTransitionBanner() {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF334155), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.12),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withOpacity(0.15),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
                ),
                child: const Icon(Icons.admin_panel_settings_rounded, color: Color(0xFF34D399), size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Bảng Điều Khiển Quản Trị Viên',
                      style: TextStyle(color: Colors.white, fontSize: 14.5, fontWeight: FontWeight.w800),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Chuyển đổi phối cảnh vận hành giữa Admin và Nông hộ',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF0B132B),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF334155)),
            ),
            child: Row(
              children: [
                const Icon(Icons.landscape_rounded, color: Color(0xFF34D399), size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: _farms.isEmpty
                      ? const Text(
                          'Xem với vai trò Nông hộ',
                          style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                        )
                      : DropdownButtonHideUnderline(
                          child: DropdownButton<Farm>(
                            value: _selectedFarmForPreview,
                            dropdownColor: const Color(0xFF1E293B),
                            isExpanded: true,
                            icon: const Icon(Icons.arrow_drop_down_rounded, color: Colors.white70),
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                            items: _farms.map((farm) {
                              return DropdownMenuItem<Farm>(
                                value: farm,
                                child: Text(
                                  'Trang trại: ${farm.name}',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              );
                            }).toList(),
                            onChanged: (farm) {
                              if (farm != null) {
                                setState(() => _selectedFarmForPreview = farm);
                              }
                            },
                          ),
                        ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _navigateToFarmerView,
              icon: const Icon(Icons.swap_horiz_rounded, size: 18),
              label: const Text(
                'Vào phối cảnh Nông hộ (Farmer View)',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
              ),
              style: ElevatedButton.styleFrom(
                foregroundColor: const Color(0xFF0F172A),
                backgroundColor: const Color(0xFF34D399),
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(9),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --- Interactive 5-Stage Value Chain Operational Process Flowchart ---
  Widget _buildValueChainFlowchart() {
    final steps = [
      {
        'num': '01',
        'title': 'Nông hộ & GIS',
        'desc': 'Ranh giới & Cây số',
        'icon': Icons.map_rounded,
        'color': const Color(0xFF0284C7),
        'page': const AdminGisPage(),
      },
      {
        'num': '02',
        'title': 'Canh tác & IoT',
        'desc': '3 Tầng đất & Thời tiết',
        'icon': Icons.sensors_rounded,
        'color': const Color(0xFF059669),
        'page': const AdminDevicePage(),
      },
      {
        'num': '03',
        'title': 'Chuẩn VietGAP',
        'desc': 'Nhật ký & Thuộc tính',
        'icon': Icons.verified_rounded,
        'color': const Color(0xFF7C3AED),
        'page': const AdminSchemaPage(),
      },
      {
        'num': '04',
        'title': 'Thu hoạch & Chi phí',
        'desc': 'Vật tư & Ngân sách',
        'icon': Icons.inventory_2_rounded,
        'color': const Color(0xFFD97706),
        'page': const AdminCostPage(),
      },
      {
        'num': '05',
        'title': 'Xuất khẩu QR/NFC',
        'desc': 'Truy xuất & Báo cáo',
        'icon': Icons.qr_code_2_rounded,
        'color': const Color(0xFFE11D48),
        'page': const AdminMediaPage(),
      },
    ];

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: const [
                  Icon(Icons.alt_route_rounded, size: 16, color: Color(0xFF0F766E)),
                  SizedBox(width: 6),
                  Text(
                    'Chuỗi Giá Trị Số Hóa Nông Nghiệp 5.0',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'Khép kín 100%',
                  style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF0F766E)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 94,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: steps.length,
              separatorBuilder: (_, __) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Center(
                  child: Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Colors.grey.shade400),
                ),
              ),
              itemBuilder: (context, idx) {
                final item = steps[idx];
                final color = item['color'] as Color;
                final page = item['page'] as Widget;

                return InkWell(
                  onTap: () {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => page));
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    width: 124,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: color.withOpacity(0.25), width: 1.2),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: color,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                item['num'] as String,
                                style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900),
                              ),
                            ),
                            Icon(item['icon'] as IconData, size: 16, color: color),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item['title'] as String,
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 1),
                            Text(
                              item['desc'] as String,
                              style: const TextStyle(fontSize: 9.5, color: Color(0xFF64748B)),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCoreKpiRow() {
    return Row(
      children: [
        // KPI 1: Chủng loại cây
        Expanded(
          child: _buildFluentMetricCard(
            title: 'Chủng loại cây',
            primaryValue: '$_totalCropTypes',
            unit: 'loại',
            secondaryText: 'Tổng $_totalPlants cây',
            icon: Icons.forest_rounded,
            color: const Color(0xFF059669),
            bgColor: Colors.white,
            onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminPlantPage()));
            },
          ),
        ),
        const SizedBox(width: 8),
        // KPI 2: Trang trại
        Expanded(
          child: _buildFluentMetricCard(
            title: 'Trang trại GIS',
            primaryValue: '$_totalFarms',
            unit: 'vườn',
            secondaryText: 'Toàn quốc',
            icon: Icons.landscape_rounded,
            color: const Color(0xFF0284C7),
            bgColor: Colors.white,
            onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminGisPage()));
            },
          ),
        ),
        const SizedBox(width: 8),
        // KPI 3: Nông hộ
        Expanded(
          child: _buildFluentMetricCard(
            title: 'Nông hộ',
            primaryValue: '$_totalUsers',
            unit: 'hộ',
            secondaryText: 'Hoạt động',
            icon: Icons.people_alt_rounded,
            color: const Color(0xFF7C3AED),
            bgColor: Colors.white,
            onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminUserPage()));
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFluentMetricCard({
    required String title,
    required String primaryValue,
    required String unit,
    required String secondaryText,
    required IconData icon,
    required Color color,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.025),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF475569),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Icon(icon, size: 15, color: color),
              ],
            ),
            const SizedBox(height: 5),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  primaryValue,
                  style: TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
                const SizedBox(width: 3),
                Text(
                  unit,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              secondaryText,
              style: const TextStyle(
                fontSize: 9.5,
                color: Color(0xFF94A3B8),
                fontWeight: FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSecondaryKpiRow() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildMiniMetric(
            icon: Icons.check_circle_rounded,
            color: const Color(0xFF10B981),
            label: 'Cây tốt',
            value: '$_healthyPlants cây',
          ),
          Container(height: 18, width: 1, color: const Color(0xFFE2E8F0)),
          _buildMiniMetric(
            icon: Icons.warning_amber_rounded,
            color: const Color(0xFFF59E0B),
            label: 'Cần chú ý',
            value: '$_watchPlants cây',
          ),
          Container(height: 18, width: 1, color: const Color(0xFFE2E8F0)),
          _buildMiniMetric(
            icon: Icons.sensors_rounded,
            color: const Color(0xFF0F766E),
            label: 'IoT Station',
            value: '$_totalDevices trạm',
          ),
        ],
      ),
    );
  }

  Widget _buildMiniMetric({
    required IconData icon,
    required Color color,
    required String label,
    required String value,
  }) {
    return Row(
      children: [
        Icon(icon, size: 15, color: color),
        const SizedBox(width: 5),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(fontSize: 9.5, color: Color(0xFF64748B)),
            ),
            Text(
              value,
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: color),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCropBreakdownSection() {
    if (_cropCounts.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
        ),
        child: const Center(
          child: Text(
            'Chưa có dữ liệu cây trồng để phân loại',
            style: TextStyle(color: AppTheme.textMuted, fontSize: 11.5),
          ),
        ),
      );
    }

    final sortedEntries = _cropCounts.entries.toList()..sort((a, b) => b.value.compareTo(a.value));

    return SizedBox(
      height: 98,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: sortedEntries.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final entry = sortedEntries[index];
          final cropName = entry.key;
          final count = entry.value;
          final percentage = _totalPlants > 0 ? (count / _totalPlants * 100).toStringAsFixed(1) : '0';
          final healthyCount = _cropHealthyCounts[cropName] ?? 0;
          final emoji = _getCropEmoji(cropName);

          return InkWell(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => AdminPlantPage(initialPlantType: cropName),
                ),
              );
            },
            borderRadius: BorderRadius.circular(14),
            child: Container(
              width: 140,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.025),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(emoji, style: const TextStyle(fontSize: 18)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFA7F3D0)),
                        ),
                        child: Text(
                          '$percentage%',
                          style: const TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF047857),
                          ),
                        ),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        cropName,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 1),
                      Text(
                        '$count cây · $healthyCount tốt',
                        style: const TextStyle(
                          fontSize: 10,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // --- 2-Column Microsoft Fluent Admin Grid ---
  Widget _buildFluentAdminGrid() {
    final modules = [
      {
        'icon': Icons.people_alt_rounded,
        'color': const Color(0xFF7C3AED),
        'title': 'Quản lý Nông hộ',
        'badge': '$_totalUsers hồ sơ',
        'desc': 'Phân quyền & kiểm duyệt tài khoản',
        'page': const AdminUserPage(),
      },
      {
        'icon': Icons.eco_rounded,
        'color': const Color(0xFF059669),
        'title': 'Cây trồng & Nhật ký',
        'badge': '$_totalPlants cây',
        'desc': '4 Tabs thông số & canh tác số',
        'page': const AdminPlantPage(),
      },
      {
        'icon': Icons.map_rounded,
        'color': const Color(0xFF0284C7),
        'title': 'Bản đồ GIS Vườn',
        'badge': '$_totalFarms trang trại',
        'desc': 'Polygon ranh giới & lưới cây GPS',
        'page': const AdminGisPage(),
      },
      {
        'icon': Icons.attach_money_rounded,
        'color': const Color(0xFF047857),
        'title': 'Chi phí & Vật tư',
        'badge': '10 bản ghi/trang',
        'desc': 'Tiêu hao, khấu hao & ngân sách',
        'page': const AdminCostPage(),
      },
      {
        'icon': Icons.tune_rounded,
        'color': const Color(0xFF0D9488),
        'title': 'Schemas VietGAP',
        'badge': 'Dynamic JSON',
        'desc': 'Cấu hình trường động theo giống',
        'page': const AdminSchemaPage(),
      },
      {
        'icon': Icons.sensors_rounded,
        'color': const Color(0xFFEA580C),
        'title': 'Cảm biến IoT 3 Tầng',
        'badge': '$_totalDevices trạm',
        'desc': 'Không khí, 7-in-1 đất & nước',
        'page': const AdminDevicePage(),
      },
      {
        'icon': Icons.storage_rounded,
        'color': const Color(0xFF4F46E5),
        'title': 'CSDL & Telemetry',
        'badge': '8 Tables & Redis',
        'desc': 'Đo độ trễ & làm sạch cache',
        'page': const AdminDatabasePage(),
      },
      {
        'icon': Icons.photo_library_rounded,
        'color': const Color(0xFFD97706),
        'title': 'Media & Quét AI',
        'badge': 'Gemini 1.5',
        'desc': 'Thư viện ảnh & nhận diện nhãn',
        'page': const AdminMediaPage(),
      },
      {
        'icon': Icons.security_rounded,
        'color': const Color(0xFFDC2626),
        'title': 'Audit Logs An ninh',
        'badge': 'Realtime Logs',
        'desc': 'Truy vết tác vụ & sự kiện 6 lớp',
        'page': const AdminAuditLogsPage(),
      },
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.35,
      ),
      itemCount: modules.length,
      itemBuilder: (context, index) {
        final m = modules[index];
        final color = m['color'] as Color;
        final page = m['page'] as Widget;

        return InkWell(
          onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => page));
          },
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.all(11),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.025),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(m['icon'] as IconData, color: color, size: 18),
                    ),
                    Flexible(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Text(
                          m['badge'] as String,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            color: color,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      m['title'] as String,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      m['desc'] as String,
                      style: const TextStyle(
                        fontSize: 9.5,
                        color: Color(0xFF64748B),
                        height: 1.2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildFooter() {
    return Center(
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
            decoration: BoxDecoration(
              color: const Color(0xFF0F766E).withOpacity(0.08),
              borderRadius: BorderRadius.circular(100),
              border: Border.all(color: const Color(0xFF0F766E).withOpacity(0.2)),
            ),
            child: Text(
              '${AppConstants.appVersion} • Enterprise Edition',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F766E)),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Sổ Nông Tân Bảo · Bản quyền © 2026 TBSG Agtech',
            style: TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

