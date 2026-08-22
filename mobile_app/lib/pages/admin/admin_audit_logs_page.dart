import 'package:flutter/material.dart';
import '../../utils/theme.dart';

class AdminAuditLogsPage extends StatefulWidget {
  const AdminAuditLogsPage({super.key});

  @override
  State<AdminAuditLogsPage> createState() => _AdminAuditLogsPageState();
}

class _AdminAuditLogsPageState extends State<AdminAuditLogsPage> {
  final List<Map<String, dynamic>> _mockLogs = [
    {
      'title': '🔐 Đăng nhập tài khoản Nông hộ',
      'detail': 'Người dùng phamhoangphuc đăng nhập thành công từ IP 113.161.xx.xx',
      'time': '13:42',
      'type': 'security'
    },
    {
      'title': '📡 Cập nhật Cảm biến IoT 3 tầng đất',
      'detail': 'Trang trại Nông hộ A đồng bộ chỉ số độ ẩm (48%), UV (6.5), Nhiệt độ (28°C)',
      'time': '13:30',
      'type': 'iot'
    },
    {
      'title': '🌱 Thêm mới Cây trồng Lô A1',
      'detail': 'Nông hộ thêm cây Sầu riêng Ri6 (Mã SR-008) với tọa độ GPS thực tế',
      'time': '12:15',
      'type': 'farm'
    },
    {
      'title': '📷 Quét bao bì Vật tư AI',
      'detail': 'Nhận diện thành công Phân bón NPK 16-16-8 qua Canvas AI Compressor 150KB',
      'time': '11:05',
      'type': 'ai'
    },
    {
      'title': '⚡ Redis Cache Eviction',
      'detail': 'Làm sạch bộ nhớ đệm Cache tự động khi có thay đổi dữ liệu trang trại',
      'time': '09:20',
      'type': 'system'
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Nhật ký An ninh & Lịch sử Hệ thống', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _mockLogs.length,
        itemBuilder: (context, idx) {
          final log = _mockLogs[idx];
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
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(log['title'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A))),
                    ),
                    Text(log['time'] as String, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted, fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(log['detail'] as String, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569), height: 1.4)),
              ],
            ),
          );
        },
      ),
    );
  }
}
