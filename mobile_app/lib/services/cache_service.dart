import 'dart:convert';
import 'dart:typed_data';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CacheService {
  static final CacheService _instance = CacheService._internal();
  factory CacheService() => _instance;
  CacheService._internal();

  late Box _farmsBox;
  late Box _plantsBox;
  late Box _logsBox;
  late Box _recentLogsBox;
  late Box _suppliesBox;
  late Box _pendingLogsBox;
  late Box _metaBox;

  Future<Uint8List> _getOrCreateEncryptionKey() async {
    final prefs = await SharedPreferences.getInstance();
    final keyString = prefs.getString('hive_sec_key_v1');
    if (keyString != null && keyString.isNotEmpty) {
      try {
        return base64Decode(keyString);
      } catch (_) {}
    }
    // Generate secure 256-bit AES encryption key
    final key = Hive.generateSecureKey();
    await prefs.setString('hive_sec_key_v1', base64Encode(key));
    return Uint8List.fromList(key);
  }

  Future<void> init() async {
    await Hive.initFlutter();
    final encKey = await _getOrCreateEncryptionKey();
    final cipher = HiveAesCipher(encKey);

    _farmsBox = await Hive.openBox('farms_cache', encryptionCipher: cipher);
    _plantsBox = await Hive.openBox('plants_cache', encryptionCipher: cipher);
    _logsBox = await Hive.openBox('logs_cache', encryptionCipher: cipher);
    _recentLogsBox = await Hive.openBox('recent_logs_cache', encryptionCipher: cipher);
    _suppliesBox = await Hive.openBox('supplies_cache', encryptionCipher: cipher);
    _pendingLogsBox = await Hive.openBox('pending_logs', encryptionCipher: cipher);
    _metaBox = await Hive.openBox('offline_meta', encryptionCipher: cipher);
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

  // --- Logs Cache (per plant) ---
  List<dynamic> getCachedPlantLogs(int plantId) {
    return _logsBox.get(plantId.toString(), defaultValue: []) as List<dynamic>;
  }

  Future<void> cachePlantLogs(int plantId, List<dynamic> jsonLogs) async {
    await _logsBox.put(plantId.toString(), jsonLogs);
  }

  // --- Recent All Logs Cache ---
  List<dynamic> getCachedRecentLogs() {
    return _recentLogsBox.get('list', defaultValue: []) as List<dynamic>;
  }

  Future<void> cacheRecentLogs(List<dynamic> jsonLogs) async {
    await _recentLogsBox.put('list', jsonLogs);
  }

  // --- Supplies Cache ---
  List<dynamic> getCachedSupplies() {
    return _suppliesBox.get('list', defaultValue: []) as List<dynamic>;
  }

  Future<void> cacheSupplies(List<dynamic> jsonSupplies) async {
    await _suppliesBox.put('list', jsonSupplies);
  }

  // --- Offline Metadata ---
  DateTime? getLastSyncTime() {
    final str = _metaBox.get('last_sync_time') as String?;
    if (str != null) {
      return DateTime.tryParse(str);
    }
    return null;
  }

  Future<void> setLastSyncTime(DateTime time) async {
    await _metaBox.put('last_sync_time', time.toIso8601String());
  }

  Map<String, int> getCacheStats() {
    return {
      'farms': getCachedFarms().length,
      'plants': getCachedPlants().length,
      'logs': getCachedRecentLogs().length,
      'supplies': getCachedSupplies().length,
      'pending': getPendingLogs().length,
    };
  }

  // --- Offline Queue (Pending Logs) ---
  List<Map<String, dynamic>> getPendingLogs() {
    final list = _pendingLogsBox.get('queue', defaultValue: []) as List<dynamic>;
    return list.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  Future<void> addPendingLog(int plantId, String logType, String note, Map<String, dynamic> details, {String? treeCode, String? farmName}) async {
    final queue = getPendingLogs();
    queue.add({
      'id': 'offline_${DateTime.now().millisecondsSinceEpoch}',
      'plantId': plantId,
      'treeCode': treeCode ?? 'Cây #$plantId',
      'farmName': farmName ?? 'Trang trại Nông hộ',
      'logType': logType,
      'note': note,
      'details': details,
      'timestamp': DateTime.now().toIso8601String(),
    });
    await _pendingLogsBox.put('queue', queue);

    // Also optimistically inject into cached recent logs
    final recent = getCachedRecentLogs();
    recent.insert(0, {
      'id': -DateTime.now().millisecondsSinceEpoch,
      'plant_id': plantId,
      'tree_code': treeCode ?? 'Cây #$plantId',
      'farm_name': farmName ?? 'Trang trại Nông hộ',
      'log_type': logType,
      'note': note,
      'log_date': DateTime.now().toIso8601String().split('T')[0],
      'is_offline_pending': true,
      ...details,
    });
    await cacheRecentLogs(recent);
  }

  Future<void> removePendingLog(int index) async {
    final queue = getPendingLogs();
    if (index >= 0 && index < queue.length) {
      queue.removeAt(index);
      await _pendingLogsBox.put('queue', queue);
    }
  }

  Future<void> clearPendingLogs() async {
    await _pendingLogsBox.put('queue', []);
  }
}
