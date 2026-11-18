import 'package:flutter/material.dart';
import 'pages/login_page.dart';
import 'pages/dashboard_page.dart';
import 'pages/admin/admin_dashboard_page.dart';
import 'services/api_service.dart';
import 'services/cache_service.dart';
import 'utils/theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await CacheService().init();
  } catch (e) {
    print('CacheService init error: $e');
  }

  Widget initialScreen = const LoginPage();
  try {
    final apiService = ApiService();
    final loggedIn = await apiService.isLoggedIn().timeout(
      const Duration(milliseconds: 1500),
      onTimeout: () => false,
    );

    if (loggedIn) {
      final cachedUser = CacheService().getCachedUserProfile();
      if (cachedUser != null && cachedUser['role'] == 'admin') {
        initialScreen = const AdminDashboardPage();
      } else {
        initialScreen = const DashboardPage();
      }
    }
  } catch (e) {
    print('Startup auth check error: $e');
    initialScreen = const LoginPage();
  }

  runApp(PlantBookApp(initialScreen: initialScreen));
}

class PlantBookApp extends StatelessWidget {
  final Widget initialScreen;

  const PlantBookApp({super.key, required this.initialScreen});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Plant Book Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: initialScreen,
    );
  }
}
