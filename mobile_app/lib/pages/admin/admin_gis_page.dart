import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../models/farm.dart';
import '../../utils/theme.dart';
import '../../components/loading_indicator.dart';
import '../../components/admin_drawer.dart';

class AdminGisPage extends StatefulWidget {
  const AdminGisPage({super.key});

  @override
  State<AdminGisPage> createState() => _AdminGisPageState();
}

class _AdminGisPageState extends State<AdminGisPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  List<Farm> _farms = [];

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: const AdminDrawer(activeRoute: 'gis'),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Bản đồ GIS Trang trại Toàn quốc', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _loadGisFarms),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang kết nối vệ tinh Mapbox GIS...')
          : Column(
              children: [
                // Map Satellite Viewer Box
                Container(
                  height: 250,
                  width: double.infinity,
                  decoration: const BoxDecoration(
                    color: Color(0xFF0F172A),
                    image: DecorationImage(
                      image: NetworkImage('https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/106.9,11.8,10,0/600x300?access_token=pk.mock'),
                      fit: BoxFit.cover,
                    ),
                  ),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    color: Colors.black.withOpacity(0.35),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: const [
                            Icon(Icons.layers_rounded, color: AppTheme.green, size: 22),
                            SizedBox(width: 8),
                            Text('Lớp Đa Giác Ranh Giới (Polygon Boundaries)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text('Đang theo dõi ${_farms.length} trang trại với tọa độ GPS thực tế.', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                      ],
                    ),
                  ),
                ),

                // Farms List
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _farms.length,
                    itemBuilder: (context, idx) {
                      final f = _farms[idx];
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
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.location_on_rounded, color: AppTheme.green, size: 22),
                                const SizedBox(width: 8),
                                Expanded(child: Text(f.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A)))),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(color: AppTheme.greenLight, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppTheme.green.withOpacity(0.3))),
                                  child: Text('${f.area?.round() ?? 0} m²', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.greenDark)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(f.description ?? 'Trang trại nông nghiệp thông minh', style: const TextStyle(fontSize: 12.5, color: AppTheme.textMuted)),
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
