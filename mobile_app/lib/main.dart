import 'package:flutter/material.dart';
import 'pages/login_page.dart';
import 'pages/dashboard_page.dart';
import 'pages/admin/admin_dashboard_page.dart';
import 'services/api_service.dart';
import 'services/cache_service.dart';
import 'utils/theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Hive Cache database
  await CacheService().init();
  
  // Check if session token is already stored and valid
  final apiService = ApiService();
  final loggedIn = await apiService.isLoggedIn();

  Widget initialScreen = const LoginPage();
  if (loggedIn) {
    try {
      final user = await apiService.fetchUserInfo();
      if (user != null && user['role'] == 'admin') {
        initialScreen = const AdminDashboardPage();
      } else {
        initialScreen = const DashboardPage();
      }
    } catch (_) {
      initialScreen = const DashboardPage();
    }
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
