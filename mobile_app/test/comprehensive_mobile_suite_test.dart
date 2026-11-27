import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile_app/core/i18n/app_localizations.dart';
import 'package:mobile_app/core/security/crypto_security_service.dart';
import 'package:mobile_app/core/security/rbac_policy.dart';
import 'package:mobile_app/core/state/app_state_and_concepts.dart';
import 'package:mobile_app/core/theme/fluent_icons.dart';
import 'package:mobile_app/models/farm.dart';
import 'package:mobile_app/models/plant.dart';
import 'package:mobile_app/models/plant_log.dart';
import 'package:mobile_app/models/supply.dart';
import 'package:mobile_app/pages/ai_chat_page.dart';
import 'package:mobile_app/pages/login_page.dart';
import 'package:mobile_app/services/api_service.dart';
import 'package:mobile_app/services/geo_fence_service.dart';
import 'package:mobile_app/services/notification_service.dart';
import 'package:mobile_app/services/websocket_service.dart';
import 'package:mobile_app/utils/theme.dart';

http.Response _jsonResponse(Map<String, dynamic> body, [int status = 200]) {
  return http.Response.bytes(
    utf8.encode(jsonEncode(body)),
    status,
    headers: const {'content-type': 'application/json; charset=utf-8'},
  );
}

void main() {
  setUp(() {
    AppStateStore().reset();
    ApiService().resetForTesting();
  });

  tearDown(() {
    WebSocketService().close();
    ApiService().resetForTesting();
    AppStateStore().reset();
  });

  // =========================================================================
  // TRỤ CỘT 1: LOGIC NGHIỆP VỤ & TIỆN ÍCH CỐT LÕI
  // =========================================================================
  group('Pillar 1 - Logic: Farm Area, Health, Geofence, Backoff, RBAC & Markdown', () {
    test('AppConcepts.formatFarmArea handles zero, ha, sub-0.1 ha, and legacy m2 accurately', () {
      expect(AppConcepts.formatFarmArea(0, 3), equals('3 Vườn'));
      expect(AppConcepts.formatFarmArea(1.5, 1), equals('1.50 ha'));
      expect(AppConcepts.formatFarmArea(0.05, 1), equals('500 m²'));
      expect(AppConcepts.formatFarmArea(25000, 2), equals('2.50 ha'));
    });

    test('AppConcepts.isSickOrWatch classifies plant health labels consistently', () {
      expect(AppConcepts.isSickOrWatch(AppConcepts.healthGood), isFalse);
      expect(AppConcepts.isSickOrWatch(AppConcepts.healthWatch), isTrue);
      expect(AppConcepts.isSickOrWatch(AppConcepts.healthSick), isTrue);
      expect(AppConcepts.isSickOrWatch('Cây đang BỆNH nhẹ'), isTrue);
    });

    test('GeoFenceService evaluates Haversine distance, swapped coords, >8m limit & GPS provider state', () async {
      final d = GeoFenceService.calculateHaversineDistance(
        lat1: 10.776889,
        lng1: 106.700806,
        lat2: 10.776895,
        lng2: 106.700810,
      );
      expect(d, isNotNull);
      expect(d!, lessThan(8.0));

      final swapped = GeoFenceService.calculateHaversineDistance(
        lat1: 106.700806,
        lng1: 10.776889,
        lat2: 10.776895,
        lng2: 106.700810,
      );
      expect(swapped, isNotNull);
      expect(swapped!, lessThan(8.0));

      final okRes = GeoFenceService.evaluateGeofence(
        plantLat: 10.776895,
        plantLng: 106.700810,
        scanLat: 10.776889,
        scanLng: 106.700806,
      );
      expect(okRes.isWithinGeofence, isTrue);
      expect(okRes.status, equals(AppConcepts.geoStatusVerifiedOk));

      final exceededRes = GeoFenceService.evaluateGeofence(
        plantLat: 10.778000,
        plantLng: 106.700806,
        scanLat: 10.776889,
        scanLng: 106.700806,
      );
      expect(exceededRes.isWithinGeofence, isFalse);
      expect(exceededRes.status, equals(AppConcepts.geoStatusExceeded));

      final noProviderRes = GeoFenceService.evaluateGeofence(
        plantLat: 10.776895,
        plantLng: 106.700810,
        scanLat: null,
        scanLng: null,
        hasGpsProvider: false,
      );
      expect(noProviderRes.status, equals(AppConcepts.geoStatusNoGpsProvider));

      final geoWithProvider = GeoFenceService(
        positionProvider: () async =>
            const GeoPosition(latitude: 10.925, longitude: 107.24),
      );
      expect(geoWithProvider.hasPositionProvider, isTrue);
      final pos = await geoWithProvider.getCurrentPositionSafe();
      expect(pos?.latitude, equals(10.925));
    });

    test('WebSocketService.computeReconnectDelay uses bounded exponential backoff (5s..60s)', () {
      expect(WebSocketService.computeReconnectDelay(0).inSeconds, equals(5));
      expect(WebSocketService.computeReconnectDelay(1).inSeconds, equals(10));
      expect(WebSocketService.computeReconnectDelay(2).inSeconds, equals(20));
      expect(WebSocketService.computeReconnectDelay(3).inSeconds, equals(40));
      expect(WebSocketService.computeReconnectDelay(4).inSeconds, equals(60));
      expect(WebSocketService.computeReconnectDelay(10).inSeconds, equals(60));
    });

    test('RbacPolicy enforces finance redaction & role permissions across all 4 sub-roles', () {
      final owner = <String, dynamic>{'role': 'user', 'sub_role': AppConcepts.subRoleFarmOwner};
      final worker = <String, dynamic>{'role': 'user', 'sub_role': AppConcepts.subRoleCareWorker};
      final warehouse = <String, dynamic>{'role': 'user', 'sub_role': AppConcepts.subRoleWarehouseManager};
      final auditor = <String, dynamic>{'role': 'user', 'sub_role': AppConcepts.subRoleAuditorReadonly};

      expect(RbacPolicy.isFinanceRedacted(owner), isFalse);
      expect(RbacPolicy.isFinanceRedacted(worker), isTrue);
      expect(RbacPolicy.isFinanceRedacted(warehouse), isTrue);
      expect(RbacPolicy.isFinanceRedacted(auditor), isTrue);
      expect(RbacPolicy.canRecordCareLogs(worker), isTrue);
      expect(RbacPolicy.canManageSupplies(warehouse), isTrue);
      expect(RbacPolicy.canEditPlants(warehouse), isFalse);
      expect(RbacPolicy.canRecordCareLogs(auditor), isFalse);
      expect(RbacPolicy.canIssueOrRevokeNfcCard(owner), isTrue);
    });

    test('SimpleMarkdownText.parseInlineSpans strips ** and formats bold & inline code', () {
      final spans = SimpleMarkdownText.parseInlineSpans(
        'Bón **NPK 16-16-8** với mã `SUP-01` đúng liều.',
        const TextStyle(fontSize: 14),
      );
      final textSpans = spans.whereType<TextSpan>().toList();
      expect(textSpans.any((s) => s.text == 'NPK 16-16-8' && s.style?.fontWeight == FontWeight.w700), isTrue);
      expect(textSpans.any((s) => (s.text ?? '').contains('SUP-01') && s.style?.fontFamily == 'monospace'), isTrue);
      expect(textSpans.any((s) => (s.text ?? '').contains('**')), isFalse);
    });
  });

  // =========================================================================
  // TRỤ CỘT 2: GIAO TIẾP BACKEND & HỢP ĐỒNG API (MOCK CLIENT)
  // =========================================================================
  group('Pillar 2 - Backend API Contract (MockClient)', () {
    test('ApiService.login handles standard 200 login and populates AppStateStore', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, endsWith('/auth/login'));
        return _jsonResponse({
          'token': 'jwt-standard-123',
          'user': {
            'id': 12,
            'email': 'farmer@tanbao.vn',
            'role': 'user',
            'sub_role': 'farm_owner',
            'full_name': 'Nông dân A',
          },
        });
      });
      ApiService().setHttpClientForTesting(mockClient);

      final res = await ApiService().login('farmer@tanbao.vn', 'secret');
      expect(res['success'], isTrue);
      expect(await ApiService().token, equals('jwt-standard-123'));
      expect(AppStateStore().currentUser?['email'], equals('farmer@tanbao.vn'));
    });

    test('ApiService.login handles Admin TOTP MFA challenge, invalid OTP (401), and valid OTP (200)', () async {
      final mockClient = MockClient((request) async {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        final otp = body['totp_code']?.toString() ?? '';
        if (otp.isEmpty) {
          return _jsonResponse({
            'success': false,
            'mfa_required': true,
            'code': 'MFA_TOTP_REQUIRED',
            'mfa_challenge_token': 'challenge-xyz',
            'message': 'Vui lòng nhập mã xác thực 2 lớp (TOTP 6 số).',
          });
        }
        if (otp != '123456') {
          return _jsonResponse({
            'error': 'Mã xác thực 2 lớp (OTP) không chính xác.',
            'code': 'INVALID_MFA_CODE',
          }, 401);
        }
        return _jsonResponse({
          'token': 'jwt-admin-mfa-ok',
          'user': {'id': 1, 'email': 'admin@tanbao.vn', 'role': 'admin'},
        });
      });
      ApiService().setHttpClientForTesting(mockClient);

      final step1 = await ApiService().login('admin@tanbao.vn', 'AdminPass!');
      expect(step1['success'], isFalse);
      expect(step1['mfa_required'], isTrue);
      expect(step1['code'], equals('MFA_TOTP_REQUIRED'));

      final stepBad = await ApiService().login('admin@tanbao.vn', 'AdminPass!', totpCode: '000000');
      expect(stepBad['success'], isFalse);
      expect(stepBad['code'], equals('INVALID_MFA_CODE'));

      final stepOk = await ApiService().login('admin@tanbao.vn', 'AdminPass!', totpCode: '123456');
      expect(stepOk['success'], isTrue);
      expect(await ApiService().token, equals('jwt-admin-mfa-ok'));
      expect(AppStateStore().currentUser?['role'], equals(AppConcepts.roleAdmin));
    });

    test('ApiService.fetchNotifications returns Map with unread_count & notifications list (regression guard)', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, endsWith('/notifications'));
        return _jsonResponse({
          'success': true,
          'unread_count': 2,
          'notifications': [
            {'id': 10, 'title': 'Cảnh báo sâu bệnh', 'is_read': false},
            {'id': 11, 'title': 'Nhật ký mới', 'is_read': false},
          ],
        });
      });
      ApiService().setHttpClientForTesting(mockClient);
      ApiService().setTokenForTesting('jwt-test');

      final res = await ApiService().fetchNotifications();
      expect(res['unread_count'], equals(2));
      expect(res['notifications'], isA<List>());
      expect((res['notifications'] as List).length, equals(2));
    });

    test('ApiService.sendAiChatMessage transmits history, active context, handles 200 & 429', () async {
      Map<String, dynamic>? capturedPayload;
      int callCount = 0;

      final mockClient = MockClient((request) async {
        callCount++;
        capturedPayload = jsonDecode(request.body) as Map<String, dynamic>;
        if (callCount == 1) {
          return _jsonResponse({'reply': '### Khuyến nghị\nBón **NPK** định kỳ.'});
        }
        return _jsonResponse({'error': 'Rate limit exceeded'}, 429);
      });
      ApiService().setHttpClientForTesting(mockClient);
      ApiService().setTokenForTesting('jwt-test');

      final reply = await ApiService().sendAiChatMessage(
        'Vườn 2 bón gì?',
        history: [
          {'role': 'user', 'text': 'Chào Bé Mầm'},
        ],
        activeFarmId: 2,
        activePlantId: 45,
      );
      expect(reply, contains('Khuyến nghị'));
      expect(capturedPayload?['active_farm_id'], equals(2));
      expect(capturedPayload?['active_plant_id'], equals(45));
      expect((capturedPayload?['history'] as List).length, equals(1));

      final rateLimitMsg = await ApiService().sendAiChatMessage('Hỏi liên tục');
      expect(rateLimitMsg, equals('Rate limit exceeded'));
    });

    test('CryptoSecurityService.signRequestHeaders uses v1.3.7+21 client version & 64-hex HMAC', () {
      final headers = CryptoSecurityService.signRequestHeaders(
        method: 'POST',
        endpointPath: '/api/ai/chat',
        bodyJson: '{"message":"hello"}',
        jwtToken: 'tok-abc',
      );
      expect(headers['X-Client-Version'], equals(AppConcepts.clientVersionHeader));
      expect(headers['X-Client-Signature']?.length, equals(64));
      expect(headers['X-Content-SHA256']?.length, equals(64));
    });
  });

  // =========================================================================
  // TRỤ CỘT 3: GIAO DIỆN NGƯỜI DÙNG (WIDGET TESTS)
  // =========================================================================
  group('Pillar 3 - UI & Widgets: Login MFA Dialog, AiChat Markdown & Fluent Design', () {
    testWidgets('LoginPage opens TOTP MFA dialog on mfa_required and validates OTP inline', (tester) async {
      final mockClient = MockClient((request) async {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        final otp = body['totp_code']?.toString() ?? '';
        if (otp.isEmpty) {
          return _jsonResponse({
            'success': false,
            'mfa_required': true,
            'message': 'Nhập mã OTP từ Authenticator.',
          });
        }
        return _jsonResponse({'error': 'Mã OTP không chính xác.'}, 401);
      });
      ApiService().setHttpClientForTesting(mockClient);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const LoginPage(),
        ),
      );

      await tester.enterText(find.byKey(const Key('login_email_field')), 'admin@tanbao.vn');
      await tester.enterText(find.byKey(const Key('login_password_field')), 'Pass123!');
      await tester.ensureVisible(find.byKey(const Key('login_submit_button')));
      await tester.tap(find.byKey(const Key('login_submit_button')));
      await tester.pumpAndSettle();

      expect(find.text('Xác thực 2 lớp (TOTP MFA)'), findsOneWidget);
      expect(find.byKey(const Key('mfa_otp_input')), findsOneWidget);

      await tester.enterText(find.byKey(const Key('mfa_otp_input')), '123');
      await tester.tap(find.byKey(const Key('mfa_otp_submit')));
      await tester.pump();
      expect(find.text('Vui lòng nhập đủ 6 chữ số OTP.'), findsOneWidget);

      await tester.enterText(find.byKey(const Key('mfa_otp_input')), '999999');
      await tester.tap(find.byKey(const Key('mfa_otp_submit')));
      await tester.pumpAndSettle();
      expect(find.text('Mã OTP không chính xác.'), findsOneWidget);

      await tester.tap(find.text('Hủy'));
      await tester.pumpAndSettle();
      expect(find.text('Xác thực 2 lớp (TOTP MFA)'), findsNothing);
    });

    testWidgets('AiChatPage renders welcome & reply formatted without raw ** markers', (tester) async {
      final mockClient = MockClient((request) async {
        return _jsonResponse({
          'reply': '### Hướng dẫn\n- Bón **NPK 20-20-15**\n- Mã `LOT-A1`',
        });
      });
      ApiService().setHttpClientForTesting(mockClient);
      ApiService().setTokenForTesting('jwt-chat');
      AppStateStore().setActiveContext(farmId: 5, plantId: 88);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const AiChatPage(),
        ),
      );

      expect(find.textContaining('**'), findsNothing);
      expect(find.text(AppConcepts.aiQuickSuggestions.first), findsOneWidget);

      await tester.enterText(find.byKey(const Key('ai_chat_input')), 'Tư vấn bón phân');
      await tester.tap(find.byKey(const Key('ai_chat_send_button')));
      await tester.pumpAndSettle();

      expect(find.text('Tư vấn bón phân', findRichText: true), findsOneWidget);
      expect(find.text('Hướng dẫn', findRichText: true), findsOneWidget);
      expect(find.textContaining('NPK 20-20-15', findRichText: true), findsOneWidget);
      expect(find.textContaining('**'), findsNothing);
    });

    testWidgets('FluentCard and FluentSquircleIcon render and respond to taps', (tester) async {
      bool tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FluentCard(
              onTap: () => tapped = true,
              child: const Row(
                children: [
                  FluentSquircleIcon(icon: LucideIconName.sprout),
                  SizedBox(width: 12),
                  Text('Sổ Nông Tân Bảo'),
                ],
              ),
            ),
          ),
        ),
      );

      expect(find.text('Sổ Nông Tân Bảo'), findsOneWidget);
      await tester.tap(find.byType(FluentCard));
      expect(tapped, isTrue);
    });
  });

  // =========================================================================
  // TRỤ CỘT 4: DỮ LIỆU & KHO TRẠNG THÁI TẬP TRUNG
  // =========================================================================
  group('Pillar 4 - Data Models & Centralized AppStateStore', () {
    test('AppStateStore notifies listeners on snapshot, context, sync & reset', () {
      final store = AppStateStore();
      int notifyCount = 0;
      void listener() => notifyCount++;
      store.addListener(listener);

      final farm = Farm.fromJson({'id': 7, 'name': 'Vườn Đắk Lắk', 'area': 2.5});
      final plant = Plant.fromJson({'id': 99, 'tree_code': 'SR-099', 'plant_type': 'Sầu riêng', 'farm_id': 7});

      store.setDashboardSnapshot(
        farms: [farm],
        plants: [plant],
        userProfile: {'id': 3, 'role': 'user'},
      );
      store.setActiveContext(farmId: 7, plantId: 99);
      store.setNotifications([
        {'id': 1, 'title': 'A', 'is_read': false},
        {'id': 2, 'title': 'B', 'is_read': true},
      ]);
      store.setSyncStatus(isSyncing: true, pendingCount: 4);

      expect(store.farms.length, equals(1));
      expect(store.plants.first.globalDid, equals('did:gs1:vn:tbsg:farm-7:tree-99'));
      expect(store.activeFarmId, equals(7));
      expect(store.activePlantId, equals(99));
      expect(store.unreadNotificationCount, equals(1));
      expect(store.isSyncingOffline, isTrue);
      expect(store.pendingSyncCount, equals(4));
      expect(notifyCount, equals(4));

      store.reset();
      expect(store.farms, isEmpty);
      expect(store.currentUser, isNull);
      expect(store.unreadNotificationCount, equals(0));
      store.removeListener(listener);
    });

    test('PlantLog ledger audit distinguishes valid hash chains from tampered entries', () {
      final validHash = CryptoSecurityService.computePlantLogRecordHash(
        prevLogHash: CryptoSecurityService.genesisAnchor,
        plantId: 26,
        action: 'Bón phân',
        description: 'Bón gốc',
        supplyId: 3,
        usedAmount: 2.5,
        estimatedCost: 100000,
        logDate: '2026-11-27',
      );
      final auditOk = CryptoSecurityService.auditPlantLogsLedger([
        {
          'id': 1,
          'prev_log_hash': CryptoSecurityService.genesisAnchor,
          'record_hash': validHash,
        },
        {'id': 2, 'record_hash': ''},
      ]);
      expect(auditOk.isIntact, isTrue);
      expect(auditOk.verifiedRecords, equals(1));
      expect(auditOk.legacyUnsealedRecords, equals(1));

      final auditTampered = CryptoSecurityService.auditPlantLogsLedger([
        {'id': 15, 'prev_log_hash': '', 'record_hash': 'short_bad_hash'},
      ]);
      expect(auditTampered.isIntact, isFalse);
      expect(auditTampered.tamperedRecords, equals(1));
      expect(auditTampered.tamperedLogIds, contains(15));
    });

    test('Supply model preserves PHI quarantine days cleanly', () {
      final supply = Supply.fromJson({
        'id': 11,
        'user_id': 1,
        'category': 'Thuốc BVTV',
        'name': 'Hoạt chất sinh học A',
        'phi_days': 14,
      });
      expect(supply.phiDays, equals(14));
      expect(supply.name, equals('Hoạt chất sinh học A'));
    });
  });

  // =========================================================================
  // TRỤ CỘT 5: CÁCH VẬN HÀNH (OPERATIONAL FLOWS)
  // =========================================================================
  group('Pillar 5 - Operational Flows: Reject Codes, Quiet Hours & Logout', () {
    test('AppConcepts.permanentRejectCodes blocks unrecoverable items without infinite retry', () {
      expect(AppConcepts.permanentRejectCodes, contains('PHI_VIOLATION_BLOCKED'));
      expect(AppConcepts.permanentRejectCodes, contains('SUPPLY_EXPIRED'));
      expect(AppConcepts.permanentRejectCodes, contains('READONLY_ROLE_FORBIDDEN'));
      expect(AppConcepts.permanentRejectCodes, contains('INVALID_GPS_ISO19115'));
    });

    test('NotificationService.isWithinQuietHoursFor evaluates overnight windows accurately', () {
      final prefs = <String, dynamic>{
        'quiet_hours_enabled': true,
        'quiet_start': '22:00',
        'quiet_end': '06:00',
      };
      expect(NotificationService.isWithinQuietHoursFor(prefs, DateTime(2026, 11, 27, 23, 30)), isTrue);
      expect(NotificationService.isWithinQuietHoursFor(prefs, DateTime(2026, 11, 27, 5, 45)), isTrue);
      expect(NotificationService.isWithinQuietHoursFor(prefs, DateTime(2026, 11, 27, 9, 0)), isFalse);
    });

    test('ApiService.logout clears token, closes WebSocket, and resets AppStateStore', () async {
      final mockClient = MockClient((request) async => _jsonResponse({}));
      ApiService().setHttpClientForTesting(mockClient);
      ApiService().setTokenForTesting('active-jwt');
      AppStateStore().setWsConnected(true);
      AppStateStore().setActiveContext(farmId: 10);

      await ApiService().logout();
      expect(await ApiService().token, isNull);
      expect(AppStateStore().wsConnected, isFalse);
      expect(AppStateStore().activeFarmId, isNull);
    });
  });

  // =========================================================================
  // TRỤ CỘT 6: TÍNH NĂNG CƠ BẢN ĐẾN CHUYÊN SÂU
  // =========================================================================
  group('Pillar 6 - Features (Basic to Advanced): i18n, Executive BI, Carbon MRV & 5-Layer NTAG213', () {
    test('Basic: Multilingual i18n (vi/en/zh) & Executive BI ROI calculations', () {
      expect(AppLocalizations.translate('crop_durian_ri6', lang: 'vi'), contains('Ri6'));
      expect(AppLocalizations.translate('crop_durian_ri6', lang: 'en'), contains('Durian'));
      expect(AppLocalizations.translate('crop_durian_ri6', lang: 'zh'), contains('榴莲'));

      final bi = AppLocalizations.computeExecutiveBiMetrics(
        npkCostVnd: 50000000,
        pesticideCostVnd: 20000000,
        laborCostVnd: 20000000,
        waterCostVnd: 10000000,
        totalTrees: 200,
        totalAreaHa: 2.0,
        projectedRevenueVnd: 300000000,
      );
      expect(bi['total_investment_vnd'], equals(100000000.0));
      expect(bi['cost_per_tree_vnd'], equals(500000.0));
      expect(bi['cost_per_hectare_vnd'], equals(50000000.0));
      expect(bi['roi_percent'], equals(200.0));
    });

    test('Advanced: 5-Layer Gallagher NTAG213 verification & FIPS 180-4 integrity envelope', () {
      const uid = '04:B2:C3:D4:E5:F6:81';
      final sig = CryptoSecurityService.generateNtag213HmacSignature(nfcUid: uid, issueLevel: 3);
      final chuid = CryptoSecurityService.generatePivChuidHash(plantId: 42, nfcUid: uid, issueLevel: 3);

      final verified = CryptoSecurityService.verifyNtag213Scan5Layer(
        scannedUid: uid,
        expectedPlantUid: uid,
        scannedIssueLevel: 3,
        expectedIssueLevel: 3,
        scannedHmacSignature: sig,
        plantId: 42,
        expectedChuidHash: chuid,
        userLat: 10.77689,
        userLng: 106.70081,
        plantLat: 10.776895,
        plantLng: 106.700815,
      );
      expect(verified.isValid, isTrue);
      expect(verified.passedLayers, equals(5));

      final envelope = CryptoSecurityService.createClientIntegrityEnvelope(
        payload: {'plant_id': 42, 'action': 'Tưới nước'},
      );
      expect(envelope['client_prev_hash'], equals(AppConcepts.genesisHashAnchor));
      expect(envelope['client_record_hash']?.length, equals(64));
      expect(envelope['client_hmac_proof']?.length, equals(64));
    });
  });
}
