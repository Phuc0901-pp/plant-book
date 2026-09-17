import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../../utils/theme.dart';
import '../../services/api_service.dart';
import '../../models/plant_log.dart';
import '../../models/plant.dart';
import '../../components/loading_indicator.dart';
import '../../components/log_edit_dialog.dart';

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
  List<PlantLog> _allLogs = [];
  List<PlantLog> _filteredLogs = [];
  List<Plant> _cachedPlants = [];

  final List<Map<String, String>> _categories = [
    {'key': 'all', 'label': 'Tất cả'},
    {'key': 'Tưới nước', 'label': '💧 Tưới nước'},
    {'key': 'Bón phân', 'label': '🌿 Bón phân'},
    {'key': 'Phun thuốc', 'label': '💊 Phun thuốc'},
    {'key': 'Cắt tỉa', 'label': '✂️ Cắt tỉa'},
    {'key': 'Bệnh cây', 'label': '🍂 Bệnh cây'},
    {'key': 'Thu hoạch', 'label': '🌾 Thu hoạch'},
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
        _apiService.fetchRecentLogs(),
        _apiService.fetchPlants(),
      ]);

      if (mounted) {
        setState(() {
          _allLogs = results[0] as List<PlantLog>;
          _cachedPlants = results[1] as List<Plant>;
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
        // Category filter
        if (_selectedCategory != 'all' && !log.logType.toLowerCase().contains(_selectedCategory.toLowerCase())) {
          return false;
        }

        // Search query
        if (query.isNotEmpty) {
          final noteMatch = (log.note ?? '').toLowerCase().contains(query);
          final typeMatch = log.logType.toLowerCase().contains(query);
          final operatorMatch = (log.operatorName ?? '').toLowerCase().contains(query);
          return noteMatch || typeMatch || operatorMatch;
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
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => LogEditDialog(
        plantIds: defaultPlantId,
        farmName: _cachedPlants.isNotEmpty ? _cachedPlants.first.plantType : 'Trang trại Nông hộ',
      ),
    ).then((_) => _loadLogs());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Nhật Ký Canh Tác Timeline', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Tải lại nhật ký',
            onPressed: _loadLogs,
          ),
        ],
      ),
      body: Column(
        children: [
          // 1. Search Bar with Voice Dictation
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            color: Colors.white,
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    onChanged: (_) => _applyFilters(),
                    style: const TextStyle(fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Tìm theo hoạt động, phân thuốc, ghi chú...',
                      prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.textMuted, size: 20),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear_rounded, size: 18),
                              onPressed: () {
                                _searchController.clear();
                                _applyFilters();
                              },
                            )
                          : null,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.grayBorder)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                InkWell(
                  onTap: _toggleVoiceSearch,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _isListeningVoice ? AppTheme.red : AppTheme.greenLight,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: _isListeningVoice ? AppTheme.red : AppTheme.green.withOpacity(0.3)),
                    ),
                    child: Icon(
                      _isListeningVoice ? Icons.mic_rounded : Icons.mic_none_rounded,
                      color: _isListeningVoice ? Colors.white : AppTheme.greenDark,
                      size: 20,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 2. Category Filter Chips
          Container(
            height: 48,
            color: Colors.white,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              scrollDirection: Axis.horizontal,
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, idx) {
                final cat = _categories[idx];
                final isSelected = _selectedCategory == cat['key'];
                return ChoiceChip(
                  label: Text(
                    cat['label']!,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                      color: isSelected ? Colors.white : AppTheme.textMain,
                    ),
                  ),
                  selected: isSelected,
                  selectedColor: AppTheme.greenDark,
                  backgroundColor: const Color(0xFFF1F5F9),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  onSelected: (selected) {
                    setState(() {
                      _selectedCategory = selected ? cat['key']! : 'all';
                      _applyFilters();
                    });
                  },
                );
              },
            ),
          ),
          const Divider(height: 1, color: AppTheme.grayBorder),

          // 3. Logs List or Empty State
          Expanded(
            child: _isLoading
                ? const LoadingIndicator(message: 'Đang tải lịch sử canh tác thực tế...')
                : _filteredLogs.isEmpty
                    ? _buildEmptyState()
                    : RefreshIndicator(
                        onRefresh: _loadLogs,
                        color: AppTheme.greenDark,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(16),
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
        backgroundColor: AppTheme.greenDark,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Ghi nhật ký mới', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: AppTheme.greenLight, shape: BoxShape.circle),
              child: const Icon(Icons.history_edu_rounded, color: AppTheme.green, size: 48),
            ),
            const SizedBox(height: 16),
            const Text(
              'Chưa có nhật ký canh tác phù hợp',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textMain),
            ),
            const SizedBox(height: 6),
            const Text(
              'Hãy bấm nút Ghi nhật ký mới để ghi nhận lần tưới nước, bón phân hoặc kiểm tra sâu bệnh đầu tiên!',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppTheme.textMuted, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLogCard(PlantLog log) {
    Color typeColor = AppTheme.green;
    IconData typeIcon = Icons.eco_rounded;
    final lowerType = log.logType.toLowerCase();

    if (lowerType.contains('tưới')) {
      typeColor = AppTheme.blue;
      typeIcon = Icons.water_drop_rounded;
    } else if (lowerType.contains('bón') || lowerType.contains('phân')) {
      typeColor = AppTheme.green;
      typeIcon = Icons.grass_rounded;
    } else if (lowerType.contains('phun') || lowerType.contains('thuốc')) {
      typeColor = AppTheme.amber;
      typeIcon = Icons.medication_liquid_rounded;
    } else if (lowerType.contains('cắt') || lowerType.contains('tỉa')) {
      typeColor = const Color(0xFF8B5CF6);
      typeIcon = Icons.content_cut_rounded;
    } else if (lowerType.contains('bệnh') || lowerType.contains('sâu')) {
      typeColor = AppTheme.red;
      typeIcon = Icons.pest_control_rounded;
    } else if (lowerType.contains('thu hoạch')) {
      typeColor = const Color(0xFFD97706);
      typeIcon = Icons.agriculture_rounded;
    }

    final parsedDate = DateTime.tryParse(log.logDate);
    final formattedDate = parsedDate != null ? DateFormat('dd/MM/yyyy').format(parsedDate) : log.logDate;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: log.isPhiViolation ? AppTheme.red.withOpacity(0.5) : AppTheme.grayBorder,
          width: log.isPhiViolation ? 1.5 : 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Type badge, Date & PHI violation indicator
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: typeColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(typeIcon, color: typeColor, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      log.logType,
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: typeColor),
                    ),
                  ],
                ),
              ),
              Row(
                children: [
                  const Icon(Icons.calendar_today_rounded, size: 14, color: AppTheme.textMuted),
                  const SizedBox(width: 5),
                  Text(
                    formattedDate,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textMuted),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Content Note
          if (log.note != null && log.note!.isNotEmpty)
            Text(
              log.note!,
              style: const TextStyle(fontSize: 14, color: AppTheme.textMain, height: 1.35, fontWeight: FontWeight.w500),
            ),

          // PHI Warning Badge if violation
          if (log.isPhiViolation) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppTheme.redLight,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.red.withOpacity(0.3)),
              ),
              child: Row(
                children: const [
                  Icon(Icons.warning_rounded, color: AppTheme.red, size: 16),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Cảnh báo: Thu hoạch trong thời gian chưa hết cách ly thuốc BVTV!',
                      style: TextStyle(fontSize: 11.5, color: AppTheme.red, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Batch Code & Operator Info
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (log.batchCode != null && log.batchCode!.isNotEmpty)
                Text(
                  'Lô: ',
                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF1E40AF)),
                )
              else
                Text(
                  log.operatorName != null && log.operatorName!.isNotEmpty ? 'Thực hiện: ' : 'Ghi bởi Nông hộ',
                  style: const TextStyle(fontSize: 11.5, color: AppTheme.textMuted),
                ),
              if (log.mediaUrls.isNotEmpty)
                Row(
                  children: [
                    const Icon(Icons.photo_library_rounded, size: 15, color: AppTheme.textMuted),
                    const SizedBox(width: 4),
                    Text(' ảnh', style: const TextStyle(fontSize: 11.5, color: AppTheme.textMuted)),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}
