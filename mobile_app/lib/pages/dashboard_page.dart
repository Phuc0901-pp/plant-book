import 'package:flutter/material.dart';
import '../components/farm_card.dart';
import '../components/plant_card.dart';
import '../components/loading_indicator.dart';
import '../models/farm.dart';
import '../models/plant.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';
import 'login_page.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  final ApiService _apiService = ApiService();
  
  bool _isLoading = true;
  String? _error;
  
  List<Farm> _farms = [];
  List<Plant> _plants = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final data = await Future.wait([
        _apiService.fetchFarms(),
        _apiService.fetchPlants(),
      ]);

      setState(() {
        _farms = data[0] as List<Farm>;
        _plants = data[1] as List<Plant>;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng hoặc server backend.';
        _isLoading = false;
      });
    }
  }

  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Xác nhận đăng xuất'),
        content: const Text('Bạn có chắc chắn muốn đăng xuất khỏi tài khoản nông hộ không?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy', style: TextStyle(color: AppTheme.textMuted)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Đăng xuất', style: TextStyle(color: AppTheme.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await _apiService.logout();
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LoginPage()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Row(
            children: [
              Container(
                width: 8,
                height: 24,
                decoration: BoxDecoration(
                  color: AppTheme.green,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(width: 8),
              const Text('Plant Book Nông Hộ'),
            ],
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.logout_rounded, color: AppTheme.red),
              tooltip: 'Đăng xuất',
              onPressed: _handleLogout,
            ),
          ],
          bottom: const TabBar(
            indicatorColor: AppTheme.green,
            labelColor: AppTheme.greenDark,
            unselectedLabelColor: AppTheme.textMuted,
            labelStyle: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            tabs: [
              Tab(
                icon: Icon(Icons.home_work_rounded),
                text: 'Trang trại của tôi',
              ),
              Tab(
                icon: Icon(Icons.nature_rounded),
                text: 'Cây trồng phụ trách',
              ),
            ],
          ),
        ),
        body: _isLoading
            ? const LoadingIndicator(message: 'Đang tải dữ liệu thực địa...')
            : _error != null
                ? _buildErrorView()
                : TabBarView(
                    children: [
                      _buildFarmsTab(),
                      _buildPlantsTab(),
                    ],
                  ),
      ),
    );
  }

  Widget _buildErrorView() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 64, color: AppTheme.red),
            const SizedBox(height: 16),
            const Text(
              'Lỗi kết nối dữ liệu',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textMain),
            ),
            const SizedBox(height: 8),
            Text(
              _error!,
              textAlign: Center,
              style: const TextStyle(fontSize: 13, color: AppTheme.textMuted, height: 1.5),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadData,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Thử lại'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFarmsTab() {
    if (_farms.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Container(
            height: MediaQuery.of(context).size.height * 0.6,
            alignment: Alignment.center,
            child: const Text('Bạn chưa được gán quản lý trang trại nào.'),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _farms.length,
        itemBuilder: (context, index) {
          final farm = _farms[index];
          return FarmCard(farm: farm);
        },
      ),
    );
  }

  Widget _buildPlantsTab() {
    if (_plants.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Container(
            height: MediaQuery.of(context).size.height * 0.6,
            alignment: Alignment.center,
            child: const Text('Không có cây trồng nào được bàn giao.'),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _plants.length,
        itemBuilder: (context, index) {
          final plant = _plants[index];
          return PlantCard(
            plant: plant,
            onLogTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Tính năng ghi nhật ký nhanh cho Cây #${plant.displayName} đang được phát triển.'),
                  backgroundColor: AppTheme.greenDark,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
          );
        },
      ),
    );
  }
}
