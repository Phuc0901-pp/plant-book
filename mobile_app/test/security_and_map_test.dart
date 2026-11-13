import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/components/interactive_gis_map_widget.dart';
import 'package:mobile_app/core/security/crypto_security_service.dart';
import 'package:mobile_app/core/security/rbac_policy.dart';

void main() {
  group('NIST FIPS 180-4 & 198-1 CryptoSecurityService', () {
    test('sha256Hex matches NIST standard test vector for "abc"', () {
      const expected =
          'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
      expect(CryptoSecurityService.sha256Hex('abc'), equals(expected));
    });

    test('hmacSha256Hex matches RFC 4231 test vector #1', () {
      // Key: 20 bytes of 0x0b, Data: "Hi There"
      final key = String.fromCharCodes(List<int>.filled(20, 0x0b));
      const expected =
          'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7';
      expect(
        CryptoSecurityService.hmacSha256Hex(key, 'Hi There'),
        equals(expected),
      );
    });

    test('constantTimeEquals validates equal & rejects unequal strings', () {
      expect(
        CryptoSecurityService.constantTimeEquals('A1B2C3D4', 'a1b2c3d4'),
        isTrue,
      );
      expect(
        CryptoSecurityService.constantTimeEquals('A1B2C3D4', 'A1B2C3D5'),
        isFalse,
      );
      expect(
        CryptoSecurityService.constantTimeEquals('short', 'longer'),
        isFalse,
      );
    });

    test('verifyNtag213Scan5Layer passes 5/5 layers for valid card & geofence',
        () {
      const uid = '04:A1:B2:C3:D4:E5:80';
      const plantId = 101;
      const issueLevel = 2;
      final sig = CryptoSecurityService.generateNtag213HmacSignature(
        nfcUid: uid,
        issueLevel: issueLevel,
      );
      final chuid = CryptoSecurityService.generatePivChuidHash(
        plantId: plantId,
        nfcUid: uid,
        issueLevel: issueLevel,
      );

      final result = CryptoSecurityService.verifyNtag213Scan5Layer(
        scannedUid: uid,
        expectedPlantUid: uid,
        scannedIssueLevel: issueLevel,
        expectedIssueLevel: issueLevel,
        scannedHmacSignature: sig,
        plantId: plantId,
        expectedChuidHash: chuid,
        userLat: 10.776889,
        userLng: 106.700806,
        plantLat: 10.776895,
        plantLng: 106.700810,
      );

      expect(result.isValid, isTrue);
      expect(result.passedLayers, equals(5));
      expect(result.statusCode, equals('VERIFIED_5_LAYER_OK'));
    });

    test('verifyNtag213Scan5Layer rejects cloned/revoked IssueLevel & >8m geofence',
        () {
      const uid = '04:A1:B2:C3:D4:E5:80';
      final resultRevoked = CryptoSecurityService.verifyNtag213Scan5Layer(
        scannedUid: uid,
        expectedPlantUid: uid,
        scannedIssueLevel: 1,
        expectedIssueLevel: 2,
      );
      expect(resultRevoked.isValid, isFalse);
      expect(resultRevoked.layer2IssueLevelValid, isFalse);
      expect(
        resultRevoked.statusCode,
        equals('ERR_GALLAGHER_ISSUE_LEVEL_REVOKED'),
      );

      final resultFar = CryptoSecurityService.verifyNtag213Scan5Layer(
        scannedUid: uid,
        expectedPlantUid: uid,
        userLat: 10.776889,
        userLng: 106.700806,
        plantLat: 10.778000,
        plantLng: 106.700806,
      );
      expect(resultFar.isValid, isFalse);
      expect(resultFar.layer5GeofenceValid, isFalse);
      expect(resultFar.statusCode, equals('ERR_GEOFENCE_VIOLATION'));
    });
  });

  group('Enterprise RBAC Sub-Role Policy', () {
    test('Admin & farm_owner have full finance & NFC issuance permissions', () {
      final admin = <String, dynamic>{'role': 'admin'};
      final owner = <String, dynamic>{'role': 'user', 'sub_role': 'farm_owner'};

      expect(RbacPolicy.isFinanceRedacted(admin), isFalse);
      expect(RbacPolicy.isFinanceRedacted(owner), isFalse);
      expect(RbacPolicy.canDeleteOrLockLogs(owner), isTrue);
      expect(RbacPolicy.canIssueOrRevokeNfcCard(owner), isTrue);
    });

    test('care_worker, warehouse_manager & auditor_readonly redact finance', () {
      final worker = <String, dynamic>{
        'role': 'user',
        'sub_role': 'care_worker',
      };
      final warehouse = <String, dynamic>{
        'role': 'user',
        'sub_role': 'warehouse_manager',
      };
      final auditor = <String, dynamic>{
        'role': 'user',
        'sub_role': 'auditor_readonly',
      };

      expect(RbacPolicy.isFinanceRedacted(worker), isTrue);
      expect(RbacPolicy.canRecordCareLogs(worker), isTrue);
      expect(RbacPolicy.canDeleteOrLockLogs(worker), isFalse);

      expect(RbacPolicy.isFinanceRedacted(warehouse), isTrue);
      expect(RbacPolicy.canManageSupplies(warehouse), isTrue);
      expect(RbacPolicy.canEditPlants(warehouse), isFalse);

      expect(RbacPolicy.isFinanceRedacted(auditor), isTrue);
      expect(RbacPolicy.canEditPlants(auditor), isFalse);
      expect(RbacPolicy.canAuditHashChainLedger(auditor), isTrue);
    });
  });

  group('InteractiveGisMapWidget Configuration', () {
    test('Instantiates safely with default parameters', () {
      const mapWidget = InteractiveGisMapWidget(
        farms: [],
        plants: [],
      );
      expect(mapWidget.height, equals(360));
      expect(mapWidget.showHeader, isTrue);
      expect(mapWidget.showControls, isTrue);
      expect(mapWidget.isFullscreen, isFalse);
    });
  });
}
