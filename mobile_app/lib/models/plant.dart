import 'dart:math';

/// Mô hình Thực thể Cây trồng / Lô Canh tác Chuẩn Quốc tế `v1.3.5`
/// Đồng bộ 100% với Web App (`user_dashboard.js` / `admin.js`) & PostgreSQL Schema:
/// - GS1 / W3C DID (`global_did`, `entity_class`, `plot_name`, `row_number`)
/// - Gallagher 8.30 & FIPS 201 PIV CHUID (`issue_level`, `card_type`, `chuid_hash`, `nfc_uid`)
/// - IPCC Tier-2 & Chave et al. (2014) Carbon MRV (`biomass_dbh_cm`, `canopy_height_m`, `estimatedAgbKg`, `estimatedCo2eKg`)
/// - VietGAP / GlobalG.A.P. PHI Lock (`phi_status`, `phi_until_date`, `phi_remaining_days`)
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

  // Các trường chuẩn hóa Enterprise v1.3.5
  final String? globalDid;
  final String entityClass;
  final String? plotName;
  final String? rowNumber;
  final double? biomassDbhCm;
  final double? canopyHeightM;
  final String? phiStatus;
  final String? phiUntilDate;
  final int issueLevel;
  final String cardType;
  final String? chuidHash;
  final String? publicUrl;
  final double? totalRevenue;
  final double? totalCost;

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
    this.globalDid,
    this.entityClass = 'PERENNIAL_TREE',
    this.plotName,
    this.rowNumber,
    this.biomassDbhCm,
    this.canopyHeightM,
    this.phiStatus,
    this.phiUntilDate,
    this.issueLevel = 1,
    this.cardType = 'NTAG213',
    this.chuidHash,
    this.publicUrl,
    this.totalRevenue,
    this.totalCost,
  });

  factory Plant.fromJson(Map<String, dynamic> json) {
    final int parsedId = json['id'] is int
        ? json['id'] as int
        : (int.tryParse(json['id']?.toString() ?? '0') ?? 0);
    final int? parsedFarmId = json['farm_id'] is int
        ? json['farm_id'] as int?
        : int.tryParse(json['farm_id']?.toString() ?? '');
    final String? parsedTreeCode = json['tree_code']?.toString();

    return Plant(
      id: parsedId,
      treeCode: parsedTreeCode,
      plantType: json['plant_type']?.toString() ?? 'Cây',
      plantVariety: json['plant_variety']?.toString(),
      plantAge: json['plant_age']?.toString(),
      healthStatus: json['health_status']?.toString() ?? 'Tốt',
      location: json['location']?.toString(),
      farmId: parsedFarmId,
      farmName: json['farm_name']?.toString(),
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
      nfcUid: json['nfc_uid']?.toString(),
      publicSlug: json['public_slug']?.toString(),
      lastWatered: json['last_watered']?.toString(),
      lastFertilized: json['last_fertilized']?.toString(),
      phiRemainingDays: json['phi_remaining_days'] != null
          ? int.tryParse(json['phi_remaining_days'].toString())
          : null,
      globalDid: json['global_did']?.toString() ??
          'did:gs1:vn:tbsg:farm-${parsedFarmId ?? 0}:tree-$parsedId',
      entityClass:
          json['entity_class']?.toString() ?? 'PERENNIAL_TREE',
      plotName: json['plot_name']?.toString(),
      rowNumber: json['row_number']?.toString(),
      biomassDbhCm: json['biomass_dbh_cm'] != null
          ? double.tryParse(json['biomass_dbh_cm'].toString())
          : null,
      canopyHeightM: json['canopy_height_m'] != null
          ? double.tryParse(json['canopy_height_m'].toString())
          : null,
      phiStatus: json['phi_status']?.toString(),
      phiUntilDate: json['phi_until_date']?.toString(),
      issueLevel: json['issue_level'] != null
          ? (int.tryParse(json['issue_level'].toString()) ?? 1)
          : 1,
      cardType: json['card_type']?.toString() ?? 'NTAG213',
      chuidHash: json['chuid_hash']?.toString(),
      publicUrl: json['public_url']?.toString(),
      totalRevenue: json['total_revenue'] != null
          ? double.tryParse(json['total_revenue'].toString())
          : null,
      totalCost: json['total_cost'] != null
          ? double.tryParse(json['total_cost'].toString())
          : null,
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
      'global_did': globalDid,
      'entity_class': entityClass,
      'plot_name': plotName,
      'row_number': rowNumber,
      'biomass_dbh_cm': biomassDbhCm,
      'canopy_height_m': canopyHeightM,
      'phi_status': phiStatus,
      'phi_until_date': phiUntilDate,
      'issue_level': issueLevel,
      'card_type': cardType,
      'chuid_hash': chuidHash,
      'public_url': publicUrl,
      'total_revenue': totalRevenue,
      'total_cost': totalCost,
    };
  }

  String get displayName => treeCode ?? id.toString();

  /// Trạng thái đang trong thời gian cách ly thuốc BVTV (Pre-Harvest Interval Lock).
  bool get isUnderPhiQuarantine {
    if ((phiRemainingDays ?? 0) > 0) return true;
    final String status = (phiStatus ?? '').toUpperCase();
    return status == 'LOCKED' || status == 'QUARANTINE' || status == 'WARNING';
  }

  /// Phương trình Sinh khối Quốc tế Chave et al. (2014) Pan-Tropical Allometric Equation
  /// & IPCC Tier-2:
  /// `AGB (kg) = 0.0673 * (rho * D^2 * H)^0.976`
  /// Trong đó:
  /// - `rho`: Mật độ gỗ đặc trưng cây ăn quả nhiệt đới (`0.58 g/cm3`)
  /// - `D`: Đường kính ngang ngực `biomassDbhCm` (mặc định ước tính theo tuổi cây nếu chưa đo trực tiếp)
  /// - `H`: Chiều cao vòm tán `canopyHeightM`
  double get estimatedAgbKg {
    const double woodDensityRho = 0.58;
    final double parsedAge =
        double.tryParse((plantAge ?? '').replaceAll(RegExp(r'[^0-9.]'), '')) ??
            4.0;
    final double dbh = (biomassDbhCm != null && biomassDbhCm! > 0)
        ? biomassDbhCm!
        : (8.0 + parsedAge * 2.4).clamp(6.0, 48.0);
    final double height = (canopyHeightM != null && canopyHeightM! > 0)
        ? canopyHeightM!
        : (2.2 + parsedAge * 0.55).clamp(2.0, 14.0);

    final double compound = woodDensityRho * dbh * dbh * height;
    return double.parse((0.0673 * pow(compound, 0.976)).toStringAsFixed(2));
  }

  /// Tổng Sinh khối quy đổi sang Tín chỉ Carbon hấp thụ (`kg CO2e`)
  /// Theo chuẩn IPCC 2006 / 2019 Refinement:
  /// - Below-Ground Biomass (BGB) = `0.24 * AGB`
  /// - Carbon Fraction (CF) = `0.47`
  /// - Hệ số chuyển đổi phân tử `CO2 / C` = `44 / 12 = 3.6667`
  double get estimatedCo2eKg {
    final double totalBiomassKg = estimatedAgbKg * 1.24;
    final double carbonStockKg = totalBiomassKg * 0.47;
    return double.parse((carbonStockKg * (44.0 / 12.0)).toStringAsFixed(2));
  }
}
