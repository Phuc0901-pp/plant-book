import 'dart:async';
import 'package:flutter/material.dart';
import '../components/farm_card.dart';
import '../components/plant_card.dart';
import '../components/loading_indicator.dart';
import '../components/qr_nfc_scanner.dart' show QrScannerPage, NfcScannerPage;
import '../models/farm.dart';
import '../models/plant.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import '../utils/theme.dart';
import 'farm_detail_page.dart';
import 'plant_detail_page.dart';
import 'alerts_page.dart';
import 'settings_page.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  final ApiService _apiService = ApiService();
  StreamSubscription? _wsSubscription;
  
  int _currentIndex = 0;
  bool _isLoading = true;
  String? _error;
  
  List<Farm> _farms = [];
  List<Plant> _plants = [];

  @override
  void initState() {
    super.initState();
    _loadData();
    
    // Connect and listen to real-time sync events
    WebSocketService().connect();
    _wsSubscription = WebSocketService().stream.listen((event) {
      final ev = event['event'];
      if (ev == 'plants_updated' || ev == 'new_care_log' || ev == 'farms_updated') {
        if (mounted) {
          _loadData();
        }
      }
    });
  }

  @override
  void dispose() {
    _wsSubscription?.cancel();
    super.dispose();
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
        _error = 'Không thể đồng bộ dữ liệu. Vui lòng kiểm tra kết nối mạng.';
        _isLoading = false;
      });
    }
  }

  void _triggerQrScan() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => QrScannerPage(availablePlants: _plants),
      ),
    ).then((_) => _loadData());
  }

  void _triggerNfcScan() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => NfcScannerPage(availablePlants: _plants),
      ),
    ).then((_) => _loadData());
  }

  @override
  Widget build(BuildContext context) {
    // If not the home tab (index 0 or 1), don't show the farm/plant data loading wrapper here,
    // since AlertsPage and SettingsPage manage their own lifecycle and loading internally.
    Widget body;
    if (_isLoading && (_currentIndex == 0 || _currentIndex == 1)) {
      body = const LoadingIndicator(message: 'Đang tải dữ liệu thực địa...');
    } else if (_error != null && (_currentIndex == 0 || _currentIndex == 1)) {
      body = _buildErrorView();
    } else {
      switch (_currentIndex) {
        case 0:
          body = _buildFarmsTab();
          break;
        case 1:
          body = _buildPlantsTab();
          break;
        case 2:
          body = const AlertsPage();
          break;
        case 3:
          body = const SettingsPage();
          break;
        default:
          body = _buildFarmsTab();
      }
    }

    return Scaffold(
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
            const Text(
              'Plant Book',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        actions: [
          // NFC Reader Trigger
          IconButton(
            icon: const Icon(Icons.nfc_rounded, color: AppTheme.userAccent),
            tooltip: 'Đọc thẻ NFC',
            onPressed: _triggerNfcScan,
          ),
          // QR Code Scanner Trigger
          IconButton(
            icon: const Icon(Icons.qr_code_scanner_rounded, color: AppTheme.green),
            tooltip: 'Quét mã QR',
            onPressed: _triggerQrScan,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: body,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        type: BottomNavigationBarType.fixed,
        selectedItemColor: AppTheme.greenDark,
        unselectedItemColor: AppTheme.textMuted,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
        unselectedLabelStyle: const TextStyle(fontSize: 11),
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
          if (index == 0 || index == 1) {
            _loadData();
          }
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_work_rounded),
            label: 'Nông trại',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.nature_rounded),
            label: 'Cây trồng',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.warning_amber_rounded),
            label: 'Cảnh báo',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings_rounded),
            label: 'Cài đặt',
          ),
        ],
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
              textAlign: TextAlign.center,
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
            child: const Text('Nông hộ chưa được gán trang trại nào.'),
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
          return FarmCard(
            farm: farm,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => FarmDetailPage(farm: farm),
                ),
              ).then((_) => _loadData());
            },
          );
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
            child: const Text('Nông hộ chưa được bàn giao cây trồng nào.'),
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
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => PlantDetailPage(plant: plant),
                ),
              ).then((_) => _loadData());
            },
          );
        },
      ),
    );
  }
}
