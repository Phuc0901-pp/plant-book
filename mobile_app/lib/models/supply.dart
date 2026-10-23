class Supply {
  final int id;
  final int userId;
  final String category;
  final String name;
  final String unit;
  final String? packageSize;
  final double packageQty;
  final String packageUnit;
  final double packagePrice;
  final double unitPrice;
  final double unitPriceSmall;
  final double stockQuantity;
  final String? note;
  final String? imageUrl;
  final String? activeIngredient;
  final double totalSpent;
  final double totalUsedQty;

  // Chuẩn mở rộng VietGAP / GlobalG.A.P. v1.3.5
  final String? targetPests;
  final int? phiDays;
  final String? fertilizerType;
  final String? registrationCode;

  bool get isOutOfStock =>
      (category != 'Tiền nước' && category != 'Nhân công') &&
      stockQuantity <= 0;

  Supply({
    required this.id,
    required this.userId,
    required this.category,
    required this.name,
    required this.unit,
    this.packageSize,
    required this.packageQty,
    required this.packageUnit,
    required this.packagePrice,
    required this.unitPrice,
    required this.unitPriceSmall,
    required this.stockQuantity,
    this.note,
    this.imageUrl,
    this.activeIngredient,
    this.totalSpent = 0,
    this.totalUsedQty = 0,
    this.targetPests,
    this.phiDays,
    this.fertilizerType,
    this.registrationCode,
  });

  factory Supply.fromJson(Map<String, dynamic> json) {
    return Supply(
      id: json['id'] is int
          ? json['id'] as int
          : (int.tryParse(json['id']?.toString() ?? '0') ?? 0),
      userId: json['user_id'] is int
          ? json['user_id'] as int
          : (int.tryParse(json['user_id']?.toString() ?? '0') ?? 0),
      category: json['category']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      unit: json['unit']?.toString() ?? 'kg',
      packageSize: json['package_size']?.toString(),
      packageQty: _parseDouble(json['package_qty']),
      packageUnit:
          (json['package_unit'] ?? json['unit'] ?? 'kg').toString(),
      packagePrice: _parseDouble(json['package_price']),
      unitPrice: _parseDouble(json['unit_price']),
      unitPriceSmall: _parseDouble(json['unit_price_small']),
      stockQuantity: _parseDouble(json['stock_quantity']),
      note: json['note']?.toString(),
      imageUrl: json['image_url']?.toString(),
      activeIngredient: json['active_ingredient']?.toString(),
      totalSpent: _parseDouble(json['total_spent']),
      totalUsedQty: _parseDouble(json['total_used_qty']),
      targetPests: json['target_pests']?.toString(),
      phiDays: json['phi_days'] != null
          ? int.tryParse(json['phi_days'].toString())
          : null,
      fertilizerType: json['fertilizer_type']?.toString(),
      registrationCode: json['registration_code']?.toString(),
    );
  }

  static double _parseDouble(dynamic val) {
    if (val == null) return 0.0;
    if (val is num) return val.toDouble();
    return double.tryParse(val.toString()) ?? 0.0;
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'category': category,
      'name': name,
      'unit': unit,
      'package_size': packageSize,
      'package_qty': packageQty,
      'package_unit': packageUnit,
      'package_price': packagePrice,
      'unit_price': unitPrice,
      'unit_price_small': unitPriceSmall,
      'stock_quantity': stockQuantity,
      'note': note,
      'image_url': imageUrl,
      'active_ingredient': activeIngredient,
      'target_pests': targetPests,
      'phi_days': phiDays,
      'fertilizer_type': fertilizerType,
      'registration_code': registrationCode,
    };
  }
}
