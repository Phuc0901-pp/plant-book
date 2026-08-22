import 'package:flutter/material.dart';
import '../../utils/theme.dart';
import '../../components/admin_drawer.dart';

class AdminSchemaPage extends StatefulWidget {
  const AdminSchemaPage({super.key});

  @override
  State<AdminSchemaPage> createState() => _AdminSchemaPageState();
}

class _AdminSchemaPageState extends State<AdminSchemaPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final List<Map<String, dynamic>> _mockSchemas = [
    {'name': 'Sầu riêng (Durian)', 'code': 'DURIAN', 'fields': 12, 'stages': '4 Giai đoạn (Kiến thiết, Ra hoa, Đậu trái, Thu hoạch)'},
    {'name': 'Cà phê (Coffee)', 'code': 'COFFEE', 'fields': 10, 'stages': '3 Giai đoạn (Cây con, Kinh doanh, Phục hồi)'},
    {'name': 'Ca cao (Cacao)', 'code': 'CACAO', 'fields': 8, 'stages': '3 Giai đoạn (Tạo tán, Ra hoa, Thu hoạch)'},
    {'name': 'Cao su (Rubber)', 'code': 'RUBBER', 'fields': 9, 'stages': '2 Giai đoạn (Kiến thiết cơ bản, Cạo mủ)'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: const AdminDrawer(activeRoute: 'schemas'),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Cấu hình Schemas & Quy trình Canh tác', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.green,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: const [
            Tab(text: 'Schemas JSON Cây trồng'),
            Tab(text: 'Tiêu chuẩn Quy trình Canh tác'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Crop Schemas
          ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _mockSchemas.length,
            itemBuilder: (context, idx) {
              final s = _mockSchemas[idx];
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
                      decoration: BoxDecoration(color: Colors.teal.shade50, borderRadius: BorderRadius.circular(12)),
                      child: const Icon(Icons.tune_rounded, color: Colors.teal, size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(s['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A))),
                          const SizedBox(height: 2),
                          Text('Mã: ${s["code"]} · ${s["fields"]} Thuộc tính động', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                          const SizedBox(height: 4),
                          Text(s['stages'] as String, style: TextStyle(fontSize: 11.5, color: Colors.teal.shade800, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),

          // Tab 2: Agronomy Care Norms
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _normCategory('Phương pháp tưới chuẩn', 'Tưới nhỏ giọt công nghệ Israel, Tưới phun mưa cục bộ, Tưới phủ gốc'),
              _normCategory('Loại phân bón hữu cơ & vi sinh', 'NPK 16-16-8, Phân hữu cơ vi sinh Sông Gianh, Humic Hoa Kỳ, D phân gà ủ hoai'),
              _normCategory('Loại thuốc BVTV sinh học', 'Anvil 5SC, Ridomil Gold 68WG, Nấm đối kháng Trichoderma, Dầu tỏi sinh học'),
              _normCategory('Lý do rụng lá / rụng hoa', 'Sốc nước do mưa đêm, Thiếu vi lượng Boron, Nấm Phytophthora tấn công rễ'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _normCategory(String title, String items) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.checklist_rounded, color: AppTheme.green, size: 20),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A))),
            ],
          ),
          const SizedBox(height: 8),
          Text(items, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569), height: 1.4)),
        ],
      ),
    );
  }
}
