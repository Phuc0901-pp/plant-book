class EditHistory {
  final String editedAt;
  final int editedBy;
  final String editedByName;
  final Map<String, dynamic> previousVersion;

  EditHistory({
    required this.editedAt,
    required this.editedBy,
    required this.editedByName,
    required this.previousVersion,
  });

  factory EditHistory.fromJson(Map<String, dynamic> json) {
    return EditHistory(
      editedAt: json['edited_at'] as String? ?? '',
      editedBy: json['edited_by'] as int? ?? 0,
      editedByName: json['edited_by_name'] as String? ?? 'Nông hộ',
      previousVersion:
          json['previous_version'] as Map<String, dynamic>? ?? {},
    );
  }
}

/// Nhật ký Chăm sóc VietGAP / GlobalG.A.P. tích hợp Chuỗi Băm Bất Biến (ISO/IEC 27001 SHA-256 Hash-Chain)
class PlantLog {
  final int id;
  final int plantId;
  final String logDate;
  final String logType;
  final String? note;
  final List<String> mediaUrls;
  final Map<String, dynamic> details;
  final int? createdBy;
  final List<EditHistory> editHistory;
  final String? updatedAt;
  final String? creatorName;
  final String? farmName;
  final int? farmId;
  final String? plantType;
  final String? treeCode;

  // Chuẩn Sổ cái Bất biến SHA-256 (ISO/IEC 27001 & VietGAP v1.3.5)
  final String? prevLogHash;
  final String? recordHash;
  final bool isLocked;
  final bool isDeleted;
  final String? deletedAt;
  final int? supplyId;
  final double? usedAmount;
  final double? estimatedCost;

  PlantLog({
    required this.id,
    required this.plantId,
    required this.logDate,
    required this.logType,
    this.note,
    required this.mediaUrls,
    required this.details,
    this.createdBy,
    required this.editHistory,
    this.updatedAt,
    this.creatorName,
    this.farmName,
    this.farmId,
    this.plantType,
    this.treeCode,
    this.prevLogHash,
    this.recordHash,
    this.isLocked = false,
    this.isDeleted = false,
    this.deletedAt,
    this.supplyId,
    this.usedAmount,
    this.estimatedCost,
  });

  /// Kiểm tra bản ghi đã được niêm phong mật mã học SHA-256 hay chưa.
  bool get isCryptographicallySealed =>
      recordHash != null && recordHash!.trim().length >= 16;

  /// Chuỗi hiển thị rút gọn của mã băm `recordHash` (ví dụ: `8f1c9a2b...e4d1`).
  String get shortRecordHash {
    final String raw = (recordHash ?? '').trim();
    if (raw.isEmpty) return 'UNSEALED_LEGACY';
    if (raw.length <= 14) return raw;
    return '${raw.substring(0, 8)}...${raw.substring(raw.length - 6)}';
  }

  /// Chuỗi hiển thị rút gọn của `prevLogHash`.
  String get shortPrevHash {
    final String raw = (prevLogHash ?? '').trim();
    if (raw.isEmpty) return 'GENESIS';
    if (raw == 'GENESIS_PLANT_BOOK_ENTERPRISE_2026') return 'GENESIS_2026';
    if (raw.length <= 14) return raw;
    return '${raw.substring(0, 8)}...${raw.substring(raw.length - 6)}';
  }

  bool get isPhiViolation =>
      details['phi_violation'] == true ||
      details['is_phi_violation'] == true ||
      details['phi_warning'] == true;

  String? get batchCode =>
      details['batch_code']?.toString() ??
      details['batch']?.toString() ??
      details['lot_id']?.toString();

  String? get operatorName =>
      details['operator_name']?.toString() ??
      details['operator']?.toString() ??
      creatorName;

  String? get pucCode =>
      details['puc_code']?.toString() ?? details['puc']?.toString();

  String? get equipmentUsed =>
      details['equipment_used']?.toString() ??
      details['equipment']?.toString();

  String? get fertilizerName =>
      details['fertilizer_name']?.toString() ??
      details['fertilizer']?.toString() ??
      details['supply_name']?.toString();

  String? get pesticideName =>
      details['pesticide_name']?.toString() ??
      details['pesticide']?.toString() ??
      details['supply_name']?.toString();

  String? get diseaseName =>
      details['disease_name']?.toString() ??
      details['disease']?.toString();

  String? get pruningReason =>
      details['reason']?.toString() ??
      details['prune_reason']?.toString();

  double? get amount => usedAmount ??
      (details['amount'] != null
          ? double.tryParse(details['amount'].toString())
          : null);

  String? get unit => details['unit']?.toString();

  String? get method => details['method']?.toString();

  double? get cost => estimatedCost ??
      (details['cost'] != null
          ? double.tryParse(details['cost'].toString())
          : null);

  double? get yieldKg => details['yield_kg'] != null
      ? double.tryParse(details['yield_kg'].toString())
      : (details['yield'] != null
          ? double.tryParse(details['yield'].toString())
          : null);

  String? get harvestGrade =>
      details['grade']?.toString() ?? details['quality']?.toString();

  factory PlantLog.fromJson(Map<String, dynamic> json) {
    final List<dynamic> historyList =
        json['edit_history'] as List<dynamic>? ?? <dynamic>[];
    final List<EditHistory> parsedHistory = historyList
        .whereType<Map<String, dynamic>>()
        .map(EditHistory.fromJson)
        .toList();

    final List<dynamic> mediaList =
        json['media_urls'] as List<dynamic>? ?? <dynamic>[];
    final List<String> parsedMedia = mediaList
        .map((dynamic item) {
          if (item is Map) {
            return (item['url'] ?? '').toString();
          }
          return item.toString();
        })
        .where((String url) => url.isNotEmpty)
        .toList();

    final String rawDate =
        (json['log_date'] ?? json['created_at'] ?? '').toString();
    final String normalizedDate =
        rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate;

    return PlantLog(
      id: json['id'] is int
          ? json['id'] as int
          : (int.tryParse(json['id']?.toString() ?? '0') ?? 0),
      plantId: json['plant_id'] is int
          ? json['plant_id'] as int
          : (int.tryParse(json['plant_id']?.toString() ?? '0') ?? 0),
      logDate: normalizedDate,
      logType:
          (json['log_type'] ?? json['action'] ?? 'Khác').toString(),
      note: (json['note'] ?? json['description'])?.toString(),
      mediaUrls: parsedMedia,
      details: json['details'] is Map<String, dynamic>
          ? json['details'] as Map<String, dynamic>
          : <String, dynamic>{},
      createdBy: json['created_by'] is int
          ? json['created_by'] as int?
          : int.tryParse(json['created_by']?.toString() ?? ''),
      editHistory: parsedHistory,
      updatedAt: json['updated_at']?.toString(),
      creatorName: json['creator_name']?.toString(),
      farmName: json['farm_name']?.toString(),
      farmId: json['farm_id'] != null
          ? int.tryParse(json['farm_id'].toString())
          : null,
      plantType: json['plant_type']?.toString(),
      treeCode: json['tree_code']?.toString(),
      prevLogHash: json['prev_log_hash']?.toString(),
      recordHash: json['record_hash']?.toString(),
      isLocked: json['is_locked'] == true || json['is_locked'] == 1,
      isDeleted: json['is_deleted'] == true || json['is_deleted'] == 1,
      deletedAt: json['deleted_at']?.toString(),
      supplyId: json['supply_id'] != null
          ? int.tryParse(json['supply_id'].toString())
          : null,
      usedAmount: json['used_amount'] != null
          ? double.tryParse(json['used_amount'].toString())
          : null,
      estimatedCost: json['estimated_cost'] != null
          ? double.tryParse(json['estimated_cost'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'plant_id': plantId,
        'log_date': logDate,
        'log_type': logType,
        'note': note,
        'media_urls': mediaUrls,
        'details': details,
        'created_by': createdBy,
        'updated_at': updatedAt,
        'creator_name': creatorName,
        'farm_name': farmName,
        'farm_id': farmId,
        'plant_type': plantType,
        'tree_code': treeCode,
        'prev_log_hash': prevLogHash,
        'record_hash': recordHash,
        'is_locked': isLocked,
        'is_deleted': isDeleted,
        'deleted_at': deletedAt,
        'supply_id': supplyId,
        'used_amount': usedAmount,
        'estimated_cost': estimatedCost,
      };
}
