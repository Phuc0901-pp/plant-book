import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/supply.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';

class SuppliesPage extends StatefulWidget {
  const SuppliesPage({super.key});

  @override
  State<SuppliesPage> createState() => _SuppliesPageState();
}

class _SuppliesPageState extends State<SuppliesPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  String _selectedCategory = 'all';
  List<Supply> _supplies = [];

  final NumberFormat _currencyFormat = NumberFormat.currency(
    locale: 'vi_VN',
    symbol: 'VNĐ',
    decimalDigits: 0,
  );

  @override
  void initState() {
    super.initState();
    _loadSupplies();
  }

  Future<void> _loadSupplies() async {
    setState(() => _isLoading = true);
    final supplies = await _apiService.fetchSupplies(category: _selectedCategory);
    if (mounted) {
      setState(() {
        _supplies = supplies;
        _isLoading = false;
      });
    }
  }

  void _onCategorySelected(String cat) {
    if (_selectedCategory == cat) return;
    setState(() {
      _selectedCategory = cat;
    });
    _loadSupplies();
  }

  void _openSupplyDialog([Supply? supply]) {
    showDialog(
      context: context,
      builder: (context) => SupplyFormDialog(
        supply: supply,
        onSaved: () => _loadSupplies(),
      ),
    );
  }

  Future<void> _confirmDelete(Supply supply) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: AppTheme.red),
            SizedBox(width: 8),
            Text('Xác nhận xóa vật tư', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text('Bạn có chắc chắn muốn xóa vật tư "${supply.name}" khỏi hệ thống?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xóa ngay', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final success = await _apiService.deleteSupply(supply.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? 'Đã xóa vật tư thành công!' : 'Lỗi xóa vật tư.'),
            backgroundColor: success ? AppTheme.green : AppTheme.red,
          ),
        );
        if (success) _loadSupplies();
      }
    }
  }

  Widget _buildCategoryChip(String label, String cat, IconData icon) {
    final isSelected = _selectedCategory == cat;
    return ChoiceChip(
      avatar: Icon(icon, size: 16, color: isSelected ? Colors.white : AppTheme.green),
      label: Text(label),
      selected: isSelected,
      selectedColor: AppTheme.green,
      backgroundColor: Colors.grey.shade100,
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : AppTheme.textMain,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        fontSize: 12,
      ),
      onSelected: (_) => _onCategorySelected(cat),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.inventory_2_rounded, color: AppTheme.green),
            SizedBox(width: 8),
            Text('Quản lý & Giám sát Vật tư', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openSupplyDialog(),
        backgroundColor: AppTheme.green,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Khai báo vật tư', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _buildCategoryChip('Tất cả', 'all', Icons.grid_view_rounded),
                const SizedBox(width: 8),
                _buildCategoryChip('Bón phân', 'Bón phân', Icons.science_rounded),
                const SizedBox(width: 8),
                _buildCategoryChip('Tiền nước', 'Tiền nước', Icons.water_drop_rounded),
                const SizedBox(width: 8),
                _buildCategoryChip('Phun thuốc', 'Phun thuốc', Icons.shield_rounded),
                const SizedBox(width: 8),
                _buildCategoryChip('Nhân công', 'Nhân công', Icons.badge_rounded),
              ],
            ),
          ),
          const Divider(height: 1),

          // Content List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _supplies.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.inventory_2_outlined, size: 56, color: Colors.grey.shade400),
                            const SizedBox(height: 12),
                            Text(
                              'Chưa có vật tư nào được khai báo',
                              style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton.icon(
                              onPressed: () => _openSupplyDialog(),
                              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.green),
                              icon: const Icon(Icons.add_rounded, color: Colors.white),
                              label: const Text('Khai báo vật tư mới', style: TextStyle(color: Colors.white)),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadSupplies,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _supplies.length,
                          itemBuilder: (context, index) {
                            final sp = _supplies[index];
                            return _buildSupplyCard(sp);
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildSupplyCard(Supply sp) {
    final smallUnit = (sp.unit == 'kg' ? 'g' : (sp.unit == 'lít' ? 'ml' : (sp.unit == 'm³' || sp.unit == 'm3' ? 'lít' : sp.unit)));
    final priceLarge = sp.unitPrice;
    final priceSmall = sp.unitPriceSmall > 0 ? sp.unitPriceSmall : (sp.packageQty > 0 ? priceLarge / sp.packageQty : priceLarge);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Product Thumbnail
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: sp.imageUrl != null && sp.imageUrl!.isNotEmpty
                      ? Image.network(
                          sp.imageUrl!,
                          width: 48,
                          height: 48,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _buildFallbackCategoryIcon(sp.category),
                        )
                      : _buildFallbackCategoryIcon(sp.category),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        sp.name,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.textMain),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: _getCategoryColor(sp.category).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          sp.category,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _getCategoryColor(sp.category),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.edit_outlined, size: 20, color: Colors.blue),
                  onPressed: () => _openSupplyDialog(sp),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded, size: 20, color: AppTheme.red),
                  onPressed: () => _confirmDelete(sp),
                ),
              ],
            ),
            const Divider(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Quy cách đóng gói', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                    const SizedBox(height: 2),
                    Text(
                      '${sp.packageQty.toStringAsFixed(sp.packageQty.truncateToDouble() == sp.packageQty ? 0 : 1)} ${sp.packageUnit}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('Đơn giá quy đổi', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                    const SizedBox(height: 2),
                    Text(
                      '${_currencyFormat.format(priceLarge)} / ${sp.unit}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.greenDark),
                    ),
                    Text(
                      '(${_currencyFormat.format(priceSmall)} / $smallUnit)',
                      style: const TextStyle(fontSize: 11, color: Colors.blue, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFallbackCategoryIcon(String cat) {
    IconData icon = Icons.inventory_2_rounded;
    Color color = AppTheme.green;
    if (cat == 'Bón phân') icon = Icons.science_rounded;
    if (cat == 'Tiền nước') icon = Icons.water_drop_rounded;
    if (cat == 'Phun thuốc') icon = Icons.shield_rounded;
    if (cat == 'Nhân công') icon = Icons.badge_rounded;

    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, color: color, size: 24),
    );
  }

  Color _getCategoryColor(String cat) {
    if (cat == 'Bón phân') return AppTheme.green;
    if (cat == 'Tiền nước') return Colors.blue;
    if (cat == 'Phun thuốc') return Colors.orange;
    if (cat == 'Nhân công') return Colors.purple;
    return AppTheme.green;
  }
}

class SupplyFormDialog extends StatefulWidget {
  final Supply? supply;
  final VoidCallback onSaved;

  const SupplyFormDialog({super.key, this.supply, required this.onSaved});

  @override
  State<SupplyFormDialog> createState() => _SupplyFormDialogState();
}

class _SupplyFormDialogState extends State<SupplyFormDialog> {
  final _formKey = GlobalKey<FormState>();
  final ApiService _apiService = ApiService();

  late String _category;
  late String _packageUnit;
  late TextEditingController _nameController;
  late TextEditingController _packageQtyController;
  late TextEditingController _packagePriceController;
  late TextEditingController _noteController;
  bool _isSaving = false;

  double _priceLarge = 0;
  double _priceSmall = 0;
  String _unitLarge = 'kg';
  String _unitSmall = 'g';

  @override
  void initState() {
    super.initState();
    final sp = widget.supply;
    _category = sp?.category ?? 'Bón phân';
    _packageUnit = sp?.packageUnit ?? 'kg';
    _nameController = TextEditingController(text: sp?.name ?? '');
    _packageQtyController = TextEditingController(text: sp != null ? sp.packageQty.toStringAsFixed(sp.packageQty.truncateToDouble() == sp.packageQty ? 0 : 1) : '50');
    _packagePriceController = TextEditingController(text: sp != null ? sp.packagePrice.toStringAsFixed(0) : '1530000');
    _noteController = TextEditingController(text: sp?.note ?? '');

    _recalculateUnits();
  }

  void _recalculateUnits() {
    final qty = double.tryParse(_packageQtyController.text) ?? 1.0;
    final price = double.tryParse(_packagePriceController.text) ?? 0.0;

    if (_packageUnit == 'kg') {
      _unitLarge = 'kg';
      _unitSmall = 'g';
      _priceLarge = price / qty;
      _priceSmall = _priceLarge / 1000;
    } else if (_packageUnit == 'g') {
      _unitLarge = 'kg';
      _unitSmall = 'g';
      _priceSmall = price / qty;
      _priceLarge = _priceSmall * 1000;
    } else if (_packageUnit == 'lít') {
      _unitLarge = 'lít';
      _unitSmall = 'ml';
      _priceLarge = price / qty;
      _priceSmall = _priceLarge / 1000;
    } else if (_packageUnit == 'ml') {
      _unitLarge = 'lít';
      _unitSmall = 'ml';
      _priceSmall = price / qty;
      _priceLarge = _priceSmall * 1000;
    } else if (_packageUnit == 'm3') {
      _unitLarge = 'm³';
      _unitSmall = 'lít';
      _priceLarge = price / qty;
      _priceSmall = _priceLarge / 1000;
    } else {
      _unitLarge = _packageUnit;
      _unitSmall = _packageUnit;
      _priceLarge = price / qty;
      _priceSmall = _priceLarge;
    }
    setState(() {});
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    final qty = double.tryParse(_packageQtyController.text) ?? 1.0;
    final price = double.tryParse(_packagePriceController.text) ?? 0.0;

    final data = {
      'category': _category,
      'name': _nameController.text.trim(),
      'package_qty': qty,
      'package_unit': _packageUnit,
      'package_price': price,
      'package_size': '$qty $_packageUnit',
      'unit': _unitLarge,
      'unit_price': _priceLarge,
      'unit_price_small': _priceSmall,
      'note': _noteController.text.trim(),
    };

    final isEdit = widget.supply != null;
    final res = isEdit
        ? await _apiService.updateSupply(widget.supply!.id, data)
        : await _apiService.createSupply(data);

    if (mounted) {
      setState(() => _isSaving = false);
      if (res != null) {
        Navigator.pop(context);
        widget.onSaved();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isEdit ? 'Cập nhật vật tư thành công!' : 'Khai báo vật tư mới thành công!'),
            backgroundColor: AppTheme.green,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không thể lưu vật tư. Vui lòng thử lại.'),
            backgroundColor: AppTheme.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(locale: 'vi_VN', symbol: 'VNĐ', decimalDigits: 0);

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Icon(widget.supply != null ? Icons.edit_rounded : Icons.add_box_rounded, color: AppTheme.green),
          const SizedBox(width: 8),
          Text(
            widget.supply != null ? 'Chỉnh sửa vật tư' : 'Khai báo vật tư mới',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: _category,
                decoration: const InputDecoration(labelText: 'Hạng mục gốc *', border: OutlineInputBorder()),
                items: const [
                  DropdownMenuItem(value: 'Bón phân', child: Text('🧪 Bón phân')),
                  DropdownMenuItem(value: 'Tiền nước', child: Text('💧 Tiền nước (m³)')),
                  DropdownMenuItem(value: 'Phun thuốc', child: Text('🛡️ Phun thuốc')),
                  DropdownMenuItem(value: 'Nhân công', child: Text('👷 Nhân công')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _category = val);
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Tên vật tư / Dịch vụ *',
                  hintText: 'Ví dụ: Phân NPK Đầu Trâu 20-20-15+TE',
                  border: OutlineInputBorder(),
                ),
                validator: (val) => val == null || val.trim().isEmpty ? 'Vui lòng nhập tên vật tư' : null,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: TextFormField(
                      controller: _packageQtyController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Khối lượng 1 gói *', border: OutlineInputBorder()),
                      onChanged: (_) => _recalculateUnits(),
                      validator: (val) => val == null || double.tryParse(val) == null ? 'Lỗi số' : null,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: DropdownButtonFormField<String>(
                      value: _packageUnit,
                      decoration: const InputDecoration(labelText: 'Đơn vị *', border: OutlineInputBorder()),
                      items: const [
                        DropdownMenuItem(value: 'kg', child: Text('kg')),
                        DropdownMenuItem(value: 'g', child: Text('g')),
                        DropdownMenuItem(value: 'lít', child: Text('lít')),
                        DropdownMenuItem(value: 'ml', child: Text('ml')),
                        DropdownMenuItem(value: 'm3', child: Text('m³')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          _packageUnit = val;
                          _recalculateUnits();
                        }
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _packagePriceController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Tổng giá mua 1 gói (VNĐ) *',
                  hintText: 'VD: 1530000',
                  border: OutlineInputBorder(),
                ),
                onChanged: (_) => _recalculateUnits(),
                validator: (val) => val == null || double.tryParse(val) == null ? 'Vui lòng nhập số tiền' : null,
              ),
              const SizedBox(height: 14),

              // Breakdown Calculator Box
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  border: Border.all(color: Colors.green.shade200),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.calculate_rounded, size: 16, color: AppTheme.greenDark),
                        SizedBox(width: 4),
                        Text('TỰ ĐỘNG QUY ĐỔI ĐƠN GIÁ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Đơn giá / $_unitLarge:', style: const TextStyle(fontSize: 12)),
                        Text(
                          '${currencyFormat.format(_priceLarge)} / $_unitLarge',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.greenDark, fontSize: 13),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Đơn giá / $_unitSmall:', style: const TextStyle(fontSize: 12)),
                        Text(
                          '${currencyFormat.format(_priceSmall)} / $_unitSmall',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue, fontSize: 13),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _noteController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Ghi chú thêm',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: AppTheme.green),
          onPressed: _isSaving ? null : _save,
          child: _isSaving
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Lưu vật tư', style: TextStyle(color: Colors.white)),
        ),
      ],
    );
  }
}
