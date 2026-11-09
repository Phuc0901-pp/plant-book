import 'package:flutter/material.dart';
import '../core/theme/fluent_icons.dart';

// ============================================================================
// MICROSOFT FLUENT 2 DESIGN SYSTEM FOR PLANT BOOK MOBILE
// Reference: Microsoft Loop / Microsoft Viva / To-Do / Teams Mobile
// ============================================================================

class AppTheme {
  static const String appVersion = 'v1.3.5';

  // Core Microsoft Fluent 2 Tokens
  static const Color fluentSurface = Color(0xFFFAF9F8); // Alabaster warm background
  static const Color fluentCardBg = Colors.white;
  static const Color fluentBorder = Color(0xFFEDEBE9); // 0.8px subtle card border
  static const Color fluentBorderActive = Color(0xFF107C41);

  // Microsoft Fluent Emerald (Brand Primary)
  static const Color fluentEmerald = Color(0xFF107C41);
  static const Color fluentEmeraldDark = Color(0xFF0F5B30);
  static const Color fluentEmeraldLight = Color(0xFFE6F4EA);

  // Fluent 2 Pastel Squircle Palette
  static const Color mintPastel = Color(0xFFE6F4EA);
  static const Color mintText = Color(0xFF107C41);

  static const Color skyPastel = Color(0xFFE8F0FE);
  static const Color skyText = Color(0xFF1A73E8);

  static const Color butterPastel = Color(0xFFFEF7E0);
  static const Color butterText = Color(0xFFB06000);

  static const Color lavenderPastel = Color(0xFFF3E8FF);
  static const Color lavenderText = Color(0xFF7C3AED);

  static const Color rosePastel = Color(0xFFFCE8E6);
  static const Color roseText = Color(0xFFD93025);

  // Typography Tokens
  static const Color fluentTextMain = Color(0xFF1F1F1F); // Fluent Dark 900
  static const Color fluentTextSecondary = Color(0xFF424242);
  static const Color fluentTextMuted = Color(0xFF616161);
  static const Color fluentTextSubtle = Color(0xFF707070);

  // Legacy mappings for full backward compatibility
  static const Color greenDark = fluentEmeraldDark;
  static const Color green = fluentEmerald;
  static const Color greenLight = mintPastel;
  static const Color greenSurface = Color(0xFFF0FDF4);

  static const Color userAccent = Color(0xFFD97706);
  static const Color userAccentSoft = Color(0xFFFEF3C7);

  static const Color red = Color(0xFFDC2626);
  static const Color redLight = Color(0xFFFEF2F2);
  static const Color amber = Color(0xFFD97706);
  static const Color amberLight = Color(0xFFFFFBEB);
  static const Color blue = Color(0xFF2563EB);
  static const Color blueLight = Color(0xFFEFF6FF);

  static const Color grayBorder = fluentBorder;
  static const Color grayLight = Color(0xFFF3F2F1);
  static const Color textMain = fluentTextMain;
  static const Color textMuted = fluentTextMuted;

  // Fluent 2 Dual Ambient Shadows
  static List<BoxShadow> get fluentShadow => const [
        BoxShadow(
          color: Color(0x0A0F172A),
          blurRadius: 8,
          offset: Offset(0, 2),
        ),
        BoxShadow(
          color: Color(0x080F172A),
          blurRadius: 2,
          offset: Offset(0, 1),
        ),
      ];

  static List<BoxShadow> get fluentShadowLg => const [
        BoxShadow(
          color: Color(0x140F172A),
          blurRadius: 24,
          offset: Offset(0, 10),
        ),
        BoxShadow(
          color: Color(0x0A0F172A),
          blurRadius: 6,
          offset: Offset(0, 2),
        ),
      ];

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: fluentSurface,
      primaryColor: fluentEmerald,
      colorScheme: ColorScheme.fromSeed(
        seedColor: fluentEmerald,
        primary: fluentEmerald,
        secondary: userAccent,
        surface: fluentCardBg,
        background: fluentSurface,
      ),
      fontFamily: 'Inter',
      appBarTheme: const AppBarTheme(
        backgroundColor: fluentSurface,
        foregroundColor: fluentTextMain,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.bold,
          color: fluentTextMain,
          letterSpacing: -0.2,
        ),
        iconTheme: IconThemeData(color: fluentTextMain),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: fluentBorder, width: 0.8),
        ),
        color: Colors.white,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: fluentEmerald,
          foregroundColor: Colors.white,
          elevation: 0,
          minimumSize: const Size(double.infinity, 50),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.2,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: const TextStyle(fontSize: 14, color: fluentTextMuted),
        hintStyle: const TextStyle(fontSize: 14, color: fluentTextSubtle),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: fluentBorder, width: 0.8),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: fluentBorder, width: 0.8),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: fluentEmerald, width: 1.8),
        ),
      ),
    );
  }
}

// ============================================================================
// REUSABLE FLUENT 2 WIDGETS
// ============================================================================

/// Fluent 2 Standard Card with 20px squircle corners & ambient shadow
class FluentCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final Border? border;
  final double radius;

  const FluentCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.backgroundColor,
    this.border,
    this.radius = 20.0,
  });

  @override
  Widget build(BuildContext context) {
    final cardContent = Container(
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: backgroundColor ?? Colors.white,
        borderRadius: BorderRadius.circular(radius),
        border: border ?? Border.all(color: AppTheme.fluentBorder, width: 0.8),
        boxShadow: AppTheme.fluentShadow,
      ),
      child: child,
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(radius),
          child: cardContent,
        ),
      );
    }
    return cardContent;
  }
}

/// Fluent 2 Squircle Icon Box with Pastel background
class FluentSquircleIcon extends StatelessWidget {
  final LucideIconName icon;
  final Color backgroundColor;
  final Color iconColor;
  final double size;
  final double iconSize;
  final double radius;

  const FluentSquircleIcon({
    super.key,
    required this.icon,
    this.backgroundColor = AppTheme.mintPastel,
    this.iconColor = AppTheme.mintText,
    this.size = 42.0,
    this.iconSize = 20.0,
    this.radius = 14.0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(radius),
      ),
      alignment: Alignment.center,
      child: LucideIcon(
        icon,
        size: iconSize,
        color: iconColor,
      ),
    );
  }
}
