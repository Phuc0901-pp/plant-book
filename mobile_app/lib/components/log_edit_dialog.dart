import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../models/plant_log.dart';
import '../models/supply.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';
import '../core/theme/fluent_icons.dart';

class LogEditDialog extends StatefulWidget {
  final List<int> plantIds;
  final PlantLog? log; // null means ADD, not null means EDIT
  final String? farmName;
  final String? initialType; // e.g. 'Nhân công', 'Bón phân'
  final VoidCallback? onLogSaved;

  const LogEditDialog({
    super.key,
    required this.plantIds,
    this.log,
    this.farmName,
    this.initialType,
    this.onLogSaved,
  });

  @override
  State<LogEditDialog> createState() => _LogEditDialogState();
}

class _LogEditDialogState extends State<LogEditDialog> {
  final _formKey = GlobalKey<FormState>();
  final _noteController = TextEditingController();

  // Custom detail controllers
  final _amountController = TextEditingController();
  final _manualNameController = TextEditingController();
  final _executorController = TextEditingController(text: 'Nông hộ / Kỹ thuật viên');
  final _equipmentController = TextEditingController();
  final _harvestQualityController = TextEditingController(text: 'Loại A (Đạt chuẩn xuất khẩu)');
  final _diseaseDescController = TextEditingController();

  // Dedicated Labor (Nhân công) Controllers - Defaults to BLANK text as requested!
  final _laborWorkContentController = TextEditingController(text: '');
  final _laborWorkerCountController = TextEditingController(text: '');
  final _laborCostController = TextEditingController(text: '');
  final _laborStartTimeController = TextEditingController(text: '');
  final _laborEndTimeController = TextEditingController(text: '');
  String _laborCostMode = 'total'; // 'total' (Cả đoàn) or 'per_person' (1 người)

  late String _selectedType;
  late DateTime _selectedDate;
  bool _isLoadingSupplies = false;
  bool _isSaving = false;
  bool _isListeningVoice = false;
  final stt.SpeechToText _speech = stt.SpeechToText();

  List<Supply> _allSupplies = [];
  List<Supply> _filteredSupplies = [];
  Supply? _selectedSupply;
  bool _noAccountingForWater = false;

  String _selectedUnit = 'kg';
  String _wateringMethod = 'Tưới nhỏ giọt';
  String _harvestUnit = 'kg';
  String _diseaseSeverity = 'Trung bình';

  final List<String> _activityTypes = [
    'Nhân công',
    'Tưới nước',
    'Bón phân',
    'Phun thuốc',
    'Thu hoạch',
    'Bệnh cây',
    'Khác',
  ];

  final List<String> _laborQuickChips = [
    'Cắt cành/tỉa lá',
    'Tỉa hoa/nụ non',
    'Làm cỏ xới gốc',
    'Bón phân',
    'Đào rãnh thoát nước',
    'Bọc trái chống côn trùng',
  ];

  final List<String> _wateringMethods = [
    'Tưới tay thủ công',
    'Tưới nhỏ giọt',
    'Tưới phun mưa',
    'Tưới phun sương',
  ];

  final List<String> _diseaseSeverities = [
    'Nhẹ',
    'Trung bình',
    'Nghiêm trọng',
  ];

  final List<String> _harvestUnits = [
    'kg',
    'tấn',
    'trái / quả',
    'thùng / sọt',
  ];

  final NumberFormat _currencyFormat = NumberFormat.currency(
    locale: 'vi_VN',
    symbol: 'đ',
    decimalDigits: 0,
  );

  @override
  void initState() {
    super.initState();
    final isEdit = widget.log != null;

    if (isEdit) {
      String rawType = widget.log!.logType;
      if (rawType == 'Cắt lá' || rawType == 'Tỉa cành/lá' || rawType == 'Cắt tỉa' || rawType == 'Tỉa hoa') {
        rawType = 'Nhân công';
      }
      _selectedType = _activityTypes.contains(rawType) ? rawType : 'Khác';
      _selectedDate = DateTime.tryParse(widget.log!.logDate) ?? DateTime.now();
      _noteController.text = widget.log!.note ?? '';

      final details = widget.log!.details;
      _executorController.text = (details['executor'] ?? details['operator_name'] ?? details['operator'] ?? 'Nông hộ / Kỹ thuật viên').toString();
      _equipmentController.text = (details['equipment'] ?? details['equipment_used'] ?? '').toString();

      if (_selectedType == 'Nhân công') {
        _laborWorkContentController.text = (details['work_content'] ?? details['reason'] ?? '').toString();
        _laborWorkerCountController.text = (details['worker_count'] ?? details['amount'] ?? '').toString();
        _laborCostController.text = (details['cost'] ?? details['labor_cost'] ?? '').toString();
        _laborStartTimeController.text = (details['start_time'] ?? '').toString();
        _laborEndTimeController.text = (details['end_time'] ?? '').toString();
        _laborCostMode = (details['cost_mode'] ?? 'total').toString();
      } else if (_selectedType == 'Tưới nước') {
        _amountController.text = (details['amount'] ?? '200').toString();
        _wateringMethod = (details['method'] ?? 'Tưới nhỏ giọt').toString();
      } else if (_selectedType == 'Bón phân') {
        _amountController.text = (details['amount'] ?? '100').toString();
        _selectedUnit = (details['unit'] ?? 'gam').toString();
        _manualNameController.text = (details['fertilizer_name'] ?? details['value'] ?? '').toString();
      } else if (_selectedType == 'Phun thuốc') {
        _amountController.text = (details['amount'] ?? '50').toString();
        _selectedUnit = (details['unit'] ?? 'ml').toString();
        _manualNameController.text = (details['pesticide_name'] ?? details['value'] ?? '').toString();
      } else if (_selectedType == 'Thu hoạch') {
        _amountController.text = (details['yield_kg'] ?? details['amount'] ?? '50').toString();
        _harvestUnit = (details['unit'] ?? 'kg').toString();
        _harvestQualityController.text = (details['grade'] ?? details['quality'] ?? 'Loại A (Đạt chuẩn xuất khẩu)').toString();
      } else if (_selectedType == 'Bệnh cây') {
        _manualNameController.text = (details['disease_name'] ?? details['disease'] ?? details['value'] ?? '').toString();
        _diseaseSeverity = (details['severity'] ?? 'Trung bình').toString();
        _diseaseDescController.text = (details['description'] ?? '').toString();
      } else {
        _manualNameController.text = (details['value'] ?? '').toString();
      }
    } else {
      String initial = widget.initialType ?? 'Nhân công';
      if (initial == 'Cắt lá' || initial == 'Tỉa cành/lá' || initial == 'Cắt tỉa' || initial == 'Tỉa hoa') {
        initial = 'Nhân công';
      }
      _selectedType = _activityTypes.contains(initial) ? initial : 'Nhân công';
      _selectedDate = DateTime.now();
      _setDefaultAmountForType(_selectedType);
    }

    _loadSupplies();
  }

  void _setDefaultAmountForType(String type) {
    if (type == 'Tưới nước') {
      _amountController.text = '200';
      _selectedUnit = 'lít';
    } else if (type == 'Bón phân') {
      _amountController.text = '100';
      _selectedUnit = 'gam';
    } else if (type == 'Phun thuốc') {
      _amountController.text = '50';
      _selectedUnit = 'ml';
    } else if (type == 'Thu hoạch') {
      _amountController.text = '50';
      _harvestUnit = 'kg';
    } else {
      _amountController.text = '';
    }
  }

  @override
  void dispose() {
    _noteController.dispose();
    _amountController.dispose();
    _manualNameController.dispose();
    _executorController.dispose();
    _equipmentController.dispose();
    _harvestQualityController.dispose();
    _diseaseDescController.dispose();
    _laborWorkContentController.dispose();
    _laborWorkerCountController.dispose();
    _laborCostController.dispose();
    _laborStartTimeController.dispose();
    _laborEndTimeController.dispose();
    super.dispose();
  }

  Future<void> _toggleVoiceDictation() async {
    if (!_isListeningVoice) {
      bool available = await _speech.initialize(
        onStatus: (status) {
          if (status == 'done' || status == 'notListening') {
            if (mounted) setState(() => _isListeningVoice = false);
          }
        },
        onError: (err) {
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
                final currentText = _noteController.text.trim();
                _noteController.text = currentText.isEmpty
                    ? result.recognizedWords
                    : '$currentText ${result.recognizedWords}';
              });
            }
          },
        );
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Thiết bị chưa hỗ trợ hoặc chưa cấp quyền micro.')),
          );
        }
      }
    } else {
      await _speech.stop();
      setState(() => _isListeningVoice = false);
    }
  }

  Future<void> _loadSupplies() async {
    setState(() => _isLoadingSupplies = true);
    try {
      final list = await ApiService().fetchSupplies();
      if (mounted) {
        setState(() {
          _allSupplies = list;
          _filterSupplies();
          _isLoadingSupplies = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingSupplies = false);
    }
  }

  void _filterSupplies() {
    String targetCategory = '';
    if (_selectedType == 'Tưới nước') {
      targetCategory = 'Tiền nước';
    } else if (_selectedType == 'Bón phân') {
      targetCategory = 'Bón phân';
    } else if (_selectedType == 'Phun thuốc') {
      targetCategory = 'Phun thuốc';
    }

    if (targetCategory.isNotEmpty) {
      _filteredSupplies = _allSupplies.where((s) => s.category == targetCategory).toList();
    } else {
      _filteredSupplies = [];
    }

    if (_filteredSupplies.isNotEmpty) {
      _selectedSupply = _filteredSupplies.first;
    } else {
      _selectedSupply = null;
    }
  }

  double _calculateWaterCost() {
    if (_selectedSupply == null || _noAccountingForWater) return 0.0;
    final amountLiters = double.tryParse(_amountController.text) ?? 0.0;
    final m3 = amountLiters / 1000.0;
    return m3 * _selectedSupply!.unitPrice;
  }

  double _getCalculatedLaborCost() {
    final workers = int.tryParse(_laborWorkerCountController.text) ?? 1;
    final rawCost = double.tryParse(_laborCostController.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0.0;
    return _laborCostMode == 'per_person' ? (rawCost * workers) : rawCost;
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    final note = _noteController.text.trim();
    final Map<String, dynamic> details = {};
    final dateStr = _selectedDate.toIso8601String().substring(0, 10);

    final executor = _executorController.text.trim();
    final equipment = _equipmentController.text.trim();
    if (executor.isNotEmpty) details['executor'] = executor;
    if (equipment.isNotEmpty) details['equipment'] = equipment;

    if (_selectedType == 'Nhân công') {
      final workContent = _laborWorkContentController.text.trim();
      final workers = int.tryParse(_laborWorkerCountController.text) ?? 1;
      final totalCost = _getCalculatedLaborCost();
      final startTime = _laborStartTimeController.text.trim();
      final endTime = _laborEndTimeController.text.trim();

      details['work_content'] = workContent.isNotEmpty ? workContent : 'Thuê nhân công chăm sóc';
      details['worker_count'] = workers;
      details['cost'] = totalCost;
      details['cost_mode'] = _laborCostMode;
      details['start_time'] = startTime;
      details['end_time'] = endTime;
      details['amount'] = workers;
      details['unit'] = 'người';
      details['value'] = 'Nhân công ($workContent): $workers người · ${_currencyFormat.format(totalCost)}';
    } else if (_selectedType == 'Tưới nước') {
      final amount = double.tryParse(_amountController.text) ?? 0.0;
      details['amount'] = amount;
      details['unit'] = 'lít';
      details['method'] = _wateringMethod;
      details['value'] = '$_wateringMethod: $amount lít';
      if (_selectedSupply != null && !_noAccountingForWater) {
        details['supply_id'] = _selectedSupply!.id;
        details['cost'] = _calculateWaterCost();
      }
    } else if (_selectedType == 'Bón phân') {
      final amount = double.tryParse(_amountController.text) ?? 0.0;
      final fertilizerName = _selectedSupply != null ? _selectedSupply!.name : _manualNameController.text.trim();
      details['fertilizer_name'] = fertilizerName;
      details['amount'] = amount;
      details['unit'] = _selectedUnit;
      details['value'] = '$fertilizerName: $amount $_selectedUnit';
      if (_selectedSupply != null) details['supply_id'] = _selectedSupply!.id;
    } else if (_selectedType == 'Phun thuốc') {
      final amount = double.tryParse(_amountController.text) ?? 0.0;
      final pesticideName = _selectedSupply != null ? _selectedSupply!.name : _manualNameController.text.trim();
      details['pesticide_name'] = pesticideName;
      details['amount'] = amount;
      details['unit'] = _selectedUnit;
      details['value'] = '$pesticideName: $amount $_selectedUnit';
      if (_selectedSupply != null) details['supply_id'] = _selectedSupply!.id;
    } else if (_selectedType == 'Thu hoạch') {
      final yieldVal = double.tryParse(_amountController.text) ?? 0.0;
      final quality = _harvestQualityController.text.trim();
      details['yield_kg'] = yieldVal;
      details['amount'] = yieldVal;
      details['unit'] = _harvestUnit;
      details['grade'] = quality;
      details['value'] = 'Thu hoạch: $yieldVal $_harvestUnit ($quality)';
    } else if (_selectedType == 'Bệnh cây') {
      final diseaseName = _manualNameController.text.trim();
      final desc = _diseaseDescController.text.trim();
      details['disease_name'] = diseaseName;
      details['severity'] = _diseaseSeverity;
      if (desc.isNotEmpty) details['description'] = desc;
      details['value'] = '$diseaseName ($_diseaseSeverity)';
    } else {
      details['value'] = _manualNameController.text.trim();
    }

    bool success = true;
    if (widget.log != null) {
      success = await ApiService().updatePlantLog(
        widget.plantIds.first,
        widget.log!.id,
        dateStr,
        _selectedType,
        note,
        details,
      );
    } else {
      for (final id in widget.plantIds) {
        final ok = await ApiService().createPlantLog(
          id,
          _selectedType,
          note,
          details,
        );
        if (!ok) success = false;
      }
    }

    if (!mounted) return;
    setState(() => _isSaving = false);
    widget.onLogSaved?.call();
    Navigator.pop(context, success);
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.log != null;
    final titleText = isEdit ? 'Chỉnh Sửa Nhật Ký' : 'Ghi Nhật Ký Canh Tác';

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag Handle for Fluent Bottom Sheet
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 8),
                width: 36,
                height: 4.5,
                decoration: BoxDecoration(
                  color: const Color(0xFFD1D5DB),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),

            // Header Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: AppTheme.mintPastel,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    alignment: Alignment.center,
                    child: LucideIcon(
                      isEdit ? LucideIconName.edit : LucideIconName.sprout,
                      color: AppTheme.fluentEmerald,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          titleText,
                          style: const TextStyle(
                            fontSize: 16.5,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.fluentTextMain,
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          widget.plantIds.length == 1
                              ? 'Cây #${widget.plantIds.first} · ${widget.farmName ?? "Vườn Nông hộ"}'
                              : 'Áp dụng cho ${widget.plantIds.length} cây trồng',
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: AppTheme.fluentEmerald,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const LucideIcon(LucideIconName.close, size: 20, color: AppTheme.fluentTextMuted),
                    splashRadius: 20,
                  ),
                ],
              ),
            ),

            const Divider(height: 1, thickness: 0.8, color: AppTheme.fluentBorder),

            // Scrollable Form
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Category Selector (Horizontal Pastel Pills with Lucide Icons)
                      const Text(
                        'HOẠT ĐỘNG CANH TÁC *',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.fluentTextMuted,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: _activityTypes.map((type) {
                            final isSelected = _selectedType == type;
                            LucideIconName icon = LucideIconName.fileText;
                            Color activeColor = AppTheme.fluentEmerald;
                            Color activeBg = AppTheme.mintPastel;

                            if (type == 'Nhân công') {
                              icon = LucideIconName.users;
                              activeColor = AppTheme.lavenderText;
                              activeBg = AppTheme.lavenderPastel;
                            } else if (type == 'Tưới nước') {
                              icon = LucideIconName.droplet;
                              activeColor = AppTheme.skyText;
                              activeBg = AppTheme.skyPastel;
                            } else if (type == 'Bón phân') {
                              icon = LucideIconName.beaker;
                              activeColor = AppTheme.butterText;
                              activeBg = AppTheme.butterPastel;
                            } else if (type == 'Phun thuốc') {
                              icon = LucideIconName.shield;
                              activeColor = AppTheme.roseText;
                              activeBg = AppTheme.rosePastel;
                            } else if (type == 'Thu hoạch') {
                              icon = LucideIconName.package;
                              activeColor = const Color(0xFF059669);
                              activeBg = const Color(0xFFD1FAE5);
                            } else if (type == 'Bệnh cây') {
                              icon = LucideIconName.alertTriangle;
                              activeColor = AppTheme.roseText;
                              activeBg = AppTheme.rosePastel;
                            }

                            return Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: InkWell(
                                onTap: () {
                                  setState(() {
                                    _selectedType = type;
                                    _filterSupplies();
                                    _setDefaultAmountForType(type);
                                  });
                                },
                                borderRadius: BorderRadius.circular(14),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: isSelected ? activeBg : Colors.white,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(
                                      color: isSelected ? activeColor : AppTheme.fluentBorder,
                                      width: isSelected ? 1.5 : 0.8,
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      LucideIcon(
                                        icon,
                                        size: 16,
                                        color: isSelected ? activeColor : AppTheme.fluentTextMuted,
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        type,
                                        style: TextStyle(
                                          fontSize: 12.5,
                                          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                          color: isSelected ? activeColor : AppTheme.fluentTextMain,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Date & Executor Row
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'NGÀY THỰC HIỆN *',
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.fluentTextMuted),
                                ),
                                const SizedBox(height: 6),
                                InkWell(
                                  onTap: () async {
                                    final picked = await showDatePicker(
                                      context: context,
                                      initialDate: _selectedDate,
                                      firstDate: DateTime(2020),
                                      lastDate: DateTime.now().add(const Duration(days: 30)),
                                    );
                                    if (picked != null) {
                                      setState(() => _selectedDate = picked);
                                    }
                                  },
                                  borderRadius: BorderRadius.circular(14),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(color: AppTheme.fluentBorder, width: 0.8),
                                    ),
                                    child: Row(
                                      children: [
                                        const LucideIcon(LucideIconName.calendar, size: 16, color: AppTheme.fluentEmerald),
                                        const SizedBox(width: 8),
                                        Text(
                                          DateFormat('dd/MM/yyyy').format(_selectedDate),
                                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.fluentTextMain),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'NGƯỜI THỰC HIỆN',
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.fluentTextMuted),
                                ),
                                const SizedBox(height: 6),
                                TextFormField(
                                  controller: _executorController,
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                  decoration: InputDecoration(
                                    isDense: true,
                                    prefixIcon: const Padding(
                                      padding: EdgeInsets.all(10),
                                      child: LucideIcon(LucideIconName.users, size: 16, color: AppTheme.fluentTextMuted),
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // ==================== SPECIFIC SECTION: NHÂN CÔNG ====================
                      if (_selectedType == 'Nhân công') ...[
                        _buildLaborSection(),
                      ] else if (_selectedType == 'Tưới nước') ...[
                        _buildWateringSection(),
                      ] else if (_selectedType == 'Bón phân' || _selectedType == 'Phun thuốc') ...[
                        _buildSupplySection(),
                      ] else if (_selectedType == 'Thu hoạch') ...[
                        _buildHarvestSection(),
                      ] else if (_selectedType == 'Bệnh cây') ...[
                        _buildDiseaseSection(),
                      ],

                      const SizedBox(height: 16),

                      // Notes & Voice Dictation Section
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'GHI CHÚ THỰC ĐỊA (VIETGAP)',
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: AppTheme.fluentTextMuted),
                          ),
                          InkWell(
                            onTap: _toggleVoiceDictation,
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: _isListeningVoice ? AppTheme.rosePastel : AppTheme.mintPastel,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                children: [
                                  LucideIcon(
                                    LucideIconName.mic,
                                    size: 14,
                                    color: _isListeningVoice ? AppTheme.roseText : AppTheme.mintText,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    _isListeningVoice ? 'Đang nghe...' : 'Đọc tiếng Việt',
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: _isListeningVoice ? AppTheme.roseText : AppTheme.mintText,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _noteController,
                        maxLines: 2,
                        style: const TextStyle(fontSize: 13),
                        decoration: const InputDecoration(
                          hintText: 'Nhập ghi chú hoặc bấm micro để nói...',
                        ),
                      ),
                      const SizedBox(height: 22),

                      // Submit Save Button
                      ElevatedButton(
                        onPressed: _isSaving ? null : _handleSave,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.fluentEmerald,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: _isSaving
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: const [
                                  LucideIcon(LucideIconName.check, size: 18, color: Colors.white),
                                  SizedBox(width: 8),
                                  Text(
                                    'Lưu Nhật Ký & Niêm Phong VietGAP',
                                    style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.bold, color: Colors.white),
                                  ),
                                ],
                              ),
                      ),
                      const SizedBox(height: 10),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ==================== LABOR (NHÂN CÔNG) WIDGETS ====================
  Widget _buildLaborSection() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFAF5FF), // Subtle Lavender Pastel
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE9D5FF), width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              LucideIcon(LucideIconName.users, size: 18, color: AppTheme.lavenderText),
              SizedBox(width: 6),
              Text(
                'THÔNG TIN THUÊ NHÂN CÔNG LAO ĐỘNG',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.lavenderText,
                  letterSpacing: 0.4,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 1. Work Content Input (Empty default!)
          const Text(
            'Nội dung công việc thuê nhân công làm gì *',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.fluentTextMain),
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: _laborWorkContentController,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            decoration: const InputDecoration(
              hintText: 'VD: Cắt tỉa cành tạo tán, làm cỏ, bọc trái...',
            ),
            validator: (v) {
              if (_selectedType == 'Nhân công' && (v == null || v.trim().isEmpty)) {
                return 'Vui lòng nhập nội dung công việc';
              }
              return null;
            },
          ),
          const SizedBox(height: 8),

          // 6 Quick Suggestion Chips
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: _laborQuickChips.map((chip) {
              return InkWell(
                onTap: () {
                  setState(() {
                    _laborWorkContentController.text = chip;
                  });
                },
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFDDD6FE), width: 0.8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const LucideIcon(LucideIconName.plus, size: 12, color: AppTheme.lavenderText),
                      const SizedBox(width: 4),
                      Text(
                        chip,
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF6B21A8)),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 14),

          // 2. Worker Count & Cost on the SAME HORIZONTAL ROW
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Worker Count (Empty default!)
              Expanded(
                flex: 4,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Số người làm *',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.fluentTextMain),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _laborWorkerCountController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      decoration: const InputDecoration(
                        hintText: 'VD: 3',
                        suffixText: 'người',
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),

              // Labor Cost & Mode Selector (Empty default!)
              Expanded(
                flex: 6,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Chi phí thuê (đ)',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.fluentTextMain),
                        ),
                        // Mode Switcher (Cả đoàn / 1 người)
                        Row(
                          children: [
                            _buildLaborModePill('total', 'Cả đoàn'),
                            const SizedBox(width: 4),
                            _buildLaborModePill('per_person', '1 người'),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _laborCostController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.butterText),
                      decoration: const InputDecoration(
                        hintText: 'VD: 350.000',
                        suffixText: 'VNĐ',
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // 3. Time Range (Start Time -> End Time)
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Bắt đầu làm lúc', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppTheme.fluentTextMuted)),
                    const SizedBox(height: 4),
                    TextFormField(
                      controller: _laborStartTimeController,
                      style: const TextStyle(fontSize: 12.5),
                      decoration: const InputDecoration(
                        hintText: '07:30',
                        prefixIcon: Padding(
                          padding: EdgeInsets.all(10),
                          child: LucideIcon(LucideIconName.clock, size: 14, color: AppTheme.fluentTextMuted),
                        ),
                        contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Kết thúc lúc', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppTheme.fluentTextMuted)),
                    const SizedBox(height: 4),
                    TextFormField(
                      controller: _laborEndTimeController,
                      style: const TextStyle(fontSize: 12.5),
                      decoration: const InputDecoration(
                        hintText: '11:30',
                        prefixIcon: Padding(
                          padding: EdgeInsets.all(10),
                          child: LucideIcon(LucideIconName.clock, size: 14, color: AppTheme.fluentTextMuted),
                        ),
                        contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 4. Live Calculation & Tree Cost Allocation Preview Card
          _buildLaborCostPreviewCard(),
        ],
      ),
    );
  }

  Widget _buildLaborModePill(String mode, String label) {
    final isSelected = _laborCostMode == mode;
    return InkWell(
      onTap: () => setState(() => _laborCostMode = mode),
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.lavenderText : Colors.white,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: const Color(0xFFDDD6FE), width: 0.8),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 9.5,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? Colors.white : AppTheme.fluentTextMuted,
          ),
        ),
      ),
    );
  }

  Widget _buildLaborCostPreviewCard() {
    final totalCost = _getCalculatedLaborCost();
    final treeCount = widget.plantIds.length > 0 ? widget.plantIds.length : 1;
    final perTreeCost = totalCost / treeCount;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFDDD6FE), width: 0.8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Tổng chi phí nhân công:',
                style: TextStyle(fontSize: 11, color: AppTheme.fluentTextMuted, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 2),
              Text(
                _currencyFormat.format(totalCost),
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppTheme.butterText),
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Text(
                'Phân bổ mỗi cây:',
                style: TextStyle(fontSize: 11, color: AppTheme.fluentTextMuted, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 2),
              Text(
                '${_currencyFormat.format(perTreeCost)} / cây',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.fluentEmerald),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ==================== OTHER CARE SECTIONS ====================
  Widget _buildWateringSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Phương pháp tưới *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.fluentTextMain)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          value: _wateringMethod,
          decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
          items: _wateringMethods.map((m) => DropdownMenuItem(value: m, child: Text(m, style: const TextStyle(fontSize: 13)))).toList(),
          onChanged: (v) => setState(() => _wateringMethod = v ?? _wateringMethod),
        ),
        const SizedBox(height: 12),
        const Text('Lượng nước (Lít) *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.fluentTextMain)),
        const SizedBox(height: 6),
        TextFormField(
          controller: _amountController,
          keyboardType: TextInputType.number,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
          decoration: const InputDecoration(hintText: '200', suffixText: 'lít / cây'),
        ),
      ],
    );
  }

  Widget _buildSupplySection() {
    final isFertilizer = _selectedType == 'Bón phân';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(isFertilizer ? 'Chọn loại phân bón *' : 'Chọn loại thuốc BVTV *', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.fluentTextMain)),
        const SizedBox(height: 6),
        if (_filteredSupplies.isNotEmpty)
          DropdownButtonFormField<Supply>(
            value: _selectedSupply,
            isExpanded: true,
            decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
            items: _filteredSupplies.map((s) => DropdownMenuItem(value: s, child: Text(s.name, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)))).toList(),
            onChanged: (v) => setState(() => _selectedSupply = v),
          )
        else
          TextFormField(
            controller: _manualNameController,
            style: const TextStyle(fontSize: 13),
            decoration: InputDecoration(hintText: isFertilizer ? 'VD: NPK 20-20-15' : 'VD: Anvil 5SC'),
          ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              flex: 6,
              child: TextFormField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                decoration: const InputDecoration(labelText: 'Liều lượng *'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 4,
              child: DropdownButtonFormField<String>(
                value: _selectedUnit,
                decoration: const InputDecoration(labelText: 'Đơn vị'),
                items: ['kg', 'gam', 'ml', 'lít'].map((u) => DropdownMenuItem(value: u, child: Text(u))).toList(),
                onChanged: (v) => setState(() => _selectedUnit = v ?? _selectedUnit),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildHarvestSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Sản lượng thu hoạch *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.fluentTextMain)),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              flex: 6,
              child: TextFormField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                decoration: const InputDecoration(hintText: '50'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 4,
              child: DropdownButtonFormField<String>(
                value: _harvestUnit,
                items: _harvestUnits.map((u) => DropdownMenuItem(value: u, child: Text(u))).toList(),
                onChanged: (v) => setState(() => _harvestUnit = v ?? _harvestUnit),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const Text('Phân loại phẩm cấp trái', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.fluentTextMain)),
        const SizedBox(height: 6),
        TextFormField(
          controller: _harvestQualityController,
          style: const TextStyle(fontSize: 13),
          decoration: const InputDecoration(hintText: 'Loại A (Đạt chuẩn xuất khẩu)'),
        ),
      ],
    );
  }

  Widget _buildDiseaseSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Tên sâu bệnh phát hiện *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.fluentTextMain)),
        const SizedBox(height: 6),
        TextFormField(
          controller: _manualNameController,
          style: const TextStyle(fontSize: 13),
          decoration: const InputDecoration(hintText: 'VD: Nấm Phytophthora, rầy phấn trắng...'),
        ),
        const SizedBox(height: 12),
        const Text('Mức độ gây hại', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.fluentTextMain)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          value: _diseaseSeverity,
          items: _diseaseSeverities.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
          onChanged: (v) => setState(() => _diseaseSeverity = v ?? _diseaseSeverity),
        ),
      ],
    );
  }
}
