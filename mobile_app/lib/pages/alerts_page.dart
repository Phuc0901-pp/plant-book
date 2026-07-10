import 'package:flutter/material.dart';
import '../models/farm.dart';
import '../models/plant.dart';
import '../models/plant_log.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';
import '../components/loading_indicator.dart';
import 'plant_detail_page.dart';

class AlertsPage extends StatefulWidget {
  const AlertsPage({super.key});

  @override
  State<AlertsPage> createState() => _AlertsPageState();
}

class _AlertsPageState extends State<AlertsPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  String? _error;

  List<Farm> _farms = [];
  List<Plant> _plants = [];
  Map<int, List<PlantLog>> _plantLogs = {}; // plantId -> logs

  List<Map<String, dynamic>> _diseaseAlerts = [];
  List<Map<String, dynamic>> _scheduleAlerts = [];

  @override
  void initState() {
    super.initState();
    _loadAlertData();
  }

  Future<void> _loadAlertData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final farms = await _apiService.fetchFarms();
      final plants = await _apiService.fetchPlants();
      
      Map<int, List<PlantLog>> logsMap = {};
      
      // Load logs for all plants concurrently
      final logsResults = await Future.wait(
        plants.map((p) => _apiService.fetchPlantLogs(p.id))
      );

      for (var i = 0; i < plants.length; i++) {
        logsMap[plants[i].id] = logsResults[i];
      }

      setState(() {
        _farms = farms;
        _plants = plants;
        _plantLogs = logsMap;
        _isLoading = false;
      });

      _computeAlerts();
    } catch (e) {
      setState(() {
        _error = 'Không thể đồng bộ dữ liệu cảnh báo từ máy chủ.';
        _isLoading = false;
      });
    }
  }

  void _computeAlerts() {
    List<Map<String, dynamic>> diseases = [];
    List<Map<String, dynamic>> schedules = [];

    // 1. Compute Disease Alerts (Pin to top)
    for (var plant in _plants) {
      final logs = _plantLogs[plant.id] ?? [];
      if (logs.isNotEmpty) {
        // Sort logs by date descending
        logs.sort((a, b) => b.logDate.compareTo(a.logDate));
        final latest = logs.first;
        
        // If the latest log type is "Bệnh cây", alert it immediately
        if (latest.logType == 'Bệnh cây') {
          final diseaseName = latest.details['disease'] ?? latest.details['value'] ?? 'Chưa xác định';
          diseases.add({
            'plant': plant,
            'log': latest,
            'title': 'Cây đang bị sâu bệnh hại!',
            'desc': 'Cây #${plant.displayName} (${plant.plantType}) được báo cáo bị: $diseaseName vào ngày ${latest.logDate}.',
            'severity': 'high',
          });
        }
      } else if (plant.healthStatus == 'Bệnh') {
        // Fallback check based on status
        diseases.add({
          'plant': plant,
          'title': 'Cây có trạng thái Bệnh!',
          'desc': 'Cây #${plant.displayName} (${plant.plantType}) có trạng thái sức khỏe là Bệnh nhưng chưa có nhật ký chi tiết.',
          'severity': 'high',
        });
      }
    }

    // 2. Compute Schedule Alerts (Watering / Fertilizing overdue)
    // Thresholds: Overdue if not watered in 3 days, not fertilized in 30 days
    final now = DateTime.now();

    for (var farm in _farms) {
      final farmPlants = _plants.where((p) => p.farmId == farm.id).toList();
      if (farmPlants.isEmpty) continue;

      int unwateredCount = 0;
      List<Plant> unwateredPlants = [];
      
      int unfertilizedCount = 0;
      List<Plant> unfertilizedPlants = [];

      for (var plant in farmPlants) {
        final logs = _plantLogs[plant.id] ?? [];
        
        // Check watering logs
        final waterLogs = logs.where((l) => l.logType == 'Tưới nước').toList();
        if (waterLogs.isNotEmpty) {
          waterLogs.sort((a, b) => b.logDate.compareTo(a.logDate));
          final lastWaterDate = DateTime.tryParse(waterLogs.first.logDate);
          if (lastWaterDate != null && now.difference(lastWaterDate).inDays >= 3) {
            unwateredCount++;
            unwateredPlants.add(plant);
          }
        } else {
          // Never watered
          unwateredCount++;
          unwateredPlants.add(plant);
        }

        // Check fertilizing logs
        final fertLogs = logs.where((l) => l.logType == 'Bón phân').toList();
        if (fertLogs.isNotEmpty) {
          fertLogs.sort((a, b) => b.logDate.compareTo(a.logDate));
          final lastFertDate = DateTime.tryParse(fertLogs.first.logDate);
          if (lastFertDate != null && now.difference(lastFertDate).inDays >= 30) {
            unfertilizedCount++;
            unfertilizedPlants.add(plant);
          }
        } else {
          // Never fertilized
          unfertilizedCount++;
          unfertilizedPlants.add(plant);
        }
      }

      // Group by Farm if ALL plants are overdue
      if (unwateredCount == farmPlants.length) {
        schedules.add({
          'farm': farm,
          'type': 'water_farm',
          'title': 'Chậm tưới nước toàn vườn!',
          'desc': 'Tất cả các cây trồng tại nông trại "${farm.name}" chưa được tưới nước trong 3 ngày qua.',
          'severity': 'medium',
        });
      } else if (unwateredCount > 0) {
        // Individual plant alerts
        for (var p in unwateredPlants) {
          schedules.add({
            'plant': p,
            'type': 'water_plant',
            'title': 'Cây chậm tưới nước',
            'desc': 'Cây #${p.displayName} tại "${farm.name}" chưa được tưới nước theo lịch.',
            'severity': 'low',
          });
        }
      }

      if (unfertilizedCount == farmPlants.length) {
        schedules.add({
          'farm': farm,
          'type': 'fert_farm',
          'title': 'Chậm bón phân định kỳ!',
          'desc': 'Toàn bộ cây trồng tại nông trại "${farm.name}" đã quá hạn bón phân định kỳ (30 ngày).',
          'severity': 'medium',
        });
      } else if (unfertilizedCount > 0) {
        for (var p in unfertilizedPlants) {
          schedules.add({
            'plant': p,
            'type': 'fert_plant',
            'title': 'Cây chậm bón phân',
            'desc': 'Cây #${p.displayName} đã quá hạn bón phân định kỳ.',
            'severity': 'low',
          });
        }
      }
    }

    setState(() {
      _diseaseAlerts = diseases;
      _scheduleAlerts = schedules;
    });
  }

  @override
  Widget build(BuildContext context) {
    final totalAlerts = _diseaseAlerts.length + _scheduleAlerts.length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Trung tâm Cảnh báo'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadAlertData,
          )
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang rà soát trạng thái cây trồng...')
          : _error != null
              ? _buildErrorView()
              : RefreshIndicator(
                  onRefresh: _loadAlertData,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Alert statistics banner
                      _buildStatsBanner(totalAlerts),
                      const SizedBox(height: 16),
                      
                      // 1. High Priority Disease Alerts (Pinned to top)
                      if (_diseaseAlerts.isNotEmpty) ...[
                        _sectionTitle('⚠️ CẢNH BÁO SÂU BỆNH HẠI (NGUY CẤP)', AppTheme.red),
                        ..._diseaseAlerts.map((a) => _buildAlertCard(a)),
                        const SizedBox(height: 20),
                      ],
                      
                      // 2. Schedule Alerts
                      if (_scheduleAlerts.isNotEmpty) ...[
                        _sectionTitle('📅 LỊCH TRÌNH CANH TÁC QUÁ HẠN', AppTheme.amber),
                        ..._scheduleAlerts.map((a) => _buildAlertCard(a)),
                      ],
                      
                      if (totalAlerts == 0) _buildCleanStateView(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.cloud_off_rounded, size: 48, color: AppTheme.red),
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: AppTheme.textMuted)),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: _loadAlertData, child: const Text('Tải lại')),
        ],
      ),
    );
  }

  Widget _buildStatsBanner(int count) {
    final Color bannerColor = count > 0 ? AppTheme.red : AppTheme.green;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bannerColor.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: bannerColor.withOpacity(0.2), width: 1.5),
      ),
      child: Row(
        children: [
          Icon(count > 0 ? Icons.warning_amber_rounded : Icons.check_circle_outline_rounded, color: bannerColor, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  count > 0 ? 'Phát hiện $count cảnh báo thực địa' : 'Vườn trồng an toàn!',
                  style: TextStyle(fontWeight: FontWeight.bold, color: bannerColor, fontSize: 15),
                ),
                Text(
                  count > 0 ? 'Nông hộ vui lòng rà soát và xử lý các đầu việc dưới đây.' : 'Tất cả các hoạt động chăm sóc cây đều đúng lịch trình.',
                  style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _sectionTitle(String title, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, left: 4),
      child: Text(
        title,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color, letterSpacing: 1),
      ),
    );
  }

  Widget _buildAlertCard(Map<String, dynamic> alert) {
    Color cardBorder;
    Color iconColor;
    IconData icon;
    
    if (alert['severity'] == 'high') {
      cardBorder = AppTheme.red;
      iconColor = AppTheme.red;
      icon = Icons.coronavirus_rounded;
    } else if (alert['severity'] == 'medium') {
      cardBorder = AppTheme.amber;
      iconColor = AppTheme.amber;
      icon = Icons.warning_rounded;
    } else {
      cardBorder = Colors.blue;
      iconColor = Colors.blue;
      icon = Icons.info_outline_rounded;
    }

    final plant = alert['plant'] as Plant?;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 10),
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: cardBorder.withOpacity(0.3), width: 1.5),
      ),
      child: InkWell(
        onTap: plant != null
            ? () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => PlantDetailPage(plant: plant)),
                ).then((_) => _loadAlertData());
              }
            : null,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: iconColor, size: 24),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      alert['title'] as String,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textMain),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      alert['desc'] as String,
                      style: const TextStyle(fontSize: 12, color: AppTheme.textMuted, height: 1.4),
                    ),
                    if (plant != null) ...[
                      const SizedBox(height: 8),
                      const Row(
                        children: [
                          Text('Bấm để ghi nhật ký khắc phục', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.green)),
                          SizedBox(width: 4),
                          Icon(Icons.arrow_forward_rounded, size: 10, color: AppTheme.green),
                        ],
                      )
                    ]
                  ],
                ),
              )
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCleanStateView() {
    return Container(
      margin: const EdgeInsets.only(top: 60),
      alignment: Alignment.center,
      child: const Column(
        children: [
          Icon(Icons.spa_rounded, size: 72, color: AppTheme.green),
          SizedBox(height: 16),
          Text(
            'Trang trại phát triển tốt!',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textMain),
          ),
          SizedBox(height: 8),
          Text(
            'Không phát hiện sâu bệnh hại hay quá hạn chăm sóc nào.',
            style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
          )
        ],
      ),
    );
  }
}
