import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/plant_log.dart';
import '../models/supply.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';

class LogEditDialog extends StatefulWidget {
  final List<int> plantIds;
  final PlantLog? log; // null means ADD, not null means EDIT
  final String? farmName;

  const LogEditDialog({
    super.key,
    required this.plantIds,
    this.log,
    this.farmName,
  });

  @override
  State<LogEditDialog> createState() => _LogEditDialogState();
}

class _LogEditDialogState extends State<LogEditDialog> {
  final _formKey = GlobalKey<FormState>();
  final _noteController = TextEditingController();
  
  // Custom detail controllers
  final _amountController = TextEditingController();
  final _manualNameController = TextEditingController(); // For fallback when no supplies in warehouse
  
  late String _selectedType;
  late DateTime _selectedDate;
  bool _isLoadingSupplies = false;
  bool _isSaving = false;

  List<Supply> _allSupplies = [];
  List<Supply> _filteredSupplies = [];
  Supply? _selectedSupply;
  String _selectedUnit = 'kg'; // Default unit
  String _wateringMethod = 'Tưới nhỏ giọt';

  final List<String> _activityTypes = [
    'Tưới nước',
    'Bón phân',
    'Phun thuốc',
    'Tỉa cành/lá',
    'Tỉa quả/hoa',
    'Bệnh cây',
    'Khác'
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
      _selectedType = _activityTypes.contains(widget.log!.logType) ? widget.log!.logType : 'Khác';
      _selectedDate = DateTime.tryParse(widget.log!.logDate) ?? DateTime.now();
      _noteController.text = widget.log!.note ?? '';

      // Set edit initial values
      final details = widget.log!.details;
      if (_selectedType == 'Tưới nước') {
        _amountController.text = (details['amount'] ?? details['value'] ?? '').toString();
        _wateringMethod = (details['method'] ?? 'Tưới nhỏ giọt').toString();
      } else if (_selectedType == 'Bón phân' || _selectedType == 'Phun thuốc') {
        _amountController.text = (details['amount'] ?? '').toString();
        _selectedUnit = (details['unit'] ?? (_selectedType == 'Bón phân' ? 'kg' : 'lít')).toString();
        _manualNameController.text = (details['fertilizer_name'] ?? details['pesticide_name'] ?? details['value'] ?? '').toString();
      } else {
        _manualNameController.text = (details['value'] ?? details['reason'] ?? details['disease'] ?? '').toString();
      }
    } else {
      _selectedType = 'Tưới nước';
      _selectedDate = DateTime.now();
      _amountController.text = '10'; // default 10 liters
    }

    _loadSupplies();
  }

  @override
  void dispose() {
    _noteController.dispose();
    _amountController.dispose();
    _manualNameController.dispose();
    super.dispose();
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
      _selectedUnit = 'lít';
    } else if (_selectedType == 'Bón phân') {
      targetCategory = 'Bón phân';
      _selectedUnit = 'kg';
    } else if (_selectedType == 'Phun thuốc') {
      targetCategory = 'Phun thuốc';
      _selectedUnit = 'lít';
    }

    if (targetCategory.isNotEmpty) {
      _filteredSupplies = _allSupplies.where((s) => s.category == targetCategory).toList();
    } else {
      _filteredSupplies = [];
    }

    // Try to auto-select matching supply if edit or new
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

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSaving = true;
    });

    final note = _noteController.text.trim();
    final Map<String, dynamic> details = {};
    final dateStr = _selectedDate.toIso8601String().substring(0, 10);

    // Build details based on selected care activity type
    if (_selectedType == 'Tưới nước') {
      final amount = double.tryParse(_amountController.text) ?? 0.0;
      details['amount'] = amount;
      details['unit'] = 'lít';
      details['method'] = _wateringMethod;
      details['value'] = '$_wateringMethod: $amount lít';
    } else if (_selectedType == 'Bón phân') {
      final amount = double.tryParse(_amountController.text) ?? 0.0;
      final fertilizerName = _selectedSupply != null ? _selectedSupply!.name : _manualNameController.text.trim();
      details['fertilizer_name'] = fertilizerName;
      details['amount'] = amount;
      details['unit'] = _selectedUnit;
      details['value'] = '$fertilizerName: $amount $_selectedUnit';
    } else if (_selectedType == 'Phun thuốc') {
      final amount = double.tryParse(_amountController.text) ?? 0.0;
      final pesticideName = _selectedSupply != null ? _selectedSupply!.name : _manualNameController.text.trim();
      details['pesticide_name'] = pesticideName;
      details['amount'] = amount;
      details['unit'] = _selectedUnit;
      details['value'] = '$pesticideName: $amount $_selectedUnit';
    } else if (_selectedType == 'Tỉa cành/lá' || _selectedType == 'Tỉa quả/hoa') {
      details['reason'] = _manualNameController.text.trim();
      details['value'] = _manualNameController.text.trim();
    } else if (_selectedType == 'Bệnh cây') {
      details['disease_name'] = _manualNameController.text.trim();
      details['value'] = _manualNameController.text.trim();
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

        // Auto-record supply usage if online and a supply was chosen from the list
        if (ok && _selectedSupply != null) {
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
              'note': 'Tự động hạch toán từ Nhật ký Chăm sóc Mobile: $_selectedType ($amount ${_selectedType == 'Tưới nước' ? 'Lít' : _selectedUnit} = $usageQty ${_selectedSupply!.unit} cho Cây #$id)',
            });
          } catch (e) {
            print('Failed to record supply usage in background for plant $id: $e');
          }
        }
      }
    }

    if (!mounted) return;

    setState(() {
      _isSaving = false;
    });

    if (success) {
      Navigator.pop(context, true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không thể lưu nhật ký. Vui lòng thử lại.'),
          backgroundColor: AppTheme.red,
        ),
      );
    }
  }

  double _calculateWaterCost() {
    if (_selectedSupply == null) return 0.0;
    final amount = double.tryParse(_amountController.text) ?? 0.0;
    final m3 = amount / 1000.0;
    return m3 * _selectedSupply!.unitPrice;
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.log != null;
    final titleText = isEdit ? 'Chỉnh sửa Nhật ký' : 'Ghi Nhật ký Chăm sóc';

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      clipBehavior: Clip.antiAlias,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // AgTech Gradient Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF091E15), Color(0xFF15803D)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
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
                      Text(
                        widget.plantIds.length == 1
                            ? 'Cây #${widget.plantIds.first}${widget.farmName != null ? ' - ${widget.farmName}' : ''}'
                            : '${widget.plantIds.length} cây đã chọn${widget.farmName != null ? ' - ${widget.farmName}' : ''}',
                        style: const TextStyle(color: Colors.white70, fontSize: 11),
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
                    // Activity Type Dropdown
                    const Text('Loại hoạt động *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: _selectedType,
                      decoration: InputDecoration(
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        fillColor: const Color(0xFFF8FAFC),
                        filled: true,
                      ),
                      items: _activityTypes.map((type) {
                        return DropdownMenuItem<String>(
                          value: type,
                          child: Text(type, style: const TextStyle(fontSize: 14)),
                        );
                      }).toList(),
                      onChanged: isEdit
                          ? null // Disable type change on edit to preserve schema integrity
                          : (val) {
                              if (val != null) {
                                setState(() {
                                  _selectedType = val;
                                  _filterSupplies();
                                });
                              }
                            },
                    ),
                    const SizedBox(height: 14),

                    // Date Picker Button
                    const Text('Ngày thực hiện *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
                    const SizedBox(height: 6),
                    OutlinedButton.icon(
                      icon: const Icon(Icons.calendar_today_rounded, size: 16, color: AppTheme.green),
                      label: Text(
                        '${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}',
                        style: const TextStyle(color: AppTheme.textMain, fontSize: 14),
                      ),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 14),
                        side: const BorderSide(color: AppTheme.grayBorder, width: 1.2),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        alignment: Alignment.centerLeft,
                      ),
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: _selectedDate,
                          firstDate: DateTime(2025),
                          lastDate: DateTime.now(),
                        );
                        if (picked != null) {
                          setState(() {
                            _selectedDate = picked;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 14),

                    // Dynamic Fields based on Log Type
                    if (_selectedType == 'Tưới nước' || _selectedType == 'Bón phân' || _selectedType == 'Phun thuốc') ...[
                      // Supplies Dropdown if loading/exists
                      if (_isLoadingSupplies) ...[
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 10),
                          child: Row(
                            children: [
                              SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.green)),
                              SizedBox(width: 8),
                              Text('Đang nạp kho vật tư của bạn...', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                            ],
                          ),
                        ),
                      ] else if (_filteredSupplies.isNotEmpty) ...[
                        Text(
                          _selectedType == 'Tưới nước' ? 'Chọn nguồn nước (Từ kho vật tư) *' : 'Chọn vật tư (Từ kho vật tư) *',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted),
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
                                    ? '${s.name} (${s.packageQty} ${s.packageUnit}) - ⚠️ [HẾT HÀNG]'
                                    : '${s.name} (${s.packageQty} ${s.packageUnit}) (Tồn: ${s.stockQuantity} ${s.unit})',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: isOut ? Colors.red : AppTheme.textMain,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }).toList(),
                          onChanged: (val) {
                            setState(() {
                              _selectedSupply = val;
                            });
                          },
                        ),
                        const SizedBox(height: 14),
                      ] else ...[
                        // Fallback warning + text input for manual name entry
                        Container(
                          padding: const EdgeInsets.all(10),
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: Colors.amber.withValues(alpha: 0.1),
                            border: Border.all(color: Colors.amber.shade300),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.info_outline_rounded, size: 18, color: Colors.amber),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Chưa có vật tư phù hợp trong kho. Vui lòng khai báo trong tab Vật tư để tự động liên kết chi phí.',
                                  style: TextStyle(fontSize: 11, color: AppTheme.textMuted, height: 1.3),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          _selectedType == 'Bón phân' ? 'Tên phân bón (Nhập tay) *' : 'Tên thuốc bảo vệ thực vật (Nhập tay) *',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted),
                        ),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _manualNameController,
                          decoration: InputDecoration(
                            hintText: _selectedType == 'Bón phân' ? 'Ví dụ: Phân NPK Đầu Trâu' : 'Ví dụ: Thuốc diệt nấm Anvil',
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          validator: (val) => val == null || val.trim().isEmpty ? 'Trường này không được bỏ trống' : null,
                        ),
                        const SizedBox(height: 14),
                      ],

                      // Quantity Input & Unit Selector
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            flex: 3,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _selectedType == 'Tưới nước' ? 'Lượng nước tưới *' : 'Liều lượng dùng *',
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted),
                                ),
                                const SizedBox(height: 6),
                                TextFormField(
                                  controller: _amountController,
                                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                  decoration: InputDecoration(
                                    hintText: 'VD: 10',
                                    isDense: true,
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                  onChanged: (_) {
                                    if (_selectedType == 'Tưới nước') setState(() {});
                                  },
                                  validator: (val) => val == null || double.tryParse(val) == null ? 'Lỗi số' : null,
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
                                const Text('Đơn vị tính *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
                                const SizedBox(height: 6),
                                if (_selectedType == 'Tưới nước') ...[
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      border: Border.all(color: AppTheme.grayBorder),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Text('lít', style: TextStyle(fontSize: 14, color: AppTheme.textMain)),
                                  ),
                                ] else ...[
                                  DropdownButtonFormField<String>(
                                    value: _selectedUnit,
                                    decoration: InputDecoration(
                                      isDense: true,
                                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                    items: _selectedType == 'Bón phân'
                                        ? const [
                                            DropdownMenuItem(value: 'kg', child: Text('kg')),
                                            DropdownMenuItem(value: 'g', child: Text('g')),
                                          ]
                                        : const [
                                            DropdownMenuItem(value: 'lít', child: Text('lít')),
                                            DropdownMenuItem(value: 'ml', child: Text('ml')),
                                          ],
                                    onChanged: (val) {
                                      if (val != null) {
                                        setState(() {
                                          _selectedUnit = val;
                                        });
                                      }
                                    },
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Extra details for Watering Method
                      if (_selectedType == 'Tưới nước') ...[
                        const Text('Phương thức tưới *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
                        const SizedBox(height: 6),
                        DropdownButtonFormField<String>(
                          value: _wateringMethod,
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          items: const [
                            DropdownMenuItem(value: 'Tưới nhỏ giọt', child: Text('Tưới nhỏ giọt')),
                            DropdownMenuItem(value: 'Tưới phun mưa', child: Text('Tưới phun mưa')),
                            DropdownMenuItem(value: 'Tưới phun sương', child: Text('Tưới phun sương')),
                            DropdownMenuItem(value: 'Tưới thủ công', child: Text('Tưới thủ công')),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                _wateringMethod = val;
                              });
                            }
                          },
                        ),
                        const SizedBox(height: 14),

                        // Real-time Water cost conversion display (AgTech premium styling)
                        if (_selectedSupply != null) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFEFF6FF), Color(0xFFDBEAFE)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              border: Border.all(color: const Color(0xFFBFDBFE)),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.water_drop_rounded, color: Colors.blue, size: 24),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'HẠCH TOÁN CHI PHÍ NƯỚC TỰ ĐỘNG',
                                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.blue, letterSpacing: 0.3),
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        widget.plantIds.length == 1
                                            ? '${_amountController.text} Lít = ${(double.tryParse(_amountController.text) ?? 0.0) / 1000.0} m³'
                                            : '${_amountController.text} Lít/cây x ${widget.plantIds.length} cây = ${((double.tryParse(_amountController.text) ?? 0.0) * widget.plantIds.length).toStringAsFixed(1)} Lít (${((double.tryParse(_amountController.text) ?? 0.0) * widget.plantIds.length / 1000.0).toStringAsFixed(3)} m³)',
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMain),
                                      ),
                                      Text(
                                        widget.plantIds.length == 1
                                            ? 'Thành tiền: ${_currencyFormat.format(_calculateWaterCost())}'
                                            : 'Tổng: ${_currencyFormat.format(_calculateWaterCost() * widget.plantIds.length)} (${_currencyFormat.format(_calculateWaterCost())}/cây)',
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.blue),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                        ],
                      ],
                    ] else ...[
                      // Default text input fields for other log types
                      Text(
                        _selectedType == 'Tỉa cành/lá' || _selectedType == 'Tỉa quả/hoa'
                            ? 'Lý do cắt tỉa *'
                            : _selectedType == 'Bệnh cây'
                                ? 'Tên bệnh / Triệu chứng phát hiện *'
                                : 'Chi tiết hoạt động *',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted),
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _manualNameController,
                        decoration: InputDecoration(
                          hintText: _selectedType == 'Bệnh cây' ? 'Ví dụ: Nấm hồng, rầy xanh' : 'Ví dụ: Cắt cành còi cọc',
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        validator: (val) => val == null || val.trim().isEmpty ? 'Trường này không được bỏ trống' : null,
                      ),
                      const SizedBox(height: 14),
                    ],

                    // Note input field
                    const Text('Ghi chú thêm', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _noteController,
                      maxLines: 3,
                      decoration: InputDecoration(
                        hintText: 'Ví dụ: Chăm sóc định kỳ đợt 1...',
                        isDense: true,
                        contentPadding: const EdgeInsets.all(12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Footer Action Buttons
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            color: const Color(0xFFF8FAFC),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Hủy bỏ', style: TextStyle(color: AppTheme.textMuted)),
                ),
                const SizedBox(width: 10),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.green,
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _isSaving ? null : _handleSave,
                  icon: _isSaving
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.lock_rounded, size: 16, color: Colors.white),
                  label: const Text('Lưu lại', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
