import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../core/state/app_state_and_concepts.dart';
import 'api_service.dart';
import 'websocket_service.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  static const String criticalChannelId = AppConcepts.criticalChannelId;
  static const String generalChannelId = AppConcepts.generalChannelId;

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  final ApiService _apiService = ApiService();

  final ValueNotifier<int> unreadCount = ValueNotifier<int>(0);
  final ValueNotifier<List<Map<String, dynamic>>> notifications = ValueNotifier<List<Map<String, dynamic>>>([]);

  Map<String, dynamic> _preferences = {
    'sound_enabled': true,
    'sound_profile': 'chime',
    'quiet_hours_enabled': false,
    'quiet_start': '22:00',
    'quiet_end': '06:00',
  };

  Map<String, dynamic> get preferences => Map<String, dynamic>.from(_preferences);

  bool _initialized = false;
  StreamSubscription<Map<String, dynamic>>? _wsSubscription;

  Future<void> init() async {
    if (!_initialized) {
      const AndroidInitializationSettings androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const DarwinInitializationSettings iosSettings = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );
      const InitializationSettings initSettings = InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      );

      try {
        await _plugin.initialize(initSettings);
        final AndroidFlutterLocalNotificationsPlugin? androidImpl =
            _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
        if (androidImpl != null) {
          await androidImpl.requestNotificationsPermission();
          await androidImpl.createNotificationChannel(
            const AndroidNotificationChannel(
              criticalChannelId,
              'Cảnh báo Khẩn cấp & An ninh',
              description: 'Báo động sâu bệnh nặng, vi phạm PHI, cảnh báo NFC và bảo mật',
              importance: Importance.max,
              playSound: true,
              enableVibration: true,
            ),
          );
          await androidImpl.createNotificationChannel(
            const AndroidNotificationChannel(
              generalChannelId,
              'Cập nhật Canh tác & Thẻ NFC',
              description: 'Thông báo gắn thẻ cây, nhật ký chăm sóc và lịch nông vụ',
              importance: Importance.defaultImportance,
              playSound: true,
            ),
          );
        }
      } catch (_) {}

      _wsSubscription?.cancel();
      _wsSubscription = WebSocketService().stream.listen(_handleWsMessage);
      _initialized = true;
    }

    await Future.wait([
      refreshNotifications(),
      loadPreferences(),
    ]);
  }

  static bool isWithinQuietHoursFor(
    Map<String, dynamic> prefs,
    DateTime now,
  ) {
    if (prefs['quiet_hours_enabled'] != true) return false;
    final nowM = now.hour * 60 + now.minute;
    final startParts = (prefs['quiet_start']?.toString() ?? '22:00').split(':');
    final endParts = (prefs['quiet_end']?.toString() ?? '06:00').split(':');
    final sM = (int.tryParse(startParts[0]) ?? 22) * 60 +
        (startParts.length > 1 ? (int.tryParse(startParts[1]) ?? 0) : 0);
    final eM = (int.tryParse(endParts[0]) ?? 6) * 60 +
        (endParts.length > 1 ? (int.tryParse(endParts[1]) ?? 0) : 0);
    return sM < eM ? (nowM >= sM && nowM < eM) : (nowM >= sM || nowM < eM);
  }

  bool _isWithinQuietHours() => isWithinQuietHoursFor(_preferences, DateTime.now());

  Future<void> _handleWsMessage(Map<String, dynamic> msg) async {
    if (msg['event'] != 'new_notification') return;
    final dynamic rawData = msg['data'];
    if (rawData is! Map) return;

    final dynamic rawNotif = rawData['notification'] ?? rawData;
    if (rawNotif is! Map) return;
    final notifMap = Map<String, dynamic>.from(rawNotif);

    final updated = List<Map<String, dynamic>>.from(notifications.value);
    final existingIdx = updated.indexWhere((n) => n['id'] == notifMap['id']);
    if (existingIdx >= 0) {
      updated[existingIdx] = notifMap;
    } else {
      updated.insert(0, notifMap);
    }
    notifications.value = updated;
    unreadCount.value = updated.where((n) => n['is_read'] != true).length;
    AppStateStore().setNotifications(updated, unreadCount: unreadCount.value);

    final severity = (notifMap['severity'] ?? notifMap['type'] ?? 'info').toString().toLowerCase();
    final soundProfile = (rawData['sound_profile'] ?? notifMap['sound_profile'] ?? 'chime').toString().toLowerCase();
    if (severity == AppConcepts.severityAuditSilent || soundProfile == AppConcepts.soundSilent) return;

    final bool isDanger = severity == AppConcepts.severityDanger || soundProfile == AppConcepts.soundSiren;
    if (isDanger) {
      HapticFeedback.heavyImpact();
    } else if (_preferences['sound_enabled'] != true || _isWithinQuietHours()) {
      await _showTrayNotification(notifMap, isDanger: false, playSound: false);
      return;
    }

    await _showTrayNotification(notifMap, isDanger: isDanger, playSound: true);
  }

  Future<void> _showTrayNotification(
    Map<String, dynamic> notif, {
    required bool isDanger,
    required bool playSound,
  }) async {
    try {
      final int id = (notif['id'] is int)
          ? notif['id'] as int
          : DateTime.now().millisecondsSinceEpoch.remainder(100000);
      final AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
        isDanger ? criticalChannelId : generalChannelId,
        isDanger ? 'Cảnh báo Khẩn cấp & An ninh' : 'Cập nhật Canh tác & Thẻ NFC',
        importance: isDanger ? Importance.max : Importance.defaultImportance,
        priority: isDanger ? Priority.high : Priority.defaultPriority,
        playSound: playSound,
        enableVibration: isDanger,
        vibrationPattern: isDanger ? Int64List.fromList([0, 300, 150, 300]) : null,
      );
      final DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: playSound,
      );
      await _plugin.show(
        id,
        notif['title']?.toString() ?? 'Sổ Nông Tân Bảo',
        notif['message']?.toString() ?? '',
        NotificationDetails(android: androidDetails, iOS: iosDetails),
      );
    } catch (_) {}
  }

  Future<void> refreshNotifications() async {
    final res = await _apiService.fetchNotifications();
    final dynamic rawList = res['notifications'];
    if (rawList is List) {
      final list = rawList.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      notifications.value = list;
      unreadCount.value = (res['unread_count'] as int?) ?? list.where((n) => n['is_read'] != true).length;
      AppStateStore().setNotifications(list, unreadCount: unreadCount.value);
    }
  }

  Future<void> loadPreferences() async {
    final p = await _apiService.fetchNotificationPreferences();
    _preferences = p;
  }

  Future<bool> updatePreferences(Map<String, dynamic> patch) async {
    _preferences = {..._preferences, ...patch};
    return _apiService.updateNotificationPreferences(_preferences);
  }

  Future<void> markRead(int id) async {
    final ok = await _apiService.markNotificationRead(id);
    if (ok) {
      await refreshNotifications();
    }
  }

  Future<void> markAllRead() async {
    final ok = await _apiService.markAllNotificationsRead();
    if (ok) {
      await refreshNotifications();
    }
  }

  Future<void> archive(int id) async {
    final ok = await _apiService.deleteNotification(id);
    if (ok) {
      await refreshNotifications();
    }
  }

  Future<bool> registerExternalPushToken(String platform, String token, {String? deviceLabel}) {
    return _apiService.registerPushToken(platform: platform, token: token, deviceLabel: deviceLabel);
  }
}
