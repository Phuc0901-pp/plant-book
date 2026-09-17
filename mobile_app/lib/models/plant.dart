class Plant {
  final int id;
  final String? treeCode;
  final String plantType;
  final String? plantVariety;
  final String? plantAge;
  final String healthStatus;
  final String? location;
  final int? farmId;
  final String? farmName;
  final double? latitude;
  final double? longitude;
  final String? nfcUid;
  final String? publicSlug;
  final String? lastWatered;
  final String? lastFertilized;
  final int? phiRemainingDays;

  Plant({
    required this.id,
    this.treeCode,
    required this.plantType,
    this.plantVariety,
    this.plantAge,
    required this.healthStatus,
    this.location,
    this.farmId,
    this.farmName,
    this.latitude,
    this.longitude,
    this.nfcUid,
    this.publicSlug,
    this.lastWatered,
    this.lastFertilized,
    this.phiRemainingDays,
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
      farmName: json['farm_name'] as String?,
      latitude: json['latitude'] != null ? double.tryParse(json['latitude'].toString()) : null,
      longitude: json['longitude'] != null ? double.tryParse(json['longitude'].toString()) : null,
      nfcUid: json['nfc_uid'] as String?,
      publicSlug: json['public_slug'] as String?,
      lastWatered: json['last_watered'] as String?,
      lastFertilized: json['last_fertilized'] as String?,
      phiRemainingDays: json['phi_remaining_days'] != null ? int.tryParse(json['phi_remaining_days'].toString()) : null,
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
      'farm_name': farmName,
      'latitude': latitude,
      'longitude': longitude,
      'nfc_uid': nfcUid,
      'public_slug': publicSlug,
      'last_watered': lastWatered,
      'last_fertilized': lastFertilized,
      'phi_remaining_days': phiRemainingDays,
    };
  }

  String get displayName => treeCode ?? id.toString();
}
