import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/farm.dart';
import '../../utils/theme.dart';
import '../../components/loading_indicator.dart';
import '../../components/admin_drawer.dart';
import '../farm_detail_page.dart';

class AdminGisPage extends StatefulWidget {
  const AdminGisPage({super.key});

  @override
  State<AdminGisPage> createState() => _AdminGisPageState();
}

class _AdminGisPageState extends State<AdminGisPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  List<Farm> _farms = [];
  String _selectedLayer = 'polygon'; // 'polygon', 'contour', 'satellite'

  @override
  void initState() {
    super.initState();
    _loadGisFarms();
  }

  Future<void> _loadGisFarms() async {
    setState(() => _isLoading = true);
    try {
      final list = await _apiService.fetchFarms();
      setState(() {
        _farms = list;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  double get _totalAreaHa {
    double totalM2 = 0;
    for (final f in _farms) {
      totalM2 += (f.area ?? 0);
    }
    // If area in DB is m2, convert to ha, or if already ha, format nicely
    return totalM2 > 1000 ? totalM2 / 10000 : totalM2;
  }

  String _formatArea(double? area) {
    if (area == null || area == 0) return '0 ha';
    if (area >= 10000) {
      return '${(area / 10000).toStringAsFixed(2)} ha';
    } else if (area >= 1000) {
      return '${(area / 10000).toStringAsFixed(3)} ha';
    }
    return '${area.toStringAsFixed(0)} m²';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: const AdminDrawer(activeRoute: 'gis'),
      appBar: AppBar(
        backgroundColor: const Color(0xFF064E3B),
        title: const Text('Bản Đồ GIS & Vùng Trồng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Làm mới dữ liệu',
            onPressed: _loadGisFarms,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang kết nối vệ tinh Mapbox GIS...')
          : Column(
              children: [
                // Top Enterprise GIS Dashboard Banner
                Container(
                  width: double.infinity,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFF0F172A),
                        Color(0xFF1E293B),
                        Color(0xFF064E3B),
                      ],
                    ),
                  ),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header Row with zero overflow
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                            ),
                            child: const Icon(Icons.layers_outlined, color: Color(0xFF34D399), size: 18),
                          ),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Text(
                              'GIÁM SÁT RANH GIỚI VÙNG TRỒNG (GIS)',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                letterSpacing: 0.6,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Metric Summary Row
                      Row(
                        children: [
                          _buildMetricPill(
                            label: 'TỔNG VÙNG TRỒNG',
                            value: '${_farms.length}',
                            icon: Icons.home_work_outlined,
                          ),
                          const SizedBox(width: 8),
                          _buildMetricPill(
                            label: 'QUY MÔ ƯỚC TÍNH',
                            value: _totalAreaHa >= 1 ? '${_totalAreaHa.toStringAsFixed(1)} ha' : '${_totalAreaHa.toStringAsFixed(2)} ha',
                            icon: Icons.aspect_ratio_rounded,
                          ),
                          const SizedBox(width: 8),
                          _buildMetricPill(
                            label: 'VỆ TINH GPS',
                            value: 'Chuẩn 3D',
                            icon: Icons.satellite_alt_rounded,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Layer Filter Chips
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            _buildLayerChip('polygon', '📐 Ranh giới Đa giác', Icons.polyline_rounded),
                            const SizedBox(width: 8),
                            _buildLayerChip('contour', '⛰️ Bình độ 1m DEM', Icons.terrain_rounded),
                            const SizedBox(width: 8),
                            _buildLayerChip('satellite', '🛰️ Ảnh Vệ tinh Toàn cảnh', Icons.satellite_rounded),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // Section Title Bar
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  color: const Color(0xFFF1F5F9),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'DANH SÁCH TRANG TRẠI (${_farms.length})',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF475569),
                          letterSpacing: 0.5,
                        ),
                      ),
                      const Text(
                        'Mã số PUC & VietGAP',
                        style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),

                // Farms ERP List
                Expanded(
                  child: _farms.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: const [
                              Icon(Icons.map_outlined, size: 48, color: Color(0xFF94A3B8)),
                              SizedBox(height: 8),
                              Text('Chưa có dữ liệu trang trại GIS', style: TextStyle(color: Color(0xFF64748B))),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _farms.length,
                          itemBuilder: (context, idx) {
                            final f = _farms[idx];
                            final hasPuc = f.description?.contains('PUC') == true;

                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.03),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(14),
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => FarmDetailPage(farm: f),
                                    ),
                                  );
                                },
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Top row: Name & Area Pill
                                      Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.all(8),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFECFDF5),
                                              borderRadius: BorderRadius.circular(10),
                                              border: Border.all(color: const Color(0xFFA7F3D0)),
                                            ),
                                            child: const Icon(Icons.location_on_rounded, color: Color(0xFF059669), size: 20),
                                          ),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  f.name,
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 15,
                                                    color: Color(0xFF0F172A),
                                                  ),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  f.description ?? 'Trang trại Nông nghiệp số',
                                                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFF1F5F9),
                                              borderRadius: BorderRadius.circular(8),
                                              border: Border.all(color: const Color(0xFFCBD5E1)),
                                            ),
                                            child: Text(
                                              _formatArea(f.area),
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                                fontSize: 12,
                                                color: Color(0xFF0F172A),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),

                                      const SizedBox(height: 10),
                                      const Divider(height: 1, color: Color(0xFFF1F5F9)),
                                      const SizedBox(height: 10),

                                      // Bottom Info & Quick action pills
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          // Status badge
                                          Row(
                                            children: [
                                              Container(
                                                width: 8,
                                                height: 8,
                                                decoration: const BoxDecoration(
                                                  color: Color(0xFF10B981),
                                                  shape: BoxShape.circle,
                                                ),
                                              ),
                                              const SizedBox(width: 6),
                                              Text(
                                                hasPuc ? 'Đã cấp Mã PUC' : 'Định vị GPS Chuẩn',
                                                style: const TextStyle(
                                                  fontSize: 11.5,
                                                  fontWeight: FontWeight.w600,
                                                  color: Color(0xFF059669),
                                                ),
                                              ),
                                            ],
                                          ),

                                          // Action button
                                          Row(
                                            children: const [
                                              Text(
                                                'Xem chi tiết',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF064E3B),
                                                ),
                                              ),
                                              SizedBox(width: 4),
                                              Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Color(0xFF064E3B)),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }

  Widget _buildMetricPill({required String label, required String value, required IconData icon}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.white.withOpacity(0.12)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 12, color: const Color(0xFF6EE7B7)),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(fontSize: 8.5, color: Colors.white60, fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              value,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLayerChip(String key, String title, IconData icon) {
    final isSelected = _selectedLayer == key;
    return InkWell(
      onTap: () => setState(() => _selectedLayer = key),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF10B981) : Colors.white.withOpacity(0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? const Color(0xFF34D399) : Colors.white24),
        ),
        child: Row(
          children: [
            Icon(icon, size: 13, color: isSelected ? Colors.white : Colors.white70),
            const SizedBox(width: 5),
            Text(
              title,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected ? Colors.white : Colors.white70,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
