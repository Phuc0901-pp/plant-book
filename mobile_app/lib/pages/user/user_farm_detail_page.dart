import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../models/farm.dart';
import '../../models/plant.dart';
import '../../models/plant_log.dart';
import '../../services/api_service.dart';
import '../../components/loading_indicator.dart';
import '../../components/common/pro_upgrade_modal.dart';
import '../../components/interactive_gis_map_widget.dart';
import '../../components/plant_card.dart';
import '../../components/log_edit_dialog.dart';
import '../plant_detail_page.dart';

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
  List<PlantLog> _farmLogs = [];
  List<Farm> _allFarms = [];
  String _plantSearchQuery = '';

  List<Map<String, dynamic>> _realWeatherForecast = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);

    try {
      final results = await Future.wait<dynamic>([
        _apiService.fetchUserInfo(),
        _apiService.fetchFarms(),
        _apiService.fetchPlants(),
        _apiService.fetchRecentLogs(days: 90),
      ]);

      final user = results[0] as Map<String, dynamic>?;
      final farms = results[1] as List<Farm>;
      final allPlants = results[2] as List<Plant>;
      final allLogs = results[3] as List<PlantLog>;

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

      final farmPlants = allPlants.where((p) => p.farmId == selected.id || (farms.length <= 1 && selected.id == 1)).toList();
      final farmPlantIds = farmPlants.map((p) => p.id).toSet();
      final farmLogs = allLogs.where((l) => farmPlantIds.contains(l.plantId) || (l.farmId != null && l.farmId == selected.id)).toList();

      Map<String, dynamic>? iot;
      try {
        iot = await _apiService.fetchFarmIoTData(selected.id);
      } catch (_) {}

      List<Map<String, dynamic>> forecast = [];
      try {
        final lat = selected.latitude ?? 12.68;
        final lng = selected.longitude ?? 108.03;
        forecast = await _apiService.fetchRealWeatherForecast(lat, lng);
      } catch (_) {}

      if (mounted) {
        setState(() {
          _userProfile = user;
          _isPro = user != null && (user['account_tier'] == 'pro' || user['account_tier'] == 'normal');
          _allFarms = farms;
          _currentFarm = selected;
          _farmPlants = farmPlants.isNotEmpty ? farmPlants : allPlants;
          _farmLogs = farmLogs.isNotEmpty ? farmLogs : allLogs;
          _iotData = iot;
          _realWeatherForecast = forecast;
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

  Widget _buildIotSensorsTab() {
    final soil = _iotData?['soil_data'] as Map<String, dynamic>? ?? {};
    final depthKey = 'depth_${_selectedSoilDepth}cm';
    final levelData = soil[depthKey] as Map<String, dynamic>? ?? soil['depth_20cm'] as Map<String, dynamic>? ?? {};

    final moisture = levelData['moisture'] ?? (_selectedSoilDepth == 10 ? 68.0 : (_selectedSoilDepth == 20 ? 64.5 : 72.0));
    final temp = levelData['temperature'] ?? (_selectedSoilDepth == 10 ? 27.5 : (_selectedSoilDepth == 20 ? 25.9 : 24.5));
    final ph = levelData['ph'] ?? (_selectedSoilDepth == 10 ? 6.5 : (_selectedSoilDepth == 20 ? 6.6 : 6.8));
    final ec = levelData['ec'] ?? (_selectedSoilDepth == 10 ? 1.2 : (_selectedSoilDepth == 20 ? 1.3 : 1.1));
    final salinity = levelData['salinity'] ?? 0.2;
    final npk = levelData['npk'] ?? (_selectedSoilDepth == 10 ? 'N:48 | P:35 | K:65' : (_selectedSoilDepth == 20 ? 'N:46 | P:32 | K:62' : 'N:40 | P:28 | K:55'));

    final air = _iotData?['air_data'] as Map<String, dynamic>? ?? {};
    final airTemp = air['temperature'] ?? 28.2;
    final airHumidity = air['humidity'] ?? 73;
    final airWind = air['wind'] ?? '16 km/h - Đông';
    final airRain = air['rainfall'] ?? '2 mm (0.5 mm/h)';
    final uv = air['uv_index'] ?? 4.2;
    final solar = air['solar_radiation'] ?? '666 W/m²';

    final water = _iotData?['water_data'] as Map<String, dynamic>? ?? {};
    final waterPh = water['ph'] ?? 6.9;
    final waterDo = water['do'] ?? 6.7;
    final waterTurbidity = water['turbidity'] ?? 13;
    final waterLevel = water['level'] ?? 91;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner Trạm Cảm Biến IoT
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF334155)),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.12), blurRadius: 10, offset: const Offset(0, 4)),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0284C7),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.bolt_rounded, color: Colors.white, size: 12),
                          SizedBox(width: 4),
                          Text('LIVE SENSORS', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text('Giám Sát 3 Môi Trường', style: TextStyle(color: Colors.white70, fontSize: 10.5, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                const Text(
                  'Trạm Cảm Biến IoT Đa Môi Trường',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Giám sát tự động 3 môi trường (Không khí, Đất, Nước) & Khuyến nghị kỹ thuật canh tác VietGAP.',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11.5, height: 1.3),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // ================= MÔI TRƯỜNG 1: KHÔNG KHÍ =================
          _buildFluentSectionCard(
            title: 'Môi trường Không khí',
            icon: Icons.air_rounded,
            headerColor: const Color(0xFF0284C7),
            badgeText: 'Air Station #01',
            badgeBg: const Color(0xFFE0F2FE),
            badgeFg: const Color(0xFF0369A1),
            children: [
              Row(
                children: [
                  Expanded(child: _buildFluentMetricTile('Nhiệt độ không khí', '$airTemp °C', Icons.thermostat_rounded, const Color(0xFFEF4444), '✓ Mát mẻ, lý tưởng')),
                  const SizedBox(width: 10),
                  Expanded(child: _buildFluentMetricTile('Độ ẩm không khí', '$airHumidity %', Icons.water_drop_rounded, const Color(0xFF0284C7), '✓ Độ ẩm tối ưu')),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _buildFluentMetricTile('Tốc độ & Hướng gió', '$airWind', Icons.wind_power_rounded, const Color(0xFF3B82F6), 'Gió nhẹ dễ chịu')),
                  const SizedBox(width: 10),
                  Expanded(child: _buildFluentMetricTile('Lượng & Cường độ mưa', '$airRain', Icons.cloud_rain_rounded, const Color(0xFF0284C7), 'Mưa nhỏ không đáng kể')),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _buildFluentMetricTile('Chỉ số UV', '$uv (Vừa)', Icons.wb_sunny_rounded, const Color(0xFFF59E0B), 'An toàn cho lá')),
                  const SizedBox(width: 10),
                  Expanded(child: _buildFluentMetricTile('Bức xạ mặt trời', '$solar', Icons.solar_power_rounded, const Color(0xFFEA580C), 'Quang hợp tốt')),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),

          // ================= MÔI TRƯỜNG 2: ĐẤT ĐA TẦNG =================
          _buildFluentSectionCard(
            title: 'Cảm biến Đất Đa tầng',
            icon: Icons.layers_rounded,
            headerColor: const Color(0xFFD97706),
            badgeText: 'Multilayer 7-in-1',
            badgeBg: const Color(0xFFFEF3C7),
            badgeFg: const Color(0xFF92400E),
            headerAction: Container(
              margin: const EdgeInsets.only(top: 8, bottom: 4),
              child: Row(
                children: [
                  _depthChipFluent(10, 'Tầng 10 cm'),
                  const SizedBox(width: 6),
                  _depthChipFluent(20, 'Tầng 20 cm'),
                  const SizedBox(width: 6),
                  _depthChipFluent(30, 'Tầng 30 cm'),
                ],
              ),
            ),
            children: [
              Row(
                children: [
                  Expanded(child: _buildFluentMetricTile('Độ ẩm đất (${_selectedSoilDepth}cm)', '$moisture %', Icons.water_drop_rounded, const Color(0xFFD97706), '✓ Đủ ẩm rễ')),
                  const SizedBox(width: 10),
                  Expanded(child: _buildFluentMetricTile('Nhiệt độ đất (${_selectedSoilDepth}cm)', '$temp °C', Icons.thermostat_rounded, const Color(0xFFD97706), '✓ Nhiệt độ mát')),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _buildFluentMetricTile('Độ pH Đất', '$ph', Icons.science_rounded, const Color(0xFFD97706), '✓ Đất trung tính')),
                  const SizedBox(width: 10),
                  Expanded(child: _buildFluentMetricTile('Độ EC', '$ec mS/cm', Icons.bolt_rounded, const Color(0xFFD97706), 'Dẫn điện chuẩn')),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _buildFluentMetricTile('Độ mặn', '$salinity ‰', Icons.grain_rounded, const Color(0xFFD97706), 'An toàn không mặn')),
                  const SizedBox(width: 10),
                  Expanded(child: _buildFluentMetricTile('Dinh dưỡng N-P-K', '$npk', Icons.eco_rounded, const Color(0xFFD97706), 'mg/kg (Cân bằng)')),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),

          // ================= MÔI TRƯỜNG 3: NƯỚC TƯỚI =================
          _buildFluentSectionCard(
            title: 'Môi trường Nước tưới',
            icon: Icons.water_rounded,
            headerColor: const Color(0xFF059669),
            badgeText: 'Bể tưới IoT',
            badgeBg: const Color(0xFFDCFCE7),
            badgeFg: const Color(0xFF15803D),
            children: [
              Row(
                children: [
                  Expanded(child: _buildFluentMetricTile('pH Nước tưới', '$waterPh', Icons.science_rounded, const Color(0xFF059669), '✓ Chuẩn nước sạch')),
                  const SizedBox(width: 10),
                  Expanded(child: _buildFluentMetricTile('Oxy hòa tan (DO)', '$waterDo mg/L', Icons.air_rounded, const Color(0xFF059669), 'Tốt cho rễ')),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _buildFluentMetricTile('Độ đục nước', '$waterTurbidity NTU', Icons.water_damage_rounded, const Color(0xFF059669), 'Nước trong sạch')),
                  const SizedBox(width: 10),
                  Expanded(child: _buildFluentMetricTile('Mực nước bể lưu', '$waterLevel %', Icons.inventory_2_rounded, const Color(0xFF059669), 'Đầy đủ nước tưới')),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildFluentSectionCard({
    required String title,
    required IconData icon,
    required Color headerColor,
    required String badgeText,
    required Color badgeBg,
    required Color badgeFg,
    Widget? headerAction,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10, offset: const Offset(0, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(icon, color: headerColor, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    title,
                    style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.bold, color: headerColor),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: badgeBg,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: badgeFg.withOpacity(0.3)),
                ),
                child: Text(badgeText, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: badgeFg)),
              ),
            ],
          ),
          if (headerAction != null) headerAction,
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _buildFluentMetricTile(String label, String value, IconData icon, Color color, String subtext) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            subtext,
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _depthChipFluent(int depth, String label) {
    final bool active = _selectedSoilDepth == depth;
    return Expanded(
      child: GestureDetector(
        onTap: () => _onSelectDepth(depth),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(
            color: active ? const Color(0xFFFEF3C7) : Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: active ? const Color(0xFFD97706) : const Color(0xFFFDE68A)),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: active ? const Color(0xFF78350F) : const Color(0xFF854D0E),
                fontSize: 11,
                fontWeight: active ? FontWeight.bold : FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildWeatherTab() {
    final forecast = _realWeatherForecast;
    final lat = _currentFarm?.latitude ?? 12.68;
    final lng = _currentFarm?.longitude ?? 108.03;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0284C7), Color(0xFF0369A1)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(color: const Color(0xFF0284C7).withOpacity(0.2), blurRadius: 10, offset: const Offset(0, 4)),
              ],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.cloud_sync_rounded, color: Colors.white, size: 26),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Dự Báo Thời Tiết 6 Ngày Tới (API Thật)',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Tọa độ GPS trang trại: ${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}',
                        style: const TextStyle(color: Colors.white70, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 6 Weather Cards
          ...forecast.map((item) {
            final dayName = item['day_name'] ?? 'Hôm nay';
            final dateStr = item['date_formatted'] ?? '';
            final tempRange = item['temp_range'] ?? '25°C - 33°C';
            final rainProb = item['rain_prob'] ?? 20;
            final hum = item['humidity'] ?? 70;
            final wind = item['wind_speed'] ?? 12;
            final iconEmoji = item['icon'] ?? '☀️';
            final condition = item['condition'] ?? 'Nắng ấm';
            final advice = item['advice'] ?? 'Khuyến nghị canh tác.';
            final color = Color(item['color_val'] ?? 0xFF10B981);

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
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
                      Row(
                        children: [
                          Text(iconEmoji, style: const TextStyle(fontSize: 22)),
                          const SizedBox(width: 8),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '$dayName · $dateStr',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                              ),
                              Text(
                                condition,
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
                              ),
                            ],
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: Text(
                          tempRange,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      _weatherMicroBadge(Icons.water_drop_outlined, 'Mưa: $rainProb%', Colors.blue),
                      const SizedBox(width: 8),
                      _weatherMicroBadge(Icons.waves_rounded, 'Độ ẩm: $hum%', Colors.teal),
                      const SizedBox(width: 8),
                      _weatherMicroBadge(Icons.air_rounded, 'Gió: $wind km/h', Colors.indigo),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.06),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: color.withOpacity(0.2)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.lightbulb_outline_rounded, size: 16, color: color),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            advice,
                            style: TextStyle(fontSize: 11.5, color: color, fontWeight: FontWeight.w600, height: 1.35),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ],
      ),
    );
  }

  Widget _weatherMicroBadge(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  Widget _buildPlantsAndLogsTab() {
    final filteredPlants = _farmPlants.where((p) {
      if (_plantSearchQuery.isEmpty) return true;
      final q = _plantSearchQuery.toLowerCase();
      return p.displayName.toLowerCase().contains(q) ||
          p.plantType.toLowerCase().contains(q) ||
          (p.plantVariety ?? '').toLowerCase().contains(q) ||
          (p.location ?? '').toLowerCase().contains(q);
    }).toList();

    final healthyCount = _farmPlants.where((p) => p.healthStatus.toLowerCase().contains('tốt')).length;
    final attentionCount = _farmPlants.where((p) => p.healthStatus.toLowerCase().contains('chú ý') || p.healthStatus.toLowerCase().contains('bệnh')).length;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Quick Stats Header
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.grayBorder),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Cây Quản Lý', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                      const SizedBox(height: 2),
                      Text('${_farmPlants.length} cây', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textMain)),
                    ],
                  ),
                ),
                Container(width: 1, height: 30, color: AppTheme.grayBorder),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Khỏe Mạnh', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                      const SizedBox(height: 2),
                      Text('$healthyCount cây', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
                    ],
                  ),
                ),
                Container(width: 1, height: 30, color: AppTheme.grayBorder),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Cần Chăm Sóc', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                      const SizedBox(height: 2),
                      Text('$attentionCount cây', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: attentionCount > 0 ? AppTheme.amber : AppTheme.green)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 2. Quick Log Action Button
          SizedBox(
            width: double.infinity,
            height: 46,
            child: ElevatedButton.icon(
              onPressed: _openQuickCareLog,
              icon: const Icon(Icons.edit_note_rounded, size: 20),
              label: const Text('GHI NHẬT KÝ CHO VƯỜN NÀY (1-CHẠM)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.greenDark,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 18),

          // 3. Search input
          TextField(
            onChanged: (val) => setState(() => _plantSearchQuery = val.trim()),
            decoration: InputDecoration(
              hintText: 'Tìm theo mã cây, giống, vị trí...',
              prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.textMuted, size: 20),
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.grayBorder)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.grayBorder)),
            ),
          ),
          const SizedBox(height: 16),

          // 4. Section 1: Plants List
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'DANH SÁCH CÂY TRỒNG THUỘC VƯỜN',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
              ),
              Text('${filteredPlants.length} cây', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
            ],
          ),
          const SizedBox(height: 8),

          if (filteredPlants.isEmpty)
            Container(
              padding: const EdgeInsets.all(20),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppTheme.grayBorder)),
              child: const Text('Không tìm thấy cây nào phù hợp.', style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: filteredPlants.length,
              itemBuilder: (ctx, idx) {
                final plant = filteredPlants[idx];
                return PlantCard(
                  plant: plant,
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => PlantDetailPage(plant: plant)),
                    );
                  },
                  onLogTap: () {
                    showDialog(
                      context: context,
                      barrierDismissible: false,
                      builder: (_) => LogEditDialog(
                        plantIds: [plant.id],
                        farmName: _currentFarm?.name ?? plant.plantType,
                        onLogSaved: _loadInitialData,
                      ),
                    );
                  },
                );
              },
            ),

          const SizedBox(height: 24),

          // 5. Section 2: Cultivation History Logs for this Farm
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'LỊCH SỬ CANH TÁC & CHĂM SÓC GẦN ĐÂY',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
              ),
              Text('${_farmLogs.length} bản ghi', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
            ],
          ),
          const SizedBox(height: 8),

          if (_farmLogs.isEmpty)
            Container(
              padding: const EdgeInsets.all(20),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppTheme.grayBorder)),
              child: const Text('Chưa có nhật ký canh tác nào cho trang trại này.', style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _farmLogs.length > 8 ? 8 : _farmLogs.length,
              itemBuilder: (ctx, idx) {
                final log = _farmLogs[idx];
                Color badgeBg = const Color(0xFFF1F5F9);
                Color badgeText = const Color(0xFF475569);
                IconData logIcon = Icons.edit_note_rounded;

                final lType = log.logType.toLowerCase();
                if (lType.contains('tưới')) {
                  badgeBg = const Color(0xFFEFF6FF);
                  badgeText = const Color(0xFF2563EB);
                  logIcon = Icons.water_drop_rounded;
                } else if (lType.contains('phân')) {
                  badgeBg = const Color(0xFFECFDF5);
                  badgeText = const Color(0xFF059669);
                  logIcon = Icons.eco_rounded;
                } else if (lType.contains('thuốc') || lType.contains('phun')) {
                  badgeBg = const Color(0xFFFEF2F2);
                  badgeText = const Color(0xFFDC2626);
                  logIcon = Icons.medication_rounded;
                } else if (lType.contains('tỉa') || lType.contains('cắt')) {
                  badgeBg = const Color(0xFFFFFBEB);
                  badgeText = const Color(0xFFD97706);
                  logIcon = Icons.content_cut_rounded;
                } else if (lType.contains('thu hoạch')) {
                  badgeBg = const Color(0xFFFAF5FF);
                  badgeText = const Color(0xFF7C3AED);
                  logIcon = Icons.agriculture_rounded;
                }

                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.grayBorder),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(10)),
                        child: Icon(logIcon, color: badgeText, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  log.logType,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF0F172A)),
                                ),
                                Text(
                                  log.logDate ?? '',
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                ),
                              ],
                            ),
                            if (log.note != null && log.note!.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(
                                log.note!,
                                style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                            const SizedBox(height: 2),
                            Text(
                              'Cây #${log.treeCode ?? log.plantId} · Người thực hiện: ${log.operatorName ?? log.creatorName ?? "Nông hộ"}',
                              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
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
