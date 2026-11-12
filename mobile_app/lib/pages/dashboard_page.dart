import 'package:flutter/material.dart';
import '../components/navigation/user_bottom_nav.dart';
import '../utils/theme.dart';
import '../core/theme/fluent_icons.dart';
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
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4.5,
                margin: const EdgeInsets.only(bottom: 18),
                decoration: BoxDecoration(
                  color: const Color(0xFFD1D5DB),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              const Text(
                'Định danh & Quét Cây Trồng Thực Địa',
                style: TextStyle(
                  fontSize: 16.5,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.fluentTextMain,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Chọn phương thức nhận diện tem dán trên thân cây hoặc thẻ từ NFC:',
                style: TextStyle(fontSize: 12.5, color: AppTheme.fluentTextMuted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 18),
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
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
                        decoration: BoxDecoration(
                          color: AppTheme.mintPastel,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFFCEEAD6), width: 0.8),
                          boxShadow: AppTheme.fluentShadow,
                        ),
                        child: Column(
                          children: const [
                            LucideIcon(LucideIconName.scan, size: 32, color: AppTheme.fluentEmerald),
                            SizedBox(height: 10),
                            Text(
                              'Quét mã QR Code',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: AppTheme.fluentEmeraldDark),
                            ),
                            SizedBox(height: 4),
                            Text('Camera sau quang học', style: TextStyle(fontSize: 11, color: AppTheme.fluentTextMuted)),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
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
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
                        decoration: BoxDecoration(
                          color: AppTheme.skyPastel,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFFD2E3FC), width: 0.8),
                          boxShadow: AppTheme.fluentShadow,
                        ),
                        child: Column(
                          children: const [
                            LucideIcon(LucideIconName.tag, size: 32, color: AppTheme.skyText),
                            SizedBox(height: 10),
                            Text(
                              'Chạm Thẻ NFC',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF1E40AF)),
                            ),
                            SizedBox(height: 4),
                            Text('Chạm lưng điện thoại', style: TextStyle(fontSize: 11, color: AppTheme.fluentTextMuted)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  void _openQuickCareDialog() {
    final defaultPlantId = _cachedPlants.isNotEmpty ? [_cachedPlants.first.id] : <int>[];
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => LogEditDialog(
        plantIds: defaultPlantId,
        farmName: _cachedPlants.isNotEmpty ? _cachedPlants.first.plantType : 'Trang trại Nông hộ',
        initialType: 'Nhân công',
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
      backgroundColor: AppTheme.fluentSurface,
      appBar: AppBar(
        backgroundColor: AppTheme.fluentSurface,
        elevation: 0,
        titleSpacing: 16,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(0.8),
          child: Container(color: AppTheme.fluentBorder, height: 0.8),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(5),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.fluentBorder, width: 0.8),
                boxShadow: AppTheme.fluentShadow,
              ),
              child: Image.asset(
                'assets/images/logo.png',
                height: 22,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const LucideIcon(LucideIconName.sprout, color: AppTheme.fluentEmerald, size: 20),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  'Sổ Nông Tân Bảo AgTech',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppTheme.fluentTextMain, letterSpacing: -0.2),
                ),
                Text(
                  'Hệ Thống Nhật Ký Canh Tác Số · Chuẩn VietGAP',
                  style: TextStyle(fontSize: 10, color: AppTheme.fluentEmerald, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const LucideIcon(LucideIconName.scan, size: 20, color: AppTheme.fluentTextMain),
            tooltip: 'Quét QR / NFC',
            onPressed: _openQrNfcScanner,
          ),
          IconButton(
            icon: const LucideIcon(LucideIconName.sparkles, size: 20, color: AppTheme.fluentEmerald),
            tooltip: 'Hỏi Bé Mầm AI',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AiChatPage()),
              );
            },
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: Column(
        children: [
          if (widget.isAdminView)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFEA580C), Color(0xFFD97706)],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
              ),
              child: Row(
                children: [
                  const LucideIcon(LucideIconName.shield, color: Colors.white, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '👑 Chế độ Admin: Đang xem ${widget.viewingFarmName ?? "Nông hộ"}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  InkWell(
                    onTap: () => Navigator.pop(context),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          LucideIcon(LucideIconName.arrowLeft, size: 12, color: Color(0xFFEA580C)),
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
      // Chỉ hiển thị nút nổi SpeedDial tại Tab 0 (Tổng quan).
      // Các Tab con (Nhật ký, Kho vật tư) tự quản lý nút bấm riêng biệt, tránh triệt để lỗi chồng chéo 2 nút.
      floatingActionButton: _currentIndex == 0
          ? Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (_isSpeedDialOpen) ...[
                  _buildSpeedDialItem(
                    icon: LucideIconName.sparkles,
                    color: const Color(0xFF10B981),
                    label: 'Hỏi Bé Mầm AI',
                    onTap: () {
                      setState(() => _isSpeedDialOpen = false);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const AiChatPage()));
                    },
                  ),
                  const SizedBox(height: 10),
                  _buildSpeedDialItem(
                    icon: LucideIconName.scan,
                    color: const Color(0xFF2563EB),
                    label: 'Quét QR / Chạm NFC',
                    onTap: () {
                      setState(() => _isSpeedDialOpen = false);
                      _openQrNfcScanner();
                    },
                  ),
                  const SizedBox(height: 10),
                  _buildSpeedDialItem(
                    icon: LucideIconName.users,
                    color: AppTheme.lavenderText,
                    label: 'Ghi nhanh nhật ký tác nghiệp',
                    onTap: () {
                      setState(() => _isSpeedDialOpen = false);
                      _openQuickCareDialog();
                    },
                  ),
                  const SizedBox(height: 14),
                ],
                FloatingActionButton(
                  backgroundColor: AppTheme.fluentEmerald,
                  foregroundColor: Colors.white,
                  elevation: 4,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                  onPressed: () {
                    setState(() => _isSpeedDialOpen = !_isSpeedDialOpen);
                  },
                  child: AnimatedRotation(
                    turns: _isSpeedDialOpen ? 0.125 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: LucideIcon(_isSpeedDialOpen ? LucideIconName.close : LucideIconName.plus, size: 24, color: Colors.white),
                  ),
                ),
              ],
            )
          : null,
      bottomNavigationBar: UserBottomNav(
        currentIndex: _currentIndex,
        onTap: _onTabTapped,
      ),
    );
  }

  Widget _buildSpeedDialItem({
    required LucideIconName icon,
    required Color color,
    required String label,
    required VoidCallback onTap,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.fluentBorder, width: 0.8),
            boxShadow: AppTheme.fluentShadow,
          ),
          child: Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: AppTheme.fluentTextMain),
          ),
        ),
        const SizedBox(width: 10),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: color.withOpacity(0.3),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            alignment: Alignment.center,
            child: LucideIcon(icon, color: Colors.white, size: 20),
          ),
        ),
      ],
    );
  }
}
