import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
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
  String? _errorMessage;
  String _selectedCategory = 'all';
  List<Supply> _supplies = [];

  Map<String, dynamic>? _analyticsData;
  List<Map<String, dynamic>> _usages = [];
  bool _isAnalyticsLoading = true;

  final NumberFormat _currencyFormat = NumberFormat.currency(
    locale: 'vi_VN',
    symbol: 'VNĐ',
    decimalDigits: 0,
  );

  @override
  void initState() {
    super.initState();
    _loadSupplies();
    _loadAnalyticsAndUsages();
  }

  Future<void> _loadSupplies() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final supplies = await _apiService.fetchSupplies(category: _selectedCategory);
      if (mounted) {
        setState(() {
          _supplies = supplies;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Không thể tải danh sách vật tư. Vui lòng kiểm tra kết nối mạng.';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _loadAnalyticsAndUsages() async {
    if (!mounted) return;
    setState(() {
      _isAnalyticsLoading = true;
    });

    try {
      final usages = await _apiService.fetchSupplyUsages();
      final analytics = await _apiService.fetchSupplyAnalytics(period: 'month');
      if (mounted) {
        setState(() {
          _usages = usages;
          _analyticsData = analytics;
          _isAnalyticsLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isAnalyticsLoading = false;
        });
      }
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
      barrierDismissible: false,
      builder: (context) => SupplyFormDialog(
        supply: supply,
        onSaved: () {
          _loadSupplies();
          _loadAnalyticsAndUsages();
        },
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
        content: Text('Bạn có chắc chắn muốn xóa vật tư "${supply.name}" khỏi danh mục cá nhân?'),
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
        if (success) {
          _loadSupplies();
          _loadAnalyticsAndUsages();
        }
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
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : AppTheme.textMain,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        fontSize: 12,
      ),
      onSelected: (_) => _onCategorySelected(cat),
    );
  }

  Widget _buildManagementTab() {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openSupplyDialog(),
        backgroundColor: AppTheme.green,
        elevation: 3,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Khai báo vật tư', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          // Filter Chips Header
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildCategoryChip('Tất cả', 'all', Icons.grid_view_rounded),
                  const SizedBox(width: 6),
                  _buildCategoryChip('Bón phân', 'Bón phân', Icons.science_rounded),
                  const SizedBox(width: 6),
                  _buildCategoryChip('Tiền nước', 'Tiền nước', Icons.water_drop_rounded),
                  const SizedBox(width: 6),
                  _buildCategoryChip('Phun thuốc', 'Phun thuốc', Icons.shield_rounded),
                  const SizedBox(width: 6),
                  _buildCategoryChip('Nhân công', 'Nhân công', Icons.badge_rounded),
                ],
              ),
            ),
          ),
          const Divider(height: 1),

          // Main Content
          Expanded(
            child: _isLoading
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircularProgressIndicator(color: AppTheme.green),
                        SizedBox(height: 12),
                        Text('Đang nạp dữ liệu vật tư của nông hộ...', style: TextStyle(fontSize: 13, color: AppTheme.textMuted)),
                      ],
                    ),
                  )
                : _errorMessage != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.cloud_off_rounded, size: 48, color: AppTheme.red),
                            const SizedBox(height: 12),
                            Text(_errorMessage!, style: const TextStyle(color: AppTheme.textMuted, fontSize: 13)),
                            const SizedBox(height: 16),
                            ElevatedButton.icon(
                              onPressed: _loadSupplies,
                              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.green),
                              icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                              label: const Text('Tải lại', style: TextStyle(color: Colors.white)),
                            ),
                          ],
                        ),
                      )
                    : _supplies.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: AppTheme.green.withOpacity(0.1),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.inventory_2_outlined, size: 54, color: AppTheme.green),
                                  ),
                                  const SizedBox(height: 16),
                                  const Text(
                                    'Chưa có vật tư nào được khai báo',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.textMain),
                                  ),
                                  const SizedBox(height: 6),
                                  const Text(
                                    'Vật tư được quản lý riêng cho từng khách hàng/nông hộ. Hãy khai báo loại phân bón, tiền nước hoặc thuốc BVTV đầu tiên!',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(color: AppTheme.textMuted, fontSize: 12, height: 1.4),
                                  ),
                                  const SizedBox(height: 20),
                                  ElevatedButton.icon(
                                    onPressed: () => _openSupplyDialog(),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppTheme.green,
                                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    ),
                                    icon: const Icon(Icons.add_rounded, color: Colors.white),
                                    label: const Text('Khai báo vật tư mới ngay', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _loadSupplies,
                            color: AppTheme.green,
                            child: ListView.builder(
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
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

  Widget _buildAnalyticsTab() {
    if (_isAnalyticsLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: AppTheme.green),
            SizedBox(height: 12),
            Text('Đang nạp báo cáo giám sát chi phí...', style: TextStyle(fontSize: 13, color: AppTheme.textMuted)),
          ],
        ),
      );
    }

    final totalSpent = _analyticsData?['summary']?['total_expenditure'] ?? 0.0;
    final categories = _analyticsData?['summary']?['categories'] as Map<String, dynamic>? ?? {};

    final formattedTotal = _currencyFormat.format(totalSpent);

    return RefreshIndicator(
      onRefresh: _loadAnalyticsAndUsages,
      color: AppTheme.green,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Total Expenditure Card (Gradient Header)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.green, AppTheme.greenDark],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.green.withOpacity(0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'TỔNG CHI PHÍ ĐÃ TIÊU HAO',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Colors.white70,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    formattedTotal,
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Dựa trên tất cả các lượt ghi chép tiêu hao vật tư của các thửa ruộng',
                    style: TextStyle(fontSize: 11, color: Colors.white60),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Cost by category title
            const Text(
              'Chi phí theo hạng mục',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textMain),
            ),
            const SizedBox(height: 10),

            // Grid of Categories Cost
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.5,
              children: [
                _buildCategoryCostCard('Bón phân', categories['Bón phân'] ?? 0.0, Icons.science_rounded, Colors.green),
                _buildCategoryCostCard('Tiền nước', categories['Tiền nước'] ?? 0.0, Icons.water_drop_rounded, Colors.blue),
                _buildCategoryCostCard('Phun thuốc', categories['Phun thuốc'] ?? 0.0, Icons.shield_rounded, Colors.orange.shade800),
                _buildCategoryCostCard('Nhân công', categories['Nhân công'] ?? 0.0, Icons.badge_rounded, Colors.purple),
              ],
            ),
            const SizedBox(height: 24),

            // Recent usages title
            const Text(
              'Nhật ký tiêu hao vật tư gần đây',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textMain),
            ),
            const SizedBox(height: 10),

            if (_usages.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: const Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.history_rounded, size: 40, color: Colors.grey),
                    SizedBox(height: 8),
                    Text(
                      'Chưa có lượt tiêu hao nào được ghi nhận',
                      style: TextStyle(fontSize: 13, color: AppTheme.textMuted, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Lịch sử tiêu hao sẽ xuất hiện khi bạn thêm nhật ký chăm sóc cây có sử dụng vật tư.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 11, color: AppTheme.textMuted),
                    ),
                  ],
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _usages.length,
                itemBuilder: (context, index) {
                  final usage = _usages[index];
                  return _buildUsageListItem(usage);
                },
              ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryCostCard(String title, dynamic cost, IconData icon, Color color) {
    final formattedCost = _currencyFormat.format(cost);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.shade100,
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: color),
              const SizedBox(width: 6),
              Text(
                title,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMain),
              ),
            ],
          ),
          Text(
            formattedCost,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUsageListItem(Map<String, dynamic> usage) {
    final cat = usage['category'] ?? '';
    IconData icon = Icons.inventory_2_rounded;
    Color color = AppTheme.green;
    if (cat == 'Bón phân') {
      icon = Icons.science_rounded;
      color = Colors.green;
    } else if (cat == 'Tiền nước') {
      icon = Icons.water_drop_rounded;
      color = Colors.blue;
    } else if (cat == 'Phun thuốc') {
      icon = Icons.shield_rounded;
      color = Colors.orange.shade800;
    } else if (cat == 'Nhân công') {
      icon = Icons.badge_rounded;
      color = Colors.purple;
    }

    final dateStr = usage['usage_date']?.toString().substring(0, 10) ?? '';
    final formattedDate = dateStr.split('-').reversed.join('/');
    final qty = double.tryParse(usage['quantity']?.toString() ?? '0') ?? 0.0;
    final unit = usage['unit'] ?? '';
    final totalCost = double.tryParse(usage['total_cost']?.toString() ?? '0') ?? 0.0;

    final targetName = usage['tree_code'] != null
        ? 'Cây ${usage['tree_code']}'
        : (usage['farm_name'] ?? 'Cây trồng');

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade100),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        title: Text(
          usage['supply_name'] ?? 'Vật tư',
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textMain),
        ),
        subtitle: Text(
          '$formattedDate • $targetName\nĐã dùng: $qty $unit',
          style: const TextStyle(fontSize: 11, color: AppTheme.textMuted, height: 1.3),
        ),
        isThreeLine: true,
        trailing: Text(
          _currencyFormat.format(totalCost),
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Row(
            children: [
              Icon(Icons.inventory_2_rounded, color: AppTheme.green),
              SizedBox(width: 8),
              Text('Quản lý & Giám sát Vật tư', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          bottom: const TabBar(
            labelColor: AppTheme.green,
            unselectedLabelColor: AppTheme.textMuted,
            indicatorColor: AppTheme.green,
            labelStyle: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            tabs: [
              Tab(text: 'Quản lý vật tư'),
              Tab(text: 'Giám sát & Chi phí'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _buildManagementTab(),
            _buildAnalyticsTab(),
          ],
        ),
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
      elevation: 1.5,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Product Thumbnail Image
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
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
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: _getCategoryColor(sp.category).withValues(alpha: 0.12),
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
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(icon, color: color, size: 24),
    );
  }

  Color _getCategoryColor(String cat) {
    if (cat == 'Bón phân') return AppTheme.green;
    if (cat == 'Tiền nước') return Colors.blue;
    if (cat == 'Phun thuốc') return Colors.orange.shade800;
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
  String? _imageUrl;
  bool _isUploadingImage = false;

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
    _imageUrl = sp?.imageUrl;

    _recalculateUnits();
  }

  Future<void> _pickAndUploadImage() async {
    try {
      final picker = ImagePicker();
      final image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
      if (image == null) return;

      setState(() {
        _isUploadingImage = true;
      });

      final bytes = await image.readAsBytes();
      final filename = image.name;

      final url = await _apiService.uploadSupplyImage(bytes, filename);

      setState(() {
        _imageUrl = url;
        _isUploadingImage = false;
      });

      if (url == null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tải ảnh bao bì lên thất bại. Vui lòng thử lại.')),
        );
      }
    } catch (e) {
      setState(() {
        _isUploadingImage = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi tải ảnh: $e')),
        );
      }
    }
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
      'image_url': _imageUrl,
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

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      clipBehavior: Clip.antiAlias,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header with AgTech Dark Emerald Gradient
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
                    widget.supply != null ? Icons.edit_note_rounded : Icons.add_box_rounded,
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
                        widget.supply != null ? 'Chỉnh sửa vật tư' : 'Khai báo vật tư mới',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Tự động quy đổi đơn giá chi tiết',
                        style: TextStyle(color: Colors.white70, fontSize: 11),
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

          // Scrollable Form Body
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(18),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Hạng mục gốc
                    DropdownButtonFormField<String>(
                      value: _category,
                      decoration: InputDecoration(
                        labelText: 'Hạng mục gốc *',
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        fillColor: const Color(0xFFF8FAFC),
                        filled: true,
                      ),
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
                    const SizedBox(height: 14),

                    // Tên vật tư
                    TextFormField(
                      controller: _nameController,
                      decoration: InputDecoration(
                        labelText: 'Tên vật tư / Dịch vụ *',
                        hintText: 'Ví dụ: Phân NPK Đầu Trâu 20-20-15+TE',
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        fillColor: const Color(0xFFF8FAFC),
                        filled: true,
                      ),
                      validator: (val) => val == null || val.trim().isEmpty ? 'Vui lòng nhập tên vật tư' : null,
                    ),
                    const SizedBox(height: 14),

                    // Photo Upload Card (only for Bón phân / Phun thuốc)
                    if (_category == 'Bón phân' || _category == 'Phun thuốc') ...[
                      const Text(
                        'Hình ảnh bao bì / sản phẩm',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted),
                      ),
                      const SizedBox(height: 6),
                      InkWell(
                        onTap: _isUploadingImage ? null : _pickAndUploadImage,
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          height: 120,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            border: Border.all(color: AppTheme.grayBorder, style: BorderStyle.solid, width: 1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: _isUploadingImage
                              ? const Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      CircularProgressIndicator(strokeWidth: 2, color: AppTheme.green),
                                      SizedBox(height: 8),
                                      Text('Đang tải ảnh lên...', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                                    ],
                                  ),
                                )
                              : _imageUrl != null
                                  ? Stack(
                                      children: [
                                        ClipRRect(
                                          borderRadius: BorderRadius.circular(12),
                                          child: Image.network(
                                            _imageUrl!,
                                            width: double.infinity,
                                            height: double.infinity,
                                            fit: BoxFit.cover,
                                          ),
                                        ),
                                        Positioned(
                                          top: 8,
                                          right: 8,
                                          child: CircleAvatar(
                                            radius: 16,
                                            backgroundColor: Colors.black.withOpacity(0.6),
                                            child: IconButton(
                                              padding: EdgeInsets.zero,
                                              icon: const Icon(Icons.delete_forever_rounded, color: Colors.white, size: 18),
                                              onPressed: () {
                                                setState(() {
                                                  _imageUrl = null;
                                                });
                                              },
                                            ),
                                          ),
                                        ),
                                      ],
                                    )
                                  : Center(
                                      child: Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(Icons.add_photo_alternate_rounded, size: 36, color: Colors.grey.shade400),
                                          const SizedBox(height: 4),
                                          const Text(
                                            'Bấm để tải lên ảnh bao bì vật tư',
                                            style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                          ),
                                          const Text(
                                            'Hỗ trợ định dạng JPG, PNG, WEBP',
                                            style: TextStyle(fontSize: 10, color: AppTheme.textMuted),
                                          ),
                                        ],
                                      ),
                                    ),
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    // Khối lượng & Đơn vị
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: TextFormField(
                            controller: _packageQtyController,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: InputDecoration(
                              labelText: 'Khối lượng gói *',
                              hintText: 'VD: 50',
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              fillColor: const Color(0xFFF8FAFC),
                              filled: true,
                            ),
                            onChanged: (_) => _recalculateUnits(),
                            validator: (val) => val == null || double.tryParse(val) == null ? 'Lỗi số' : null,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 2,
                          child: DropdownButtonFormField<String>(
                            value: _packageUnit,
                            decoration: InputDecoration(
                              labelText: 'Đơn vị gói *',
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              fillColor: const Color(0xFFF8FAFC),
                              filled: true,
                            ),
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
                    const SizedBox(height: 14),

                    // Tổng giá mua
                    TextFormField(
                      controller: _packagePriceController,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'Tổng giá mua 1 gói (VNĐ) *',
                        hintText: 'VD: 1530000',
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        fillColor: const Color(0xFFF8FAFC),
                        filled: true,
                      ),
                      onChanged: (_) => _recalculateUnits(),
                      validator: (val) => val == null || double.tryParse(val) == null ? 'Vui lòng nhập số tiền' : null,
                    ),
                    const SizedBox(height: 16),

                    // Breakdown Calculator Box (Design Upgrade)
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFF0FDF4), Color(0xFFDCFCE7)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        border: Border.all(color: const Color(0xFF86EFAC)),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.calculate_rounded, size: 16, color: AppTheme.greenDark),
                              SizedBox(width: 6),
                              Text(
                                'BẢNG TỰ ĐỘNG QUY ĐỔI ĐƠN GIÁ CHI TIẾT',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.greenDark, letterSpacing: 0.3),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: const Color(0xFFBBF7D0)),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('Đơn giá chuẩn / $_unitLarge', style: const TextStyle(fontSize: 10, color: AppTheme.textMuted, fontWeight: FontWeight.w600)),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${currencyFormat.format(_priceLarge)} / $_unitLarge',
                                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.greenDark, fontSize: 12),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: const Color(0xFFBFDBFE)),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('Đơn giá chi tiết / $_unitSmall', style: const TextStyle(fontSize: 10, color: AppTheme.textMuted, fontWeight: FontWeight.w600)),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${currencyFormat.format(_priceSmall)} / $_unitSmall',
                                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue, fontSize: 12),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Ghi chú thêm
                    TextFormField(
                      controller: _noteController,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: 'Ghi chú / Thông tin thêm',
                        hintText: 'Ví dụ: Đơn giá 5.000đ/m3 nước; Phân bón đợt 1...',
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        fillColor: const Color(0xFFF8FAFC),
                        filled: true,
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
                  onPressed: _isSaving ? null : _save,
                  icon: _isSaving
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.lock_rounded, size: 16, color: Colors.white),
                  label: const Text('Lưu vật tư', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
