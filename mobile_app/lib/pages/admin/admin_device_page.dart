import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/theme.dart';
import '../../components/loading_indicator.dart';
import '../../components/admin_drawer.dart';

class AdminDevicePage extends StatefulWidget {
  const AdminDevicePage({super.key});

  @override
  State<AdminDevicePage> createState() => _AdminDevicePageState();
}

class _AdminDevicePageState extends State<AdminDevicePage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  List<dynamic> _devices = [];
  int _selectedDepth = 20; // 10, 20, 30 cm

  @override
  void initState() {
    super.initState();
    _loadDevices();
  }

  Future<void> _loadDevices() async {
    setState(() => _isLoading = true);
    try {
      final list = await _apiService.fetchDevices();
      setState(() {
        _devices = list;
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
      drawer: const AdminDrawer(activeRoute: 'devices'),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Cảm biến IoT 3 Tầng Đất & Khí hậu', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _loadDevices),
        ],
      ),
      body: Column(
        children: [
          // 3-Depth Soil Selector Chips (10cm, 20cm, 30cm)
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                const Text('Tầng đất chọn: ', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
                const SizedBox(width: 8),
                _depthChip(10, 'Tầng 10 cm'),
                const SizedBox(width: 6),
                _depthChip(20, 'Tầng 20 cm'),
                const SizedBox(width: 6),
                _depthChip(30, 'Tầng 30 cm'),
              ],
            ),
          ),

          Expanded(
            child: _isLoading
                ? const LoadingIndicator(message: 'Đang kết nối trạm Cảm biến IoT...')
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _devices.isEmpty ? 3 : _devices.length,
                    itemBuilder: (context, idx) {
                      final soilMoisture = _selectedDepth == 10 ? 65 : (_selectedDepth == 20 ? 48 : 58);
                      final soilTemp = _selectedDepth == 10 ? 29.5 : (_selectedDepth == 20 ? 27.2 : 25.8);

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: soilMoisture < 50 ? Colors.red.shade200 : Colors.grey.shade200),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 3))
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.sensors_rounded, color: Colors.orange, size: 22),
                                    const SizedBox(width: 8),
                                    Text('Trạm Cảm biến IoT #${idx + 1}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A))),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.green.shade200)),
                                  child: const Text('ONLINE ⚡ Pin 95%', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Colors.green)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),

                            // Soil & Air Telemetry Cards Grid
                            Row(
                              children: [
                                Expanded(child: _metricBox('Độ ẩm đất (${_selectedDepth}cm)', '$soilMoisture %', Icons.water_drop_rounded, soilMoisture < 50 ? Colors.red : Colors.blue)),
                                const SizedBox(width: 8),
                                Expanded(child: _metricBox('Nhiệt độ đất (${_selectedDepth}cm)', '$soilTemp °C', Icons.thermostat_rounded, Colors.orange)),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(child: _metricBox('Chỉ số UV', '6.5 (Vừa)', Icons.wb_sunny_rounded, Colors.amber)),
                                const SizedBox(width: 8),
                                Expanded(child: _metricBox('Bức xạ Mặt trời', '650 W/m²', Icons.solar_power_rounded, Colors.teal)),
                              ],
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

  Widget _depthChip(int depth, String label) {
    final bool active = _selectedDepth == depth;
    return GestureDetector(
      onTap: () => setState(() => _selectedDepth = depth),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: active ? AppTheme.greenDark : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(label, style: TextStyle(color: active ? Colors.white : Colors.grey.shade700, fontSize: 11.5, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _metricBox(String label, String val, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: color.withOpacity(0.06), borderRadius: BorderRadius.circular(10), border: Border.all(color: color.withOpacity(0.2))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 4),
              Expanded(child: Text(label, style: const TextStyle(fontSize: 10.5, color: AppTheme.textMuted, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis)),
            ],
          ),
          const SizedBox(height: 4),
          Text(val, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}
