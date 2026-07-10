class Farm {
  final int id;
  final String name;
  final String? description;
  final String? polygonCoordinates;
  final double? area;
  final int? userId;
  final int? plantCount;

  Farm({
    required this.id,
    required this.name,
    this.description,
    this.polygonCoordinates,
    this.area,
    this.userId,
    this.plantCount,
  });

  factory Farm.fromJson(Map<String, dynamic> json) {
    return Farm(
      id: json['id'] as int,
      name: json['name'] as String? ?? '—',
      description: json['description'] as String?,
      polygonCoordinates: json['polygon_coordinates']?.toString(),
      area: json['area'] != null ? double.tryParse(json['area'].toString()) : null,
      userId: json['user_id'] as int?,
      plantCount: json['plant_count'] as int?,
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
      'plant_count': plantCount,
    };
  }
}
