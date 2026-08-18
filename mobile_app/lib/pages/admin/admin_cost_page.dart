import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/theme.dart';
import '../../components/loading_indicator.dart';

class AdminCostPage extends StatefulWidget {
  const AdminCostPage({super.key});

  @override
  State<AdminCostPage> createState() => _AdminCostPageState();
}

class _AdminCostPageState extends State<AdminCostPage> with SingleTickerProviderStateMixin {
  final ApiService _apiService = ApiService();
  late TabController _tabController;
  bool _isLoading = true;

  List<Map<String, dynamic>> _consumables = [];
  List<Map<String, dynamic>> _fixedAssets = [];

  double _totalConsumable = 0;
  double _totalFixed = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadCostData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadCostData() async {
    setState(() => _isLoading = true);
    try {
      final cons = await _apiService.fetchCostConsumables();
      final fixed = await _apiService.fetchCostFixed();

      double sumCons = 0;
      for (final c in cons) {
        sumCons += (double.tryParse(c['total']?.toString() ?? c['total_cost']?.toString() ?? '0') ?? 0);
      }

      double sumFixed = 0;
      for (final f in fixed) {
        sumFixed += (double.tryParse(f['cost']?.toString() ?? '0') ?? 0);
      }

      setState(() {
        _consumables = cons;
        _fixedAssets = fixed;
        _totalConsumable = sumCons;
        _totalFixed = sumFixed;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  String _formatCurrency(double val) {
    return '${val.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]}.')} ₫';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Quản trị Chi phí Đầu tư', style: TextStyle(fontSize: 16)),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(text: '📦 Vật tư tiêu hao'),
            Tab(text: '🏗️ Tài sản cố định'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadCostData,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang tải dữ liệu chi phí...')
          : Column(
              children: [
                // KPI Header Card
                Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppTheme.grayBorder),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 4)),
                    ],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('📦 Vật tư', style: TextStyle(fontSize: 10, color: AppTheme.textMuted, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 2),
                            Text(_formatCurrency(_totalConsumable), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.emerald)),
                          ],
                        ),
                      ),
                      Container(width: 1, height: 30, color: AppTheme.grayBorder),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(left: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('🏗️ Tài sản', style: TextStyle(fontSize: 10, color: AppTheme.textMuted, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 2),
                              Text(_formatCurrency(_totalFixed), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.blue)),
                            ],
                          ),
                        ),
                      ),
                      Container(width: 1, height: 30, color: AppTheme.grayBorder),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(left: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('💰 Tổng chi', style: TextStyle(fontSize: 10, color: AppTheme.textMuted, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 2),
                              Text(_formatCurrency(_totalConsumable + _totalFixed), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.amber)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Tab View List
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildConsumablesList(),
                      _buildFixedAssetsList(),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildConsumablesList() {
    if (_consumables.isEmpty) {
      return const Center(child: Text('Chưa có dữ liệu vật tư tiêu hao thực tế.'));
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _consumables.length,
      itemBuilder: (context, index) {
        final c = _consumables[index];
        final name = c['name'] ?? c['supply_name'] ?? '—';
        final cat = c['category'] ?? 'Vật tư';
        final total = double.tryParse(c['total']?.toString() ?? c['total_cost']?.toString() ?? '0') ?? 0;
        final farm = c['farm_name'] ?? '—';

        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: AppTheme.grayBorder)),
          child: ListTile(
            leading: const CircleAvatar(backgroundColor: Colors.emerald, child: Icon(Icons.inventory_2_rounded, color: Colors.white, size: 20)),
            title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            subtitle: Text('Loại: $cat | Trang trại: $farm', style: const TextStyle(fontSize: 11)),
            trailing: Text(_formatCurrency(total), style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.emerald, fontSize: 13)),
          ),
        );
      },
    );
  }

  Widget _buildFixedAssetsList() {
    if (_fixedAssets.isEmpty) {
      return const Center(child: Text('Chưa có dữ liệu tài sản cố định thực tế.'));
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _fixedAssets.length,
      itemBuilder: (context, index) {
        final a = _fixedAssets[index];
        final name = a['name'] ?? '—';
        final cat = a['category'] ?? 'Tài sản';
        final cost = double.tryParse(a['cost']?.toString() ?? '0') ?? 0;
        final rem = double.tryParse(a['remaining']?.toString() ?? '0') ?? 0;
        final farm = a['farm_name'] ?? '—';

        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: AppTheme.grayBorder)),
          child: ListTile(
            leading: const CircleAvatar(backgroundColor: Colors.blue, child: Icon(Icons.precision_manufacturing_rounded, color: Colors.white, size: 20)),
            title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            subtitle: Text('Loại: $cat | Còn lại: ${_formatCurrency(rem)}\nTrang trại: $farm', style: const TextStyle(fontSize: 11)),
            trailing: Text(_formatCurrency(cost), style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue, fontSize: 13)),
          ),
        );
      },
    );
  }
}
