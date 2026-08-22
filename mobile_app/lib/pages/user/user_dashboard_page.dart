import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../components/common/welcome_banner.dart';
import '../../components/farm_card.dart';
import '../../components/plant_card.dart';
import '../../components/common/pro_upgrade_modal.dart';
import '../../components/loading_indicator.dart';
import '../../models/farm.dart';
import '../../models/plant.dart';
import '../../services/api_service.dart';

class UserDashboardPage extends StatefulWidget {
  final Function(int) onNavigateTab;

  const UserDashboardPage({super.key, required this.onNavigateTab});

  @override
  State<UserDashboardPage> createState() => _UserDashboardPageState();
}

class _UserDashboardPageState extends State<UserDashboardPage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  List<Farm> _farms = [];
  List<Plant> _plants = [];
  Map<String, dynamic>? _userProfile;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _apiService.fetchFarms(),
        _apiService.fetchPlants(),
        _apiService.fetchUserInfo(),
      ]);

      setState(() {
        _farms = results[0] as List<Farm>;
        _plants = results[1] as List<Plant>;
        _userProfile = results[2] as Map<String, dynamic>?;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const LoadingIndicator(message: 'Đang tải dữ liệu thực địa...');
    }

    final bool isPro = _userProfile?['account_tier'] == 'pro';
    final userName = _userProfile?['full_name'] ?? _userProfile?['name'] ?? 'Nông hộ';

    return RefreshIndicator(
      onRefresh: _loadDashboardData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Banner matching Web App 100%
            WelcomeBanner(userName: userName, accountTier: _userProfile?['account_tier'] as String?),
            const SizedBox(height: 20),

            // Macro Farm Overview Notification if Normal Tier
            if (!isPro)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Row(
                  children: const [
                    Icon(Icons.workspace_premium_rounded, color: Colors.amber, size: 22),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Chế độ Nông hộ NORMAL (Quản lý Toàn Vườn). Nâng cấp PRO 👑 để quản lý riêng từng cây & Mã QR/NFC.',
                        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF78350F)),
                      ),
                    ),
                  ],
                ),
              ),

            // Section Header: My Farms
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'TRANG TRẠI CỦA BẠN',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
                ),
                TextButton(
                  onPressed: () => widget.onNavigateTab(1),
                  child: const Text('Xem tất cả →', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
                ),
              ],
            ),
            const SizedBox(height: 6),

            if (_farms.isEmpty)
              Container(
                padding: const EdgeInsets.all(20),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.grayBorder)),
                child: const Text('Chưa khởi tạo trang trại nào.', style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _farms.length > 2 ? 2 : _farms.length,
                itemBuilder: (context, idx) {
                  final farm = _farms[idx];
                  return FarmCard(
                    farm: farm,
                    onTap: () => widget.onNavigateTab(1),
                  );
                },
              ),

            const SizedBox(height: 20),

            // Section Header: Plants Summary
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'DANH SÁCH CÂY TRỒNG',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
                ),
                Text('${_plants.length} cây', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
              ],
            ),
            const SizedBox(height: 8),

            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _plants.length > 3 ? 3 : _plants.length,
              itemBuilder: (context, idx) {
                final plant = _plants[idx];
                return PlantCard(
                  plant: plant,
                  onLogTap: () {
                    if (!isPro) {
                      ProUpgradeModal.show(context, 'quản lý từng cây riêng lẻ & Thẻ QR/NFC');
                    }
                  },
                );
              },
            ),

            const SizedBox(height: 24),
            Center(
              child: Text(
                AppConstants.appFooter,
                style: const TextStyle(fontSize: 11, color: AppTheme.textMuted, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
