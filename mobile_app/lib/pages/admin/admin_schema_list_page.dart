import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/theme.dart';
import '../../components/loading_indicator.dart';

class AdminSchemaListPage extends StatefulWidget {
  const AdminSchemaListPage({super.key});

  @override
  State<AdminSchemaListPage> createState() => _AdminSchemaListPageState();
}

class _AdminSchemaListPageState extends State<AdminSchemaListPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  List<Map<String, dynamic>> _schemas = [];

  @override
  void initState() {
    super.initState();
    _loadSchemas();
  }

  Future<void> _loadSchemas() async {
    setState(() => _isLoading = true);
    final list = await _apiService.fetchSchemas();
    setState(() {
      _schemas = list;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Cấu hình thuộc tính', style: TextStyle(fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadSchemas,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang tải danh sách schema...')
          : _schemas.isEmpty
              ? const Center(child: Text('Không có cấu hình schema nào.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _schemas.length,
                  itemBuilder: (context, index) {
                    final s = _schemas[index];
                    final name = s['name'] ?? 'Không tên';
                    final desc = s['description'] ?? 'Không có mô tả.';
                    final List<dynamic> fields = s['fields'] as List<dynamic>? ?? [];

                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: AppTheme.grayBorder),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.greenDark),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              desc,
                              style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                            ),
                            const SizedBox(height: 12),
                            const Divider(color: AppTheme.grayBorder),
                            const SizedBox(height: 8),
                            const Text(
                              'Thuộc tính đăng ký:',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: AppTheme.textMain),
                            ),
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: fields.map<Widget>((dynamic f) {
                                final fMap = f as Map<String, dynamic>? ?? {};
                                final fName = fMap['name'] ?? '';
                                final fType = fMap['type'] ?? 'text';
                                return Chip(
                                  labelPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 0),
                                  visualDensity: VisualDensity.compact,
                                  backgroundColor: AppTheme.greenLight.withOpacity(0.3),
                                  label: Text(
                                    '$fName ($fType)',
                                    style: const TextStyle(fontSize: 10, color: AppTheme.greenDark, fontWeight: FontWeight.bold),
                                  ),
                                );
                              }).toList(),
                            )
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
