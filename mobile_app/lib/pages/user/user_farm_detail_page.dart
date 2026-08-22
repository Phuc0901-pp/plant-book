import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../models/farm.dart';
import '../../services/api_service.dart';
import '../../components/loading_indicator.dart';
import '../../components/common/pro_upgrade_modal.dart';

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

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    final farmId = widget.farm?.id ?? 1;

    try {
      final results = await Future.wait([
        _apiService.fetchUserInfo(),
        _apiService.fetchFarmIoTData(farmId),
      ]);

      final user = results[0] as Map<String, dynamic>?;
      final iot = results[1] as Map<String, dynamic>?;

      if (mounted) {
        setState(() {
          _isPro = user != null && user['account_tier'] == 'pro';
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

  @override
  Widget build(BuildContext context) {
    final farmName = widget.farm?.name ?? 'Trang trại Nông hộ';

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
            Tab(text: 'Bản đồ GIS'),
            Tab(text: 'Cảm biến IoT'),
            Tab(text: 'Thời tiết 6 ngày'),
          ],
        ),
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang đồng bộ dữ liệu cảm biến IoT từ CSDL...')
          : TabBarView(
              controller: _tabController,
              children: [
                // Subtab 1: Interactive GIS Satellite Map View
                _buildGisMapTab(),

                // Subtab 2: IoT 3-Depth Soil Sensors
                _buildIotSensorsTab(),

                // Subtab 3: 6-Day Weather Forecast & Agronomy Advice
                _buildWeatherTab(),
              ],
            ),
    );
  }

  Widget _buildGisMapTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 240,
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(16),
              image: const DecorationImage(
                image: NetworkImage('https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/106.9,11.8,12,0/600x300?access_token=pk.mock'),
                fit: BoxFit.cover,
              ),
            ),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.35),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: const [
                      Icon(Icons.layers_rounded, color: AppTheme.green, size: 22),
                      SizedBox(width: 8),
                      Text('Ranh giới Lô đất Polygon', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('Diện tích: ${widget.farm?.area?.round() ?? 5000} m² · Tọa độ GPS thực tế.', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.grayBorder)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('THÔNG TIN LÔ ĐẤT CANH TÁC', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8)),
                const SizedBox(height: 10),
                _infoRow('Tên lô', widget.farm?.name ?? 'Lô A1'),
                _infoRow('Diện tích', '${widget.farm?.area?.round() ?? 5000} m²'),
                _infoRow('Số lượng cây', '${widget.farm?.plantCount ?? 45} cây'),
                _infoRow('Độ cao so với mặt biển', '450 m'),
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

    final moisture = levelData['moisture'] ?? (_selectedSoilDepth == 10 ? 65 : (_selectedSoilDepth == 20 ? 48 : 58));
    final temp = levelData['temperature'] ?? (_selectedSoilDepth == 10 ? 29.5 : (_selectedSoilDepth == 20 ? 27.2 : 25.8));
    final ph = levelData['ph'] ?? 6.5;
    final ec = levelData['ec'] ?? 1.2;

    final air = _iotData?['air_data'] as Map<String, dynamic>? ?? {};
    final uv = air['uv_index'] ?? 4.2;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Soil depth selector chips
          Row(
            children: [
              const Text('Tầng đất chọn: ', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
              const SizedBox(width: 8),
              _depthChip(10, 'Tầng 10cm'),
              const SizedBox(width: 6),
              _depthChip(20, 'Tầng 20cm 🔒'),
              const SizedBox(width: 6),
              _depthChip(30, 'Tầng 30cm 🔒'),
            ],
          ),
          const SizedBox(height: 16),

          // Soil sensor metrics cards
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
              Expanded(child: _metricBox('Độ ẩm Không khí', '${air["humidity"] ?? 74} %', Icons.cloud_rounded, Colors.blue)),
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
        'weather': 'Nắng nhẹ',
        'advice': 'Thích hợp bón phân lá & tỉa cành che sáng.'
      },
      {
        'day': 'Ngày mai',
        'weather': 'Mưa rào nhẹ',
        'advice': 'Dự báo có mưa rào. Tạm dừng bón phân lá, kiểm tra rãnh thoát nước.'
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
          decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.blue.shade200)),
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
