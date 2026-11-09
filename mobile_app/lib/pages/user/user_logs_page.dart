import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../../utils/theme.dart';
import '../../services/api_service.dart';
import '../../models/plant_log.dart';
import '../../models/plant.dart';
import '../../models/farm.dart';
import '../../components/loading_indicator.dart';
import '../../components/log_edit_dialog.dart';
import '../../core/theme/fluent_icons.dart';
import '../plant_detail_page.dart';

class UserLogsPage extends StatefulWidget {
  const UserLogsPage({super.key});

  @override
  State<UserLogsPage> createState() => _UserLogsPageState();
}

class _UserLogsPageState extends State<UserLogsPage> {
  final ApiService _apiService = ApiService();
  final TextEditingController _searchController = TextEditingController();
  final stt.SpeechToText _speech = stt.SpeechToText();

  bool _isLoading = true;
  bool _isListeningVoice = false;
  String _selectedCategory = 'all';
  String _selectedFarmId = 'all';
  List<PlantLog> _allLogs = [];
  List<PlantLog> _filteredLogs = [];
  List<Plant> _cachedPlants = [];
  List<Farm> _farms = [];

  final List<Map<String, dynamic>> _categories = [
    {'key': 'all', 'label': 'Tất cả', 'icon': LucideIconName.fileText},
    {'key': 'Nhân công', 'label': 'Nhân công', 'icon': LucideIconName.users},
    {'key': 'Tưới nước', 'label': 'Tưới nước', 'icon': LucideIconName.droplet},
    {'key': 'Bón phân', 'label': 'Bón phân', 'icon': LucideIconName.beaker},
    {'key': 'Phun thuốc', 'label': 'Phun thuốc', 'icon': LucideIconName.shield},
    {'key': 'Bệnh cây', 'label': 'Bệnh cây', 'icon': LucideIconName.alertTriangle},
    {'key': 'Thu hoạch', 'label': 'Thu hoạch', 'icon': LucideIconName.package},
  ];

  @override
  void initState() {
    super.initState();
    _loadLogs();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadLogs() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait<dynamic>([
        _apiService.fetchRecentLogs(days: 90),
        _apiService.fetchPlants(),
        _apiService.fetchFarms(),
      ]);

      if (mounted) {
        setState(() {
          _allLogs = results[0] as List<PlantLog>;
          _cachedPlants = results[1] as List<Plant>;
          _farms = results[2] as List<Farm>;
          _applyFilters();
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _applyFilters() {
    final query = _searchController.text.trim().toLowerCase();
    setState(() {
      _filteredLogs = _allLogs.where((log) {
        // Farm filter
        if (_selectedFarmId != 'all') {
          final targetFarmId = int.tryParse(_selectedFarmId);
          if (targetFarmId != null) {
            final plantOfLog = _cachedPlants.where((p) => p.id == log.plantId).toList();
            final logFarmId = log.farmId ?? (plantOfLog.isNotEmpty ? plantOfLog.first.farmId : null);
            if (logFarmId != null && logFarmId != targetFarmId) return false;
          }
        }

        // Category filter
        if (_selectedCategory != 'all') {
          final target = _selectedCategory.toLowerCase();
          final type = log.logType.toLowerCase();
          if (target == 'nhân công') {
            if (!type.contains('nhân công') && !type.contains('công') && !type.contains('cắt') && !type.contains('tỉa') && !type.contains('lao động')) {
              return false;
            }
          } else if (target == 'bệnh cây') {
            if (!type.contains('bệnh') && !type.contains('sâu')) return false;
          } else if (!type.contains(target)) {
            return false;
          }
        }

        // Search query
        if (query.isNotEmpty) {
          final noteMatch = (log.note ?? '').toLowerCase().contains(query);
          final typeMatch = log.logType.toLowerCase().contains(query);
          final operatorMatch = (log.operatorName ?? '').toLowerCase().contains(query);
          final treeMatch = (log.treeCode ?? '').toLowerCase().contains(query);
          final detailsStr = log.details.toString().toLowerCase();
          return noteMatch || typeMatch || operatorMatch || treeMatch || detailsStr.contains(query);
        }

        return true;
      }).toList();
    });
  }

  Future<void> _toggleVoiceSearch() async {
    if (!_isListeningVoice) {
      bool available = await _speech.initialize(
        onStatus: (status) {
          if (status == 'done' || status == 'notListening') {
            if (mounted) setState(() => _isListeningVoice = false);
          }
        },
        onError: (_) {
          if (mounted) setState(() => _isListeningVoice = false);
        },
      );

      if (available) {
        setState(() => _isListeningVoice = true);
        _speech.listen(
          localeId: 'vi_VN',
          onResult: (result) {
            if (mounted) {
              setState(() {
                _searchController.text = result.recognizedWords;
                _applyFilters();
              });
            }
          },
        );
      }
    } else {
      await _speech.stop();
      setState(() => _isListeningVoice = false);
    }
  }

  void _openAddLogDialog() {
    final defaultPlantId = _cachedPlants.isNotEmpty ? [_cachedPlants.first.id] : <int>[];
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => LogEditDialog(
        plantIds: defaultPlantId,
        farmName: _cachedPlants.isNotEmpty ? _cachedPlants.first.plantType : 'Trang trại Nông hộ',
        initialType: 'Nhân công',
        onLogSaved: _loadLogs,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.fluentSurface,
      appBar: AppBar(
        title: const Text(
          'Nhật Ký Canh Tác Timeline',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppTheme.fluentTextMain),
        ),
        actions: [
          IconButton(
            icon: const LucideIcon(LucideIconName.refreshCw, size: 18, color: AppTheme.fluentTextMuted),
            tooltip: 'Tải lại nhật ký',
            onPressed: _loadLogs,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // 1. Search Bar with Voice Dictation
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.fluentBorder, width: 0.8),
                      boxShadow: AppTheme.fluentShadow,
                    ),
                    child: TextField(
                      controller: _searchController,
                      onChanged: (_) => _applyFilters(),
                      style: const TextStyle(fontSize: 13.5),
                      decoration: InputDecoration(
                        hintText: 'Tìm theo hoạt động, nhân công, vật tư...',
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        prefixIcon: const Padding(
                          padding: EdgeInsets.all(10),
                          child: LucideIcon(LucideIconName.search, size: 18, color: AppTheme.fluentTextMuted),
                        ),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const LucideIcon(LucideIconName.close, size: 16, color: AppTheme.fluentTextMuted),
                                onPressed: () {
                                  _searchController.clear();
                                  _applyFilters();
                                },
                              )
                            : null,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                InkWell(
                  onTap: _toggleVoiceSearch,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _isListeningVoice ? AppTheme.rosePastel : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: _isListeningVoice ? AppTheme.roseText : AppTheme.fluentBorder,
                        width: 0.8,
                      ),
                      boxShadow: AppTheme.fluentShadow,
                    ),
                    child: LucideIcon(
                      LucideIconName.mic,
                      color: _isListeningVoice ? AppTheme.roseText : AppTheme.fluentEmerald,
                      size: 20,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 2. Category Filter Chips (Horizontal Fluent Pills)
          SizedBox(
            height: 44,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              scrollDirection: Axis.horizontal,
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (context, idx) {
                final cat = _categories[idx];
                final isSelected = _selectedCategory == cat['key'];
                return InkWell(
                  onTap: () {
                    setState(() {
                      _selectedCategory = cat['key'] as String;
                      _applyFilters();
                    });
                  },
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: isSelected ? AppTheme.fluentEmerald : Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isSelected ? AppTheme.fluentEmerald : AppTheme.fluentBorder,
                        width: 0.8,
                      ),
                      boxShadow: isSelected ? AppTheme.fluentShadow : null,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        LucideIcon(
                          cat['icon'] as LucideIconName,
                          size: 14,
                          color: isSelected ? Colors.white : AppTheme.fluentTextMuted,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          cat['label'] as String,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                            color: isSelected ? Colors.white : AppTheme.fluentTextMain,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 6),

          // 3. Logs List or Empty State
          Expanded(
            child: _isLoading
                ? const LoadingIndicator(message: 'Đang tải lịch sử canh tác thực tế...')
                : _filteredLogs.isEmpty
                    ? _buildEmptyState()
                    : RefreshIndicator(
                        onRefresh: _loadLogs,
                        color: AppTheme.fluentEmerald,
                        backgroundColor: Colors.white,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          itemCount: _filteredLogs.length,
                          itemBuilder: (context, idx) {
                            final log = _filteredLogs[idx];
                            return _buildLogCard(log);
                          },
                        ),
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAddLogDialog,
        backgroundColor: AppTheme.fluentEmerald,
        foregroundColor: Colors.white,
        elevation: 3,
        icon: const LucideIcon(LucideIconName.plus, size: 18, color: Colors.white),
        label: const Text('Ghi nhật ký mới', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            ChibiWeatherWidget(type: ChibiWeatherType.sun, size: 68),
            SizedBox(height: 16),
            Text(
              'Chưa có nhật ký canh tác phù hợp',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppTheme.fluentTextMain),
            ),
            SizedBox(height: 6),
            Text(
              'Hãy bấm nút "Ghi nhật ký mới" để ghi nhận thuê nhân công, tưới nước hoặc bón phân đầu tiên!',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12.5, color: AppTheme.fluentTextMuted, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLogCard(PlantLog log) {
    Color typeColor = AppTheme.fluentEmerald;
    Color typeBg = AppTheme.mintPastel;
    LucideIconName typeIcon = LucideIconName.sprout;

    final lowerType = log.logType.toLowerCase();
    final isLabor = lowerType.contains('nhân công') || lowerType.contains('công') || lowerType.contains('tỉa') || lowerType.contains('cắt');

    if (isLabor) {
      typeColor = AppTheme.lavenderText;
      typeBg = AppTheme.lavenderPastel;
      typeIcon = LucideIconName.users;
    } else if (lowerType.contains('tưới')) {
      typeColor = AppTheme.skyText;
      typeBg = AppTheme.skyPastel;
      typeIcon = LucideIconName.droplet;
    } else if (lowerType.contains('bón') || lowerType.contains('phân')) {
      typeColor = AppTheme.butterText;
      typeBg = AppTheme.butterPastel;
      typeIcon = LucideIconName.beaker;
    } else if (lowerType.contains('phun') || lowerType.contains('thuốc')) {
      typeColor = AppTheme.roseText;
      typeBg = AppTheme.rosePastel;
      typeIcon = LucideIconName.shield;
    } else if (lowerType.contains('bệnh') || lowerType.contains('sâu')) {
      typeColor = AppTheme.roseText;
      typeBg = AppTheme.rosePastel;
      typeIcon = LucideIconName.alertTriangle;
    } else if (lowerType.contains('thu hoạch')) {
      typeColor = const Color(0xFF059669);
      typeBg = const Color(0xFFD1FAE5);
      typeIcon = LucideIconName.package;
    }

    final parsedDate = DateTime.tryParse(log.logDate);
    final formattedDate = parsedDate != null ? DateFormat('dd/MM/yyyy').format(parsedDate) : log.logDate;

    // Extract Labor specific fields if available
    final details = log.details;
    final workContent = details['work_content'] ?? details['reason'] ?? '';
    final workerCount = details['worker_count'] ?? details['amount'];
    final laborCost = details['cost'] ?? details['labor_cost'];
    final startTime = details['start_time'];
    final endTime = details['end_time'];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: log.isPhiViolation ? AppTheme.roseText.withOpacity(0.4) : AppTheme.fluentBorder,
          width: log.isPhiViolation ? 1.5 : 0.8,
        ),
        boxShadow: AppTheme.fluentShadow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () {
            final matching = _cachedPlants.where((p) => p.id == log.plantId).toList();
            if (matching.isNotEmpty) {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => PlantDetailPage(plant: matching.first)),
              );
            }
          },
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Row: Activity Pill + Date
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: typeBg,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          LucideIcon(typeIcon, color: typeColor, size: 14),
                          const SizedBox(width: 5),
                          Text(
                            isLabor ? 'Nhân công' : log.logType,
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: typeColor),
                          ),
                        ],
                      ),
                    ),
                    Row(
                      children: [
                        const LucideIcon(LucideIconName.calendar, size: 12, color: AppTheme.fluentTextMuted),
                        const SizedBox(width: 4),
                        Text(
                          formattedDate,
                          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppTheme.fluentTextMuted),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Labor Specific Detail Row
                if (isLabor && (workContent != '' || workerCount != null)) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFAF5FF),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE9D5FF), width: 0.8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (workContent != '')
                          Row(
                            children: [
                              const LucideIcon(LucideIconName.scissors, size: 12, color: AppTheme.lavenderText),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'Nội dung: $workContent',
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF6B21A8)),
                                ),
                              ),
                            ],
                          ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            if (workerCount != null)
                              Text('👥 $workerCount người làm', style: const TextStyle(fontSize: 11.5, color: AppTheme.fluentTextMuted)),
                            if (laborCost != null)
                              Text('💰 Chi phí: $laborCost đ', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: AppTheme.butterText)),
                            if (startTime != null && startTime != '')
                              Text('⏰ $startTime - $endTime', style: const TextStyle(fontSize: 11, color: AppTheme.fluentTextMuted)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                ],

                // Note Content
                if (log.note != null && log.note!.isNotEmpty)
                  Text(
                    log.note!,
                    style: const TextStyle(fontSize: 13, color: AppTheme.fluentTextMain, height: 1.35, fontWeight: FontWeight.w500),
                  ),

                // PHI Warning Badge
                if (log.isPhiViolation) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppTheme.rosePastel,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.roseText.withOpacity(0.3), width: 0.8),
                    ),
                    child: Row(
                      children: const [
                        LucideIcon(LucideIconName.alertTriangle, color: AppTheme.roseText, size: 14),
                        SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Cảnh báo: Thu hoạch trong thời gian chưa hết cách ly thuốc BVTV!',
                            style: TextStyle(fontSize: 11, color: AppTheme.roseText, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Footer: Plant ID & Operator
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        'Cây #${log.treeCode ?? log.plantId} · ${log.operatorName != null && log.operatorName!.isNotEmpty ? "Người làm: ${log.operatorName}" : "Nông hộ"}',
                        style: const TextStyle(fontSize: 11, color: AppTheme.fluentTextMuted),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (log.mediaUrls.isNotEmpty)
                      Row(
                        children: [
                          const LucideIcon(LucideIconName.camera, size: 12, color: AppTheme.fluentTextMuted),
                          const SizedBox(width: 4),
                          Text('${log.mediaUrls.length} ảnh', style: const TextStyle(fontSize: 11, color: AppTheme.fluentTextMuted)),
                        ],
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
