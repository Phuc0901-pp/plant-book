import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_service.dart';
import 'cache_service.dart';
import '../models/farm.dart';
import '../models/plant.dart';
import '../models/plant_log.dart';
import '../models/supply.dart';

class OfflineSyncService {
  static final OfflineSyncService _instance = OfflineSyncService._internal();
  factory OfflineSyncService() => _instance;
  OfflineSyncService._internal();

  final ApiService _apiService = ApiService();
  final CacheService _cacheService = CacheService();

  bool _isSyncing = false;
  bool get isSyncing => _isSyncing;

  /// Tải toàn bộ dữ liệu từ Server về Local Hive Storage để sẵn sàng làm việc ngoại tuyến
  Future<Map<String, dynamic>> downloadAllForOffline() async {
    try {
      final farmsRes = await _apiService.fetchFarms();
      final plantsRes = await _apiService.fetchPlants();
      final logsRes = await _apiService.fetchRecentLogs(days: 90);
      final suppliesRes = await _apiService.fetchSupplies();

      final now = DateTime.now();
      await _cacheService.setLastSyncTime(now);

      return {
        'success': true,
        'message': 'Đã tải thành công toàn bộ dữ liệu về máy!',
        'farmsCount': farmsRes.length,
        'plantsCount': plantsRes.length,
        'logsCount': logsRes.length,
        'suppliesCount': suppliesRes.length,
        'syncTime': now,
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Lỗi khi tải dữ liệu ngoại tuyến: $e',
      };
    }
  }

  /// Đẩy toàn bộ hàng đợi ghi nhận ngoại tuyến lên Server
  Future<Map<String, dynamic>> syncPendingQueue({Function(int current, int total)? onProgress}) async {
    if (_isSyncing) {
      return {'success': false, 'message': 'Đang trong quá trình đồng bộ...'};
    }

    final queue = _cacheService.getPendingLogs();
    if (queue.isEmpty) {
      return {
        'success': true,
        'message': 'Không có tác vụ nào cần đồng bộ.',
        'syncedCount': 0,
        'failedCount': 0,
      };
    }

    _isSyncing = true;
    int synced = 0;
    int failed = 0;
    final List<Map<String, dynamic>> remainingQueue = [];

    for (int i = 0; i < queue.length; i++) {
      final item = queue[i];
      if (onProgress != null) onProgress(i + 1, queue.length);

      try {
        final plantId = item['plantId'] as int;
        final logType = item['logType'] as String;
        final note = item['note'] as String? ?? '';
        final details = Map<String, dynamic>.from(item['details'] as Map);

        final ok = await _apiService.createPlantLog(
          plantId,
          logType,
          note,
          details,
          isSyncing: true,
        );

        if (ok) {
          synced++;
        } else {
          failed++;
          remainingQueue.add(item);
        }
      } catch (e) {
        failed++;
        remainingQueue.add(item);
      }
    }

    // Update remaining queue
    final pendingBox = _cacheService.getPendingLogs();
    await _cacheService.clearPendingLogs();
    for (final rem in remainingQueue) {
      final pid = rem['plantId'] as int;
      final ltype = rem['logType'] as String;
      final note = rem['note'] as String? ?? '';
      final det = Map<String, dynamic>.from(rem['details'] as Map);
      await _cacheService.addPendingLog(pid, ltype, note, det, treeCode: rem['treeCode'], farmName: rem['farmName']);
    }

    _isSyncing = false;

    // Refresh recent logs from server if online
    try {
      await _apiService.fetchRecentLogs(days: 90);
    } catch (_) {}

    await _cacheService.setLastSyncTime(DateTime.now());

    return {
      'success': true,
      'syncedCount': synced,
      'failedCount': failed,
      'message': 'Đã đồng bộ thành công $synced tác vụ lên máy chủ!' + (failed > 0 ? ' ($failed tác vụ chờ thử lại)' : ''),
    };
  }

  /// Ghi nhật ký ngoại tuyến 1-chạm
  Future<void> recordOfflineLog({
    required int plantId,
    required String logType,
    required String note,
    required Map<String, dynamic> details,
    String? treeCode,
    String? farmName,
  }) async {
    await _cacheService.addPendingLog(
      plantId,
      logType,
      note,
      details,
      treeCode: treeCode,
      farmName: farmName,
    );
  }
}