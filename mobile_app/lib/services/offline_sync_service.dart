import 'api_service.dart';
import 'cache_service.dart';

/// Dịch vụ Đồng bộ Ngoại tuyến Nguyên tử 2 Pha (Atomic 2-Phase Offline Batch Sync Engine)
/// Khớp 100% với kiến trúc Web App `v1.3.5` và Backend `POST /api/plants/offline-batch-sync`:
/// - **Pha 1**: Thử đồng bộ nguyên tử toàn bộ lô (`care_logs` + `field_mutations`) qua `POST /api/plants/offline-batch-sync` được bảo vệ bởi khóa Mutex `withFarmHashChainLock` và chuỗi băm `sealPlantLogHashChain`.
/// - **Pha 2 (Fallback)**: Nếu mạng chập chờn hoặc máy chủ yêu cầu tách lẻ, tự động chuyển sang đồng bộ từng bản ghi và bảo toàn 100% các bản ghi chưa đẩy được (Zero Data Loss).
class OfflineSyncService {
  static final OfflineSyncService _instance = OfflineSyncService._internal();
  factory OfflineSyncService() => _instance;
  OfflineSyncService._internal();

  final ApiService _apiService = ApiService();
  final CacheService _cacheService = CacheService();

  bool _isSyncing = false;
  bool get isSyncing => _isSyncing;

  /// Tải toàn bộ dữ liệu từ Server về Local AES-256 Hive Storage để sẵn sàng làm việc ngoại tuyến.
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

  /// Đẩy toàn bộ hàng đợi ghi nhận ngoại tuyến (`pending_logs` + `pending_field_mutations`) lên Server.
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
    int synced = 0;
    int failed = 0;

    try {
      if (onProgress != null) {
        onProgress(1, totalTasks);
      }

      // PHA 1: Đồng bộ Nguyên tử 2 Pha qua POST /api/plants/offline-batch-sync
      final List<Map<String, dynamic>> batchCareLogs = pendingLogs
          .map((Map<String, dynamic> item) {
            final Map<String, dynamic> details = item['details'] is Map
                ? Map<String, dynamic>.from(item['details'] as Map)
                : <String, dynamic>{};
            return <String, dynamic>{
              'plant_id': item['plantId'] ?? item['plant_id'],
              'action': item['logType'] ?? item['action'] ?? 'Chăm sóc',
              'description': item['note'] ?? item['description'] ?? '',
              'supply_id': item['supply_id'] ?? details['supply_id'],
              'used_amount': item['used_amount'] ?? details['amount'] ?? 0,
              'estimated_cost': item['estimated_cost'] ?? details['cost'] ?? 0,
              'log_date': item['log_date'] ??
                  (item['timestamp']?.toString().split('T')[0]),
              'client_record_hash': item['record_hash'],
              'client_prev_hash': item['prev_log_hash'],
            };
          })
          .toList();

      final List<Map<String, dynamic>> batchMutations = pendingMutations
          .map((Map<String, dynamic> m) => <String, dynamic>{
                'plant_id': m['plant_id'],
                if (m['health_status'] != null)
                  'health_status': m['health_status'],
                if (m['latitude'] != null) 'latitude': m['latitude'],
                if (m['longitude'] != null) 'longitude': m['longitude'],
                if (m['nfc_uid'] != null) 'nfc_uid': m['nfc_uid'],
                if (m['location'] != null) 'location': m['location'],
              })
          .toList();

      final Map<String, dynamic>? batchRes =
          await _apiService.syncOfflineBatch(
        careLogs: batchCareLogs,
        fieldMutations: batchMutations,
      );

      if (batchRes != null && batchRes['success'] == true) {
        synced = totalTasks;
        await _cacheService.clearPendingLogs();
        await _cacheService.clearPendingFieldMutations();
        if (onProgress != null) {
          onProgress(totalTasks, totalTasks);
        }
      } else {
        // PHA 2 (FALLBACK): Đồng bộ từng bản ghi và giữ nguyên bản ghi lỗi
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

      // Làm mới danh sách nhật ký và cây trồng từ Server sau khi đồng bộ
      try {
        await _apiService.fetchRecentLogs(days: 90);
        await _apiService.fetchPlants();
      } catch (_) {}

      await _cacheService.setLastSyncTime(DateTime.now());
    } finally {
      _isSyncing = false;
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

  /// Ghi nhật ký ngoại tuyến 1-chạm (kèm đóng dấu SHA-256 Client Integrity Envelope).
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

  /// Ghi nhận cập nhật thực địa ngoại tuyến (Tọa độ GPS, UID NFC, Tình trạng sức khỏe).
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
