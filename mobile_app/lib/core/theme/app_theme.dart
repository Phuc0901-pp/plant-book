import 'package:flutter/material.dart';
import '../constants/app_constants.dart';

class AppTheme {
  static const String appVersion = AppConstants.appVersion;

  // Smart Agriculture Palette
  static const Color greenDark = Color(0xFF064E3B); // Deep Forest Green
  static const Color green = Color(0xFF059669);     // Emerald Accent
  static const Color greenLight = Color(0xFFECFDF5);
  
  static const Color userAccent = Color(0xFFD97706); // Warm Amber Accent
  static const Color userAccentSoft = Color(0xFFFEF3C7);
  
  static const Color red = Color(0xFFDC2626);
  static const Color amber = Color(0xFFD97706);
  static const Color grayBorder = Color(0xFFE2E8F0);
  static const Color textMain = Color(0xFF0F172A);
  static const Color textMuted = Color(0xFF64748B);

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: const Color(0xFFF8FAFC),
      primaryColor: greenDark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: green,
        primary: greenDark,
        secondary: userAccent,
      ),
      fontFamily: 'Inter',
      appBarTheme: const AppBarTheme(
        backgroundColor: greenDark,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: grayBorder),
        ),
        color: Colors.white,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: greenDark,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: grayBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: green, width: 1.5),
        ),
      ),
    );
  }
}
