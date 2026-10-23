import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/core/constants/app_constants.dart';
import 'package:mobile_app/core/security/crypto_security_service.dart';
import 'package:mobile_app/core/security/rbac_policy.dart';
import 'package:mobile_app/models/farm.dart';
import 'package:mobile_app/models/plant.dart';
import 'package:mobile_app/models/plant_log.dart';
import 'package:mobile_app/models/supply.dart';
import 'package:mobile_app/main.dart';

void main() {
  group('Suite 1: NIST FIPS 180-4 SHA-256 & FIPS 198-1 HMAC-SHA256 Cryptography', () {
    test('SHA-256 matches standard NIST test vector ("abc")', () {
      final String digest = CryptoSecurityService.sha256Hex('abc');
      expect(
        digest,
        equals('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'),
      );
    });

    test('Gallagher 8.30 NTAG213 HMAC-SHA256 & 5-Layer Verification pass for valid tag within 8m Geofence', () {
      const String uid = '04:A1:B2:C3:D4:E5:F6';
      final String sig = CryptoSecurityService.generateNtag213HmacSignature(
        nfcUid: uid,
        issueLevel: 2,
      );
      final String chuid = CryptoSecurityService.generatePivChuidHash(
        plantId: 26,
        nfcUid: uid,
        issueLevel: 2,
      );

      final Ntag213VerificationResult result =
          CryptoSecurityService.verifyNtag213Scan5Layer(
        scannedUid: uid,
        expectedPlantUid: uid,
        scannedIssueLevel: 2,
        expectedIssueLevel: 2,
        scannedHmacSignature: sig,
        plantId: 26,
        expectedChuidHash: chuid,
        userLat: 10.925000,
        userLng: 107.240000,
        plantLat: 10.925020,
        plantLng: 107.240020,
      );

      expect(result.isValid, isTrue);
      expect(result.passedLayers, equals(5));
      expect(result.statusCode, equals('VERIFIED_5_LAYER_OK'));
    });

    test('ISO/IEC 27001 PlantLog SHA-256 Hash-Chain & HTTP Request Signing', () {
      final String recordHash = CryptoSecurityService.computePlantLogRecordHash(
        prevLogHash: CryptoSecurityService.genesisAnchor,
        plantId: 26,
        action: 'Tưới nước',
        description: 'Tưới nhỏ giọt buổi sáng',
        supplyId: 0,
        usedAmount: 50,
        estimatedCost: 15000,
        logDate: '2026-10-23',
      );
      expect(recordHash.length, equals(64));

      final Map<String, String> signedHeaders =
          CryptoSecurityService.signRequestHeaders(
        method: 'POST',
        endpointPath: '/api/plants/offline-batch-sync',
        bodyJson: '{"care_logs":[]}',
        jwtToken: 'sample-jwt-token',
      );
      expect(signedHeaders['X-Client-Version'], equals('1.3.5+19'));
      expect(signedHeaders['X-Client-Signature']?.length, equals(64));
    });
  });

  group('Suite 2: Enterprise 4-Role RBAC & Finance Redaction Policy', () {
    test('farm_owner sees full currency while care_worker and auditor_readonly are redacted', () {
      final Map<String, dynamic> owner = <String, dynamic>{
        'role': 'user',
        'sub_role': 'farm_owner',
      };
      final Map<String, dynamic> worker = <String, dynamic>{
        'role': 'user',
        'sub_role': 'care_worker',
      };
      final Map<String, dynamic> auditor = <String, dynamic>{
        'role': 'user',
        'sub_role': 'auditor_readonly',
      };

      expect(RbacPolicy.isFinanceRedacted(owner), isFalse);
      expect(RbacPolicy.isFinanceRedacted(worker), isTrue);
      expect(RbacPolicy.isFinanceRedacted(auditor), isTrue);
      expect(RbacPolicy.canRecordCareLogs(worker), isTrue);
      expect(RbacPolicy.canRecordCareLogs(auditor), isFalse);
      expect(
        RbacPolicy.formatCurrencyWithPolicy(1250000, worker),
        contains('***'),
      );
    });
  });

  group('Suite 3: Data Models & IPCC Tier-2 / Chave et al. (2014) Carbon MRV', () {
    test('Plant, PlantLog, Farm, Supply models serialize and compute Carbon MRV accurately', () {
      final Plant plant = Plant.fromJson(<String, dynamic>{
        'id': 26,
        'tree_code': 'SR-RI6-026',
        'plant_type': 'Sầu riêng',
        'plant_variety': 'Ri6',
        'plant_age': '6',
        'health_status': 'Tốt',
        'farm_id': 2,
        'biomass_dbh_cm': 22.0,
        'canopy_height_m': 6.5,
        'issue_level': 2,
        'nfc_uid': '04:A1:B2:C3:D4:E5:F6',
      });

      expect(plant.globalDid, equals('did:gs1:vn:tbsg:farm-2:tree-26'));
      expect(plant.estimatedAgbKg, greaterThan(50.0));
      expect(plant.estimatedCo2eKg, greaterThan(100.0));

      final PlantLog log = PlantLog.fromJson(<String, dynamic>{
        'id': 101,
        'plant_id': 26,
        'log_date': '2026-10-23',
        'log_type': 'Bón phân',
        'prev_log_hash': CryptoSecurityService.genesisAnchor,
        'record_hash':
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        'is_locked': true,
      });
      expect(log.isCryptographicallySealed, isTrue);
      expect(log.isLocked, isTrue);

      final Farm farm = Farm.fromJson(<String, dynamic>{
        'id': 2,
        'name': 'Trang trại Tân Bảo',
        'puc_code': 'VN-PUC-TBSG-002',
      });
      expect(farm.pucCode, equals('VN-PUC-TBSG-002'));

      final Supply supply = Supply.fromJson(<String, dynamic>{
        'id': 5,
        'user_id': 1,
        'category': 'Thuốc BVTV',
        'name': 'Sinh học Neem',
        'phi_days': 7,
      });
      expect(supply.phiDays, equals(7));
    });
  });

  group('Suite 4: PlantBookApp Root Widget Smoke Verification', () {
    testWidgets('Renders PlantBookApp with v1.3.5+19 constants', (WidgetTester tester) async {
      expect(AppConstants.appVersion, equals('v1.3.5'));
      expect(AppConstants.fullBuildTag, equals('v1.3.5+19'));
      await tester.pumpWidget(
        PlantBookApp(
          initialScreen: Container(
            child: const Text('TBSG v1.3.5+19', textDirection: TextDirection.ltr),
          ),
        ),
      );
      expect(find.text('TBSG v1.3.5+19'), findsOneWidget);
    });
  });
}
