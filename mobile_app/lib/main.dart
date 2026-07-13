import 'package:flutter/material.dart';
import 'pages/login_page.dart';
import 'pages/dashboard_page.dart';
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

  runApp(PlantBookApp(initialScreen: loggedIn ? const DashboardPage() : const LoginPage()));
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
