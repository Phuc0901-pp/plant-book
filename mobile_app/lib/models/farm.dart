class Farm {
  final int id;
  final String name;
  final String? description;
  final String? polygonCoordinates;
  final double? area;
  final int? userId;
  final double? latitude;
  final double? longitude;
  final int? plantCount;
  final bool allowViewPlants;
  final bool allowSharedHistory;
  final bool allowSharedSupplies;

  // Chuẩn mở rộng v1.3.5 (GS1 PUC / VietGAP / EUDR Polygon)
  final String? pucCode;
  final String? vietgapCertCode;
  final String? ownerName;
  final String? createdAt;

  Farm({
    required this.id,
    required this.name,
    this.description,
    this.polygonCoordinates,
    this.area,
    this.userId,
    this.latitude,
    this.longitude,
    this.plantCount,
    this.allowViewPlants = true,
    this.allowSharedHistory = true,
    this.allowSharedSupplies = true,
    this.pucCode,
    this.vietgapCertCode,
    this.ownerName,
    this.createdAt,
  });

  factory Farm.fromJson(Map<String, dynamic> json) {
    return Farm(
      id: json['id'] is int
          ? json['id'] as int
          : (int.tryParse(json['id']?.toString() ?? '0') ?? 0),
      name: json['name'] as String? ?? '—',
      description: json['description'] as String?,
      polygonCoordinates: json['polygon_coordinates']?.toString(),
      area: json['area'] != null
          ? double.tryParse(json['area'].toString())
          : null,
      userId: json['user_id'] is int
          ? json['user_id'] as int?
          : int.tryParse(json['user_id']?.toString() ?? ''),
      latitude: json['latitude'] != null
          ? double.tryParse(json['latitude'].toString())
          : (json['lat'] != null
              ? double.tryParse(json['lat'].toString())
              : null),
      longitude: json['longitude'] != null
          ? double.tryParse(json['longitude'].toString())
          : (json['lng'] != null
              ? double.tryParse(json['lng'].toString())
              : null),
      plantCount: json['plant_count'] is int
          ? json['plant_count'] as int?
          : int.tryParse(json['plant_count']?.toString() ?? ''),
      allowViewPlants: json['allow_view_plants'] ?? true,
      allowSharedHistory: json['allow_shared_history'] ?? true,
      allowSharedSupplies: json['allow_shared_supplies'] ?? true,
      pucCode: json['puc_code']?.toString(),
      vietgapCertCode: json['vietgap_cert_code']?.toString(),
      ownerName: json['owner_name']?.toString(),
      createdAt: json['created_at']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'polygon_coordinates': polygonCoordinates,
      'area': area,
      'user_id': userId,
      'latitude': latitude,
      'longitude': longitude,
      'plant_count': plantCount,
      'allow_view_plants': allowViewPlants,
      'allow_shared_history': allowSharedHistory,
      'allow_shared_supplies': allowSharedSupplies,
      'puc_code': pucCode,
      'vietgap_cert_code': vietgapCertCode,
      'owner_name': ownerName,
      'created_at': createdAt,
    };
  }
}
