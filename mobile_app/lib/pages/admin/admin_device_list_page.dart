import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/theme.dart';
import '../../components/loading_indicator.dart';

class AdminDeviceListPage extends StatefulWidget {
  const AdminDeviceListPage({super.key});

  @override
  State<AdminDeviceListPage> createState() => _AdminDeviceListPageState();
}

class _AdminDeviceListPageState extends State<AdminDeviceListPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  List<Map<String, dynamic>> _devices = [];

  @override
  void initState() {
    super.initState();
    _loadDevices();
  }

  Future<void> _loadDevices() async {
    setState(() => _isLoading = true);
    final list = await _apiService.fetchDevices();
    setState(() {
      _devices = list;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: const Text('Quản lý Thiết bị IOT', style: TextStyle(fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadDevices,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang tải danh sách thiết bị...')
          : _devices.isEmpty
              ? const Center(child: Text('Không có thiết bị IOT nào đăng ký.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _devices.length,
                  itemBuilder: (context, index) {
                    final d = _devices[index];
                    final name = d['name'] ?? 'Thiết bị không tên';
                    final model = d['model'] ?? 'IOT node';
                    final uid = d['device_uid'] ?? '—';
                    final farmName = d['farm_name'] ?? 'Chưa gán trang trại';
                    final status = d['status'] ?? 'offline';
                    final isOnline = status == 'online';

                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: AppTheme.grayBorder),
                      ),
                      child: ListTile(
                        leading: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: isOnline ? AppTheme.greenLight : Colors.grey.shade100,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.sensors_rounded,
                            color: isOnline ? AppTheme.green : Colors.grey.shade400,
                            size: 24,
                          ),
                        ),
                        title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Model: $model | UID: $uid', style: const TextStyle(fontSize: 11)),
                              const SizedBox(height: 2),
                              Text('Trang trại: $farmName', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: isOnline ? AppTheme.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: isOnline ? AppTheme.green : Colors.red),
                          ),
                          child: Text(
                            status.toUpperCase(),
                            style: TextStyle(
                              color: isOnline ? AppTheme.green : Colors.red,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
