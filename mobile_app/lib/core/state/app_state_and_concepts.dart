import 'package:flutter/foundation.dart';
import '../../models/farm.dart';
import '../../models/plant.dart';

/// Nguồn chân lý duy nhất (Single Source of Truth) cho toàn bộ
/// biến khái niệm (domain concepts, constants, endpoints, RBAC, codes)
/// của ứng dụng di động TBSG AgTech.
class AppConcepts {
  AppConcepts._();

  // --- Version & Branding ---
  static const String appVersion = 'v1.3.7';
  static const String buildNumber = '21';
  static const String fullBuildTag = 'v1.3.7+21';
  static const String clientVersionHeader = '1.3.7+21';
  static const String userAgent =
      'PlantBookMobileApp/1.3.7 (Android; Flutter; Enterprise-Security)';
  static const String appName = 'Sổ Nông Điện Tử';
  static const String brandOwner = 'TBSG Agtech © 2026';
  static const String loginFooter =
      'Bảo mật SSL/TLS · FIPS 180-4 SHA-256 · Phát triển & Sở hữu bởi TBSG Agtech © 2026';
  static const String appFooter =
      'Sổ Nông Tân Bảo v1.3.7 · Bản quyền © 2026 TBSG Agtech';
  static const String securityStandardBadge =
      'OWASP MASVS v2.0 · ISO/IEC 27001 · Gallagher 8.30 · NIST FIPS 180-4';

  // --- Endpoints & Timeouts ---
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://plant-book.onrender.com/api',
  );
  static const String wsUrl = String.fromEnvironment(
    'WS_BASE_URL',
    defaultValue: 'wss://plant-book.onrender.com',
  );
  static const Duration defaultHttpTimeout = Duration(seconds: 10);
  static const Duration aiChatTimeout = Duration(seconds: 35);
  static const Duration wsConnectTimeout = Duration(seconds: 15);
  static const int wsBaseReconnectSeconds = 5;
  static const int wsMaxReconnectSeconds = 60;

  // --- Domain & Health Concepts ---
  static const String healthGood = 'Tốt';
  static const String healthWatch = 'Cần chú ý';
  static const String healthSick = 'Bệnh';

  static bool isSickOrWatch(String status) {
    final lower = status.trim().toLowerCase();
    return lower.contains('bệnh') || lower.contains('chú ý');
  }

  /// Chuẩn hóa hiển thị diện tích nông trại khớp 100% logic Backend (`ha` mặc định,
  /// tự động quy đổi ngược nếu dữ liệu cũ còn ở đơn vị `m² >= 1000`).
  static String formatFarmArea(double totalArea, int farmCount) {
    if (totalArea <= 0) {
      return '$farmCount Vườn';
    }
    if (totalArea >= 1000) {
      return '${(totalArea / 10000).toStringAsFixed(2)} ha';
    }
    if (totalArea < 0.1) {
      return '${(totalArea * 10000).toStringAsFixed(0)} m²';
    }
    return '${totalArea.toStringAsFixed(2)} ha';
  }

  // --- GeoFence Concepts ---
  static const double nfcGeofenceMaxMeters = 8.0;
  static const String geoStatusVerifiedOk = 'VERIFIED_OK';
  static const String geoStatusExceeded = 'GEOFENCE_EXCEEDED';
  static const String geoStatusNoGpsData = 'NO_GPS_DATA';
  static const String geoStatusNoGpsProvider = 'NO_GPS_PROVIDER';

  // --- Offline Sync Permanent Reject Codes ---
  static const Set<String> permanentRejectCodes = <String>{
    'PHI_VIOLATION_BLOCKED',
    'SUPPLY_EXPIRED',
    'READONLY_ROLE_FORBIDDEN',
    'PLANT_ACCESS_DENIED',
    'FARM_ACCESS_DENIED',
    'INVALID_GPS_ISO19115',
    'INVALID_NFC_UID',
    'INVALID_PLANT_ID',
    'INVALID_MUTATION_TYPE',
    'PLANT_NOT_FOUND',
    'FORBIDDEN',
  };

  // --- Security & RBAC Concepts ---
  static const String genesisHashAnchor = 'GENESIS_PLANT_BOOK_ENTERPRISE_2026';
  static const String roleAdmin = 'admin';
  static const String roleSuperAdmin = 'superadmin';
  static const String subRoleFarmOwner = 'farm_owner';
  static const String subRoleCareWorker = 'care_worker';
  static const String subRoleWarehouseManager = 'warehouse_manager';
  static const String subRoleAuditorReadonly = 'auditor_readonly';

  // --- Notification Concepts ---
  static const String criticalChannelId = 'tbsg_critical_alerts';
  static const String generalChannelId = 'tbsg_general_updates';
  static const String severityDanger = 'danger';
  static const String severityAuditSilent = 'audit_silent';
  static const String soundSiren = 'siren';
  static const String soundSilent = 'silent';

  // --- AI Chat Concepts ---
  static const int aiMaxHistoryMessages = 10;
  static const String aiWelcomeMessage =
      '🌱 **Chào Bác! Em là Bé Mầm - Trợ lý Nông nghiệp Thông minh.**\n\n'
      'Bác cần tư vấn kỹ thuật canh tác sầu riêng, tra cứu liều lượng phân thuốc, '
      'quy trình VietGAP hay kiểm tra chi phí vườn hôm nay ạ? ✨';

  static const List<String> aiQuickSuggestions = <String>[
    '🌱 Hướng dẫn sử dụng app',
    '🏡 Danh sách trang trại của tôi',
    '💰 Tổng chi phí vật tư đã dùng',
    '🌿 Cách xử lý vàng lá thối rễ',
    '💊 Thời gian cách ly thuốc BVTV',
    '📝 Nhật ký canh tác gần đây',
  ];
}

/// Kho trạng thái tập trung toàn ứng dụng (Centralized Reactive State Store).
class AppStateStore extends ChangeNotifier {
  static final AppStateStore _instance = AppStateStore._internal();
  factory AppStateStore() => _instance;
  AppStateStore._internal();

  Map<String, dynamic>? _currentUser;
  List<Farm> _farms = <Farm>[];
  List<Plant> _plants = <Plant>[];
  List<Map<String, dynamic>> _notifications = <Map<String, dynamic>>[];
  int _unreadNotificationCount = 0;
  Map<String, dynamic>? _supplyAnalytics;
  int? _activeFarmId;
  int? _activePlantId;
  bool _wsConnected = false;
  bool _isSyncingOffline = false;
  int _pendingSyncCount = 0;
  DateTime? _lastSyncTime;
  int _selectedTabIndex = 0;

  Map<String, dynamic>? get currentUser =>
      _currentUser == null ? null : Map<String, dynamic>.from(_currentUser!);
  List<Farm> get farms => List<Farm>.unmodifiable(_farms);
  List<Plant> get plants => List<Plant>.unmodifiable(_plants);
  List<Map<String, dynamic>> get notifications =>
      List<Map<String, dynamic>>.unmodifiable(_notifications);
  int get unreadNotificationCount => _unreadNotificationCount;
  Map<String, dynamic>? get supplyAnalytics => _supplyAnalytics == null
      ? null
      : Map<String, dynamic>.from(_supplyAnalytics!);
  int? get activeFarmId => _activeFarmId;
  int? get activePlantId => _activePlantId;
  bool get wsConnected => _wsConnected;
  bool get isSyncingOffline => _isSyncingOffline;
  int get pendingSyncCount => _pendingSyncCount;
  DateTime? get lastSyncTime => _lastSyncTime;
  int get selectedTabIndex => _selectedTabIndex;

  void setDashboardSnapshot({
    List<Farm>? farms,
    List<Plant>? plants,
    Map<String, dynamic>? userProfile,
    Map<String, dynamic>? supplyAnalytics,
  }) {
    if (farms != null) {
      _farms = List<Farm>.from(farms);
    }
    if (plants != null) {
      _plants = List<Plant>.from(plants);
    }
    if (userProfile != null) {
      _currentUser = Map<String, dynamic>.from(userProfile);
    }
    if (supplyAnalytics != null) {
      _supplyAnalytics = Map<String, dynamic>.from(supplyAnalytics);
    }
    notifyListeners();
  }

  void setNotifications(
    List<Map<String, dynamic>> items, {
    int? unreadCount,
  }) {
    _notifications = items
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    _unreadNotificationCount = unreadCount ??
        _notifications.where((n) => n['is_read'] != true).length;
    notifyListeners();
  }

  void setActiveContext({int? farmId, int? plantId}) {
    _activeFarmId = farmId;
    _activePlantId = plantId;
    notifyListeners();
  }

  void setWsConnected(bool connected) {
    if (_wsConnected == connected) return;
    _wsConnected = connected;
    notifyListeners();
  }

  void setSyncStatus({
    bool? isSyncing,
    int? pendingCount,
    DateTime? lastSync,
  }) {
    if (isSyncing != null) _isSyncingOffline = isSyncing;
    if (pendingCount != null) _pendingSyncCount = pendingCount;
    if (lastSync != null) _lastSyncTime = lastSync;
    notifyListeners();
  }

  void setSelectedTabIndex(int index) {
    if (_selectedTabIndex == index) return;
    _selectedTabIndex = index;
    notifyListeners();
  }

  void reset() {
    _currentUser = null;
    _farms = <Farm>[];
    _plants = <Plant>[];
    _notifications = <Map<String, dynamic>>[];
    _unreadNotificationCount = 0;
    _supplyAnalytics = null;
    _activeFarmId = null;
    _activePlantId = null;
    _wsConnected = false;
    _isSyncingOffline = false;
    _pendingSyncCount = 0;
    _lastSyncTime = null;
    _selectedTabIndex = 0;
    notifyListeners();
  }
}
