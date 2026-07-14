import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:nfc_manager/nfc_manager.dart';
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

  String? _selectedFarmIdForFilter;

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

    final filteredPlants = _selectedFarmIdForFilter == null
        ? _plants
        : _plants.where((p) => p.farmId == int.parse(_selectedFarmIdForFilter!)).toList();

    return Column(
      children: [
        // Dropdown to filter by farm
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: DropdownButtonFormField<String>(
            value: _selectedFarmIdForFilter,
            decoration: InputDecoration(
              labelText: 'Lọc theo trang trại',
              labelStyle: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: AppTheme.grayBorder),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: AppTheme.green),
              ),
            ),
            items: [
              const DropdownMenuItem(value: null, child: Text('Tất cả trang trại', style: TextStyle(fontSize: 13))),
              ..._farms.map((f) => DropdownMenuItem(value: f.id.toString(), child: Text(f.name, style: const TextStyle(fontSize: 13)))),
            ],
            onChanged: (val) {
              setState(() {
                _selectedFarmIdForFilter = val;
              });
            },
          ),
        ),
        Expanded(
          child: filteredPlants.isEmpty
              ? const Center(
                  child: Text(
                    'Không tìm thấy cây trồng phù hợp cho trang trại này.',
                    style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: filteredPlants.length,
                    itemBuilder: (context, index) {
                      final plant = filteredPlants[index];
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
                        onNfcTap: () {
                          _openNfcLinkDialog(plant);
                        },
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }

  void _openNfcLinkDialog(Plant plant) {
    final TextEditingController controller = TextEditingController();
    bool isListening = false;
    String status = 'Chạm thẻ NFC vào mặt lưng điện thoại để ghi nhận mã...';
    
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            
            // Start NFC session if not already listening
            if (!isListening) {
              isListening = true;
              NfcManager.instance.isAvailable().then((avail) {
                if (avail) {
                  NfcManager.instance.startSession(
                    onDiscovered: (NfcTag tag) async {
                      // Get UID
                      final List<dynamic>? identifier = 
                          tag.data['isodep']?['identifier'] ??
                          tag.data['nfca']?['identifier'] ??
                          tag.data['mifare']?['identifier'] ??
                          tag.data['mifareultralight']?['identifier'] ??
                          tag.data['ndef']?['identifier'];
                          
                      if (identifier != null) {
                        final uid = identifier.map((e) => e.toRadixString(16).padLeft(2, '0').toUpperCase()).join(':');
                        
                        String? plantUrl;
                        // Write NDEF URI to tag
                        final ndef = Ndef.from(tag);
                        if (ndef != null && ndef.isWritable) {
                          try {
                            String domain = _apiService.baseUrl.replaceAll('/api', '');
                            if (!domain.startsWith('http')) {
                              domain = 'https://$domain';
                            }
                            final slug = plant.publicSlug ?? plant.id.toString();
                            plantUrl = '$domain/plant/$slug';
                            
                            final record = NdefRecord.createUri(Uri.parse(plantUrl));
                            await ndef.write(NdefMessage([record]));
                          } catch (_) {}
                        }
                        
                        // Call API to link NFC
                        final success = await _apiService.updateNfcTag(plant.id, uid);
                        NfcManager.instance.stopSession();
                        
                        if (mounted) {
                          Navigator.pop(context);
                          
                          String domain = _apiService.baseUrl.replaceAll('/api', '');
                          if (!domain.startsWith('http')) {
                            domain = 'https://$domain';
                          }
                          final slug = plant.publicSlug ?? plant.id.toString();
                          final finalUrl = plantUrl ?? '$domain/plant/$slug';

                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(success 
                                  ? 'Đã liên kết thẻ $uid thành công!\nĐường dẫn: $finalUrl'
                                  : 'Không thể liên kết thẻ NFC. Vui lòng thử lại.'),
                              backgroundColor: success ? AppTheme.green : AppTheme.red,
                              action: success ? SnackBarAction(
                                label: 'Sao chép',
                                textColor: Colors.white,
                                onPressed: () {
                                  Clipboard.setData(ClipboardData(text: finalUrl));
                                },
                              ) : null,
                            ),
                          );
                          _loadData();
                        }
                      } else {
                        NfcManager.instance.stopSession();
                        setDialogState(() {
                          isListening = false;
                          status = 'Không nhận diện được thẻ. Thử lại hoặc nhập tay.';
                        });
                      }
                    },
                    onError: (err) async {
                      NfcManager.instance.stopSession();
                      setDialogState(() {
                        isListening = false;
                        status = 'Lỗi kết nối NFC: ${err.message}';
                      });
                    }
                  );
                } else {
                  setDialogState(() {
                    status = 'Thiết bị không hỗ trợ NFC hoặc chưa bật NFC.';
                  });
                }
              });
            }

            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Row(
                children: [
                  Icon(Icons.nfc_rounded, color: Colors.blue),
                  SizedBox(width: 8),
                  Text('Định danh thẻ NFC', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Cây trồng: Cây #${plant.displayName}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    if (plant.nfcUid != null) ...[
                      Chip(
                        label: Text('Mã thẻ hiện tại: ${plant.nfcUid}'),
                        backgroundColor: AppTheme.grayBorder,
                      ),
                      const SizedBox(height: 12),
                    ],
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        border: Border.all(color: Colors.blue.shade100),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              status,
                              style: const TextStyle(fontSize: 12, color: Colors.blue),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Row(
                      children: [
                        Expanded(child: Divider()),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 8),
                          child: Text('hoặc nhập thủ công', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                        ),
                        Expanded(child: Divider()),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: controller,
                      decoration: const InputDecoration(
                        labelText: 'Nhập mã thẻ (UID)',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.green,
                        minimumSize: const Size.fromHeight(40),
                      ),
                      onPressed: () async {
                        final uid = controller.text.trim().toUpperCase();
                        if (uid.isEmpty) return;
                        
                        NfcManager.instance.stopSession();
                        Navigator.pop(context);
                        
                        final success = await _apiService.updateNfcTag(plant.id, uid);
                        if (mounted) {
                          String domain = _apiService.baseUrl.replaceAll('/api', '');
                          if (!domain.startsWith('http')) {
                            domain = 'https://$domain';
                          }
                          final slug = plant.publicSlug ?? plant.id.toString();
                          final plantUrl = '$domain/plant/$slug';

                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(success 
                                  ? 'Đã liên kết thẻ $uid thành công!\nĐường dẫn: $plantUrl'
                                  : 'Không thể liên kết thẻ NFC. Vui lòng thử lại.'),
                              backgroundColor: success ? AppTheme.green : AppTheme.red,
                              action: success ? SnackBarAction(
                                label: 'Sao chép',
                                textColor: Colors.white,
                                onPressed: () {
                                  Clipboard.setData(ClipboardData(text: plantUrl));
                                },
                              ) : null,
                            ),
                          );
                          _loadData();
                        }
                      },
                      child: const Text('Lưu mã thẻ', style: TextStyle(color: Colors.white)),
                    ),
                    if (plant.nfcUid != null) ...[
                      const SizedBox(height: 8),
                      TextButton(
                        style: TextButton.styleFrom(foregroundColor: AppTheme.red),
                        onPressed: () async {
                          NfcManager.instance.stopSession();
                          Navigator.pop(context);
                          
                          final success = await _apiService.updateNfcTag(plant.id, null);
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Đã hủy liên kết thẻ định danh.'),
                                backgroundColor: AppTheme.red,
                              ),
                            );
                            _loadData();
                          }
                        },
                        child: const Text('Hủy kích hoạt thẻ hiện tại'),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    NfcManager.instance.stopSession();
                    Navigator.pop(context);
                  },
                  child: const Text('Đóng'),
                ),
              ],
            );
          },
        );
      },
    ).then((_) {
      NfcManager.instance.stopSession();
    });
  }
}
