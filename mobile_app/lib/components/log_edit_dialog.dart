import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../models/plant_log.dart';
import '../models/supply.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';

class LogEditDialog extends StatefulWidget {
  final List<int> plantIds;
  final PlantLog? log; // null means ADD, not null means EDIT
  final String? farmName;
  final String? initialType; // Direct pre-selected care category e.g. 'Bón phân'
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
  final _manualNameController = TextEditingController(); // For fallback or disease name
  final _executorController = TextEditingController(text: 'Nông hộ / Kỹ thuật viên');
  final _equipmentController = TextEditingController();
  final _harvestQualityController = TextEditingController(text: 'Loại A (Đạt chuẩn xuất khẩu)');
  final _diseaseDescController = TextEditingController();

  late String _selectedType;
  late DateTime _selectedDate;
  bool _isLoadingSupplies = false;
  bool _isSaving = false;
  bool _isListeningVoice = false;
  final stt.SpeechToText _speech = stt.SpeechToText();

  List<Supply> _allSupplies = [];
  List<Supply> _filteredSupplies = [];
  Supply? _selectedSupply;
  bool _noAccountingForWater = false; // When user chooses not to account for water

  String _selectedUnit = 'kg';
  String _wateringMethod = 'Tưới nhỏ giọt';
  String _pruneReason = 'Tỉa cành tạo tán';
  String _flowerPruneReason = 'Tỉa định lượng hoa/quả non';
  String _harvestUnit = 'kg';
  String _diseaseSeverity = 'Trung bình';

  final List<String> _activityTypes = [
    'Tưới nước',
    'Bón phân',
    'Phun thuốc',
    'Cắt tỉa',
    'Tỉa hoa',
    'Thu hoạch',
    'Bệnh cây',
    'Khác'
  ];

  final List<String> _wateringMethods = [
    'Tưới tay thủ công',
    'Tưới nhỏ giọt',
    'Tưới phun mưa',
    'Tưới phun sương',
  ];

  final List<String> _pruneReasonsList = [
    'Tỉa cành tạo tán',
    'Tỉa bớt lá thông thoáng',
    'Cắt tỉa cành sâu bệnh / khô',
    'Tỉa cành sau thu hoạch',
  ];

  final List<String> _flowerPruneReasonsList = [
    'Tỉa định lượng hoa/quả non',
    'Bỏ hoa dị tật / ra muộn',
    'Tỉa bớt hoa đầu cành',
    'Cân đối dinh dưỡng nuôi cây',
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
    symbol: 'VNĐ',
    decimalDigits: 0,
  );

  @override
  void initState() {
    super.initState();
    final isEdit = widget.log != null;
    
    if (isEdit) {
      String rawType = widget.log!.logType;
      if (rawType == 'Cắt lá' || rawType == 'Tỉa cành/lá') {
        rawType = 'Cắt tỉa';
      }
      _selectedType = _activityTypes.contains(rawType) ? rawType : 'Khác';
      _selectedDate = DateTime.tryParse(widget.log!.logDate) ?? DateTime.now();
      _noteController.text = widget.log!.note ?? '';

      final details = widget.log!.details;
      _executorController.text = (details['executor'] ?? details['operator_name'] ?? details['operator'] ?? 'Nông hộ / Kỹ thuật viên').toString();
      _equipmentController.text = (details['equipment'] ?? details['equipment_used'] ?? '').toString();

      if (_selectedType == 'Tưới nước') {
        _amountController.text = (details['amount'] ?? '200').toString();
        _wateringMethod = (details['method'] ?? 'Tưới nhỏ giọt').toString();
        if (!_wateringMethods.contains(_wateringMethod)) {
          _wateringMethod = _wateringMethods.first;
        }
      } else if (_selectedType == 'Bón phân') {
        _amountController.text = (details['amount'] ?? '100').toString();
        _selectedUnit = (details['unit'] ?? 'gam').toString();
        _manualNameController.text = (details['fertilizer_name'] ?? details['value'] ?? '').toString();
      } else if (_selectedType == 'Phun thuốc') {
        _amountController.text = (details['amount'] ?? '50').toString();
        _selectedUnit = (details['unit'] ?? 'ml').toString();
        _manualNameController.text = (details['pesticide_name'] ?? details['value'] ?? '').toString();
      } else if (_selectedType == 'Cắt tỉa') {
        _pruneReason = (details['reason'] ?? 'Tỉa cành tạo tán').toString();
        _amountController.text = (details['amount'] ?? '5').toString();
      } else if (_selectedType == 'Tỉa hoa') {
        _flowerPruneReason = (details['reason'] ?? 'Tỉa định lượng hoa/quả non').toString();
        _amountController.text = (details['amount'] ?? '3').toString();
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
      String initial = widget.initialType ?? 'Tưới nước';
      if (initial == 'Cắt lá' || initial == 'Tỉa cành/lá') {
        initial = 'Cắt tỉa';
      }
      _selectedType = _activityTypes.contains(initial) ? initial : 'Tưới nước';
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
    } else if (type == 'Cắt tỉa') {
      _amountController.text = '5';
    } else if (type == 'Tỉa hoa') {
      _amountController.text = '3';
    } else if (type == 'Thu hoạch') {
      _amountController.text = '50';
      _harvestUnit = 'kg';
    } else {
      _amountController.text = '1';
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
    setState(() {
      _isLoadingSupplies = true;
    });

    try {
      final list = await ApiService().fetchSupplies();
      if (mounted) {
        setState(() {
          _allSupplies = list;
          _filterSupplies();
          _isLoadingSupplies = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingSupplies = false;
        });
      }
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
      if (widget.log != null) {
        final details = widget.log!.details;
        final savedName = details['fertilizer_name'] ?? details['pesticide_name'] ?? '';
        final found = _filteredSupplies.firstWhere(
          (s) => s.name.toLowerCase().trim() == savedName.toString().toLowerCase().trim(),
          orElse: () => _filteredSupplies.first,
        );
        _selectedSupply = found;
      } else {
        _selectedSupply = _filteredSupplies.first;
      }
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

  String _getBatchCodePreview() {
    final dateClean = DateFormat('yyyyMMdd').format(_selectedDate);
    final treeCodeClean = widget.plantIds.length == 1 ? 'LOT${widget.plantIds.first}' : 'LOT-MULTI';
    return 'VN-TB-$dateClean-$treeCodeClean';
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSaving = true;
    });

    final note = _noteController.text.trim();
    final Map<String, dynamic> details = {};
    final dateStr = _selectedDate.toIso8601String().substring(0, 10);

    // Standard VietGAP fields across all types
    final executor = _executorController.text.trim();
    final equipment = _equipmentController.text.trim();
    if (executor.isNotEmpty) details['executor'] = executor;
    if (equipment.isNotEmpty) details['equipment'] = equipment;

    // Specific fields by activity type
    if (_selectedType == 'Tưới nước') {
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
      if (_selectedSupply != null) {
        details['supply_id'] = _selectedSupply!.id;
      }
    } else if (_selectedType == 'Phun thuốc') {
      final amount = double.tryParse(_amountController.text) ?? 0.0;
      final pesticideName = _selectedSupply != null ? _selectedSupply!.name : _manualNameController.text.trim();
      details['pesticide_name'] = pesticideName;
      details['amount'] = amount;
      details['unit'] = _selectedUnit;
      details['value'] = '$pesticideName: $amount $_selectedUnit';
      if (_selectedSupply != null) {
        details['supply_id'] = _selectedSupply!.id;
        if (_selectedSupply!.activeIngredient != null && _selectedSupply!.activeIngredient!.isNotEmpty) {
          details['active_ingredient'] = _selectedSupply!.activeIngredient;
        }
      }
    } else if (_selectedType == 'Cắt tỉa') {
      final amount = int.tryParse(_amountController.text) ?? 1;
      details['reason'] = _pruneReason;
      details['amount'] = amount;
      details['value'] = '$_pruneReason: $amount cành/lá';
    } else if (_selectedType == 'Tỉa hoa') {
      final amount = int.tryParse(_amountController.text) ?? 1;
      details['reason'] = _flowerPruneReason;
      details['amount'] = amount;
      details['value'] = '$_flowerPruneReason: $amount hoa/quả';
    } else if (_selectedType == 'Thu hoạch') {
      final yieldVal = double.tryParse(_amountController.text) ?? 0.0;
      final quality = _harvestQualityController.text.trim();
      details['batch_code'] = _getBatchCodePreview();
      details['yield_kg'] = yieldVal;
      details['amount'] = yieldVal;
      details['unit'] = _harvestUnit;
      details['grade'] = quality;
      details['quality'] = quality;
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
        if (!ok) {
          success = false;
        }

        // Auto-record supply usage if linked to warehouse
        if (ok && _selectedSupply != null && !_noAccountingForWater) {
          try {
            final amount = double.tryParse(_amountController.text) ?? 0.0;
            double usageQty = amount;
            
            if (_selectedType == 'Tưới nước') {
              usageQty = amount / 1000.0; // Liters -> m3
            } else if (_selectedUnit == 'g' || _selectedUnit == 'gam' || _selectedUnit == 'ml') {
              usageQty = amount / 1000.0; // g/ml -> kg/l
            }

            await ApiService().recordSupplyUsage({
              'supply_id': _selectedSupply!.id,
              'usage_date': dateStr,
              'quantity': usageQty,
              'plant_id': id,
              'note': 'Tự động hạch toán VietGAP từ Nhật ký Mobile: $_selectedType ($amount ${_selectedType == 'Tưới nước' ? 'Lít' : _selectedUnit} = $usageQty ${_selectedSupply!.unit} cho Cây #$id)',
            });
          } catch (e) {
            print('Failed to record supply usage in background: $e');
          }
        }
      }
    }

    if (!mounted) return;

    setState(() {
      _isSaving = false;
    });

    widget.onLogSaved?.call();
    Navigator.pop(context, success);
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.log != null;
    final titleText = isEdit ? 'Chỉnh Sửa Nhật Ký' : 'Ghi Nhật Ký Canh Tác';

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      elevation: 0,
      backgroundColor: Colors.transparent,
      child: Container(
        width: double.infinity,
        constraints: const BoxConstraints(maxWidth: 440, maxHeight: 720),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.18),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              decoration: const BoxDecoration(
                color: AppTheme.greenDark,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      isEdit ? Icons.edit_note_rounded : Icons.spa_rounded,
                      color: const Color(0xFF86EFAC),
                      size: 22,
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
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            widget.plantIds.length == 1
                                ? '✅ Cây #${widget.plantIds.first}${widget.farmName != null ? ' - ${widget.farmName}' : ''}'
                                : '✅ Đã chọn: ${widget.plantIds.length} cây trồng${widget.farmName != null ? ' (${widget.farmName})' : ''}',
                            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white70),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),

            // Scrollable Form
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(18),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Date Picker
                      const Text('NGÀY THỰC HIỆN *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.5)),
                      const SizedBox(height: 6),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.calendar_today_rounded, size: 16, color: AppTheme.green),
                        label: Text(
                          '${_selectedDate.day.toString().padLeft(2, '0')}/${_selectedDate.month.toString().padLeft(2, '0')}/${_selectedDate.year}',
                          style: const TextStyle(color: AppTheme.textMain, fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                          side: const BorderSide(color: AppTheme.grayBorder, width: 1.2),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          alignment: Alignment.centerLeft,
                          backgroundColor: const Color(0xFFF8FAFC),
                        ),
                        onPressed: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: _selectedDate,
                            firstDate: DateTime(2020),
                            lastDate: DateTime.now().add(const Duration(days: 30)),
                          );
                          if (picked != null) {
                            setState(() {
                              _selectedDate = picked;
                            });
                          }
                        },
                      ),
                      const SizedBox(height: 14),

                      // Activity Type Dropdown
                      const Text('LOẠI HOẠT ĐỘNG *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.5)),
                      const SizedBox(height: 6),
                      DropdownButtonFormField<String>(
                        value: _selectedType,
                        decoration: InputDecoration(
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          fillColor: const Color(0xFFF8FAFC),
                          filled: true,
                        ),
                        items: _activityTypes.map((type) {
                          IconData typeIcon = Icons.eco_rounded;
                          Color typeColor = AppTheme.green;
                          if (type == 'Tưới nước') {
                            typeIcon = Icons.water_drop_rounded;
                            typeColor = Colors.blue;
                          } else if (type == 'Bón phân') {
                            typeIcon = Icons.science_rounded;
                            typeColor = Colors.teal;
                          } else if (type == 'Phun thuốc') {
                            typeIcon = Icons.shield_rounded;
                            typeColor = Colors.orange;
                          } else if (type == 'Cắt tỉa' || type == 'Tỉa hoa') {
                            typeIcon = Icons.content_cut_rounded;
                            typeColor = Colors.brown;
                          } else if (type == 'Thu hoạch') {
                            typeIcon = Icons.agriculture_rounded;
                            typeColor = Colors.amber.shade800;
                          } else if (type == 'Bệnh cây') {
                            typeIcon = Icons.coronavirus_rounded;
                            typeColor = Colors.red;
                          }

                          return DropdownMenuItem<String>(
                            value: type,
                            child: Row(
                              children: [
                                Icon(typeIcon, size: 18, color: typeColor),
                                const SizedBox(width: 8),
                                Text(type, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          );
                        }).toList(),
                        onChanged: isEdit
                            ? null
                            : (val) {
                                if (val != null) {
                                  setState(() {
                                    _selectedType = val;
                                    _filterSupplies();
                                    _setDefaultAmountForType(val);
                                  });
                                }
                              },
                      ),
                      const SizedBox(height: 14),

                      // Divider
                      const Divider(color: Color(0xFFE2E8F0), thickness: 1),
                      const SizedBox(height: 10),

                      // ================= DYNAMIC FORM BUILDER =================
                      _buildDynamicFields(),

                      const SizedBox(height: 14),

                      // ================= VIETGAP EXECUTOR & EQUIPMENT CARD =================
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDF4),
                          border: Border.all(color: const Color(0xFFBBF7D0)),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.verified_user_rounded, color: Color(0xFF166534), size: 16),
                                SizedBox(width: 6),
                                Text(
                                  'TIÊU CHUẨN VIETGAP: NGƯỜI THỰC HIỆN & THIẾT BỊ',
                                  style: TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF166534),
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            const Text('Người thực hiện *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF14532D))),
                            const SizedBox(height: 4),
                            TextFormField(
                              controller: _executorController,
                              decoration: InputDecoration(
                                hintText: 'VD: Nguyễn Văn A, Kỹ thuật viên...',
                                isDense: true,
                                fillColor: Colors.white,
                                filled: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              validator: (val) => val == null || val.trim().isEmpty ? 'Vui lòng nhập người thực hiện' : null,
                            ),
                            const SizedBox(height: 8),
                            const Text('Thiết bị / Dụng cụ sử dụng', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF14532D))),
                            const SizedBox(height: 4),
                            TextFormField(
                              controller: _equipmentController,
                              decoration: InputDecoration(
                                hintText: 'VD: Bình phun đeo vai, Kéo cắt cành, Hệ thống tưới nhỏ giọt...',
                                isDense: true,
                                fillColor: Colors.white,
                                filled: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),

                      // ================= NOTES & VOICE SPEECH-TO-TEXT =================
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('GHI CHÚ THÊM', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.5)),
                          InkWell(
                            onTap: _toggleVoiceDictation,
                            borderRadius: BorderRadius.circular(20),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: _isListeningVoice ? Colors.red.withOpacity(0.15) : const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: _isListeningVoice ? Colors.red : const Color(0xFFBFDBFE)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    _isListeningVoice ? Icons.mic_rounded : Icons.mic_none_rounded,
                                    size: 14,
                                    color: _isListeningVoice ? Colors.red : const Color(0xFF2563EB),
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    _isListeningVoice ? 'Đang nghe...' : '🎙️ Đọc giọng nói',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: _isListeningVoice ? Colors.red : const Color(0xFF2563EB),
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
                        decoration: InputDecoration(
                          hintText: 'Thêm thông tin thực địa ngoài vườn...',
                          contentPadding: const EdgeInsets.all(12),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          fillColor: const Color(0xFFF8FAFC),
                          filled: true,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Footer Actions
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppTheme.grayBorder)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isSaving ? null : () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('Hủy', style: TextStyle(fontWeight: FontWeight.w600)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isSaving ? null : _handleSave,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        backgroundColor: AppTheme.greenDark,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        elevation: 2,
                      ),
                      child: _isSaving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('💾 Lưu nhật ký', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDynamicFields() {
    switch (_selectedType) {
      case 'Tưới nước':
        return _buildWateringFields();
      case 'Bón phân':
        return _buildFertilizingFields();
      case 'Phun thuốc':
        return _buildPesticideFields();
      case 'Cắt tỉa':
        return _buildPruningFields();
      case 'Tỉa hoa':
        return _buildFlowerPruningFields();
      case 'Thu hoạch':
        return _buildHarvestFields();
      case 'Bệnh cây':
        return _buildDiseaseFields();
      default:
        return _buildOtherFields();
    }
  }

  Widget _buildWateringFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Phương pháp tưới nước
        const Text('Phương pháp tưới nước *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          value: _wateringMethod,
          decoration: InputDecoration(
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            fillColor: const Color(0xFFF8FAFC),
            filled: true,
          ),
          items: _wateringMethods.map((m) {
            return DropdownMenuItem(value: m, child: Text(m, style: const TextStyle(fontSize: 13)));
          }).toList(),
          onChanged: (val) {
            if (val != null) setState(() => _wateringMethod = val);
          },
        ),
        const SizedBox(height: 14),

        // Nguồn nước / Tiền nước
        const Row(
          children: [
            Icon(Icons.water_drop_rounded, size: 14, color: Colors.blue),
            SizedBox(width: 4),
            Text('Nguồn nước / Tiền nước (Từ Kho vật tư)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
          ],
        ),
        const SizedBox(height: 6),
        if (_filteredSupplies.isNotEmpty) ...[
          DropdownButtonFormField<Supply?>(
            value: _noAccountingForWater ? null : _selectedSupply,
            isExpanded: true,
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              fillColor: const Color(0xFFF0FDF4),
              filled: true,
            ),
            items: [
              ..._filteredSupplies.map((s) {
                return DropdownMenuItem<Supply?>(
                  value: s,
                  child: Text(
                    '💧 ${s.name} (${s.packageQty} ${s.packageUnit}) — ${_currencyFormat.format(s.unitPrice)} / ${s.unit}',
                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppTheme.textMain),
                    overflow: TextOverflow.ellipsis,
                  ),
                );
              }),
              const DropdownMenuItem<Supply?>(
                value: null,
                child: Text(
                  'Không hạch toán tiền nước',
                  style: TextStyle(fontSize: 12.5, color: Colors.grey, fontStyle: FontStyle.italic),
                ),
              ),
            ],
            onChanged: (val) {
              setState(() {
                if (val == null) {
                  _noAccountingForWater = true;
                  _selectedSupply = null;
                } else {
                  _noAccountingForWater = false;
                  _selectedSupply = val;
                }
              });
            },
          ),
        ] else ...[
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              border: Border.all(color: const Color(0xFFBBF7D0)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline_rounded, size: 16, color: Color(0xFF166534)),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Chưa khai báo đơn giá m³ nước trong Kho vật tư.',
                    style: TextStyle(fontSize: 11.5, color: Color(0xFF166534)),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 14),

        // Lượng nước tưới (Lít)
        const Text('Lượng nước tưới (Lít) *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
        const SizedBox(height: 6),
        TextFormField(
          controller: _amountController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            hintText: 'VD: 200',
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            suffixText: 'Lít',
          ),
          onChanged: (_) => setState(() {}),
          validator: (val) => val == null || double.tryParse(val) == null ? 'Vui lòng nhập lượng nước hợp lệ' : null,
        ),
        const SizedBox(height: 12),

        // Gradient Water Conversion Card
        _buildWaterConversionCard(),
      ],
    );
  }

  Widget _buildWaterConversionCard() {
    final amountLiters = double.tryParse(_amountController.text) ?? 0.0;
    final treeCount = widget.plantIds.length > 0 ? widget.plantIds.length : 1;
    final singleM3 = amountLiters / 1000.0;
    final totalM3 = singleM3 * treeCount;
    final singleCost = _calculateWaterCost();
    final totalCost = singleCost * treeCount;

    String volumeText;
    if (treeCount > 1) {
      volumeText = '$amountLiters Lít/cây x $treeCount cây = ${(amountLiters * treeCount).toStringAsFixed(0)} Lít (${totalM3 < 0.01 ? totalM3.toStringAsFixed(3) : totalM3.toStringAsFixed(2)} m³)';
    } else {
      volumeText = '$amountLiters Lít = ${singleM3 < 0.01 ? singleM3.toStringAsFixed(3) : singleM3.toStringAsFixed(2)} m³';
    }

    String costText;
    if (_selectedSupply == null || _noAccountingForWater) {
      costText = '0 VNĐ (Không hạch toán)';
    } else if (treeCount > 1) {
      costText = '${_currencyFormat.format(totalCost)} (${_currencyFormat.format(singleCost)}/cây)';
    } else {
      costText = _currencyFormat.format(totalCost);
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFF0FDF4), Color(0xFFE0F2FE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: const Color(0xFF7DD3FC)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.calculate_rounded, color: Color(0xFF0369A1), size: 16),
              SizedBox(width: 6),
              Text(
                'TỰ ĐỘNG QUY ĐỔI LÍT ➔ M³ & QUY THÀNH TIỀN',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0369A1),
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  volumeText,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0C4A6E)),
                ),
              ),
              Text(
                costText,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF15803D)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFertilizingFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_filteredSupplies.isNotEmpty) ...[
          const Row(
            children: [
              Icon(Icons.link_rounded, size: 14, color: AppTheme.green),
              SizedBox(width: 4),
              Text('Chọn loại Phân bón (Từ Kho Vật tư) *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
            ],
          ),
          const SizedBox(height: 6),
          DropdownButtonFormField<Supply>(
            value: _selectedSupply,
            isExpanded: true,
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              fillColor: const Color(0xFFF0FDF4),
              filled: true,
            ),
            items: _filteredSupplies.map((s) {
              final isOut = s.isOutOfStock;
              return DropdownMenuItem<Supply>(
                value: s,
                enabled: !isOut,
                child: Text(
                  isOut
                      ? '🧪 ${s.name} (${s.packageQty} ${s.packageUnit}) — ⚠️ [HẾT HÀNG]'
                      : '🧪 ${s.name} (${s.packageQty} ${s.packageUnit}) (Còn: ${s.stockQuantity} ${s.unit})',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.bold,
                    color: isOut ? Colors.red : AppTheme.textMain,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              );
            }).toList(),
            onChanged: (val) {
              setState(() => _selectedSupply = val);
            },
          ),
          if (_selectedSupply?.imageUrl != null && _selectedSupply!.imageUrl!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                border: Border.all(color: AppTheme.grayBorder),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: Image.network(
                      _selectedSupply!.imageUrl!,
                      width: 40,
                      height: 40,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Icon(Icons.image_not_supported_rounded, size: 24, color: Colors.grey),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text('Ảnh bao bì / nhãn hiệu sản phẩm', style: TextStyle(fontSize: 11, color: AppTheme.textMuted, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          ],
          const SizedBox(height: 4),
          const Text(
            '✅ Đã liên kết với Kho vật tư (Tự động hạch toán chi phí)',
            style: TextStyle(fontSize: 11, color: Color(0xFF15803D), fontWeight: FontWeight.w600),
          ),
        ] else ...[
          const Text('Loại phân bón *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
          const SizedBox(height: 6),
          TextFormField(
            controller: _manualNameController,
            decoration: InputDecoration(
              hintText: 'Ví dụ: Phân NPK 20-20-15, Hữu cơ vi sinh...',
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
            validator: (val) => val == null || val.trim().isEmpty ? 'Vui lòng nhập tên phân bón' : null,
          ),
        ],
        const SizedBox(height: 14),

        // Liều lượng & Đơn vị
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Liều lượng *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      hintText: 'VD: 100',
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    validator: (val) => val == null || double.tryParse(val) == null ? 'Số lượng lỗi' : null,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Đơn vị', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: ['gam', 'kg', 'ml', 'lít', 'bao'].contains(_selectedUnit) ? _selectedUnit : 'gam',
                    decoration: InputDecoration(
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'gam', child: Text('gam')),
                      DropdownMenuItem(value: 'kg', child: Text('kg')),
                      DropdownMenuItem(value: 'ml', child: Text('ml')),
                      DropdownMenuItem(value: 'lít', child: Text('lít')),
                      DropdownMenuItem(value: 'bao', child: Text('bao')),
                    ],
                    onChanged: (val) {
                      if (val != null) setState(() => _selectedUnit = val);
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPesticideFields() {
    final activeIng = _selectedSupply?.activeIngredient ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_filteredSupplies.isNotEmpty) ...[
          const Row(
            children: [
              Icon(Icons.link_rounded, size: 14, color: AppTheme.green),
              SizedBox(width: 4),
              Text('Chọn Thuốc BVTV (Từ Kho Vật tư) *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
            ],
          ),
          const SizedBox(height: 6),
          DropdownButtonFormField<Supply>(
            value: _selectedSupply,
            isExpanded: true,
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              fillColor: const Color(0xFFF0FDF4),
              filled: true,
            ),
            items: _filteredSupplies.map((s) {
              final isOut = s.isOutOfStock;
              return DropdownMenuItem<Supply>(
                value: s,
                enabled: !isOut,
                child: Text(
                  isOut
                      ? '🛡️ ${s.name} (${s.packageQty} ${s.packageUnit}) — ⚠️ [HẾT HÀNG]'
                      : '🛡️ ${s.name} (${s.packageQty} ${s.packageUnit}) (Còn: ${s.stockQuantity} ${s.unit})',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.bold,
                    color: isOut ? Colors.red : AppTheme.textMain,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              );
            }).toList(),
            onChanged: (val) {
              setState(() => _selectedSupply = val);
            },
          ),
          const SizedBox(height: 8),

          // VietGAP Active Ingredient Info Card
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              border: Border.all(color: const Color(0xFFA7F3D0), width: 1.5),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.shield_outlined, color: Color(0xFF059669), size: 16),
                    SizedBox(width: 6),
                    Text(
                      'Tiêu Chuẩn VietGAP - Hoạt Chất & Nguồn Gốc:',
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF065F46)),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Hoạt chất đăng ký: ${activeIng.isNotEmpty ? activeIng : 'Chưa khai báo'}',
                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF065F46), fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),

          if (_selectedSupply?.imageUrl != null && _selectedSupply!.imageUrl!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                border: Border.all(color: AppTheme.grayBorder),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: Image.network(
                      _selectedSupply!.imageUrl!,
                      width: 40,
                      height: 40,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Icon(Icons.image_not_supported_rounded, size: 24, color: Colors.grey),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text('Ảnh bao bì / nhãn hiệu sản phẩm', style: TextStyle(fontSize: 11, color: AppTheme.textMuted, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          ],
          const SizedBox(height: 4),
          const Text(
            '✅ Đã liên kết với Kho vật tư (Tự động hạch toán chi phí & lưu vết VietGAP)',
            style: TextStyle(fontSize: 11, color: Color(0xFF15803D), fontWeight: FontWeight.w600),
          ),
        ] else ...[
          const Text('Loại thuốc bảo vệ thực vật *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
          const SizedBox(height: 6),
          TextFormField(
            controller: _manualNameController,
            decoration: InputDecoration(
              hintText: 'Ví dụ: Thuốc trừ bệnh Anvil 5SC, Ridomil Gold...',
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
            validator: (val) => val == null || val.trim().isEmpty ? 'Vui lòng nhập tên thuốc BVTV' : null,
          ),
        ],
        const SizedBox(height: 14),

        // Liều lượng & Đơn vị
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Liều lượng *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      hintText: 'VD: 50',
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    validator: (val) => val == null || double.tryParse(val) == null ? 'Số lượng lỗi' : null,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Đơn vị', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: ['ml', 'gam', 'lít', 'chai', 'gói'].contains(_selectedUnit) ? _selectedUnit : 'ml',
                    decoration: InputDecoration(
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'ml', child: Text('ml')),
                      DropdownMenuItem(value: 'gam', child: Text('gam')),
                      DropdownMenuItem(value: 'lít', child: Text('lít')),
                      DropdownMenuItem(value: 'chai', child: Text('chai')),
                      DropdownMenuItem(value: 'gói', child: Text('gói')),
                    ],
                    onChanged: (val) {
                      if (val != null) setState(() => _selectedUnit = val);
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPruningFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Lý do cắt tỉa *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          value: _pruneReasonsList.contains(_pruneReason) ? _pruneReason : _pruneReasonsList.first,
          decoration: InputDecoration(
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
          items: _pruneReasonsList.map((r) => DropdownMenuItem(value: r, child: Text(r, style: const TextStyle(fontSize: 13)))).toList(),
          onChanged: (val) {
            if (val != null) setState(() => _pruneReason = val);
          },
        ),
        const SizedBox(height: 14),
        const Text('Số lượng cành/lá đã cắt', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
        const SizedBox(height: 6),
        TextFormField(
          controller: _amountController,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            hintText: 'VD: 5',
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
          validator: (val) => val == null || int.tryParse(val) == null ? 'Số cành/lá lỗi' : null,
        ),
      ],
    );
  }

  Widget _buildFlowerPruningFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Lý do tỉa hoa/quả *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          value: _flowerPruneReasonsList.contains(_flowerPruneReason) ? _flowerPruneReason : _flowerPruneReasonsList.first,
          decoration: InputDecoration(
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
          items: _flowerPruneReasonsList.map((r) => DropdownMenuItem(value: r, child: Text(r, style: const TextStyle(fontSize: 13)))).toList(),
          onChanged: (val) {
            if (val != null) setState(() => _flowerPruneReason = val);
          },
        ),
        const SizedBox(height: 14),
        const Text('Số lượng hoa/quả đã tỉa', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
        const SizedBox(height: 6),
        TextFormField(
          controller: _amountController,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            hintText: 'VD: 3',
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
          validator: (val) => val == null || int.tryParse(val) == null ? 'Số hoa/quả lỗi' : null,
        ),
      ],
    );
  }

  Widget _buildHarvestFields() {
    final batchCode = _getBatchCodePreview();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // VietGAP Batch Code Preview
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            border: Border.all(color: const Color(0xFFCBD5E1)),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.qr_code_2_rounded, size: 16, color: Color(0xFF0284C7)),
                  SizedBox(width: 6),
                  Text(
                    'Mã Lô Nông Sản VietGAP (Batch Code) Tự Sinh:',
                    style: TextStyle(fontSize: 11.5, color: Color(0xFF475569), fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                batchCode,
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w800,
                  fontSize: 13.5,
                  color: Color(0xFF0369A1),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Sản lượng & Đơn vị
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.agriculture_rounded, size: 14, color: Color(0xFFD97706)),
                      SizedBox(width: 4),
                      Text('Sản lượng thu hoạch *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      hintText: 'VD: 50',
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    validator: (val) => val == null || double.tryParse(val) == null ? 'Sản lượng lỗi' : null,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Đơn vị', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: _harvestUnits.contains(_harvestUnit) ? _harvestUnit : _harvestUnits.first,
                    decoration: InputDecoration(
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    items: _harvestUnits.map((u) => DropdownMenuItem(value: u, child: Text(u, style: const TextStyle(fontSize: 13)))).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _harvestUnit = val);
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // Chất lượng nông sản / Brix
        const Text('Chất lượng nông sản / Độ đường (Brix)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
        const SizedBox(height: 6),
        TextFormField(
          controller: _harvestQualityController,
          decoration: InputDecoration(
            hintText: 'Ví dụ: Loại A (Brix 18%), Đạt chuẩn xuất khẩu...',
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ],
    );
  }

  Widget _buildDiseaseFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Tên bệnh / Triệu chứng *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
        const SizedBox(height: 6),
        TextFormField(
          controller: _manualNameController,
          decoration: InputDecoration(
            hintText: 'Ví dụ: Vàng lá thối rễ, Sâu đục thân, Nấm hồng...',
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
          validator: (val) => val == null || val.trim().isEmpty ? 'Vui lòng nhập tên bệnh hoặc triệu chứng' : null,
        ),
        const SizedBox(height: 14),

        const Text('Mức độ nghiêm trọng *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          value: _diseaseSeverities.contains(_diseaseSeverity) ? _diseaseSeverity : 'Trung bình',
          decoration: InputDecoration(
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
          items: _diseaseSeverities.map((s) {
            Color color = Colors.green;
            if (s == 'Trung bình') color = Colors.orange;
            if (s == 'Nghiêm trọng') color = Colors.red;

            return DropdownMenuItem(
              value: s,
              child: Row(
                children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                  const SizedBox(width: 8),
                  Text(s, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color)),
                ],
              ),
            );
          }).toList(),
          onChanged: (val) {
            if (val != null) setState(() => _diseaseSeverity = val);
          },
        ),
        const SizedBox(height: 14),

        const Text('Mô tả dấu hiệu / Triệu chứng', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
        const SizedBox(height: 6),
        TextFormField(
          controller: _diseaseDescController,
          maxLines: 2,
          decoration: InputDecoration(
            hintText: 'Nhập thêm chi tiết quan sát được trên cây...',
            contentPadding: const EdgeInsets.all(12),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ],
    );
  }

  Widget _buildOtherFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Chi tiết hoạt động *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
        const SizedBox(height: 6),
        TextFormField(
          controller: _manualNameController,
          decoration: InputDecoration(
            hintText: 'Ghi chép chi tiết hoạt động nông nghiệp...',
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
          validator: (val) => val == null || val.trim().isEmpty ? 'Trường này không được bỏ trống' : null,
        ),
      ],
    );
  }
}
