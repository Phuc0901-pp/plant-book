import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/farm.dart';
import '../../utils/theme.dart';
import '../../components/loading_indicator.dart';
import '../farm_detail_page.dart';

class AdminFarmMapPage extends StatefulWidget {
  const AdminFarmMapPage({super.key});

  @override
  State<AdminFarmMapPage> createState() => _AdminFarmMapPageState();
}

class _AdminFarmMapPageState extends State<AdminFarmMapPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  List<Farm> _farms = [];

  @override
  void initState() {
    super.initState();
    _loadFarms();
  }

  Future<void> _loadFarms() async {
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
      appBar: AppBar(
        backgroundColor: const Color(0xFF064E3B),
        title: const Text('Bản đồ GIS Toàn quốc', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Làm mới',
            onPressed: _loadFarms,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang tải bản đồ ranh giới GIS...')
          : Column(
              children: [
                // Top GIS Dashboard Banner
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
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                            ),
                            child: const Icon(Icons.map_rounded, color: Color(0xFF34D399), size: 18),
                          ),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Text(
                              'HỆ THỐNG GIS GIÁM SÁT NÔNG NGHIỆP',
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
                      const SizedBox(height: 8),
                      Text(
                        'Đang theo dõi ${_farms.length} trang trại với toạ độ vệ tinh thực tế.',
                        style: const TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                    ],
                  ),
                ),

                // Farms List
                Expanded(
                  child: _farms.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: const [
                              Icon(Icons.home_work_outlined, size: 48, color: Color(0xFF94A3B8)),
                              SizedBox(height: 8),
                              Text('Chưa có trang trại nào', style: TextStyle(color: Color(0xFF64748B))),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _farms.length,
                          itemBuilder: (context, idx) {
                            final farm = _farms[idx];
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
                                    MaterialPageRoute(builder: (_) => FarmDetailPage(farm: farm)),
                                  );
                                },
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFECFDF5),
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(color: const Color(0xFFA7F3D0)),
                                        ),
                                        child: const Icon(Icons.location_on_rounded, color: Color(0xFF059669), size: 22),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              farm.name,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 15,
                                                color: Color(0xFF0F172A),
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 3),
                                            Text(
                                              farm.description ?? 'Trang trại chuẩn VietGAP',
                                              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 8),
                                            Wrap(
                                              spacing: 12,
                                              runSpacing: 4,
                                              children: [
                                                Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    const Icon(Icons.aspect_ratio_rounded, size: 14, color: Color(0xFF059669)),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      _formatArea(farm.area),
                                                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                                    ),
                                                  ],
                                                ),
                                                Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    const Icon(Icons.eco_rounded, size: 14, color: Color(0xFF059669)),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      '${farm.plantCount ?? 0} cây',
                                                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
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
}
