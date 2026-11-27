import 'dart:math' as math;
import '../core/state/app_state_and_concepts.dart';

class GeoFenceResult {
  final bool isWithinGeofence;
  final double? distanceMeters;
  final double allowedRadiusMeters;
  final String message;
  final String status;

  const GeoFenceResult({
    required this.isWithinGeofence,
    this.distanceMeters,
    this.allowedRadiusMeters = AppConcepts.nfcGeofenceMaxMeters,
    required this.message,
    required this.status,
  });
}

class GeoPosition {
  final double latitude;
  final double longitude;
  const GeoPosition({required this.latitude, required this.longitude});
}

class GeoFenceService {
  static const double defaultGeofenceRadiusMeters =
      AppConcepts.nfcGeofenceMaxMeters;

  final Future<GeoPosition?> Function()? _positionProvider;

  GeoFenceService({Future<GeoPosition?> Function()? positionProvider})
      : _positionProvider = positionProvider;

  bool get hasPositionProvider => _positionProvider != null;

  Future<GeoPosition?> getCurrentPositionSafe() async {
    if (_positionProvider == null) return null;
    try {
      return await _positionProvider!();
    } catch (_) {
      return null;
    }
  }

  static double? calculateHaversineDistance({
    required double? lat1,
    required double? lng1,
    required double? lat2,
    required double? lng2,
  }) {
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
      return null;
    }

    double pLat1 = lat1;
    double pLng1 = lng1;
    double pLat2 = lat2;
    double pLng2 = lng2;

    if (pLat1.abs() > 90 && pLng1.abs() <= 90) {
      final tmp = pLat1;
      pLat1 = pLng1;
      pLng1 = tmp;
    }
    if (pLat2.abs() > 90 && pLng2.abs() <= 90) {
      final tmp = pLat2;
      pLat2 = pLng2;
      pLng2 = tmp;
    }

    const double earthRadiusMeters = 6371000.0;
    final double dLat = _toRadians(pLat2 - pLat1);
    final double dLng = _toRadians(pLng2 - pLng1);

    final double a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_toRadians(pLat1)) *
            math.cos(_toRadians(pLat2)) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);

    final double c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    final double distance = earthRadiusMeters * c;

    return (distance * 10).round() / 10.0;
  }

  static GeoFenceResult evaluateGeofence({
    required double? plantLat,
    required double? plantLng,
    required double? scanLat,
    required double? scanLng,
    double allowedRadius = defaultGeofenceRadiusMeters,
    bool hasGpsProvider = true,
  }) {
    if (plantLat == null || plantLng == null) {
      return GeoFenceResult(
        isWithinGeofence: true,
        allowedRadiusMeters: allowedRadius,
        message: 'Cây chưa thiết lập tọa độ GPS cố định. Cho phép truy cập.',
        status: AppConcepts.geoStatusNoGpsData,
      );
    }

    if (!hasGpsProvider && (scanLat == null || scanLng == null)) {
      return GeoFenceResult(
        isWithinGeofence: true,
        allowedRadiusMeters: allowedRadius,
        message:
            'Thiết bị chưa cấu hình dịch vụ định vị GPS thực địa. Cho phép truy cập theo mã thẻ.',
        status: AppConcepts.geoStatusNoGpsProvider,
      );
    }

    if (scanLat == null || scanLng == null) {
      return GeoFenceResult(
        isWithinGeofence: true,
        allowedRadiusMeters: allowedRadius,
        message: 'Không nhận diện được GPS thiết bị. Cho phép truy cập theo mã thẻ.',
        status: AppConcepts.geoStatusNoGpsData,
      );
    }

    final double? distance = calculateHaversineDistance(
      lat1: scanLat,
      lng1: scanLng,
      lat2: plantLat,
      lng2: plantLng,
    );

    if (distance == null) {
      return GeoFenceResult(
        isWithinGeofence: true,
        allowedRadiusMeters: allowedRadius,
        message: 'Tọa độ GPS không hợp lệ.',
        status: AppConcepts.geoStatusNoGpsData,
      );
    }

    if (distance <= allowedRadius) {
      return GeoFenceResult(
        isWithinGeofence: true,
        distanceMeters: distance,
        allowedRadiusMeters: allowedRadius,
        message:
            'Vị trí hợp lệ: Đúng gốc cây (Cách ${distance.toStringAsFixed(1)}m ≤ ${allowedRadius.toStringAsFixed(0)}m)',
        status: AppConcepts.geoStatusVerifiedOk,
      );
    } else {
      return GeoFenceResult(
        isWithinGeofence: false,
        distanceMeters: distance,
        allowedRadiusMeters: allowedRadius,
        message:
            'Vị trí lệch: Bạn đang cách gốc cây ${distance.toStringAsFixed(1)}m (Vượt quá bán kính quy định ≤ ${allowedRadius.toStringAsFixed(0)}m).',
        status: AppConcepts.geoStatusExceeded,
      );
    }
  }

  static double _toRadians(double degree) {
    return degree * (math.pi / 180.0);
  }
}
