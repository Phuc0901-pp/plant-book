import 'package:hive_flutter/hive_flutter.dart';

class CacheService {
  static final CacheService _instance = CacheService._internal();
  factory CacheService() => _instance;
  CacheService._internal();

  late Box _farmsBox;
  late Box _plantsBox;
  late Box _logsBox;
  late Box _pendingLogsBox;

  Future<void> init() async {
    await Hive.initFlutter();
    _farmsBox = await Hive.openBox('farms_cache');
    _plantsBox = await Hive.openBox('plants_cache');
    _logsBox = await Hive.openBox('logs_cache');
    _pendingLogsBox = await Hive.openBox('pending_logs');
  }

  // --- Farms Cache ---
  List<dynamic> getCachedFarms() {
    return _farmsBox.get('list', defaultValue: []) as List<dynamic>;
  }

  Future<void> cacheFarms(List<dynamic> jsonFarms) async {
    await _farmsBox.put('list', jsonFarms);
  }

  // --- Plants Cache ---
  List<dynamic> getCachedPlants() {
    return _plantsBox.get('list', defaultValue: []) as List<dynamic>;
  }

  Future<void> cachePlants(List<dynamic> jsonPlants) async {
    await _plantsBox.put('list', jsonPlants);
  }

  // --- Logs Cache ---
  List<dynamic> getCachedPlantLogs(int plantId) {
    return _logsBox.get(plantId.toString(), defaultValue: []) as List<dynamic>;
  }

  Future<void> cachePlantLogs(int plantId, List<dynamic> jsonLogs) async {
    await _logsBox.put(plantId.toString(), jsonLogs);
  }

  // --- Offline Queue (Pending Logs) ---
  List<Map<String, dynamic>> getPendingLogs() {
    final list = _pendingLogsBox.get('queue', defaultValue: []) as List<dynamic>;
    return list.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  Future<void> addPendingLog(int plantId, String logType, String note, Map<String, dynamic> details) async {
    final queue = getPendingLogs();
    queue.add({
      'plantId': plantId,
      'logType': logType,
      'note': note,
      'details': details,
      'timestamp': DateTime.now().toIso8601String(),
    });
    await _pendingLogsBox.put('queue', queue);
  }

  Future<void> clearPendingLogs() async {
    await _pendingLogsBox.put('queue', []);
  }
}
