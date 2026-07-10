import 'package:flutter/material.dart';
import '../models/plant_log.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';

class LogEditDialog extends StatefulWidget {
  final int plantId;
  final PlantLog? log; // null means ADD, not null means EDIT

  const LogEditDialog({
    super.key,
    required this.plantId,
    this.log,
  });

  @override
  State<LogEditDialog> createState() => _LogEditDialogState();
}

class _LogEditDialogState extends State<LogEditDialog> {
  final _formKey = GlobalKey<FormState>();
  final _noteController = TextEditingController();
  final _detailController = TextEditingController(); // For amount, fertilizer name, pesticide name, etc.
  
  late String _selectedType;
  late DateTime _selectedDate;
  bool _isSaving = false;

  final List<String> _activityTypes = [
    'Tưới nước',
    'Bón phân',
    'Phun thuốc',
    'Tỉa cành/lá',
    'Tỉa quả/hoa',
    'Bệnh cây',
    'Khác'
  ];

  @override
  void initState() {
    super.initState();
    if (widget.log != null) {
      // Edit mode
      _selectedType = _activityTypes.contains(widget.log!.logType) ? widget.log!.logType : 'Khác';
      _selectedDate = DateTime.tryParse(widget.log!.logDate) ?? DateTime.now();
      _noteController.text = widget.log!.note ?? '';
      
      // Load details into input controller
      final detailVal = widget.log!.details['value'] ?? 
                        widget.log!.details['method'] ?? 
                        widget.log!.details['fertilizer'] ?? 
                        widget.log!.details['pesticide'] ?? 
                        widget.log!.details['reason'] ?? 
                        widget.log!.details['disease'] ?? '';
      _detailController.text = detailVal.toString();
    } else {
      // Add mode
      _selectedType = 'Tưới nước';
      _selectedDate = DateTime.now();
    }
  }

  @override
  void dispose() {
    _noteController.dispose();
    _detailController.dispose();
    super.dispose();
  }

  String _getDetailLabel() {
    switch (_selectedType) {
      case 'Tưới nước':
        return 'Phương thức tưới / Lượng nước (lít)';
      case 'Bón phân':
        return 'Tên phân bón sử dụng';
      case 'Phun thuốc':
        return 'Tên thuốc BVTV';
      case 'Tỉa cành/lá':
        return 'Lý do cắt tỉa cành/lá';
      case 'Tỉa quả/hoa':
        return 'Lý do tỉa quả/hoa';
      case 'Bệnh cây':
        return 'Tên bệnh phát hiện';
      default:
        return 'Chi tiết hoạt động';
    }
  }

  String _getDetailHint() {
    switch (_selectedType) {
      case 'Tưới nước':
        return 'Ví dụ: Tưới nhỏ giọt 5 lít';
      case 'Bón phân':
        return 'Ví dụ: Phân NPK 16-16-8';
      case 'Phun thuốc':
        return 'Ví dụ: Anvil 5SC';
      case 'Tỉa cành/lá':
        return 'Ví dụ: Loại bỏ cành sâu bệnh';
      case 'Tỉa quả/hoa':
        return 'Ví dụ: Tỉa bớt nụ còi cọc';
      case 'Bệnh cây':
        return 'Ví dụ: Nấm hồng, rầy xanh';
      default:
        return 'Nhập thông số chi tiết...';
    }
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSaving = true;
    });

    final note = _noteController.text.trim();
    final detailValue = _detailController.text.trim();
    
    // Build details JSON
    final Map<String, dynamic> details = {
      'value': detailValue,
    };
    
    // Assign specific field keys for backwards compatibility with web portal schemas
    if (_selectedType == 'Tưới nước') details['method'] = detailValue;
    if (_selectedType == 'Bón phân') details['fertilizer'] = detailValue;
    if (_selectedType == 'Phun thuốc') details['pesticide'] = detailValue;
    if (_selectedType == 'Tỉa cành/lá' || _selectedType == 'Tỉa quả/hoa') details['reason'] = detailValue;
    if (_selectedType == 'Bệnh cây') details['disease'] = detailValue;

    bool success;
    final dateStr = _selectedDate.toIso8601String().substring(0, 10);

    if (widget.log != null) {
      // Call Edit API
      success = await ApiService().updatePlantLog(
        widget.plantId,
        widget.log!.id,
        dateStr,
        _selectedType,
        note,
        details,
      );
    } else {
      // Call Add API
      success = await ApiService().createPlantLog(
        widget.plantId,
        _selectedType,
        note,
        details,
      );
    }

    if (!mounted) return;

    setState(() {
      _isSaving = false;
    });

    if (success) {
      Navigator.pop(context, true); // Return true to trigger reload
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không thể lưu nhật ký. Vui lòng kiểm tra lại kết nối mạng.'),
          backgroundColor: AppTheme.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.log != null ? 'Chỉnh sửa Nhật ký' : 'Ghi Nhật ký Mới';

    return AlertDialog(
      title: Text(
        title,
        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textMain),
      ),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Log Type Dropdown
              const Text('Loại hoạt động:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                value: _selectedType,
                decoration: const InputDecoration(
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: _activityTypes.map((type) {
                  return DropdownMenuItem<String>(
                    value: type,
                    child: Text(type, style: const TextStyle(fontSize: 14)),
                  );
                }).toList(),
                onChanged: widget.log != null 
                    ? null // Disable type change on edit to preserve schema integrity
                    : (val) {
                        if (val != null) {
                          setState(() {
                            _selectedType = val;
                          });
                        }
                      },
              ),
              const SizedBox(height: 16),
              
              // Date picker
              const Text('Ngày thực hiện:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
              const SizedBox(height: 6),
              OutlinedButton.icon(
                icon: const Icon(Icons.calendar_today_rounded, size: 16, color: AppTheme.greenDark),
                label: Text(
                  '${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}',
                  style: const TextStyle(color: AppTheme.textMain, fontSize: 14),
                ),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                  side: const BorderSide(color: AppTheme.grayBorder, width: 1.5),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
              const SizedBox(height: 16),
              
              // Detail input field (changes based on type)
              Text(_getDetailLabel(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
              const SizedBox(height: 6),
              TextFormField(
                controller: _detailController,
                decoration: InputDecoration(
                  hintText: _getDetailHint(),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Trường này không được bỏ trống';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              
              // Note field
              const Text('Ghi chú bổ sung:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
              const SizedBox(height: 6),
              TextFormField(
                controller: _noteController,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Nhập ghi chú hoặc hướng dẫn chăm sóc...',
                  contentPadding: EdgeInsets.all(12),
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSaving ? null : () => Navigator.pop(context),
          child: const Text('Hủy', style: TextStyle(color: AppTheme.textMuted)),
        ),
        ElevatedButton(
          onPressed: _isSaving ? null : _handleSave,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.green,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          ),
          child: _isSaving
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
              : const Text('Lưu lại', style: TextStyle(fontSize: 13)),
        ),
      ],
    );
  }
}
