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
      packageQty: json['package_qty'] != null ? (json['package_qty'] as num).toDouble() : 1.0,
      packageUnit: json['package_unit'] ?? json['unit'] ?? 'kg',
      packagePrice: json['package_price'] != null ? (json['package_price'] as num).toDouble() : 0.0,
      unitPrice: json['unit_price'] != null ? (json['unit_price'] as num).toDouble() : 0.0,
      unitPriceSmall: json['unit_price_small'] != null ? (json['unit_price_small'] as num).toDouble() : 0.0,
      stockQuantity: json['stock_quantity'] != null ? (json['stock_quantity'] as num).toDouble() : 0.0,
      note: json['note'],
      imageUrl: json['image_url'],
      totalSpent: json['total_spent'] != null ? (json['total_spent'] as num).toDouble() : 0.0,
      totalUsedQty: json['total_used_qty'] != null ? (json['total_used_qty'] as num).toDouble() : 0.0,
    );
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
