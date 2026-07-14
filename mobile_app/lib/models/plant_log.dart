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
      previousVersion: json['previous_version'] as Map<String, dynamic>? ?? {},
    );
  }
}

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
  });

  factory PlantLog.fromJson(Map<String, dynamic> json) {
    var historyList = json['edit_history'] as List<dynamic>? ?? [];
    List<EditHistory> parsedHistory = historyList
        .map((dynamic item) => EditHistory.fromJson(item as Map<String, dynamic>))
        .toList();

    var mediaList = json['media_urls'] as List<dynamic>? ?? [];
    List<String> parsedMedia = mediaList.map((dynamic item) {
      if (item is Map) {
        return (item['url'] ?? '').toString();
      }
      return item.toString();
    }).where((url) => url.isNotEmpty).toList();

    return PlantLog(
      id: json['id'] as int,
      plantId: json['plant_id'] as int,
      logDate: json['log_date']?.toString().substring(0, 10) ?? '',
      logType: json['log_type'] as String? ?? 'Khác',
      note: json['note'] as String?,
      mediaUrls: parsedMedia,
      details: json['details'] as Map<String, dynamic>? ?? {},
      createdBy: json['created_by'] as int?,
      editHistory: parsedHistory,
      updatedAt: json['updated_at'] as String?,
    );
  }
}
