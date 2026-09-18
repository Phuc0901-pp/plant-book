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

  // Pagination parameters (10 items per page)
  static const int _itemsPerPage = 10;
  int _consumablesPage = 0;
  int _fixedAssetsPage = 0;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadCostData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
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
        _consumablesPage = 0;
        _fixedAssetsPage = 0;
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
        title: const Text('Quản trị Chi phí Đầu tư & Vật tư', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF86EFAC),
          tabs: const [
            Tab(text: '📦 Vật tư tiêu hao'),
            Tab(text: '🏗️ Tài sản cố định'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Làm mới',
            onPressed: _loadCostData,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang tải dữ liệu chi phí & vật tư...')
          : Column(
              children: [
                // KPI Header Card - Fluent UI
                Container(
                  margin: const EdgeInsets.all(14),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10, offset: const Offset(0, 3)),
                    ],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('📦 Vật tư tiêu hao', style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                            const SizedBox(height: 2),
                            Text(_formatCurrency(_totalConsumable), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF059669))),
                          ],
                        ),
                      ),
                      Container(width: 1, height: 32, color: const Color(0xFFE2E8F0)),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(left: 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('🏗️ Tài sản cố định', style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                              const SizedBox(height: 2),
                              Text(_formatCurrency(_totalFixed), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0284C7))),
                            ],
                          ),
                        ),
                      ),
                      Container(width: 1, height: 32, color: const Color(0xFFE2E8F0)),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(left: 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('💰 Tổng chi', style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                              const SizedBox(height: 2),
                              Text(_formatCurrency(_totalConsumable + _totalFixed), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFFD97706))),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Search Box
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Tìm kiếm vật tư, tài sản hoặc trang trại...',
                      prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF64748B)),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear_rounded, size: 18),
                              onPressed: () {
                                setState(() {
                                  _searchController.clear();
                                  _searchQuery = '';
                                  _consumablesPage = 0;
                                  _fixedAssetsPage = 0;
                                });
                              },
                            )
                          : null,
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      fillColor: Colors.white,
                      filled: true,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                    ),
                    onChanged: (val) {
                      setState(() {
                        _searchQuery = val.trim().toLowerCase();
                        _consumablesPage = 0;
                        _fixedAssetsPage = 0;
                      });
                    },
                  ),
                ),
                const SizedBox(height: 10),

                // Tab View List with 10 Items per Page
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildPaginatedConsumablesList(),
                      _buildPaginatedFixedAssetsList(),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildPaginatedConsumablesList() {
    final filtered = _consumables.where((c) {
      if (_searchQuery.isEmpty) return true;
      final name = (c['name'] ?? c['supply_name'] ?? '').toString().toLowerCase();
      final cat = (c['category'] ?? '').toString().toLowerCase();
      final farm = (c['farm_name'] ?? '').toString().toLowerCase();
      return name.contains(_searchQuery) || cat.contains(_searchQuery) || farm.contains(_searchQuery);
    }).toList();

    if (filtered.isEmpty) {
      return const Center(
        child: Text('Không tìm thấy dữ liệu vật tư phù hợp.', style: TextStyle(color: Color(0xFF64748B))),
      );
    }

    final totalItems = filtered.length;
    final totalPages = (totalItems / _itemsPerPage).ceil();
    final currentPage = _consumablesPage.clamp(0, totalPages - 1);
    final startIndex = currentPage * _itemsPerPage;
    final endIndex = (startIndex + _itemsPerPage).clamp(0, totalItems);
    final pageItems = filtered.sublist(startIndex, endIndex);

    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            itemCount: pageItems.length,
            itemBuilder: (context, index) {
              final c = pageItems[index];
              final name = c['name'] ?? c['supply_name'] ?? '—';
              final cat = c['category'] ?? 'Vật tư';
              final total = double.tryParse(c['total']?.toString() ?? c['total_cost']?.toString() ?? '0') ?? 0;
              final farm = c['farm_name'] ?? '—';

              return Card(
                elevation: 0,
                color: Colors.white,
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                child: ListTile(
                  dense: true,
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.inventory_2_rounded, color: Color(0xFF059669), size: 20),
                  ),
                  title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF0F172A))),
                  subtitle: Text('Loại: $cat | Trang trại: $farm', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  trailing: Text(
                    _formatCurrency(total),
                    style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF059669), fontSize: 13.5),
                  ),
                ),
              );
            },
          ),
        ),

        // Pagination Controls Bar (10 items / page)
        _buildPaginationBar(
          currentPage: currentPage,
          totalPages: totalPages,
          totalItems: totalItems,
          startIndex: startIndex,
          endIndex: endIndex,
          onPrev: currentPage > 0
              ? () => setState(() => _consumablesPage = currentPage - 1)
              : null,
          onNext: currentPage < totalPages - 1
              ? () => setState(() => _consumablesPage = currentPage + 1)
              : null,
        ),
      ],
    );
  }

  Widget _buildPaginatedFixedAssetsList() {
    final filtered = _fixedAssets.where((a) {
      if (_searchQuery.isEmpty) return true;
      final name = (a['name'] ?? '').toString().toLowerCase();
      final cat = (a['category'] ?? '').toString().toLowerCase();
      final farm = (a['farm_name'] ?? '').toString().toLowerCase();
      return name.contains(_searchQuery) || cat.contains(_searchQuery) || farm.contains(_searchQuery);
    }).toList();

    if (filtered.isEmpty) {
      return const Center(
        child: Text('Không tìm thấy dữ liệu tài sản cố định phù hợp.', style: TextStyle(color: Color(0xFF64748B))),
      );
    }

    final totalItems = filtered.length;
    final totalPages = (totalItems / _itemsPerPage).ceil();
    final currentPage = _fixedAssetsPage.clamp(0, totalPages - 1);
    final startIndex = currentPage * _itemsPerPage;
    final endIndex = (startIndex + _itemsPerPage).clamp(0, totalItems);
    final pageItems = filtered.sublist(startIndex, endIndex);

    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            itemCount: pageItems.length,
            itemBuilder: (context, index) {
              final a = pageItems[index];
              final name = a['name'] ?? '—';
              final cat = a['category'] ?? 'Tài sản';
              final cost = double.tryParse(a['cost']?.toString() ?? '0') ?? 0;
              final rem = double.tryParse(a['remaining']?.toString() ?? '0') ?? 0;
              final farm = a['farm_name'] ?? '—';

              return Card(
                elevation: 0,
                color: Colors.white,
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                child: ListTile(
                  dense: true,
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.precision_manufacturing_rounded, color: Color(0xFF0284C7), size: 20),
                  ),
                  title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF0F172A))),
                  subtitle: Text('Loại: $cat | Còn lại: ${_formatCurrency(rem)}\nTrang trại: $farm', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  trailing: Text(
                    _formatCurrency(cost),
                    style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0284C7), fontSize: 13.5),
                  ),
                ),
              );
            },
          ),
        ),

        // Pagination Controls Bar (10 items / page)
        _buildPaginationBar(
          currentPage: currentPage,
          totalPages: totalPages,
          totalItems: totalItems,
          startIndex: startIndex,
          endIndex: endIndex,
          onPrev: currentPage > 0
              ? () => setState(() => _fixedAssetsPage = currentPage - 1)
              : null,
          onNext: currentPage < totalPages - 1
              ? () => setState(() => _fixedAssetsPage = currentPage + 1)
              : null,
        ),
      ],
    );
  }

  Widget _buildPaginationBar({
    required int currentPage,
    required int totalPages,
    required int totalItems,
    required int startIndex,
    required int endIndex,
    required VoidCallback? onPrev,
    required VoidCallback? onNext,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Previous button
          OutlinedButton.icon(
            onPressed: onPrev,
            icon: const Icon(Icons.chevron_left_rounded, size: 18),
            label: const Text('Trước', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              side: BorderSide(color: onPrev != null ? const Color(0xFFCBD5E1) : Colors.grey.shade300),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),

          // Page indicator
          Column(
            children: [
              Text(
                'Trang ${currentPage + 1} / $totalPages',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 2),
              Text(
                'Hiển thị ${startIndex + 1} - $endIndex (Tổng $totalItems)',
                style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
              ),
            ],
          ),

          // Next button
          OutlinedButton.icon(
            onPressed: onNext,
            icon: const Icon(Icons.chevron_right_rounded, size: 18),
            label: const Text('Sau', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              side: BorderSide(color: onNext != null ? const Color(0xFFCBD5E1) : Colors.grey.shade300),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
        ],
      ),
    );
  }
}
