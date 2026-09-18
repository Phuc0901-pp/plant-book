import 'dart:math' as math;

class GeoFenceResult {
  final bool isWithinGeofence;
  final double? distanceMeters;
  final double allowedRadiusMeters;
  final String message;
  final String status; // 'VERIFIED_OK', 'GEOFENCE_EXCEEDED', 'NO_GPS_DATA'

  const GeoFenceResult({
    required this.isWithinGeofence,
    this.distanceMeters,
    this.allowedRadiusMeters = 8.0,
    required this.message,
    required this.status,
  });
}

class GeoFenceService {
  static const double defaultGeofenceRadiusMeters = 8.0;

  /// Calculates Haversine distance in meters between two GPS coordinates
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

    // Handle swapped coordinates (lat > 90)
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

    return (distance * 10).round() / 10.0; // 1 decimal place
  }

  /// Evaluates whether scan position is within plant's allowed geofence radius (<= 8.0m)
  static GeoFenceResult evaluateGeofence({
    required double? plantLat,
    required double? plantLng,
    required double? scanLat,
    required double? scanLng,
    double allowedRadius = defaultGeofenceRadiusMeters,
  }) {
    if (plantLat == null || plantLng == null) {
      return GeoFenceResult(
        isWithinGeofence: true,
        allowedRadiusMeters: allowedRadius,
        message: 'Cây chưa thiết lập tọa độ GPS cố định. Cho phép truy cập.',
        status: 'NO_GPS_DATA',
      );
    }

    if (scanLat == null || scanLng == null) {
      return GeoFenceResult(
        isWithinGeofence: true,
        allowedRadiusMeters: allowedRadius,
        message: 'Không nhận diện được GPS thiết bị. Cho phép truy cập theo mã thẻ.',
        status: 'NO_GPS_DATA',
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
        status: 'NO_GPS_DATA',
      );
    }

    if (distance <= allowedRadius) {
      return GeoFenceResult(
        isWithinGeofence: true,
        distanceMeters: distance,
        allowedRadiusMeters: allowedRadius,
        message: 'Vị trí hợp lệ: Đúng gốc cây (Cách ${distance.toStringAsFixed(1)}m ≤ ${allowedRadius.toStringAsFixed(0)}m)',
        status: 'VERIFIED_OK',
      );
    } else {
      return GeoFenceResult(
        isWithinGeofence: false,
        distanceMeters: distance,
        allowedRadiusMeters: allowedRadius,
        message: 'Vị trí lệch: Bạn đang cách gốc cây ${distance.toStringAsFixed(1)}m (Vượt quá bán kính quy định ≤ ${allowedRadius.toStringAsFixed(0)}m).',
        status: 'GEOFENCE_EXCEEDED',
      );
    }
  }

  static double _toRadians(double degree) {
    return degree * (math.pi / 180.0);
  }
}
