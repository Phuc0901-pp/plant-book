class Plant {
  final int id;
  final String? treeCode;
  final String plantType;
  final String? plantVariety;
  final String? plantAge;
  final String healthStatus;
  final String? location;
  final int? farmId;
  final double? latitude;
  final double? longitude;
  final String? lastWatered;
  final String? lastFertilized;

  Plant({
    required this.id,
    this.treeCode,
    required this.plantType,
    this.plantVariety,
    this.plantAge,
    required this.healthStatus,
    this.location,
    this.farmId,
    this.latitude,
    this.longitude,
    this.lastWatered,
    this.lastFertilized,
  });

  factory Plant.fromJson(Map<String, dynamic> json) {
    return Plant(
      id: json['id'] as int,
      treeCode: json['tree_code'] as String?,
      plantType: json['plant_type'] as String? ?? 'Cây',
      plantVariety: json['plant_variety'] as String?,
      plantAge: json['plant_age']?.toString(),
      healthStatus: json['health_status'] as String? ?? 'Tốt',
      location: json['location'] as String?,
      farmId: json['farm_id'] as int?,
      latitude: json['latitude'] != null ? double.tryParse(json['latitude'].toString()) : null,
      longitude: json['longitude'] != null ? double.tryParse(json['longitude'].toString()) : null,
      lastWatered: json['last_watered'] as String?,
      lastFertilized: json['last_fertilized'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'tree_code': treeCode,
      'plant_type': plantType,
      'plant_variety': plantVariety,
      'plant_age': plantAge,
      'health_status': healthStatus,
      'location': location,
      'farm_id': farmId,
      'latitude': latitude,
      'longitude': longitude,
      'last_watered': lastWatered,
      'last_fertilized': lastFertilized,
    };
  }

  String get displayName => treeCode ?? id.toString();
}
