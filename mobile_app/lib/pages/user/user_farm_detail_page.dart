import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../models/farm.dart';
import '../../models/plant.dart';
import '../../services/api_service.dart';
import '../../components/loading_indicator.dart';
import '../../components/common/pro_upgrade_modal.dart';
import '../../components/interactive_gis_map_widget.dart';

class UserFarmDetailPage extends StatefulWidget {
  final Farm? farm;

  const UserFarmDetailPage({super.key, this.farm});

  @override
  State<UserFarmDetailPage> createState() => _UserFarmDetailPageState();
}

class _UserFarmDetailPageState extends State<UserFarmDetailPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  int _selectedSoilDepth = 10; // 10, 20, 30 cm
  bool _isPro = false;
  Map<String, dynamic>? _iotData;
  Map<String, dynamic>? _userProfile;
  Farm? _currentFarm;
  List<Plant> _farmPlants = [];
  List<Farm> _allFarms = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);

    try {
      final results = await Future.wait<dynamic>([
        _apiService.fetchUserInfo(),
        _apiService.fetchFarms(),
        _apiService.fetchPlants(),
      ]);

      final user = results[0] as Map<String, dynamic>?;
      final farms = results[1] as List<Farm>;
      final allPlants = results[2] as List<Plant>;

      Farm selected;
      if (widget.farm != null) {
        selected = widget.farm!;
      } else if (farms.isNotEmpty) {
        selected = farms.first;
      } else {
        selected = Farm(
          id: 1,
          name: 'Trang trại Nông hộ',
          area: 5733.9,
          plantCount: allPlants.length,
          latitude: 12.68,
          longitude: 108.03,
        );
      }

      final farmPlants = allPlants.where((p) => p.farmId == selected.id || selected.id == 1).toList();

      Map<String, dynamic>? iot;
      try {
        iot = await _apiService.fetchFarmIoTData(selected.id);
      } catch (_) {}

      if (mounted) {
        setState(() {
          _userProfile = user;
          _isPro = user != null && (user['account_tier'] == 'pro' || user['account_tier'] == 'normal');
          _allFarms = farms;
          _currentFarm = selected;
          _farmPlants = farmPlants.isNotEmpty ? farmPlants : allPlants;
          _iotData = iot;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _onSelectDepth(int depth) {
    if (depth > 10 && !_isPro) {
      ProUpgradeModal.show(context, 'xem Cảm biến Đất Tầng ${depth}cm');
      return;
    }
    setState(() => _selectedSoilDepth = depth);
  }

  String _formatArea(double? area) {
    if (area == null || area == 0) return '0 ha';
    if (area >= 10000) {
      return '${(area / 10000).toStringAsFixed(2)} ha (${area.toStringAsFixed(0)} m²)';
    }
    return '${area.toStringAsFixed(0)} m²';
  }

  @override
  Widget build(BuildContext context) {
    final farmName = _currentFarm?.name ?? widget.farm?.name ?? 'Vùng Trồng & Bản Đồ GIS';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: Text(farmName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.green,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: const [
            Tab(text: 'Bản đồ GIS Vệ Tinh'),
            Tab(text: 'Cảm biến IoT'),
            Tab(text: 'Thời tiết Nông nghiệp'),
          ],
        ),
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang đồng bộ dữ liệu GIS và Cảm biến IoT...')
          : TabBarView(
              controller: _tabController,
              children: [
                // Subtab 1: Interactive GIS Satellite Map View
                _buildGisMapTab(),

                // Subtab 2: IoT 3-Depth Soil Sensors
                _buildIotSensorsTab(),

                // Subtab 3: Weather Forecast & Agronomy Advice
                _buildWeatherTab(),
              ],
            ),
    );
  }

  Widget _buildGisMapTab() {
    final farm = _currentFarm;
    final ownerName = _userProfile?['full_name'] ?? _userProfile?['name'] ?? 'Nông hộ';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Interactive Satellite Map View
          InteractiveGisMapWidget(
            farms: farm != null ? [farm] : _allFarms,
            plants: _farmPlants,
            height: 340,
          ),
          const SizedBox(height: 16),

          // Farm GIS Metadata Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.grayBorder),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 6, offset: const Offset(0, 2)),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'HỒ SƠ VÙNG TRỒNG & QUY MÔ GIS',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: const Text('VietGAP Chuẩn', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF059669))),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _infoRow('Tên Trang Trại', farm?.name ?? 'Vườn Nông hộ'),
                _infoRow('Chủ Vườn / Đại Diện', ownerName),
                _infoRow('Quy Mô Diện Tích', _formatArea(farm?.area)),
                _infoRow('Tổng Số Cây Quản Lý', '${_farmPlants.length} cây'),
                _infoRow('Địa Điểm', farm?.description ?? 'Cư M\'gar, Đắk Lắk'),
                _infoRow('Tọa Độ Vệ Tinh', farm?.latitude != null ? '${farm!.latitude!.toStringAsFixed(4)}, ${farm.longitude!.toStringAsFixed(4)}' : '12.6800, 108.0300'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIotSensorsTab() {
    final soil = _iotData?['soil_data'] as Map<String, dynamic>? ?? {};
    final depthKey = 'depth_${_selectedSoilDepth}cm';
    final levelData = soil[depthKey] as Map<String, dynamic>? ?? soil['depth_20cm'] as Map<String, dynamic>? ?? {};

    final moisture = levelData['moisture'] ?? (_selectedSoilDepth == 10 ? 64.5 : (_selectedSoilDepth == 20 ? 52.0 : 58.2));
    final temp = levelData['temperature'] ?? (_selectedSoilDepth == 10 ? 28.5 : (_selectedSoilDepth == 20 ? 26.8 : 25.4));
    final ph = levelData['ph'] ?? 6.2;
    final ec = levelData['ec'] ?? 1.15;

    final air = _iotData?['air_data'] as Map<String, dynamic>? ?? {};
    final uv = air['uv_index'] ?? 3.8;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('Tầng đất quan trắc: ', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
              const SizedBox(width: 8),
              _depthChip(10, 'Tầng 10cm'),
              const SizedBox(width: 6),
              _depthChip(20, 'Tầng 20cm'),
              const SizedBox(width: 6),
              _depthChip(30, 'Tầng 30cm'),
            ],
          ),
          const SizedBox(height: 16),

          Row(
            children: [
              Expanded(child: _metricBox('Độ ẩm đất (${_selectedSoilDepth}cm)', '$moisture %', Icons.water_drop_rounded, moisture < 50 ? Colors.red : AppTheme.green)),
              const SizedBox(width: 10),
              Expanded(child: _metricBox('Nhiệt độ đất (${_selectedSoilDepth}cm)', '$temp °C', Icons.thermostat_rounded, Colors.orange)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _metricBox('Độ pH đất', '$ph (Tối ưu)', Icons.science_rounded, Colors.teal)),
              const SizedBox(width: 10),
              Expanded(child: _metricBox('Độ dẫn điện EC', '$ec mS/cm', Icons.bolt_rounded, Colors.purple)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _metricBox('Chỉ số UV Môi trường', '$uv (Vừa)', Icons.wb_sunny_rounded, Colors.amber)),
              const SizedBox(width: 10),
              Expanded(child: _metricBox('Độ ẩm Không khí', '${air["humidity"] ?? 72} %', Icons.cloud_rounded, Colors.blue)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildWeatherTab() {
    final List<dynamic> forecast = _iotData?['weather_forecast'] as List<dynamic>? ?? [
      {
        'day': 'Hôm nay',
        'weather': 'Nắng nhẹ rải rác',
        'temp': '24°C - 32°C',
        'advice': 'Thời tiết lý tưởng để bón bổ sung phân hữu cơ vi sinh và tưới gốc.'
      },
      {
        'day': 'Ngày mai',
        'weather': 'Mây dông chiều tối',
        'temp': '23°C - 31°C',
        'advice': 'Chiều có khả năng mưa rào 65%. Tránh phun thuốc BVTV phòng trôi thuốc.'
      },
      {
        'day': 'Ngày kia',
        'weather': 'Nắng ấm',
        'temp': '24°C - 33°C',
        'advice': 'Kiểm tra độ ẩm đất tầng 20cm và tỉa cành thông thoáng tán cây.'
      }
    ];

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: forecast.length,
      itemBuilder: (context, idx) {
        final item = forecast[idx] as Map<String, dynamic>;
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.blue.shade50,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.blue.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('🌤️ ${item["day"] ?? "Dự báo"}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E3A8A))),
                  Text(item['weather'] ?? 'Mây dông', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.blue)),
                ],
              ),
              const SizedBox(height: 6),
              Text(item['advice'] ?? 'Khuyến cáo kỹ thuật canh tác.', style: const TextStyle(fontSize: 12.5, color: Color(0xFF1E40AF), height: 1.4)),
            ],
          ),
        );
      },
    );
  }

  Widget _depthChip(int depth, String label) {
    final bool active = _selectedSoilDepth == depth;
    return GestureDetector(
      onTap: () => _onSelectDepth(depth),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppTheme.greenDark : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(label, style: TextStyle(color: active ? Colors.white : Colors.grey.shade700, fontSize: 11, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _metricBox(String label, String val, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: color.withOpacity(0.06), borderRadius: BorderRadius.circular(12), border: Border.all(color: color.withOpacity(0.2))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Expanded(child: Text(label, style: const TextStyle(fontSize: 10.5, color: AppTheme.textMuted, fontWeight: FontWeight.bold), overflow: TextOverflow.ellipsis)),
            ],
          ),
          const SizedBox(height: 6),
          Text(val, style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String val) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppTheme.textMuted, fontSize: 12.5)),
          Text(val, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }
}
