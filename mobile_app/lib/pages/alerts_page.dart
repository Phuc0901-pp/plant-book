import 'package:flutter/material.dart';
import '../models/farm.dart';
import '../models/plant.dart';
import '../models/plant_log.dart';
import '../services/api_service.dart';
import '../services/notification_service.dart';
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
  final NotificationService _notificationService = NotificationService();
  bool _isLoading = true;
  String? _error;

  List<Farm> _farms = [];
  List<Plant> _plants = [];
  Map<int, List<PlantLog>> _plantLogs = {};

  List<Map<String, dynamic>> _diseaseAlerts = [];
  List<Map<String, dynamic>> _scheduleAlerts = [];

  String? _selectedFarmId;
  String _inboxFilter = 'all';
  DateTime _lastRefreshTime = DateTime.now();

  @override
  void initState() {
    super.initState();
    _loadAlertData();
    _notificationService.init();
  }

  Future<void> _loadAlertData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await _notificationService.refreshNotifications();
      final farms = await _apiService.fetchFarms();
      final plants = await _apiService.fetchPlants();

      Map<int, List<PlantLog>> logsMap = {};

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
        _lastRefreshTime = DateTime.now();
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

  void _openPreferencesSheet() {
    final currentPrefs = _notificationService.preferences;
    bool soundEnabled = currentPrefs['sound_enabled'] != false;
    bool quietHours = currentPrefs['quiet_hours_enabled'] == true;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Cài đặt Chuông & Giờ yên lặng',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Phát âm thanh & Rung thông báo'),
                      subtitle: const Text('Cảnh báo Khẩn cấp luôn ưu tiên báo động'),
                      value: soundEnabled,
                      onChanged: (v) {
                        setModalState(() => soundEnabled = v);
                        _notificationService.updatePreferences({'sound_enabled': v});
                      },
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Giờ yên lặng (22:00 – 06:00)'),
                      subtitle: const Text('Tắt chuông tin thường ban đêm, giữ nguyên còi khẩn cấp'),
                      value: quietHours,
                      onChanged: (v) {
                        setModalState(() => quietHours = v);
                        _notificationService.updatePreferences({
                          'quiet_hours_enabled': v,
                          'quiet_start': '22:00',
                          'quiet_end': '06:00',
                        });
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _computeAlerts() {
    List<Map<String, dynamic>> diseases = [];
    List<Map<String, dynamic>> schedules = [];

    for (var plant in _plants) {
      final logs = _plantLogs[plant.id] ?? [];
      if (logs.isNotEmpty) {
        logs.sort((a, b) => b.logDate.compareTo(a.logDate));
        final latest = logs.first;

        if (latest.logType == 'Bệnh cây') {
          final diseaseName = latest.details['disease'] ?? latest.details['value'] ?? 'Chưa xác định';
          diseases.add({
            'plant': plant,
            'log': latest,
            'title': 'Cây đang bị sâu bệnh hại!',
            'desc': 'Cây #${plant.displayName} (${plant.plantType}) được báo cáo bị: $diseaseName vào ngày ${latest.logDate}.',
            'severity': 'high',
            'farmId': plant.farmId,
          });
        }
      } else if (plant.healthStatus == 'Bệnh' || plant.healthStatus == 'Cần chú ý') {
        diseases.add({
          'plant': plant,
          'title': plant.healthStatus == 'Bệnh' ? 'Cây có trạng thái Bệnh!' : 'Cây cần chú ý sức khỏe!',
          'desc': 'Cây #${plant.displayName} (${plant.plantType}) có trạng thái sức khỏe là "${plant.healthStatus}".',
          'severity': 'high',
          'farmId': plant.farmId,
        });
      }
    }

    diseases.sort((a, b) {
      final pA = a['plant'] as Plant?;
      final pB = b['plant'] as Plant?;
      final codeA = pA?.treeCode ?? pA?.displayName ?? '';
      final codeB = pB?.treeCode ?? pB?.displayName ?? '';
      return codeA.toLowerCase().compareTo(codeB.toLowerCase());
    });

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

        final waterLogs = logs.where((l) => l.logType == 'Tưới nước').toList();
        if (waterLogs.isNotEmpty) {
          waterLogs.sort((a, b) => b.logDate.compareTo(a.logDate));
          final lastWaterDate = DateTime.tryParse(waterLogs.first.logDate);
          if (lastWaterDate != null && now.difference(lastWaterDate).inDays >= 3) {
            unwateredCount++;
            unwateredPlants.add(plant);
          }
        } else {
          unwateredCount++;
          unwateredPlants.add(plant);
        }

        final fertLogs = logs.where((l) => l.logType == 'Bón phân').toList();
        if (fertLogs.isNotEmpty) {
          fertLogs.sort((a, b) => b.logDate.compareTo(a.logDate));
          final lastFertDate = DateTime.tryParse(fertLogs.first.logDate);
          if (lastFertDate != null && now.difference(lastFertDate).inDays >= 30) {
            unfertilizedCount++;
            unfertilizedPlants.add(plant);
          }
        } else {
          unfertilizedCount++;
          unfertilizedPlants.add(plant);
        }
      }

      if (unwateredCount == farmPlants.length) {
        schedules.add({
          'farm': farm,
          'farmId': farm.id,
          'type': 'water_farm',
          'title': 'Chậm tưới nước toàn vườn!',
          'desc': 'Tất cả các cây trồng tại nông trại "${farm.name}" chưa được tưới nước trong 3 ngày qua.',
          'severity': 'medium',
          'priorityRank': 1,
        });
      } else if (unwateredCount > 0) {
        for (var p in unwateredPlants) {
          schedules.add({
            'plant': p,
            'farmId': farm.id,
            'type': 'water_plant',
            'title': 'Cây chậm tưới nước',
            'desc': 'Cây #${p.displayName} tại "${farm.name}" chưa được tưới nước theo lịch.',
            'severity': 'medium',
            'priorityRank': 1,
          });
        }
      }

      if (unfertilizedCount == farmPlants.length) {
        schedules.add({
          'farm': farm,
          'farmId': farm.id,
          'type': 'fert_farm',
          'title': 'Chậm bón phân định kỳ!',
          'desc': 'Toàn bộ cây trồng tại nông trại "${farm.name}" đã quá hạn bón phân định kỳ (30 ngày).',
          'severity': 'low',
          'priorityRank': 2,
        });
      } else if (unfertilizedCount > 0) {
        for (var p in unfertilizedPlants) {
          schedules.add({
            'plant': p,
            'farmId': farm.id,
            'type': 'fert_plant',
            'title': 'Cây chậm bón phân',
            'desc': 'Cây #${p.displayName} tại "${farm.name}" đã quá hạn bón phân định kỳ.',
            'severity': 'low',
            'priorityRank': 2,
          });
        }
      }
    }

    schedules.sort((a, b) {
      int pA = (a['priorityRank'] as int?) ?? 99;
      int pB = (b['priorityRank'] as int?) ?? 99;
      if (pA != pB) return pA.compareTo(pB);

      final p1 = a['plant'] as Plant?;
      final p2 = b['plant'] as Plant?;
      final c1 = p1?.treeCode ?? p1?.displayName ?? a['farm']?.name ?? '';
      final c2 = p2?.treeCode ?? p2?.displayName ?? b['farm']?.name ?? '';
      return c1.toLowerCase().compareTo(c2.toLowerCase());
    });

    setState(() {
      _diseaseAlerts = diseases;
      _scheduleAlerts = schedules;
    });
  }

  @override
  Widget build(BuildContext context) {
    final filteredDiseases = _selectedFarmId == null
        ? _diseaseAlerts
        : _diseaseAlerts.where((a) => a['farmId']?.toString() == _selectedFarmId).toList();

    final filteredSchedules = _selectedFarmId == null
        ? _scheduleAlerts
        : _scheduleAlerts.where((a) => a['farmId']?.toString() == _selectedFarmId).toList();

    final totalAlerts = filteredDiseases.length + filteredSchedules.length;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Trung tâm Thông báo & Cảnh báo'),
          actions: [
            IconButton(
              icon: const Icon(Icons.done_all_rounded),
              tooltip: 'Đánh dấu đã đọc hết',
              onPressed: () => _notificationService.markAllRead(),
            ),
            IconButton(
              icon: const Icon(Icons.notifications_active_outlined),
              tooltip: 'Cài đặt chuông & Giờ yên lặng',
              onPressed: _openPreferencesSheet,
            ),
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: _loadAlertData,
            ),
          ],
          bottom: TabBar(
            tabs: [
              Tab(
                child: ValueListenableBuilder<int>(
                  valueListenable: _notificationService.unreadCount,
                  builder: (_, unread, __) {
                    return Text(unread > 0 ? 'Hộp thư ($unread)' : 'Hộp thư Thông báo');
                  },
                ),
              ),
              Tab(text: 'Thực địa ($totalAlerts)'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _buildInboxTab(),
            _buildFieldAlertsTab(filteredDiseases, filteredSchedules, totalAlerts),
          ],
        ),
      ),
    );
  }

  Widget _buildInboxTab() {
    return ValueListenableBuilder<List<Map<String, dynamic>>>(
      valueListenable: _notificationService.notifications,
      builder: (context, items, _) {
        final filtered = items.where((n) {
          if (_inboxFilter == 'unread') return n['is_read'] != true;
          if (_inboxFilter == 'danger') return n['type'] == 'danger' || n['severity'] == 'danger';
          return true;
        }).toList();

        return RefreshIndicator(
          onRefresh: _notificationService.refreshNotifications,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                child: Row(
                  children: [
                    _buildFilterChip('Tất cả', 'all'),
                    const SizedBox(width: 8),
                    _buildFilterChip('Chưa đọc', 'unread'),
                    const SizedBox(width: 8),
                    _buildFilterChip('Khẩn cấp', 'danger'),
                  ],
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? ListView(
                        children: const [
                          SizedBox(height: 80),
                          Center(
                            child: Text(
                              'Chưa có thông báo hệ thống nào.',
                              style: TextStyle(color: AppTheme.textMuted),
                            ),
                          ),
                        ],
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(14),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          final n = filtered[index];
                          final bool isUnread = n['is_read'] != true;
                          final String sev = (n['severity'] ?? n['type'] ?? 'info').toString();
                          final Color accent = sev == 'danger'
                              ? AppTheme.red
                              : (sev == 'warning' ? AppTheme.amber : AppTheme.green);

                          return Card(
                            elevation: 0,
                            margin: const EdgeInsets.only(bottom: 10),
                            color: isUnread ? accent.withOpacity(0.06) : Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(color: accent.withOpacity(isUnread ? 0.45 : 0.2)),
                            ),
                            child: ListTile(
                              onTap: () {
                                final int? id = n['id'] is int ? n['id'] as int : int.tryParse(n['id']?.toString() ?? '');
                                if (id != null) _notificationService.markRead(id);
                              },
                              leading: Icon(
                                sev == 'danger'
                                    ? Icons.security_rounded
                                    : (sev == 'warning' ? Icons.warning_amber_rounded : Icons.notifications_rounded),
                                color: accent,
                              ),
                              title: Text(
                                n['title']?.toString() ?? 'Thông báo',
                                style: TextStyle(
                                  fontWeight: isUnread ? FontWeight.bold : FontWeight.w600,
                                  fontSize: 13.5,
                                ),
                              ),
                              subtitle: Text(
                                n['message']?.toString() ?? '',
                                style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                              ),
                              trailing: IconButton(
                                icon: const Icon(Icons.close_rounded, size: 18),
                                onPressed: () {
                                  final int? id = n['id'] is int ? n['id'] as int : int.tryParse(n['id']?.toString() ?? '');
                                  if (id != null) _notificationService.archive(id);
                                },
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildFilterChip(String label, String key) {
    final selected = _inboxFilter == key;
    return ChoiceChip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      selected: selected,
      onSelected: (_) => setState(() => _inboxFilter = key),
    );
  }

  Widget _buildFieldAlertsTab(
    List<Map<String, dynamic>> filteredDiseases,
    List<Map<String, dynamic>> filteredSchedules,
    int totalAlerts,
  ) {
    if (_isLoading) {
      return const LoadingIndicator(message: 'Đang rà soát trạng thái cây trồng...');
    }
    if (_error != null) {
      return _buildErrorView();
    }
    return RefreshIndicator(
      onRefresh: _loadAlertData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_farms.isNotEmpty) ...[
            DropdownButtonFormField<String>(
              value: _selectedFarmId,
              decoration: InputDecoration(
                labelText: 'Lọc cảnh báo theo trang trại',
                labelStyle: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppTheme.grayBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppTheme.green),
                ),
              ),
              items: [
                const DropdownMenuItem(value: null, child: Text('Tất cả trang trại sở hữu', style: TextStyle(fontSize: 13))),
                ..._farms.map((f) => DropdownMenuItem(value: f.id.toString(), child: Text(f.name, style: const TextStyle(fontSize: 13)))),
              ],
              onChanged: (val) {
                setState(() {
                  _selectedFarmId = val;
                });
              },
            ),
            const SizedBox(height: 14),
          ],

          _buildStatsBanner(totalAlerts),
          const SizedBox(height: 16),

          if (filteredDiseases.isNotEmpty) ...[
            _sectionTitle('⚠️ CẢNH BÁO SÂU BỆNH HẠI & SỨC KHỎE (ƯU TIÊN 1)', AppTheme.red),
            ...filteredDiseases.map((a) => _buildAlertCard(a)),
            const SizedBox(height: 20),
          ],

          if (filteredSchedules.isNotEmpty) ...[
            _sectionTitle('📅 LỊCH TRÌNH CANH TÁC CẦN XỬ LÝ (TƯỚI NƯỚC & BÓN PHÂN)', AppTheme.amber),
            ...filteredSchedules.map((a) => _buildAlertCard(a)),
          ],

          if (totalAlerts == 0) _buildCleanStateView(),
        ],
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
    final timeStr = '${_lastRefreshTime.day.toString().padLeft(2, '0')}/${_lastRefreshTime.month.toString().padLeft(2, '0')}/${_lastRefreshTime.year} ${_lastRefreshTime.hour.toString().padLeft(2, '0')}:${_lastRefreshTime.minute.toString().padLeft(2, '0')}';

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
                ),
                const SizedBox(height: 4),
                Text(
                  '🔄 Đã làm mới kiểm tra hôm nay: $timeStr',
                  style: const TextStyle(fontSize: 10, color: AppTheme.green, fontWeight: FontWeight.w600),
                ),
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
