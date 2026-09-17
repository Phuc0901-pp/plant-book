import 'package:flutter/material.dart';
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
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: const AdminDrawer(activeRoute: 'dashboard'),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        elevation: 0,
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
                errorBuilder: (_, __, ___) => const Icon(Icons.eco_rounded, color: AppTheme.green, size: 22),
              ),
            ),
            const SizedBox(width: 10),
            const Text(
              'TANBAO AgTech — Admin',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Làm mới dữ liệu',
            onPressed: _loadMetrics,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Đăng xuất',
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
                    // 1. Role Transition Banner & Farm Context Switcher
                    _buildRoleTransitionBanner(),
                    const SizedBox(height: 20),

                    // 2. Core 3 KPIs Section
                    _buildSectionHeader('TỔNG QUAN HỆ THỐNG', 'Chỉ số cốt lõi toàn hệ sinh thái'),
                    const SizedBox(height: 10),
                    _buildCoreKpiRow(),
                    const SizedBox(height: 12),
                    _buildSecondaryKpiRow(),
                    const SizedBox(height: 22),

                    // 3. Crop Breakdown & Distribution Section
                    _buildSectionHeader('CƠ CẤU & PHÂN BỔ LOẠI CÂY TRỒNG', 'Chạm vào loại cây để lọc danh sách chi tiết'),
                    const SizedBox(height: 10),
                    _buildCropBreakdownSection(),
                    const SizedBox(height: 24),

                    // 4. Categorized Management Modules
                    _buildSectionHeader('DANH MỤC QUẢN TRỊ NGHIỆP VỤ', '3 nhóm chức năng điều hành tập trung'),
                    const SizedBox(height: 12),
                    _buildCategorizedModules(),
                    const SizedBox(height: 24),

                    // 5. Footer Branding
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
        Text(
          title,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: AppTheme.textMuted,
            letterSpacing: 0.9,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: const TextStyle(
            fontSize: 11,
            color: Color(0xFF64748B),
          ),
        ),
      ],
    );
  }

  Widget _buildRoleTransitionBanner() {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF064E3B), Color(0xFF047857)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF064E3B).withOpacity(0.2),
            blurRadius: 10,
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
                  color: Colors.white.withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.admin_panel_settings_rounded, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Xin chào, Quản trị viên!',
                      style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Chuyển đổi linh hoạt giữa giao diện Admin và Nông hộ',
                      style: TextStyle(color: Colors.white70, fontSize: 11.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.18),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withOpacity(0.15)),
            ),
            child: Row(
              children: [
                const Icon(Icons.landscape_rounded, color: Color(0xFF6EE7B7), size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: _farms.isEmpty
                      ? const Text(
                          'Xem với vai trò Nông hộ',
                          style: TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w600),
                        )
                      : DropdownButtonHideUnderline(
                          child: DropdownButton<Farm>(
                            value: _selectedFarmForPreview,
                            dropdownColor: const Color(0xFF064E3B),
                            isExpanded: true,
                            icon: const Icon(Icons.arrow_drop_down_rounded, color: Colors.white70),
                            style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.bold),
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
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _navigateToFarmerView,
              icon: const Icon(Icons.swap_horiz_rounded, size: 18),
              label: const Text(
                'Vào cổng Nông hộ (Farmer View)',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              style: ElevatedButton.styleFrom(
                foregroundColor: const Color(0xFF064E3B),
                backgroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 11),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCoreKpiRow() {
    return Row(
      children: [
        // KPI 1: Chủng loại cây & tổng cây
        Expanded(
          child: _buildCoreCard(
            title: 'Chủng loại cây',
            primaryValue: '$_totalCropTypes',
            unit: 'loại',
            secondaryText: 'Tổng $_totalPlants cây',
            icon: Icons.forest_rounded,
            color: const Color(0xFF059669),
            bgColor: const Color(0xFFECFDF5),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AdminPlantPage()),
              );
            },
          ),
        ),
        const SizedBox(width: 10),
        // KPI 2: Số lượng trang trại
        Expanded(
          child: _buildCoreCard(
            title: 'Trang trại',
            primaryValue: '$_totalFarms',
            unit: 'nông trại',
            secondaryText: 'Toàn quốc',
            icon: Icons.landscape_rounded,
            color: const Color(0xFF2563EB),
            bgColor: const Color(0xFFEFF6FF),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AdminGisPage()),
              );
            },
          ),
        ),
        const SizedBox(width: 10),
        // KPI 3: Số lượng người dùng
        Expanded(
          child: _buildCoreCard(
            title: 'Người dùng',
            primaryValue: '$_totalUsers',
            unit: 'nông hộ',
            secondaryText: 'Hoạt động',
            icon: Icons.people_alt_rounded,
            color: const Color(0xFF7C3AED),
            bgColor: const Color(0xFFF5F3FF),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AdminUserPage()),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildCoreCard({
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.25)),
          boxShadow: [
            BoxShadow(
              color: color.withOpacity(0.06),
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
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: color.withOpacity(0.85),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Icon(icon, size: 16, color: color),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  primaryValue,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
                const SizedBox(width: 3),
                Text(
                  unit,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: color.withOpacity(0.8),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              secondaryText,
              style: const TextStyle(
                fontSize: 10,
                color: Color(0xFF64748B),
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
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildMiniMetric(
            icon: Icons.check_circle_rounded,
            color: const Color(0xFF10B981),
            label: 'Sức khỏe tốt',
            value: '$_healthyPlants cây',
          ),
          Container(height: 20, width: 1, color: const Color(0xFFE2E8F0)),
          _buildMiniMetric(
            icon: Icons.warning_amber_rounded,
            color: const Color(0xFFF59E0B),
            label: 'Cần chú ý',
            value: '$_watchPlants cây',
          ),
          Container(height: 20, width: 1, color: const Color(0xFFE2E8F0)),
          _buildMiniMetric(
            icon: Icons.sensors_rounded,
            color: const Color(0xFFEA580C),
            label: 'Thiết bị IoT',
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
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
            ),
            Text(
              value,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCropBreakdownSection() {
    if (_cropCounts.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Center(
          child: Text(
            'Chưa có dữ liệu cây trồng để phân loại',
            style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
          ),
        ),
      );
    }

    final sortedEntries = _cropCounts.entries.toList()..sort((a, b) => b.value.compareTo(a.value));

    return Column(
      children: [
        // Horizontal list of crop chips/cards
        SizedBox(
          height: 105,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: sortedEntries.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
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
                  width: 150,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.03),
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
                          Text(emoji, style: const TextStyle(fontSize: 20)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppTheme.greenLight,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '$percentage%',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.greenDark,
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
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0F172A),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '$count cây · $healthyCount tốt',
                            style: const TextStyle(
                              fontSize: 11,
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
        ),
      ],
    );
  }

  Widget _buildCategorizedModules() {
    return Column(
      children: [
        // Group 1: Quản lý Nông nghiệp & Cây trồng
        _buildModuleGroupHeader('🌿 QUẢN LÝ NÔNG NGHIỆP & CÂY TRỒNG'),
        _buildModuleTile(
          icon: Icons.people_alt_rounded,
          color: const Color(0xFF7C3AED),
          title: 'Quản lý tài khoản Nông hộ & Phân quyền',
          subtitle: 'Xem danh sách, kiểm duyệt hồ sơ & cấu hình quyền trang trại.',
          onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminUserPage()));
          },
        ),
        _buildModuleTile(
          icon: Icons.eco_rounded,
          color: const Color(0xFF059669),
          title: 'Danh sách Cây trồng & Nhật ký số',
          subtitle: 'Tra cứu cây trồng, thông số 4 Tabs & nhật ký canh tác số hóa.',
          onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminPlantPage()));
          },
        ),
        _buildModuleTile(
          icon: Icons.map_rounded,
          color: const Color(0xFF2563EB),
          title: 'Bản đồ GIS Trang trại Toàn quốc',
          subtitle: 'Vệ tinh ranh giới polygon & định vị tọa độ GPS từng lô đất.',
          onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminGisPage()));
          },
        ),
        const SizedBox(height: 12),

        // Group 2: Tài chính & Quy chuẩn Nông nghiệp
        _buildModuleGroupHeader('📊 TÀI CHÍNH & QUY CHUẨN NÔNG NGHIỆP'),
        _buildModuleTile(
          icon: Icons.attach_money_rounded,
          color: const Color(0xFF047857),
          title: 'Quản trị Chi phí Đầu tư & Vật tư',
          subtitle: 'Giám sát chi phí vật tư tiêu hao, khấu hao và ngân sách vụ mùa.',
          onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminCostPage()));
          },
        ),
        _buildModuleTile(
          icon: Icons.tune_rounded,
          color: const Color(0xFF0D9488),
          title: 'Cấu hình Schemas & Thuộc tính VietGAP',
          subtitle: 'Thiết lập biểu mẫu thuộc tính động JSON cho từng giống cây trồng.',
          onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminSchemaPage()));
          },
        ),
        const SizedBox(height: 12),

        // Group 3: Hạ tầng & Kỹ thuật
        _buildModuleGroupHeader('⚙️ HẠ TẦNG & HỆ THỐNG KỸ THUẬT'),
        _buildModuleTile(
          icon: Icons.sensors_rounded,
          color: const Color(0xFFEA580C),
          title: 'Cảm biến IoT 3 tầng đất & Quan trắc',
          subtitle: 'Đăng ký thiết bị cảm biến, gateway & theo dõi kết nối trực tuyến.',
          onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminDevicePage()));
          },
        ),
        _buildModuleTile(
          icon: Icons.storage_rounded,
          color: const Color(0xFF4F46E5),
          title: 'CSDL PostgreSQL & Redis Telemetry',
          subtitle: 'Giám sát 8 bảng dữ liệu, đo độ trễ & làm sạch cache 1-chạm.',
          onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminDatabasePage()));
          },
        ),
        _buildModuleTile(
          icon: Icons.photo_library_rounded,
          color: const Color(0xFFD97706),
          title: 'Thư viện Media & Quét bao bì AI',
          subtitle: 'Kho hình ảnh nông hộ và kết quả nhận diện nhãn vật tư Gemini AI.',
          onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminMediaPage()));
          },
        ),
        _buildModuleTile(
          icon: Icons.security_rounded,
          color: const Color(0xFFDC2626),
          title: 'Nhật ký An ninh & Audit Logs',
          subtitle: 'Theo dõi toàn bộ lịch sử truy vết tác vụ và sự kiện hệ thống.',
          onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminAuditLogsPage()));
          },
        ),
      ],
    );
  }

  Widget _buildModuleGroupHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, top: 4, bottom: 8),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text(
          title,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: Color(0xFF475569),
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }

  Widget _buildModuleTile({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 0,
      color: Colors.white,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        leading: Container(
          padding: const EdgeInsets.all(9),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        title: Text(
          title,
          style: const TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.bold,
            color: Color(0xFF0F172A),
          ),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Text(
            subtitle,
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF64748B),
              height: 1.25,
            ),
          ),
        ),
        trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8), size: 20),
        onTap: onTap,
      ),
    );
  }

  Widget _buildFooter() {
    return Center(
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.greenDark.withOpacity(0.08),
              borderRadius: BorderRadius.circular(100),
              border: Border.all(color: AppTheme.greenDark.withOpacity(0.2)),
            ),
            child: const Text(
              'v1.2.0 · Enterprise Edition',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.greenDark),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Sổ Nông Tân Bảo · Bản quyền © 2026 TBSG Agtech',
            style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
