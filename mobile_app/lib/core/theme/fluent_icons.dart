import 'dart:math' as math;
import 'package:flutter/material.dart';

// ============================================================================
// MICROSOFT FLUENT 2 & LUCIDE ICONOGRAPHY FOR PLANT BOOK MOBILE
// ============================================================================

/// Lucide icon identifiers for type-safe rendering
enum LucideIconName {
  search,
  scan,
  mic,
  package,
  sparkles,
  calendar,
  clock,
  users,
  dollarSign,
  camera,
  check,
  alertTriangle,
  sprout,
  tree,
  droplet,
  droplets,
  fileText,
  settings,
  sun,
  cloudRain,
  cloudSun,
  wind,
  plus,
  arrowLeft,
  chevronRight,
  chevronDown,
  close,
  edit,
  trash,
  shield,
  mapPin,
  refreshCw,
  tag,
  beaker,
  scissors,
  heartHandshake,
}

/// Lucide-styled vector icon renderer with 1.8px round-cap strokes
class LucideIcon extends StatelessWidget {
  final LucideIconName name;
  final double size;
  final Color? color;
  final double strokeWidth;

  const LucideIcon(
    this.name, {
    super.key,
    this.size = 22.0,
    this.color,
    this.strokeWidth = 2.0,
  });

  @override
  Widget build(BuildContext context) {
    final iconColor = color ?? IconTheme.of(context).color ?? const Color(0xFF1F1F1F);
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _LucidePainter(
          name: name,
          color: iconColor,
          strokeWidth: strokeWidth,
        ),
      ),
    );
  }
}

class _LucidePainter extends CustomPainter {
  final LucideIconName name;
  final Color color;
  final double strokeWidth;

  _LucidePainter({
    required this.name,
    required this.color,
    required this.strokeWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth * (size.width / 24.0)
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final fillPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final s = size.width / 24.0; // scale factor based on 24x24 Lucide canvas

    switch (name) {
      case LucideIconName.search:
        canvas.drawCircle(Offset(11 * s, 11 * s), 7 * s, paint);
        canvas.drawLine(Offset(16 * s, 16 * s), Offset(21 * s, 21 * s), paint);
        break;

      case LucideIconName.scan:
        // 4 corner brackets
        canvas.drawLine(Offset(3 * s, 7 * s), Offset(3 * s, 3 * s), paint);
        canvas.drawLine(Offset(3 * s, 3 * s), Offset(7 * s, 3 * s), paint);
        canvas.drawLine(Offset(17 * s, 3 * s), Offset(21 * s, 3 * s), paint);
        canvas.drawLine(Offset(21 * s, 3 * s), Offset(21 * s, 7 * s), paint);
        canvas.drawLine(Offset(3 * s, 17 * s), Offset(3 * s, 21 * s), paint);
        canvas.drawLine(Offset(3 * s, 21 * s), Offset(7 * s, 21 * s), paint);
        canvas.drawLine(Offset(17 * s, 21 * s), Offset(21 * s, 21 * s), paint);
        canvas.drawLine(Offset(21 * s, 21 * s), Offset(21 * s, 17 * s), paint);
        // center line
        canvas.drawLine(Offset(7 * s, 12 * s), Offset(17 * s, 12 * s), paint);
        break;

      case LucideIconName.mic:
        final rrect = RRect.fromRectAndRadius(
          Rect.fromLTWH(9 * s, 2 * s, 6 * s, 12 * s),
          Radius.circular(3 * s),
        );
        canvas.drawRRect(rrect, paint);
        final arcPath = Path()
          ..moveTo(5 * s, 10 * s)
          ..arcToPoint(Offset(19 * s, 10 * s), radius: Radius.circular(7 * s), clockwise: false);
        canvas.drawPath(arcPath, paint);
        canvas.drawLine(Offset(12 * s, 17 * s), Offset(12 * s, 22 * s), paint);
        canvas.drawLine(Offset(8 * s, 22 * s), Offset(16 * s, 22 * s), paint);
        break;

      case LucideIconName.package:
        final path = Path()
          ..moveTo(12 * s, 2 * s)
          ..lineTo(21 * s, 7 * s)
          ..lineTo(21 * s, 17 * s)
          ..lineTo(12 * s, 22 * s)
          ..lineTo(3 * s, 17 * s)
          ..lineTo(3 * s, 7 * s)
          ..close();
        canvas.drawPath(path, paint);
        canvas.drawLine(Offset(3 * s, 7 * s), Offset(12 * s, 12 * s), paint);
        canvas.drawLine(Offset(12 * s, 12 * s), Offset(21 * s, 7 * s), paint);
        canvas.drawLine(Offset(12 * s, 12 * s), Offset(12 * s, 22 * s), paint);
        break;

      case LucideIconName.sparkles:
        // Main 4-point star
        final star1 = Path()
          ..moveTo(12 * s, 3 * s)
          ..quadraticBezierTo(12 * s, 12 * s, 21 * s, 12 * s)
          ..quadraticBezierTo(12 * s, 12 * s, 12 * s, 21 * s)
          ..quadraticBezierTo(12 * s, 12 * s, 3 * s, 12 * s)
          ..quadraticBezierTo(12 * s, 12 * s, 12 * s, 3 * s);
        canvas.drawPath(star1, paint);
        // Tiny accent star
        canvas.drawCircle(Offset(19 * s, 5 * s), 1.2 * s, fillPaint);
        break;

      case LucideIconName.calendar:
        final rrect = RRect.fromRectAndRadius(
          Rect.fromLTWH(3 * s, 4 * s, 18 * s, 17 * s),
          Radius.circular(3 * s),
        );
        canvas.drawRRect(rrect, paint);
        canvas.drawLine(Offset(3 * s, 10 * s), Offset(21 * s, 10 * s), paint);
        canvas.drawLine(Offset(8 * s, 2 * s), Offset(8 * s, 5 * s), paint);
        canvas.drawLine(Offset(16 * s, 2 * s), Offset(16 * s, 5 * s), paint);
        break;

      case LucideIconName.clock:
        canvas.drawCircle(Offset(12 * s, 12 * s), 9 * s, paint);
        canvas.drawLine(Offset(12 * s, 6 * s), Offset(12 * s, 12 * s), paint);
        canvas.drawLine(Offset(12 * s, 12 * s), Offset(16 * s, 14 * s), paint);
        break;

      case LucideIconName.users:
        // Primary user head & shoulder
        canvas.drawCircle(Offset(9 * s, 7 * s), 3.5 * s, paint);
        final p1 = Path()
          ..moveTo(2 * s, 20 * s)
          ..quadraticBezierTo(2 * s, 14 * s, 9 * s, 14 * s)
          ..quadraticBezierTo(16 * s, 14 * s, 16 * s, 20 * s);
        canvas.drawPath(p1, paint);
        // Second user outline
        final p2 = Path()
          ..moveTo(16 * s, 11 * s)
          ..arcToPoint(Offset(17 * s, 5 * s), radius: Radius.circular(3.5 * s), clockwise: true);
        canvas.drawPath(p2, paint);
        final p3 = Path()
          ..moveTo(17 * s, 14 * s)
          ..quadraticBezierTo(22 * s, 14 * s, 22 * s, 19 * s);
        canvas.drawPath(p3, paint);
        break;

      case LucideIconName.dollarSign:
        canvas.drawLine(Offset(12 * s, 2 * s), Offset(12 * s, 22 * s), paint);
        final sPath = Path()
          ..moveTo(16 * s, 6 * s)
          ..lineTo(10 * s, 6 * s)
          ..quadraticBezierTo(7.5 * s, 6 * s, 7.5 * s, 9 * s)
          ..quadraticBezierTo(7.5 * s, 11.5 * s, 12 * s, 12 * s)
          ..quadraticBezierTo(16.5 * s, 12.5 * s, 16.5 * s, 15 * s)
          ..quadraticBezierTo(16.5 * s, 18 * s, 14 * s, 18 * s)
          ..lineTo(8 * s, 18 * s);
        canvas.drawPath(sPath, paint);
        break;

      case LucideIconName.camera:
        final rrect = RRect.fromRectAndRadius(
          Rect.fromLTWH(3 * s, 7 * s, 18 * s, 13 * s),
          Radius.circular(3 * s),
        );
        canvas.drawRRect(rrect, paint);
        canvas.drawCircle(Offset(12 * s, 13.5 * s), 3.5 * s, paint);
        final topPlate = Path()
          ..moveTo(8 * s, 7 * s)
          ..lineTo(10 * s, 4 * s)
          ..lineTo(14 * s, 4 * s)
          ..lineTo(16 * s, 7 * s);
        canvas.drawPath(topPlate, paint);
        break;

      case LucideIconName.check:
        final path = Path()
          ..moveTo(4 * s, 12 * s)
          ..lineTo(9 * s, 17 * s)
          ..lineTo(20 * s, 6 * s);
        canvas.drawPath(path, paint);
        break;

      case LucideIconName.alertTriangle:
        final path = Path()
          ..moveTo(12 * s, 3 * s)
          ..lineTo(21 * s, 19 * s)
          ..lineTo(3 * s, 19 * s)
          ..close();
        canvas.drawPath(path, paint);
        canvas.drawLine(Offset(12 * s, 9 * s), Offset(12 * s, 13 * s), paint);
        canvas.drawCircle(Offset(12 * s, 16 * s), 1.0 * s, fillPaint);
        break;

      case LucideIconName.sprout:
        canvas.drawLine(Offset(12 * s, 10 * s), Offset(12 * s, 21 * s), paint);
        // Right leaf
        final rightLeaf = Path()
          ..moveTo(12 * s, 14 * s)
          ..quadraticBezierTo(20 * s, 14 * s, 20 * s, 8 * s)
          ..quadraticBezierTo(13 * s, 8 * s, 12 * s, 14 * s);
        canvas.drawPath(rightLeaf, paint);
        // Left leaf
        final leftLeaf = Path()
          ..moveTo(12 * s, 12 * s)
          ..quadraticBezierTo(4 * s, 12 * s, 4 * s, 6 * s)
          ..quadraticBezierTo(11 * s, 6 * s, 12 * s, 12 * s);
        canvas.drawPath(leftLeaf, paint);
        break;

      case LucideIconName.tree:
        final treeTop = Path()
          ..moveTo(12 * s, 3 * s)
          ..lineTo(18 * s, 10 * s)
          ..lineTo(15 * s, 10 * s)
          ..lineTo(20 * s, 16 * s)
          ..lineTo(4 * s, 16 * s)
          ..lineTo(9 * s, 10 * s)
          ..lineTo(6 * s, 10 * s)
          ..close();
        canvas.drawPath(treeTop, paint);
        canvas.drawLine(Offset(12 * s, 16 * s), Offset(12 * s, 21 * s), paint);
        break;

      case LucideIconName.droplet:
      case LucideIconName.droplets:
        final drop = Path()
          ..moveTo(12 * s, 3 * s)
          ..quadraticBezierTo(5 * s, 12 * s, 5 * s, 16 * s)
          ..arcToPoint(Offset(19 * s, 16 * s), radius: Radius.circular(7 * s), clockwise: false)
          ..quadraticBezierTo(19 * s, 12 * s, 12 * s, 3 * s);
        canvas.drawPath(drop, paint);
        break;

      case LucideIconName.fileText:
        final rrect = RRect.fromRectAndRadius(
          Rect.fromLTWH(4 * s, 3 * s, 16 * s, 18 * s),
          Radius.circular(2.5 * s),
        );
        canvas.drawRRect(rrect, paint);
        canvas.drawLine(Offset(8 * s, 8 * s), Offset(16 * s, 8 * s), paint);
        canvas.drawLine(Offset(8 * s, 12 * s), Offset(16 * s, 12 * s), paint);
        canvas.drawLine(Offset(8 * s, 16 * s), Offset(12 * s, 16 * s), paint);
        break;

      case LucideIconName.settings:
        canvas.drawCircle(Offset(12 * s, 12 * s), 4 * s, paint);
        final gear = Path()
          ..addOval(Rect.fromCircle(center: Offset(12 * s, 12 * s), radius: 8.5 * s));
        canvas.drawPath(gear, paint);
        break;

      case LucideIconName.sun:
        canvas.drawCircle(Offset(12 * s, 12 * s), 4.5 * s, paint);
        for (int i = 0; i < 8; i++) {
          final angle = (i * 45) * math.pi / 180;
          final x1 = 12 * s + 6.5 * s * math.cos(angle);
          final y1 = 12 * s + 6.5 * s * math.sin(angle);
          final x2 = 12 * s + 9.5 * s * math.cos(angle);
          final y2 = 12 * s + 9.5 * s * math.sin(angle);
          canvas.drawLine(Offset(x1, y1), Offset(x2, y2), paint);
        }
        break;

      case LucideIconName.cloudRain:
        final cloud = Path()
          ..moveTo(6 * s, 14 * s)
          ..arcToPoint(Offset(6 * s, 8 * s), radius: Radius.circular(4 * s))
          ..arcToPoint(Offset(15 * s, 6 * s), radius: Radius.circular(5 * s))
          ..arcToPoint(Offset(19 * s, 10 * s), radius: Radius.circular(3.5 * s))
          ..arcToPoint(Offset(18 * s, 14 * s), radius: Radius.circular(3.5 * s))
          ..close();
        canvas.drawPath(cloud, paint);
        canvas.drawLine(Offset(8 * s, 17 * s), Offset(7 * s, 20 * s), paint);
        canvas.drawLine(Offset(12 * s, 17 * s), Offset(11 * s, 20 * s), paint);
        canvas.drawLine(Offset(16 * s, 17 * s), Offset(15 * s, 20 * s), paint);
        break;

      case LucideIconName.cloudSun:
        final cloud = Path()
          ..moveTo(6 * s, 18 * s)
          ..lineTo(16 * s, 18 * s)
          ..arcToPoint(Offset(16 * s, 12 * s), radius: Radius.circular(4 * s))
          ..arcToPoint(Offset(10 * s, 11 * s), radius: Radius.circular(4 * s))
          ..arcToPoint(Offset(6 * s, 15 * s), radius: Radius.circular(3 * s))
          ..close();
        canvas.drawPath(cloud, paint);
        // Sun peeking
        canvas.drawArc(
          Rect.fromCircle(center: Offset(15 * s, 7 * s), radius: 3.5 * s),
          -math.pi * 0.8,
          math.pi * 1.2,
          false,
          paint,
        );
        break;

      case LucideIconName.wind:
        final p1 = Path()
          ..moveTo(3 * s, 8 * s)
          ..lineTo(14 * s, 8 * s)
          ..arcToPoint(Offset(14 * s, 5 * s), radius: Radius.circular(2.5 * s), clockwise: false);
        canvas.drawPath(p1, paint);
        final p2 = Path()
          ..moveTo(3 * s, 12 * s)
          ..lineTo(18 * s, 12 * s)
          ..arcToPoint(Offset(18 * s, 15 * s), radius: Radius.circular(2.5 * s));
        canvas.drawPath(p2, paint);
        break;

      case LucideIconName.plus:
        canvas.drawLine(Offset(12 * s, 5 * s), Offset(12 * s, 19 * s), paint);
        canvas.drawLine(Offset(5 * s, 12 * s), Offset(19 * s, 12 * s), paint);
        break;

      case LucideIconName.arrowLeft:
        canvas.drawLine(Offset(19 * s, 12 * s), Offset(5 * s, 12 * s), paint);
        canvas.drawLine(Offset(11 * s, 6 * s), Offset(5 * s, 12 * s), paint);
        canvas.drawLine(Offset(11 * s, 18 * s), Offset(5 * s, 12 * s), paint);
        break;

      case LucideIconName.chevronRight:
        final path = Path()
          ..moveTo(9 * s, 6 * s)
          ..lineTo(15 * s, 12 * s)
          ..lineTo(9 * s, 18 * s);
        canvas.drawPath(path, paint);
        break;

      case LucideIconName.chevronDown:
        final path = Path()
          ..moveTo(6 * s, 9 * s)
          ..lineTo(12 * s, 15 * s)
          ..lineTo(18 * s, 9 * s);
        canvas.drawPath(path, paint);
        break;

      case LucideIconName.close:
        canvas.drawLine(Offset(6 * s, 6 * s), Offset(18 * s, 18 * s), paint);
        canvas.drawLine(Offset(18 * s, 6 * s), Offset(6 * s, 18 * s), paint);
        break;

      case LucideIconName.edit:
        final path = Path()
          ..moveTo(4 * s, 20 * s)
          ..lineTo(8 * s, 20 * s)
          ..lineTo(19 * s, 9 * s)
          ..lineTo(15 * s, 5 * s)
          ..lineTo(4 * s, 16 * s)
          ..close();
        canvas.drawPath(path, paint);
        break;

      case LucideIconName.trash:
        canvas.drawLine(Offset(3 * s, 6 * s), Offset(21 * s, 6 * s), paint);
        final rrect = RRect.fromRectAndRadius(
          Rect.fromLTWH(6 * s, 6 * s, 12 * s, 15 * s),
          Radius.circular(2 * s),
        );
        canvas.drawRRect(rrect, paint);
        canvas.drawLine(Offset(10 * s, 10 * s), Offset(10 * s, 16 * s), paint);
        canvas.drawLine(Offset(14 * s, 10 * s), Offset(14 * s, 16 * s), paint);
        break;

      case LucideIconName.shield:
        final path = Path()
          ..moveTo(12 * s, 2 * s)
          ..lineTo(20 * s, 5 * s)
          ..quadraticBezierTo(20 * s, 14 * s, 12 * s, 22 * s)
          ..quadraticBezierTo(4 * s, 14 * s, 4 * s, 5 * s)
          ..close();
        canvas.drawPath(path, paint);
        break;

      case LucideIconName.mapPin:
        final path = Path()
          ..moveTo(12 * s, 2 * s)
          ..arcToPoint(Offset(12 * s, 14 * s), radius: Radius.circular(6 * s))
          ..lineTo(12 * s, 22 * s)
          ..lineTo(12 * s, 14 * s)
          ..arcToPoint(Offset(12 * s, 2 * s), radius: Radius.circular(6 * s));
        canvas.drawPath(path, paint);
        canvas.drawCircle(Offset(12 * s, 8 * s), 2.5 * s, paint);
        break;

      case LucideIconName.refreshCw:
        final arc = Path()
          ..addArc(Rect.fromCircle(center: Offset(12 * s, 12 * s), radius: 8 * s), 0.2, math.pi * 1.5);
        canvas.drawPath(arc, paint);
        canvas.drawLine(Offset(20 * s, 9 * s), Offset(20 * s, 14 * s), paint);
        canvas.drawLine(Offset(20 * s, 14 * s), Offset(15 * s, 14 * s), paint);
        break;

      case LucideIconName.tag:
        final path = Path()
          ..moveTo(3 * s, 3 * s)
          ..lineTo(10 * s, 3 * s)
          ..lineTo(21 * s, 14 * s)
          ..lineTo(14 * s, 21 * s)
          ..lineTo(3 * s, 10 * s)
          ..close();
        canvas.drawPath(path, paint);
        canvas.drawCircle(Offset(7 * s, 7 * s), 1.5 * s, fillPaint);
        break;

      case LucideIconName.beaker:
        final path = Path()
          ..moveTo(8 * s, 3 * s)
          ..lineTo(16 * s, 3 * s)
          ..moveTo(10 * s, 3 * s)
          ..lineTo(10 * s, 8 * s)
          ..lineTo(4 * s, 19 * s)
          ..quadraticBezierTo(4 * s, 21 * s, 6 * s, 21 * s)
          ..lineTo(18 * s, 21 * s)
          ..quadraticBezierTo(20 * s, 21 * s, 20 * s, 19 * s)
          ..lineTo(14 * s, 8 * s)
          ..lineTo(14 * s, 3 * s);
        canvas.drawPath(path, paint);
        break;

      case LucideIconName.scissors:
        canvas.drawCircle(Offset(6 * s, 7 * s), 3 * s, paint);
        canvas.drawCircle(Offset(6 * s, 17 * s), 3 * s, paint);
        canvas.drawLine(Offset(8.5 * s, 8.5 * s), Offset(19 * s, 18 * s), paint);
        canvas.drawLine(Offset(8.5 * s, 15.5 * s), Offset(19 * s, 6 * s), paint);
        break;

      case LucideIconName.heartHandshake:
        canvas.drawCircle(Offset(8 * s, 10 * s), 3 * s, paint);
        canvas.drawCircle(Offset(16 * s, 10 * s), 3 * s, paint);
        final base = Path()
          ..moveTo(3 * s, 19 * s)
          ..lineTo(8 * s, 14 * s)
          ..lineTo(12 * s, 17 * s)
          ..lineTo(16 * s, 14 * s)
          ..lineTo(21 * s, 19 * s);
        canvas.drawPath(base, paint);
        break;
    }
  }

  @override
  bool shouldRepaint(covariant _LucidePainter oldDelegate) {
    return oldDelegate.name != name ||
        oldDelegate.color != color ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}

// ============================================================================
// CUTE PROFESSIONAL CHIBI WEATHER WIDGETS (MẶT TRỜI, MÂY MƯA, GIỌT SƯƠNG)
// ============================================================================

/// Cute Chibi Weather Icon Type
enum ChibiWeatherType {
  sun,
  rain,
  cloudSun,
  humidity,
  wind,
}

class ChibiWeatherWidget extends StatefulWidget {
  final ChibiWeatherType type;
  final double size;

  const ChibiWeatherWidget({
    super.key,
    required this.type,
    this.size = 54.0,
  });

  @override
  State<ChibiWeatherWidget> createState() => _ChibiWeatherWidgetState();
}

class _ChibiWeatherWidgetState extends State<ChibiWeatherWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animController,
      builder: (context, child) {
        final floatOffset = math.sin(_animController.value * math.pi) * 3.0;
        return Transform.translate(
          offset: Offset(0, -floatOffset),
          child: SizedBox(
            width: widget.size,
            height: widget.size,
            child: CustomPaint(
              painter: _ChibiWeatherPainter(
                type: widget.type,
                animValue: _animController.value,
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ChibiWeatherPainter extends CustomPainter {
  final ChibiWeatherType type;
  final double animValue;

  _ChibiWeatherPainter({
    required this.type,
    required this.animValue,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    switch (type) {
      case ChibiWeatherType.sun:
        _drawChibiSun(canvas, w, h);
        break;
      case ChibiWeatherType.rain:
        _drawChibiRain(canvas, w, h);
        break;
      case ChibiWeatherType.cloudSun:
        _drawChibiCloudSun(canvas, w, h);
        break;
      case ChibiWeatherType.humidity:
        _drawChibiHumidity(canvas, w, h);
        break;
      case ChibiWeatherType.wind:
        _drawChibiWind(canvas, w, h);
        break;
    }
  }

  void _drawChibiSun(Canvas canvas, double w, double h) {
    final cx = w * 0.5;
    final cy = h * 0.5;
    final r = w * 0.32;

    // Soft animated rays
    final rayPaint = Paint()
      ..color = const Color(0xFFFDE047).withOpacity(0.65)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;

    final rayRot = animValue * 0.15;
    for (int i = 0; i < 8; i++) {
      final angle = (i * 45) * math.pi / 180 + rayRot;
      final x1 = cx + (r + 4) * math.cos(angle);
      final y1 = cy + (r + 4) * math.sin(angle);
      final x2 = cx + (r + 10) * math.cos(angle);
      final y2 = cy + (r + 10) * math.sin(angle);
      canvas.drawLine(Offset(x1, y1), Offset(x2, y2), rayPaint);
    }

    // Warm Sun Body Gradient
    final sunGrad = const RadialGradient(
      colors: [Color(0xFFFEF08A), Color(0xFFFBBF24), Color(0xFFF59E0B)],
      stops: [0.2, 0.7, 1.0],
    ).createShader(Rect.fromCircle(center: Offset(cx, cy), radius: r));

    final sunPaint = Paint()..shader = sunGrad;
    canvas.drawCircle(Offset(cx, cy), r, sunPaint);

    // Glowing white top highlight
    final highlightPaint = Paint()
      ..color = Colors.white.withOpacity(0.55)
      ..style = PaintingStyle.fill;
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx, cy - r * 0.5), width: r * 0.9, height: r * 0.45),
      highlightPaint,
    );

    // Cute Blushing Cheeks (Pink kawaii)
    final blushPaint = Paint()
      ..color = const Color(0xFFFB7185).withOpacity(0.6)
      ..style = PaintingStyle.fill;
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx - r * 0.48, cy + r * 0.18), width: 9, height: 5.5),
      blushPaint,
    );
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx + r * 0.48, cy + r * 0.18), width: 9, height: 5.5),
      blushPaint,
    );

    // Cute Kawaii Eyes (Blinking twinkle)
    final eyePaint = Paint()
      ..color = const Color(0xFF78350F)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(cx - r * 0.28, cy - r * 0.05), 2.8, eyePaint);
    canvas.drawCircle(Offset(cx + r * 0.28, cy - r * 0.05), 2.8, eyePaint);
    // Eye twinkle dots
    final twinklePaint = Paint()..color = Colors.white;
    canvas.drawCircle(Offset(cx - r * 0.28 + 0.8, cy - r * 0.05 - 0.8), 1.0, twinklePaint);
    canvas.drawCircle(Offset(cx + r * 0.28 + 0.8, cy - r * 0.05 - 0.8), 1.0, twinklePaint);

    // Cute Happy Smile Curve
    final smilePaint = Paint()
      ..color = const Color(0xFF78350F)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round;

    final smilePath = Path()
      ..moveTo(cx - 5.5, cy + 3.5)
      ..quadraticBezierTo(cx, cy + 9.0, cx + 5.5, cy + 3.5);
    canvas.drawPath(smilePath, smilePaint);
  }

  void _drawChibiRain(Canvas canvas, double w, double h) {
    // Cute puffy blue cloud
    final cx = w * 0.5;
    final cy = h * 0.42;

    final cloudGrad = const LinearGradient(
      colors: [Color(0xFFE0F2FE), Color(0xFFBAE6FD), Color(0xFF7DD3FC)],
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
    ).createShader(Rect.fromLTWH(w * 0.1, h * 0.15, w * 0.8, h * 0.5));

    final cloudPaint = Paint()..shader = cloudGrad;

    // Draw multi-circle cloud
    final cloudPath = Path()
      ..addOval(Rect.fromCenter(center: Offset(cx, cy + 4), width: w * 0.72, height: h * 0.38))
      ..addOval(Rect.fromCenter(center: Offset(cx - 12, cy - 3), width: w * 0.42, height: h * 0.38))
      ..addOval(Rect.fromCenter(center: Offset(cx + 10, cy - 6), width: w * 0.48, height: h * 0.42));
    canvas.drawPath(cloudPath, cloudPaint);

    // Blush
    final blush = Paint()..color = const Color(0xFFF472B6).withOpacity(0.55);
    canvas.drawOval(Rect.fromCenter(center: Offset(cx - 13, cy + 7), width: 7, height: 4), blush);
    canvas.drawOval(Rect.fromCenter(center: Offset(cx + 13, cy + 7), width: 7, height: 4), blush);

    // Eyes
    final eyePaint = Paint()..color = const Color(0xFF0369A1);
    canvas.drawCircle(Offset(cx - 7, cy + 3), 2.4, eyePaint);
    canvas.drawCircle(Offset(cx + 7, cy + 3), 2.4, eyePaint);
    canvas.drawCircle(Offset(cx - 6.2, cy + 2.2), 0.8, Paint()..color = Colors.white);
    canvas.drawCircle(Offset(cx + 7.8, cy + 2.2), 0.8, Paint()..color = Colors.white);

    // Sweet smile
    final smile = Paint()
      ..color = const Color(0xFF0369A1)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;
    final p = Path()
      ..moveTo(cx - 4, cy + 6.5)
      ..quadraticBezierTo(cx, cy + 10.5, cx + 4, cy + 6.5);
    canvas.drawPath(p, smile);

    // Falling raindrops
    final dropPaint = Paint()
      ..color = const Color(0xFF38BDF8)
      ..style = PaintingStyle.fill;

    final dropY1 = h * 0.74 + (animValue * 5);
    final dropY2 = h * 0.80 + ((1 - animValue) * 5);

    _drawSingleDrop(canvas, cx - 14, dropY1, 4.0, dropPaint);
    _drawSingleDrop(canvas, cx, dropY2, 5.0, dropPaint);
    _drawSingleDrop(canvas, cx + 14, dropY1, 4.0, dropPaint);
  }

  void _drawSingleDrop(Canvas canvas, double x, double y, double r, Paint paint) {
    final path = Path()
      ..moveTo(x, y - r * 1.5)
      ..quadraticBezierTo(x - r, y, x - r, y + r * 0.5)
      ..arcToPoint(Offset(x + r, y + r * 0.5), radius: Radius.circular(r), clockwise: false)
      ..quadraticBezierTo(x + r, y, x, y - r * 1.5);
    canvas.drawPath(path, paint);
  }

  void _drawChibiCloudSun(Canvas canvas, double w, double h) {
    _drawChibiSun(canvas, w * 0.85, h * 0.85);
    _drawChibiRain(canvas, w * 0.8, h * 0.8);
  }

  void _drawChibiHumidity(Canvas canvas, double w, double h) {
    final cx = w * 0.5;
    final cy = h * 0.5;
    final r = w * 0.32;

    // Teardrop body
    final dropGrad = const LinearGradient(
      colors: [Color(0xFFBAE6FD), Color(0xFF38BDF8), Color(0xFF0284C7)],
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
    ).createShader(Rect.fromLTWH(cx - r, cy - r * 1.2, r * 2, r * 2.4));

    final dropPath = Path()
      ..moveTo(cx, cy - r * 1.3)
      ..quadraticBezierTo(cx - r * 1.1, cy, cx - r * 1.1, cy + r * 0.5)
      ..arcToPoint(Offset(cx + r * 1.1, cy + r * 0.5), radius: Radius.circular(r * 1.1), clockwise: false)
      ..quadraticBezierTo(cx + r * 1.1, cy, cx, cy - r * 1.3);

    canvas.drawPath(dropPath, Paint()..shader = dropGrad);

    // Glistening highlight
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx - r * 0.45, cy - r * 0.2), width: 6, height: 12),
      Paint()..color = Colors.white.withOpacity(0.6),
    );

    // Cheeks
    final blush = Paint()..color = const Color(0xFFFB7185).withOpacity(0.5);
    canvas.drawOval(Rect.fromCenter(center: Offset(cx - r * 0.5, cy + r * 0.35), width: 8, height: 5), blush);
    canvas.drawOval(Rect.fromCenter(center: Offset(cx + r * 0.5, cy + r * 0.35), width: 8, height: 5), blush);

    // Eyes
    canvas.drawCircle(Offset(cx - r * 0.25, cy + r * 0.15), 2.8, Paint()..color = const Color(0xFF0C4A6E));
    canvas.drawCircle(Offset(cx + r * 0.25, cy + r * 0.15), 2.8, Paint()..color = const Color(0xFF0C4A6E));
    canvas.drawCircle(Offset(cx - r * 0.25 + 0.8, cy + r * 0.15 - 0.8), 1.0, Paint()..color = Colors.white);
    canvas.drawCircle(Offset(cx + r * 0.25 + 0.8, cy + r * 0.15 - 0.8), 1.0, Paint()..color = Colors.white);

    // Smile
    final smile = Paint()
      ..color = const Color(0xFF0C4A6E)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round;
    final p = Path()
      ..moveTo(cx - 4.5, cy + r * 0.32)
      ..quadraticBezierTo(cx, cy + r * 0.52, cx + 4.5, cy + r * 0.32);
    canvas.drawPath(p, smile);
  }

  void _drawChibiWind(Canvas canvas, double w, double h) {
    final cx = w * 0.5;
    final cy = h * 0.5;

    final windPaint = Paint()
      ..color = const Color(0xFF34D399)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.2
      ..strokeCap = StrokeCap.round;

    final p1 = Path()
      ..moveTo(w * 0.15, cy - 8)
      ..lineTo(w * 0.65, cy - 8)
      ..arcToPoint(Offset(w * 0.65, cy - 18), radius: const Radius.circular(5), clockwise: false);
    canvas.drawPath(p1, windPaint);

    final p2 = Path()
      ..moveTo(w * 0.25, cy + 6)
      ..lineTo(w * 0.82, cy + 6)
      ..arcToPoint(Offset(w * 0.82, cy + 16), radius: const Radius.circular(5));
    canvas.drawPath(p2, windPaint);

    // Cute flying sprout leaf
    final leaf = Path()
      ..moveTo(cx + 8, cy - 14)
      ..quadraticBezierTo(cx + 20, cy - 14, cx + 20, cy - 22)
      ..quadraticBezierTo(cx + 10, cy - 22, cx + 8, cy - 14);
    canvas.drawPath(leaf, Paint()..color = const Color(0xFF10B981));
  }

  @override
  bool shouldRepaint(covariant _ChibiWeatherPainter oldDelegate) {
    return oldDelegate.type != type || oldDelegate.animValue != animValue;
  }
}

// ============================================================================
// OFFICIAL MASCOT: BÉ MẦM (FLUENT AI ASSISTANT AVATAR)
// ============================================================================

class BeMamMascotWidget extends StatefulWidget {
  final double size;
  final VoidCallback? onTap;

  const BeMamMascotWidget({
    super.key,
    this.size = 64.0,
    this.onTap,
  });

  @override
  State<BeMamMascotWidget> createState() => _BeMamMascotWidgetState();
}

class _BeMamMascotWidgetState extends State<BeMamMascotWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final floatOffset = math.sin(_controller.value * math.pi) * 4.0;
          return Transform.translate(
            offset: Offset(0, -floatOffset),
            child: SizedBox(
              width: widget.size,
              height: widget.size,
              child: CustomPaint(
                painter: _BeMamPainter(animValue: _controller.value),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _BeMamPainter extends CustomPainter {
  final double animValue;

  _BeMamPainter({required this.animValue});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final cx = w * 0.5;
    final cy = h * 0.58;

    // Ambient glow circle
    canvas.drawCircle(
      Offset(cx, cy),
      w * 0.42,
      Paint()..color = Colors.white.withOpacity(0.85),
    );

    // Sprout Leaves on Head
    final stemPaint = Paint()
      ..color = const Color(0xFF059669)
      ..strokeWidth = 3.0 * (w / 80)
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(cx, cy - h * 0.28), Offset(cx, cy - h * 0.18), stemPaint);

    // Left Leaf
    final leftLeaf = Path()
      ..moveTo(cx, cy - h * 0.28)
      ..quadraticBezierTo(cx - w * 0.22, cy - h * 0.44, cx - w * 0.20, cy - h * 0.32)
      ..quadraticBezierTo(cx - w * 0.10, cy - h * 0.22, cx, cy - h * 0.28);
    canvas.drawPath(leftLeaf, Paint()..color = const Color(0xFF34D399));

    // Right Leaf
    final rightLeaf = Path()
      ..moveTo(cx, cy - h * 0.28)
      ..quadraticBezierTo(cx + w * 0.22, cy - h * 0.46, cx + w * 0.22, cy - h * 0.34)
      ..quadraticBezierTo(cx + w * 0.10, cy - h * 0.22, cx, cy - h * 0.28);
    canvas.drawPath(rightLeaf, Paint()..color = const Color(0xFF10B981));

    // Round Baby Body
    final bodyR = w * 0.30;
    final bodyPaint = Paint()
      ..color = const Color(0xFFA7F3D0)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(cx, cy), bodyR, bodyPaint);

    final strokePaint = Paint()
      ..color = const Color(0xFF10B981)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4 * (w / 80);
    canvas.drawCircle(Offset(cx, cy), bodyR, strokePaint);

    // Blush Cheeks
    final blush = Paint()..color = const Color(0xFFFB7185).withOpacity(0.55);
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx - bodyR * 0.55, cy + bodyR * 0.2), width: 9 * (w / 80), height: 5.5 * (w / 80)),
      blush,
    );
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx + bodyR * 0.55, cy + bodyR * 0.2), width: 9 * (w / 80), height: 5.5 * (w / 80)),
      blush,
    );

    // Big Kawaii Sparkling Eyes
    final eyePaint = Paint()..color = const Color(0xFF064E3B);
    final eyeL = Offset(cx - bodyR * 0.32, cy - bodyR * 0.05);
    final eyeR = Offset(cx + bodyR * 0.32, cy - bodyR * 0.05);
    canvas.drawCircle(eyeL, 3.2 * (w / 80), eyePaint);
    canvas.drawCircle(eyeR, 3.2 * (w / 80), eyePaint);

    // Glistening white sparkles in eyes
    final twinkle = Paint()..color = Colors.white;
    canvas.drawCircle(Offset(eyeL.dx + 1.0, eyeL.dy - 1.0), 1.2 * (w / 80), twinkle);
    canvas.drawCircle(Offset(eyeR.dx + 1.0, eyeR.dy - 1.0), 1.2 * (w / 80), twinkle);

    // Cute Happy Smile
    final smile = Paint()
      ..color = const Color(0xFF064E3B)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4 * (w / 80)
      ..strokeCap = StrokeCap.round;
    final p = Path()
      ..moveTo(cx - 5.5 * (w / 80), cy + bodyR * 0.22)
      ..quadraticBezierTo(cx, cy + bodyR * 0.45, cx + 5.5 * (w / 80), cy + bodyR * 0.22);
    canvas.drawPath(p, smile);
  }

  @override
  bool shouldRepaint(covariant _BeMamPainter oldDelegate) {
    return oldDelegate.animValue != animValue;
  }
}
