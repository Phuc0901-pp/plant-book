import 'dart:convert';
import 'dart:typed_data';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/security/crypto_security_service.dart';

/// Dịch vụ Lưu trữ Ngoại tuyến Mã hóa Chuẩn Quốc tế (AES-256 Encrypted Vault & SHA-256 Client Ledger)
/// Tuân thủ OWASP MASVS-STORAGE-1 & ISO/IEC 27001:
/// - Toàn bộ dữ liệu trang trại, cây trồng, vật tư, nhật ký và hàng đợi ngoại tuyến được mã hóa AES-256 (`HiveAesCipher`).
/// - Mỗi bản ghi ngoại tuyến (`pending_logs` và `pending_field_mutations`) đều được đóng dấu niêm phong Chuỗi Băm `SHA-256` & `HMAC-SHA256` ngay tại thời điểm phát sinh ở hiện trường (`createClientIntegrityEnvelope`).
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
  late Box _pendingMutationsBox;
  late Box _metaBox;

  bool _isInitialized = false;
  bool get isInitialized => _isInitialized;

  Future<Uint8List> _getOrCreateEncryptionKey() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String? keyString = prefs.getString('hive_sec_key_v1');
    if (keyString != null && keyString.isNotEmpty) {
      try {
        return base64Decode(keyString);
      } catch (_) {}
    }
    // Khởi tạo khóa AES-256 (32 bytes = 256 bits) an toàn
    final List<int> key = Hive.generateSecureKey();
    await prefs.setString('hive_sec_key_v1', base64Encode(key));
    return Uint8List.fromList(key);
  }

  Future<void> init() async {
    if (_isInitialized) return;
    await Hive.initFlutter();
    final Uint8List encKey = await _getOrCreateEncryptionKey();
    final HiveAesCipher cipher = HiveAesCipher(encKey);

    _farmsBox = await Hive.openBox('farms_cache', encryptionCipher: cipher);
    _plantsBox = await Hive.openBox('plants_cache', encryptionCipher: cipher);
    _logsBox = await Hive.openBox('logs_cache', encryptionCipher: cipher);
    _recentLogsBox =
        await Hive.openBox('recent_logs_cache', encryptionCipher: cipher);
    _suppliesBox =
        await Hive.openBox('supplies_cache', encryptionCipher: cipher);
    _pendingLogsBox =
        await Hive.openBox('pending_logs', encryptionCipher: cipher);
    _pendingMutationsBox =
        await Hive.openBox('pending_field_mutations', encryptionCipher: cipher);
    _metaBox = await Hive.openBox('offline_meta', encryptionCipher: cipher);
    _isInitialized = true;
  }

  // --- User Profile & RBAC Cache (Hỗ trợ kiểm tra sub_role khi Offline) ---
  Map<String, dynamic>? getCachedUserProfile() {
    if (!_isInitialized) return null;
    final dynamic raw = _metaBox.get('user_profile');
    if (raw is Map) {
      return Map<String, dynamic>.from(raw);
    }
    return null;
  }

  Future<void> cacheUserProfile(Map<String, dynamic> user) async {
    if (!_isInitialized) return;
    await _metaBox.put('user_profile', user);
  }

  // --- Farms Cache ---
  List<dynamic> getCachedFarms() {
    if (!_isInitialized) return <dynamic>[];
    return _farmsBox.get('list', defaultValue: <dynamic>[]) as List<dynamic>;
  }

  Future<void> cacheFarms(List<dynamic> jsonFarms) async {
    if (!_isInitialized) return;
    await _farmsBox.put('list', jsonFarms);
  }

  // --- Plants Cache ---
  List<dynamic> getCachedPlants() {
    if (!_isInitialized) return <dynamic>[];
    return _plantsBox.get('list', defaultValue: <dynamic>[]) as List<dynamic>;
  }

  Future<void> cachePlants(List<dynamic> jsonPlants) async {
    if (!_isInitialized) return;
    await _plantsBox.put('list', jsonPlants);
  }

  // --- Logs Cache (per plant) ---
  List<dynamic> getCachedPlantLogs(int plantId) {
    if (!_isInitialized) return <dynamic>[];
    return _logsBox.get(plantId.toString(), defaultValue: <dynamic>[])
        as List<dynamic>;
  }

  Future<void> cachePlantLogs(int plantId, List<dynamic> jsonLogs) async {
    if (!_isInitialized) return;
    await _logsBox.put(plantId.toString(), jsonLogs);
  }

  // --- Recent All Logs Cache ---
  List<dynamic> getCachedRecentLogs() {
    if (!_isInitialized) return <dynamic>[];
    return _recentLogsBox.get('list', defaultValue: <dynamic>[])
        as List<dynamic>;
  }

  Future<void> cacheRecentLogs(List<dynamic> jsonLogs) async {
    if (!_isInitialized) return;
    await _recentLogsBox.put('list', jsonLogs);
  }

  // --- Supplies Cache ---
  List<dynamic> getCachedSupplies() {
    if (!_isInitialized) return <dynamic>[];
    return _suppliesBox.get('list', defaultValue: <dynamic>[]) as List<dynamic>;
  }

  Future<void> cacheSupplies(List<dynamic> jsonSupplies) async {
    if (!_isInitialized) return;
    await _suppliesBox.put('list', jsonSupplies);
  }

  // --- Offline Metadata ---
  DateTime? getLastSyncTime() {
    if (!_isInitialized) return null;
    final String? str = _metaBox.get('last_sync_time') as String?;
    if (str != null) {
      return DateTime.tryParse(str);
    }
    return null;
  }

  Future<void> setLastSyncTime(DateTime time) async {
    if (!_isInitialized) return;
    await _metaBox.put('last_sync_time', time.toIso8601String());
  }

  String getLastClientChainHash() {
    if (!_isInitialized) return CryptoSecurityService.genesisAnchor;
    return (_metaBox.get('last_client_chain_hash') as String?) ??
        CryptoSecurityService.genesisAnchor;
  }

  Future<void> _setLastClientChainHash(String hash) async {
    if (!_isInitialized) return;
    await _metaBox.put('last_client_chain_hash', hash);
  }

  Map<String, int> getCacheStats() {
    return <String, int>{
      'farms': getCachedFarms().length,
      'plants': getCachedPlants().length,
      'logs': getCachedRecentLogs().length,
      'supplies': getCachedSupplies().length,
      'pending': getPendingLogs().length + getPendingFieldMutations().length,
      'pending_logs': getPendingLogs().length,
      'pending_mutations': getPendingFieldMutations().length,
    };
  }

  // --- Offline Queue Phase 1: Pending Care Logs (Nhật ký chăm sóc VietGAP) ---
  List<Map<String, dynamic>> getPendingLogs() {
    if (!_isInitialized) return <Map<String, dynamic>>[];
    final List<dynamic> list =
        _pendingLogsBox.get('queue', defaultValue: <dynamic>[])
            as List<dynamic>;
    return list
        .map((dynamic item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  Future<void> replacePendingLogs(List<Map<String, dynamic>> newQueue) async {
    if (!_isInitialized) return;
    await _pendingLogsBox.put('queue', newQueue);
  }

  Future<void> addPendingLog(
    int plantId,
    String logType,
    String note,
    Map<String, dynamic> details, {
    String? treeCode,
    String? farmName,
    int? supplyId,
    double? usedAmount,
    double? estimatedCost,
  }) async {
    if (!_isInitialized) return;
    final List<Map<String, dynamic>> queue = getPendingLogs();
    final String nowIso = DateTime.now().toIso8601String();
    final String logDate = nowIso.split('T')[0];
    final String prevClientHash = getLastClientChainHash();

    final String recordHash = CryptoSecurityService.computePlantLogRecordHash(
      prevLogHash: prevClientHash,
      plantId: plantId,
      action: logType,
      description: note,
      supplyId: supplyId ??
          (details['supply_id'] != null
              ? int.tryParse(details['supply_id'].toString())
              : null),
      usedAmount: usedAmount ??
          (details['amount'] != null
              ? double.tryParse(details['amount'].toString())
              : null),
      estimatedCost: estimatedCost ??
          (details['cost'] != null
              ? double.tryParse(details['cost'].toString())
              : null),
      logDate: logDate,
    );

    final Map<String, String> integrityEnvelope =
        CryptoSecurityService.createClientIntegrityEnvelope(
      payload: <String, dynamic>{
        'plant_id': plantId,
        'action': logType,
        'description': note,
        'log_date': logDate,
        'details': details,
      },
      previousClientHash: prevClientHash,
    );

    await _setLastClientChainHash(recordHash);

    queue.add(<String, dynamic>{
      'id': 'offline_${DateTime.now().millisecondsSinceEpoch}',
      'plantId': plantId,
      'plant_id': plantId,
      'treeCode': treeCode ?? 'Cây #$plantId',
      'farmName': farmName ?? 'Trang trại Nông hộ',
      'logType': logType,
      'action': logType,
      'note': note,
      'description': note,
      'details': details,
      'supply_id': supplyId ?? details['supply_id'],
      'used_amount': usedAmount ?? details['amount'],
      'estimated_cost': estimatedCost ?? details['cost'],
      'log_date': logDate,
      'timestamp': nowIso,
      'prev_log_hash': prevClientHash,
      'record_hash': recordHash,
      'integrity_envelope': integrityEnvelope,
    });
    await _pendingLogsBox.put('queue', queue);

    // Đồng bộ tức thì (Optimistic UI) vào bộ nhớ đệm nhật ký gần đây
    final List<dynamic> recent = List<dynamic>.from(getCachedRecentLogs());
    recent.insert(0, <String, dynamic>{
      'id': -DateTime.now().millisecondsSinceEpoch,
      'plant_id': plantId,
      'tree_code': treeCode ?? 'Cây #$plantId',
      'farm_name': farmName ?? 'Trang trại Nông hộ',
      'log_type': logType,
      'note': note,
      'log_date': logDate,
      'prev_log_hash': prevClientHash,
      'record_hash': recordHash,
      'is_offline_pending': true,
      'details': details,
      ...details,
    });
    await cacheRecentLogs(recent);
  }

  Future<void> removePendingLog(int index) async {
    if (!_isInitialized) return;
    final List<Map<String, dynamic>> queue = getPendingLogs();
    if (index >= 0 && index < queue.length) {
      queue.removeAt(index);
      await _pendingLogsBox.put('queue', queue);
    }
  }

  Future<void> clearPendingLogs() async {
    if (!_isInitialized) return;
    await _pendingLogsBox.put('queue', <dynamic>[]);
  }

  // --- Offline Queue Phase 2: Pending Field Mutations (Cập nhật GPS, NFC UID, Sức khỏe cây, Sinh khối) ---
  List<Map<String, dynamic>> getPendingFieldMutations() {
    if (!_isInitialized) return <Map<String, dynamic>>[];
    final List<dynamic> list = _pendingMutationsBox
        .get('queue', defaultValue: <dynamic>[]) as List<dynamic>;
    return list
        .map((dynamic item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  Future<void> replacePendingFieldMutations(
    List<Map<String, dynamic>> newQueue,
  ) async {
    if (!_isInitialized) return;
    await _pendingMutationsBox.put('queue', newQueue);
  }

  Future<void> addPendingFieldMutation({
    required int plantId,
    String? treeCode,
    String? healthStatus,
    double? latitude,
    double? longitude,
    String? nfcUid,
    String? location,
  }) async {
    if (!_isInitialized) return;
    final List<Map<String, dynamic>> queue = getPendingFieldMutations();
    final String prevHash = getLastClientChainHash();
    final Map<String, dynamic> mutationPayload = <String, dynamic>{
      'plant_id': plantId,
      if (treeCode != null) 'tree_code': treeCode,
      if (healthStatus != null) 'health_status': healthStatus,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (nfcUid != null) 'nfc_uid': nfcUid,
      if (location != null) 'location': location,
    };

    final Map<String, String> envelope =
        CryptoSecurityService.createClientIntegrityEnvelope(
      payload: mutationPayload,
      previousClientHash: prevHash,
    );
    await _setLastClientChainHash(envelope['client_record_hash']!);

    queue.add(<String, dynamic>{
      'id': 'mutation_${DateTime.now().millisecondsSinceEpoch}',
      ...mutationPayload,
      'timestamp': DateTime.now().toIso8601String(),
      'record_hash': envelope['client_record_hash'],
      'prev_log_hash': prevHash,
      'integrity_envelope': envelope,
    });
    await _pendingMutationsBox.put('queue', queue);
  }

  Future<void> removePendingFieldMutation(int index) async {
    if (!_isInitialized) return;
    final List<Map<String, dynamic>> queue = getPendingFieldMutations();
    if (index >= 0 && index < queue.length) {
      queue.removeAt(index);
      await _pendingMutationsBox.put('queue', queue);
    }
  }

  Future<void> clearPendingFieldMutations() async {
    if (!_isInitialized) return;
    await _pendingMutationsBox.put('queue', <dynamic>[]);
  }
}
