import 'package:flutter/material.dart';
import '../components/navigation/user_bottom_nav.dart';
import '../utils/theme.dart';
import 'user/user_dashboard_page.dart';
import 'user/user_farm_detail_page.dart';
import 'user/user_logs_page.dart';
import 'supplies_page.dart';
import 'settings_page.dart';
import 'ai_chat_page.dart';
import '../components/qr_nfc_scanner.dart';
import '../components/log_edit_dialog.dart';
import '../services/api_service.dart';
import '../models/plant.dart';

class DashboardPage extends StatefulWidget {
  final bool isAdminView;
  final String? viewingFarmName;

  const DashboardPage({
    super.key,
    this.isAdminView = false,
    this.viewingFarmName,
  });

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  int _currentIndex = 0;
  List<Plant> _cachedPlants = [];
  bool _isSpeedDialOpen = false;

  @override
  void initState() {
    super.initState();
    _loadAvailablePlants();
  }

  Future<void> _loadAvailablePlants() async {
    try {
      final plants = await ApiService().fetchPlants();
      if (mounted) {
        setState(() {
          _cachedPlants = plants;
        });
      }
    } catch (_) {}
  }

  void _onTabTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  void _openQrNfcScanner() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: AppTheme.grayBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const Text(
                'Định danh & Quét Cây Trồng Thực Địa',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppTheme.textMain),
              ),
              const SizedBox(height: 8),
              const Text(
                'Chọn phương thức quét tem dán trên thân hoặc trái cây:',
                style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () {
                        Navigator.pop(ctx);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => QrScannerPage(availablePlants: _cachedPlants),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
                        decoration: BoxDecoration(
                          color: AppTheme.greenLight,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppTheme.green.withOpacity(0.3)),
                        ),
                        child: Column(
                          children: const [
                            Icon(Icons.qr_code_scanner_rounded, color: AppTheme.green, size: 36),
                            SizedBox(height: 10),
                            Text('Quét mã QR Code', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.greenDark)),
                            SizedBox(height: 4),
                            Text('Dùng Camera sau', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: InkWell(
                      onTap: () {
                        Navigator.pop(ctx);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => NfcScannerPage(availablePlants: _cachedPlants),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
                        decoration: BoxDecoration(
                          color: AppTheme.blueLight,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppTheme.blue.withOpacity(0.3)),
                        ),
                        child: Column(
                          children: const [
                            Icon(Icons.nfc_rounded, color: AppTheme.blue, size: 36),
                            SizedBox(height: 10),
                            Text('Chạm Thẻ NFC', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E40AF))),
                            SizedBox(height: 4),
                            Text('Chạm lưng điện thoại', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openQuickCareDialog() {
    final defaultPlantId = _cachedPlants.isNotEmpty ? [_cachedPlants.first.id] : <int>[];
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => LogEditDialog(
        plantIds: defaultPlantId,
        farmName: _cachedPlants.isNotEmpty ? _cachedPlants.first.plantType : 'Trang trại Nông hộ',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    switch (_currentIndex) {
      case 0:
        body = UserDashboardPage(onNavigateTab: _onTabTapped);
        break;
      case 1:
        body = const UserFarmDetailPage();
        break;
      case 2:
        body = const UserLogsPage();
        break;
      case 3:
        body = const SuppliesPage();
        break;
      case 4:
        body = const SettingsPage();
        break;
      default:
        body = UserDashboardPage(onNavigateTab: _onTabTapped);
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppTheme.greenDark,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Image.asset(
                'assets/images/logo.png',
                height: 24,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Icon(Icons.eco_rounded, color: AppTheme.green, size: 24),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  'Sổ Nông Tân Bảo AgTech',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white),
                ),
                Text(
                  'Hệ Thống ERP Quản Trị Vườn Số',
                  style: TextStyle(fontSize: 10.5, color: Color(0xFF6EE7B7), fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner_rounded, color: Colors.white),
            tooltip: 'Quét QR / NFC',
            onPressed: _openQrNfcScanner,
          ),
          IconButton(
            icon: const Icon(Icons.psychology_alt_rounded, color: Color(0xFF6EE7B7)),
            tooltip: 'Hỏi Bé Mầm AI',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AiChatPage()),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          if (widget.isAdminView)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFEA580C), Color(0xFFD97706)],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black12,
                    blurRadius: 4,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  const Icon(Icons.admin_panel_settings_rounded, color: Colors.white, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '👑 Chế độ Admin: Đang xem ${widget.viewingFarmName ?? "Nông hộ"}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 12.5,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  InkWell(
                    onTap: () => Navigator.pop(context),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: const [
                          BoxShadow(
                            color: Colors.black12,
                            blurRadius: 2,
                            offset: Offset(0, 1),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.arrow_back_rounded, size: 14, color: Color(0xFFEA580C)),
                          SizedBox(width: 4),
                          Text(
                            'Quay lại Admin',
                            style: TextStyle(
                              color: Color(0xFFEA580C),
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          Expanded(child: body),
        ],
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (_isSpeedDialOpen) ...[
            _buildSpeedDialItem(
              icon: Icons.psychology_alt_rounded,
              color: const Color(0xFF10B981),
              label: 'Hỏi Bé Mầm AI',
              onTap: () {
                setState(() => _isSpeedDialOpen = false);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const AiChatPage()));
              },
            ),
            const SizedBox(height: 10),
            _buildSpeedDialItem(
              icon: Icons.qr_code_scanner_rounded,
              color: const Color(0xFF2563EB),
              label: 'Quét QR / Chạm NFC',
              onTap: () {
                setState(() => _isSpeedDialOpen = false);
                _openQrNfcScanner();
              },
            ),
            const SizedBox(height: 10),
            _buildSpeedDialItem(
              icon: Icons.edit_note_rounded,
              color: const Color(0xFFD97706),
              label: 'Ghi nhật ký 1 chạm (Voice)',
              onTap: () {
                setState(() => _isSpeedDialOpen = false);
                _openQuickCareDialog();
              },
            ),
            const SizedBox(height: 14),
          ],
          FloatingActionButton(
            backgroundColor: AppTheme.greenDark,
            foregroundColor: Colors.white,
            elevation: 5,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            onPressed: () {
              setState(() => _isSpeedDialOpen = !_isSpeedDialOpen);
            },
            child: AnimatedRotation(
              turns: _isSpeedDialOpen ? 0.125 : 0,
              duration: const Duration(milliseconds: 200),
              child: Icon(_isSpeedDialOpen ? Icons.close_rounded : Icons.add_rounded, size: 30),
            ),
          ),
        ],
      ),
      bottomNavigationBar: UserBottomNav(
        currentIndex: _currentIndex,
        onTap: _onTabTapped,
      ),
    );
  }

  Widget _buildSpeedDialItem({
    required IconData icon,
    required Color color,
    required String label,
    required VoidCallback onTap,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.08),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5, color: AppTheme.textMain),
          ),
        ),
        const SizedBox(width: 10),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: color.withOpacity(0.35),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Icon(icon, color: Colors.white, size: 24),
          ),
        ),
      ],
    );
  }
}