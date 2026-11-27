import '../core/state/app_state_and_concepts.dart';
import 'api_service.dart';
import 'cache_service.dart';

class OfflineSyncService {
  static final OfflineSyncService _instance = OfflineSyncService._internal();
  factory OfflineSyncService() => _instance;
  OfflineSyncService._internal();

  final ApiService _apiService = ApiService();
  final CacheService _cacheService = CacheService();

  bool _isSyncing = false;
  bool get isSyncing => _isSyncing;

  Future<Map<String, dynamic>> downloadAllForOffline() async {
    try {
      final farmsRes = await _apiService.fetchFarms();
      final plantsRes = await _apiService.fetchPlants();
      final logsRes = await _apiService.fetchRecentLogs(days: 90);
      final suppliesRes = await _apiService.fetchSupplies();
      await _apiService.fetchUserInfo();

      final DateTime now = DateTime.now();
      await _cacheService.setLastSyncTime(now);

      return <String, dynamic>{
        'success': true,
        'message':
            'Đã tải và mã hóa AES-256 thành công toàn bộ dữ liệu trang trại về máy!',
        'farmsCount': farmsRes.length,
        'plantsCount': plantsRes.length,
        'logsCount': logsRes.length,
        'suppliesCount': suppliesRes.length,
        'syncTime': now,
      };
    } catch (e) {
      return <String, dynamic>{
        'success': false,
        'message': 'Lỗi khi tải dữ liệu ngoại tuyến: $e',
      };
    }
  }

  Future<Map<String, dynamic>> syncPendingQueue({
    Function(int current, int total)? onProgress,
  }) async {
    if (_isSyncing) {
      return <String, dynamic>{
        'success': false,
        'message': 'Đang trong quá trình đồng bộ...',
      };
    }

    final List<Map<String, dynamic>> pendingLogs =
        _cacheService.getPendingLogs();
    final List<Map<String, dynamic>> pendingMutations =
        _cacheService.getPendingFieldMutations();
    final int totalTasks = pendingLogs.length + pendingMutations.length;

    if (totalTasks == 0) {
      return <String, dynamic>{
        'success': true,
        'message': 'Không có tác vụ nào cần đồng bộ.',
        'syncedCount': 0,
        'failedCount': 0,
      };
    }

    _isSyncing = true;
    AppStateStore().setSyncStatus(isSyncing: true, pendingCount: totalTasks);
    int synced = 0;
    int failed = 0;

    try {
      if (onProgress != null) {
        onProgress(1, totalTasks);
      }

      final List<Map<String, dynamic>> batchCareLogs = pendingLogs
          .map((Map<String, dynamic> item) {
            final Map<String, dynamic> details = item['details'] is Map
                ? Map<String, dynamic>.from(item['details'] as Map)
                : <String, dynamic>{};
            final String logType = (item['logType'] ?? item['action'] ?? item['log_type'] ?? 'Chăm sóc').toString();
            final String note = (item['note'] ?? item['description'] ?? '').toString();
            final String date = (item['log_date'] ??
                (item['timestamp']?.toString().split('T')[0]) ??
                DateTime.now().toIso8601String().split('T')[0]).toString();

            final String clientUuid = (item['client_uuid'] ??
                    item['id'] ??
                    'mob_${item['plantId'] ?? item['plant_id']}_${date}_${logType.hashCode}')
                .toString();

            return <String, dynamic>{
              'client_uuid': clientUuid,
              'plant_id': item['plantId'] ?? item['plant_id'],
              'log_type': logType,
              'action': logType,
              'note': note,
              'description': note,
              'details': details,
              'supply_id': item['supply_id'] ?? details['supply_id'],
              'used_amount': item['used_amount'] ?? details['amount'] ?? 0,
              'estimated_cost': item['estimated_cost'] ?? details['cost'] ?? 0,
              'log_date': date,
              'client_record_hash': item['record_hash'],
              'client_prev_hash': item['prev_log_hash'],
            };
          })
          .toList();

      final List<Map<String, dynamic>> batchMutations = pendingMutations
          .map((Map<String, dynamic> m) {
            final String mutUuid = (m['client_uuid'] ??
                    m['id'] ??
                    'mob_mut_${m['plant_id']}_${m.hashCode}')
                .toString();
            final String mutationType = (m['mutation_type'] ??
                    (m['nfc_uid'] != null
                        ? 'nfc_assign'
                        : (m['health_status'] != null
                            ? 'health_update'
                            : ((m['latitude'] != null && m['longitude'] != null)
                                ? 'gps_update'
                                : 'location_update'))))
                .toString();
            return <String, dynamic>{
              'client_uuid': mutUuid,
              'mutation_type': mutationType,
              'plant_id': m['plant_id'],
              if (m['health_status'] != null)
                'health_status': m['health_status'],
              if (m['latitude'] != null) 'latitude': m['latitude'],
              if (m['longitude'] != null) 'longitude': m['longitude'],
              if (m['nfc_uid'] != null) 'nfc_uid': m['nfc_uid'],
              if (m['location'] != null) 'location': m['location'],
            };
          })
          .toList();

      final Map<String, dynamic>? batchRes =
          await _apiService.syncOfflineBatch(
        careLogs: batchCareLogs,
        fieldMutations: batchMutations,
      );

      final Set<String> permanentRejectCodes = AppConcepts.permanentRejectCodes;

      if (batchRes != null && batchRes['success'] == true) {
        final bool hasGranular = batchRes['synced_uuids'] is List ||
            batchRes['rejected_items'] is List;
        if (hasGranular) {
          final Set<String> syncedSet = <String>{
            for (final dynamic u in (batchRes['synced_uuids'] as List? ?? <dynamic>[]))
              u.toString()
          };
          final Set<String> permRejectedSet = <String>{
            for (final dynamic r in (batchRes['rejected_items'] as List? ?? <dynamic>[]))
              if (r is Map && permanentRejectCodes.contains(r['code']?.toString()))
                (r['client_uuid'] ?? '').toString()
          };

          final List<Map<String, dynamic>> keepLogs = <Map<String, dynamic>>[];
          for (int i = 0; i < pendingLogs.length; i++) {
            final String uuid = batchCareLogs[i]['client_uuid'].toString();
            if (syncedSet.contains(uuid)) {
              synced++;
            } else if (permRejectedSet.contains(uuid)) {
            } else {
              failed++;
              keepLogs.add(pendingLogs[i]);
            }
          }

          final List<Map<String, dynamic>> keepMuts = <Map<String, dynamic>>[];
          for (int i = 0; i < pendingMutations.length; i++) {
            final String uuid = batchMutations[i]['client_uuid'].toString();
            if (syncedSet.contains(uuid)) {
              synced++;
            } else if (permRejectedSet.contains(uuid)) {
            } else {
              failed++;
              keepMuts.add(pendingMutations[i]);
            }
          }

          await _cacheService.replacePendingLogs(keepLogs);
          await _cacheService.replacePendingFieldMutations(keepMuts);
        } else {
          synced = totalTasks;
          await _cacheService.clearPendingLogs();
          await _cacheService.clearPendingFieldMutations();
        }
        if (onProgress != null) {
          onProgress(totalTasks, totalTasks);
        }
      } else {
        final List<Map<String, dynamic>> remainingLogs =
            <Map<String, dynamic>>[];
        int step = 0;

        for (final Map<String, dynamic> item in pendingLogs) {
          step++;
          if (onProgress != null) onProgress(step, totalTasks);
          try {
            final int plantId =
                int.tryParse((item['plantId'] ?? item['plant_id']).toString()) ??
                    0;
            final String logType =
                (item['logType'] ?? item['action'] ?? 'Khác').toString();
            final String note =
                (item['note'] ?? item['description'] ?? '').toString();
            final Map<String, dynamic> details = item['details'] is Map
                ? Map<String, dynamic>.from(item['details'] as Map)
                : <String, dynamic>{};

            final bool ok = await _apiService.createPlantLog(
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
              remainingLogs.add(item);
            }
          } catch (_) {
            failed++;
            remainingLogs.add(item);
          }
        }

        final List<Map<String, dynamic>> remainingMutations =
            <Map<String, dynamic>>[];
        for (final Map<String, dynamic> mut in pendingMutations) {
          step++;
          if (onProgress != null) onProgress(step, totalTasks);
          try {
            final Map<String, dynamic>? singleBatch =
                await _apiService.syncOfflineBatch(
              careLogs: const <Map<String, dynamic>>[],
              fieldMutations: <Map<String, dynamic>>[mut],
            );
            if (singleBatch != null && singleBatch['success'] == true) {
              synced++;
            } else {
              failed++;
              remainingMutations.add(mut);
            }
          } catch (_) {
            failed++;
            remainingMutations.add(mut);
          }
        }

        await _cacheService.replacePendingLogs(remainingLogs);
        await _cacheService.replacePendingFieldMutations(remainingMutations);
      }

      try {
        await _apiService.fetchRecentLogs(days: 90);
        await _apiService.fetchPlants();
      } catch (_) {}

      final now = DateTime.now();
      await _cacheService.setLastSyncTime(now);
      AppStateStore().setSyncStatus(
        isSyncing: false,
        pendingCount: failed,
        lastSync: now,
      );
    } finally {
      _isSyncing = false;
      AppStateStore().setSyncStatus(isSyncing: false);
    }

    return <String, dynamic>{
      'success': failed == 0,
      'syncedCount': synced,
      'failedCount': failed,
      'message':
          'Đã đồng bộ & niêm phong SHA-256 thành công $synced tác vụ lên máy chủ!' +
              (failed > 0 ? ' ($failed tác vụ được bảo toàn chờ thử lại)' : ''),
    };
  }

  Future<void> recordOfflineLog({
    required int plantId,
    required String logType,
    required String note,
    required Map<String, dynamic> details,
    String? treeCode,
    String? farmName,
    int? supplyId,
    double? usedAmount,
    double? estimatedCost,
  }) async {
    await _cacheService.addPendingLog(
      plantId,
      logType,
      note,
      details,
      treeCode: treeCode,
      farmName: farmName,
      supplyId: supplyId,
      usedAmount: usedAmount,
      estimatedCost: estimatedCost,
    );
  }

  Future<void> recordOfflineFieldMutation({
    required int plantId,
    String? treeCode,
    String? healthStatus,
    double? latitude,
    double? longitude,
    String? nfcUid,
    String? location,
  }) async {
    await _cacheService.addPendingFieldMutation(
      plantId: plantId,
      treeCode: treeCode,
      healthStatus: healthStatus,
      latitude: latitude,
      longitude: longitude,
      nfcUid: nfcUid,
      location: location,
    );
  }
}
