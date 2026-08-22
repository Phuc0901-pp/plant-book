import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class UserLogsPage extends StatefulWidget {
  const UserLogsPage({super.key});

  @override
  State<UserLogsPage> createState() => _UserLogsPageState();
}

class _UserLogsPageState extends State<UserLogsPage> {
  final List<Map<String, String>> _logs = [
    {'title': '💧 Tưới nước nhỏ giọt công nghệ Israel', 'date': 'Hôm nay, 14:15', 'type': 'Tưới nước', 'farm': 'Trang trại Lô A1'},
    {'title': '🌿 Bón phân NPK 16-16-8 bổ sung dinh dưỡng', 'date': 'Hôm qua, 09:30', 'type': 'Bón phân', 'farm': 'Trang trại Lô A1'},
    {'title': '✂️ Cắt tỉa cành che sáng & chồi dại', 'date': '20/08/2026', 'type': 'Cắt tỉa', 'farm': 'Trang trại Lô A2'},
    {'title': '🌾 Thu hoạch Sầu riêng Ri6 đợt 1', 'date': '18/08/2026', 'type': 'Thu hoạch', 'farm': 'Trang trại Lô A1'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Nhật ký Canh tác Timeline', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _logs.length,
        itemBuilder: (context, idx) {
          final item = _logs[idx];
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.grayBorder),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: AppTheme.greenLight, borderRadius: BorderRadius.circular(10)),
                  child: const Icon(Icons.history_edu_rounded, color: AppTheme.green, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item['title']!, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A))),
                      const SizedBox(height: 4),
                      Text('${item["farm"]} · ${item["date"]}', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
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
