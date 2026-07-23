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
  final double totalSpent;
  final double totalUsedQty;

  bool get isOutOfStock => (category != 'Tiền nước' && category != 'Nhân công') && stockQuantity <= 0;

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
    this.totalSpent = 0,
    this.totalUsedQty = 0,
  });

  factory Supply.fromJson(Map<String, dynamic> json) {
    return Supply(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      userId: json['user_id'] is int ? json['user_id'] : int.parse(json['user_id'].toString()),
      category: json['category'] ?? '',
      name: json['name'] ?? '',
      unit: json['unit'] ?? 'kg',
      packageSize: json['package_size'],
      packageQty: _parseDouble(json['package_qty']),
      packageUnit: json['package_unit'] ?? json['unit'] ?? 'kg',
      packagePrice: _parseDouble(json['package_price']),
      unitPrice: _parseDouble(json['unit_price']),
      unitPriceSmall: _parseDouble(json['unit_price_small']),
      stockQuantity: _parseDouble(json['stock_quantity']),
      note: json['note'],
      imageUrl: json['image_url'],
      totalSpent: _parseDouble(json['total_spent']),
      totalUsedQty: _parseDouble(json['total_used_qty']),
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
    };
  }
}
