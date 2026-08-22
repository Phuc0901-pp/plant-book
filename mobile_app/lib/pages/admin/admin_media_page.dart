import 'package:flutter/material.dart';
import '../../utils/theme.dart';
import '../../components/admin_drawer.dart';

class AdminMediaPage extends StatefulWidget {
  const AdminMediaPage({super.key});

  @override
  State<AdminMediaPage> createState() => _AdminMediaPageState();
}

class _AdminMediaPageState extends State<AdminMediaPage> {
  final List<Map<String, String>> _mediaItems = [
    {'title': 'Bao bì NPK 16-16-8 (Canvas AI 150KB)', 'type': 'Ảnh quét AI', 'url': 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19657?w=400'},
    {'title': 'Vườn Sầu Riêng Ri6 Lô A1', 'type': 'Hình ảnh', 'url': 'https://images.unsplash.com/photo-1595855759920-86582396756a?w=400'},
    {'title': 'Kiểm tra Cảm biến IoT 3 tầng', 'type': 'Hình ảnh', 'url': 'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=400'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: const AdminDrawer(activeRoute: 'media'),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Thư viện Media & Quét bao bì AI', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 0.85,
        ),
        itemCount: _mediaItems.length,
        itemBuilder: (context, idx) {
          final item = _mediaItems[idx];
          return Container(
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
                Expanded(
                  child: ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                    child: Image.network(
                      item['url']!,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(color: Colors.grey.shade200, child: const Icon(Icons.image_rounded, color: Colors.grey)),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item['title']!, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF0F172A)), maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: AppTheme.greenLight, borderRadius: BorderRadius.circular(6)),
                        child: Text(item['type']!, style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
