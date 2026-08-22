import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/plant.dart';
import '../../utils/theme.dart';
import '../../components/loading_indicator.dart';
import '../../components/admin_drawer.dart';

class AdminPlantPage extends StatefulWidget {
  const AdminPlantPage({super.key});

  @override
  State<AdminPlantPage> createState() => _AdminPlantPageState();
}

class _AdminPlantPageState extends State<AdminPlantPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  List<Plant> _plants = [];
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadPlants();
  }

  Future<void> _loadPlants() async {
    setState(() => _isLoading = true);
    try {
      final list = await _apiService.fetchPlants();
      setState(() {
        _plants = list;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  List<Plant> get _filteredPlants {
    if (_searchQuery.trim().isEmpty) return _plants;
    final q = _searchQuery.toLowerCase();
    return _plants.where((p) => p.plantType.toLowerCase().contains(q) || (p.treeCode?.toLowerCase().contains(q) ?? false)).toList();
  }

  void _showPlantDetailModal(Plant p) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => DefaultTabController(
        length: 4,
        child: Container(
          height: MediaQuery.of(context).size.height * 0.75,
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 12),
              Text(p.plantType, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF0F172A))),
              const SizedBox(height: 4),
              Text('Mã cây: ${p.treeCode ?? "SR-001"} · Giống: ${p.plantVariety ?? "Ri6"}', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
              const SizedBox(height: 12),
              const TabBar(
                labelColor: AppTheme.greenDark,
                unselectedLabelColor: Colors.grey,
                indicatorColor: AppTheme.green,
                tabs: [
                  Tab(text: 'Thông tin'),
                  Tab(text: 'Thuộc tính'),
                  Tab(text: 'Media'),
                  Tab(text: 'Nhật ký'),
                ],
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    // Tab 1: General
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _infoRow('Sức khỏe', p.healthStatus),
                          _infoRow('Tuổi cây', '${p.plantAge ?? "3 năm"}'),
                          _infoRow('Trang trại', p.farmName ?? '—'),
                          _infoRow('GPS', '${p.latitude ?? 11.83}, ${p.longitude ?? 106.91}'),
                        ],
                      ),
                    ),
                    // Tab 2: Extra Attributes
                    const Center(child: Text('Thuộc tính JSON động (NPK, EC, pH)', style: TextStyle(color: AppTheme.textMuted))),
                    // Tab 3: Media Gallery
                    const Center(child: Text('Thư viện Ảnh/Video canh tác', style: TextStyle(color: AppTheme.textMuted))),
                    // Tab 4: Farming Logs
                    const Center(child: Text('Lịch sử Tưới nước, Bón phân, Phun thuốc', style: TextStyle(color: AppTheme.textMuted))),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoRow(String label, String val) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppTheme.textMuted, fontSize: 13)),
          Text(val, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: const AdminDrawer(activeRoute: 'plants'),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Danh sách Cây trồng (Plants)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _loadPlants),
        ],
      ),
      body: Column(
        children: [
          // Search box
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(12),
            child: TextField(
              onChanged: (val) => setState(() => _searchQuery = val),
              decoration: InputDecoration(
                hintText: 'Tìm kiếm cây trồng theo tên hoặc mã...',
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
              ),
            ),
          ),
          Expanded(
            child: _isLoading
                ? const LoadingIndicator(message: 'Đang tải danh sách cây trồng...')
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _filteredPlants.length,
                    itemBuilder: (context, idx) {
                      final p = _filteredPlants[idx];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.grey.shade200),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 3))
                          ],
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(color: AppTheme.greenLight, borderRadius: BorderRadius.circular(12)),
                              child: const Icon(Icons.eco_rounded, color: AppTheme.green, size: 24),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(p.plantType, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A))),
                                  const SizedBox(height: 2),
                                  Text('Mã: ${p.treeCode ?? "SR-001"} · Tuổi: ${p.plantAge ?? "3 năm"}', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                ],
                              ),
                            ),
                            ElevatedButton(
                              onPressed: () => _showPlantDetailModal(p),
                              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.greenDark, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
                              child: const Text('Chi tiết 4 Tabs', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
