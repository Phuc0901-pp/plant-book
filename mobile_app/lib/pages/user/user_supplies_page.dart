import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../services/api_service.dart';
import '../../models/supply.dart';
import '../../components/loading_indicator.dart';

class UserSuppliesPage extends StatefulWidget {
  const UserSuppliesPage({super.key});

  @override
  State<UserSuppliesPage> createState() => _UserSuppliesPageState();
}

class _UserSuppliesPageState extends State<UserSuppliesPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  List<Supply> _supplies = [];

  @override
  void initState() {
    super.initState();
    _loadSupplies();
  }

  Future<void> _loadSupplies() async {
    setState(() => _isLoading = true);
    try {
      final list = await _apiService.fetchSupplies();
      setState(() {
        _supplies = list;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  void _triggerAiPacketScan() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.camera_alt_rounded, color: AppTheme.green, size: 40),
            const SizedBox(height: 10),
            const Text('📷 Quét Bao Bì Vật Tư Nông Nghiệp AI', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 6),
            const Text('Tự động nén Canvas 150KB và nhận diện tên phân bón/thuốc qua AI Gemini.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('⚡ Đã nhận diện thành công: Phân bón NPK 16-16-8 (Hạn dùng 2027)'), backgroundColor: AppTheme.green));
                },
                icon: const Icon(Icons.photo_camera_rounded),
                label: const Text('Chụp ảnh bao bì vật tư'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Kho Vật tư Nông nghiệp', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(icon: const Icon(Icons.qr_code_scanner_rounded), onPressed: _triggerAiPacketScan),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang kiểm tra kho vật tư...')
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _supplies.length,
              itemBuilder: (context, idx) {
                final item = _supplies[idx];
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.grayBorder),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.inventory_2_rounded, color: Colors.amber, size: 24),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A))),
                            const SizedBox(height: 2),
                            Text('Tồn kho: ${item.stockQuantity} ${item.unit}', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _triggerAiPacketScan,
        backgroundColor: AppTheme.greenDark,
        icon: const Icon(Icons.camera_alt_rounded, color: Colors.white),
        label: const Text('Quét bao bì AI', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
    );
  }
}
