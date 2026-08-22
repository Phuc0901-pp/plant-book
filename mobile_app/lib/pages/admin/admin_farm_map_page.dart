import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/farm.dart';
import '../../utils/theme.dart';
import '../../components/loading_indicator.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Bản đồ GIS Trang trại Toàn quốc', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadFarms,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang tải bản đồ ranh giới GIS...')
          : Column(
              children: [
                // GIS Map Viewer Banner
                Container(
                  width: double.infinity,
                  height: 220,
                  decoration: const BoxDecoration(
                    color: Color(0xFF1E293B),
                    image: DecorationImage(
                      image: NetworkImage('https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/106.9,11.8,11,0/600x300?access_token=pk.mock'),
                      fit: BoxFit.cover,
                    ),
                  ),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    color: Colors.black.withOpacity(0.4),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: const [
                            Icon(Icons.map_rounded, color: AppTheme.green, size: 24),
                            SizedBox(width: 8),
                            Text('Hệ thống GIS Giám sát Nông nghiệp', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text('Đang theo dõi ${_farms.length} trang trại nông hộ trên bản đồ vệ tinh toàn quốc.', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _farms.length,
                    itemBuilder: (context, idx) {
                      final farm = _farms[idx];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.grey.shade200),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 3))
                          ],
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(color: AppTheme.green.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                              child: const Icon(Icons.location_on_rounded, color: AppTheme.green, size: 24),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(farm.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A))),
                                  const SizedBox(height: 4),
                                  Text(farm.description ?? 'Trang trại chuẩn VietGAP', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      const Icon(Icons.square_foot_rounded, size: 14, color: AppTheme.green),
                                      const SizedBox(width: 4),
                                      Text('${farm.area?.round() ?? 0} m²', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87)),
                                      const SizedBox(width: 14),
                                      const Icon(Icons.eco_rounded, size: 14, color: AppTheme.green),
                                      const SizedBox(width: 4),
                                      Text('${farm.plantCount ?? 0} cây', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87)),
                                    ],
                                  ),
                                ],
                              ),
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
