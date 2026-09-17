import 'package:flutter/material.dart';

class AppTheme {
  static const String appVersion = 'v1.2.0';

  // Smart AgTech Enterprise Palette (Deep Forest & Emerald)
  static const Color greenDark = Color(0xFF064E3B);
  static const Color green = Color(0xFF059669);
  static const Color greenLight = Color(0xFFECFDF5);
  static const Color greenSurface = Color(0xFFF0FDF4);
  
  static const Color userAccent = Color(0xFFD97706); // Warm Amber
  static const Color userAccentSoft = Color(0xFFFEF3C7);
  
  static const Color red = Color(0xFFDC2626);
  static const Color redLight = Color(0xFFFEF2F2);
  static const Color amber = Color(0xFFD97706);
  static const Color amberLight = Color(0xFFFFFBEB);
  static const Color blue = Color(0xFF2563EB);
  static const Color blueLight = Color(0xFFEFF6FF);

  static const Color grayBorder = Color(0xFFE2E8F0);
  static const Color grayLight = Color(0xFFF1F5F9);
  static const Color textMain = Color(0xFF0F172A);
  static const Color textMuted = Color(0xFF475569); // High contrast for outdoor visibility

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: const Color(0xFFF8FAFC),
      primaryColor: greenDark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: green,
        primary: greenDark,
        secondary: userAccent,
        surface: Colors.white,
      ),
      fontFamily: 'Inter',
      appBarTheme: const AppBarTheme(
        backgroundColor: greenDark,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: Colors.white,
          letterSpacing: 0.2,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: grayBorder, width: 1.2),
        ),
        color: Colors.white,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: greenDark,
          foregroundColor: Colors.white,
          elevation: 0,
          minimumSize: const Size(double.infinity, 50),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.3,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
        labelStyle: const TextStyle(fontSize: 14.5, color: textMuted),
        hintStyle: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: grayBorder, width: 1.2),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: grayBorder, width: 1.2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: green, width: 2.0),
        ),
      ),
    );
  }
}
