/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Suite 18: Flutter Mobile App v1.3.5+19 Enterprise Security, Cryptography,
 *           5-Layer NTAG213 Verification & 2-Phase Offline Batch Sync Audit
 * ═══════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { describe, test, assert } = require('../test-framework');

const MOBILE_LIB_ROOT = path.resolve(__dirname, '../../../mobile_app/lib');

function readDartFile(relPath) {
  const fullPath = path.join(MOBILE_LIB_ROOT, relPath);
  assert.ok(fs.existsSync(fullPath), `Missing Dart file: ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

describe('Suite 18: Flutter Mobile App v1.3.5+19 Security, Cryptography & Web Parity', () => {
  test('18.1 Pure-Dart NIST FIPS 180-4 SHA-256 & FIPS 198-1 HMAC-SHA256 Engine present in crypto_security_service.dart', () => {
    const content = readDartFile('core/security/crypto_security_service.dart');
    assert.ok(content.includes('class CryptoSecurityService'), 'CryptoSecurityService class missing');
    assert.ok(content.includes('static Uint8List sha256Bytes'), 'FIPS 180-4 sha256Bytes missing');
    assert.ok(content.includes('static String hmacSha256Hex'), 'FIPS 198-1 hmacSha256Hex missing');
    assert.ok(content.includes('static bool constantTimeEquals'), 'Constant-time comparison missing');
    assert.ok(content.includes('static Ntag213VerificationResult verifyNtag213Scan5Layer'), '5-layer NTAG213 verifier missing');
    assert.ok(content.includes('static Map<String, String> signRequestHeaders'), 'HTTP request envelope signer missing');
  });

  test('18.2 Enterprise 4-Sub-Role RBAC & Finance Redaction Policy present in rbac_policy.dart', () => {
    const content = readDartFile('core/security/rbac_policy.dart');
    assert.ok(content.includes("subRoleFarmOwner = 'farm_owner'"), 'farm_owner sub_role missing');
    assert.ok(content.includes("subRoleCareWorker = 'care_worker'"), 'care_worker sub_role missing');
    assert.ok(content.includes("subRoleWarehouseManager = 'warehouse_manager'"), 'warehouse_manager sub_role missing');
    assert.ok(content.includes("subRoleAuditorReadonly = 'auditor_readonly'"), 'auditor_readonly sub_role missing');
    assert.ok(content.includes('static bool isFinanceRedacted'), 'isFinanceRedacted check missing');
    assert.ok(content.includes('static String formatCurrencyWithPolicy'), 'formatCurrencyWithPolicy helper missing');
  });

  test('18.3 Models (Plant, PlantLog, Farm, Supply) synchronized with Web App v1.3.5 & IPCC Carbon MRV', () => {
    const plantDart = readDartFile('models/plant.dart');
    assert.ok(plantDart.includes('globalDid'), 'Plant.globalDid missing');
    assert.ok(plantDart.includes('issueLevel'), 'Plant.issueLevel missing');
    assert.ok(plantDart.includes('chuidHash'), 'Plant.chuidHash missing');
    assert.ok(plantDart.includes('double get estimatedAgbKg'), 'Chave et al. (2014) AGB getter missing');
    assert.ok(plantDart.includes('double get estimatedCo2eKg'), 'IPCC Tier-2 CO2e getter missing');

    const logDart = readDartFile('models/plant_log.dart');
    assert.ok(logDart.includes('prevLogHash'), 'PlantLog.prevLogHash missing');
    assert.ok(logDart.includes('recordHash'), 'PlantLog.recordHash missing');
    assert.ok(logDart.includes('isLocked'), 'PlantLog.isLocked missing');
    assert.ok(logDart.includes('isCryptographicallySealed'), 'PlantLog.isCryptographicallySealed getter missing');
  });

  test('18.4 AES-256 Encrypted Hive Vault & 2-Phase Atomic Offline Batch Sync implemented', () => {
    const cacheDart = readDartFile('services/cache_service.dart');
    const syncDart = readDartFile('services/offline_sync_service.dart');
    const apiDart = readDartFile('services/api_service.dart');

    assert.ok(cacheDart.includes('HiveAesCipher'), 'AES-256 Hive encryption missing');
    assert.ok(cacheDart.includes('pending_field_mutations'), 'pending_field_mutations box missing');
    assert.ok(cacheDart.includes('createClientIntegrityEnvelope'), 'Client SHA-256 envelope signing missing');
    assert.ok(syncDart.includes('syncOfflineBatch'), '2-phase atomic batch sync missing');
    assert.ok(apiDart.includes('/plants/offline-batch-sync'), 'POST /plants/offline-batch-sync endpoint missing');
    assert.ok(!apiDart.includes('pk.eyJ1IjoicGh1Y21lb21lbyIsImEiOiJjbXF0OTR6'), 'Hardcoded Mapbox fallback token must be removed');
  });

  test('18.5 4-Tab Enterprise Tree Profile & 5-Layer NFC/QR Scanner verified', () => {
    const detailDart = readDartFile('pages/plant_detail_page.dart');
    const scannerDart = readDartFile('components/qr_nfc_scanner.dart');

    assert.ok(detailDart.includes('TabController(length: 4'), '4-Tab controller missing in PlantDetailPage');
    assert.ok(detailDart.includes('_buildTab1BioAndGs1'), 'Tab 1 Bio & GS1 missing');
    assert.ok(detailDart.includes('_buildTab2VietGapAndHashChain'), 'Tab 2 VietGAP & SHA-256 missing');
    assert.ok(detailDart.includes('_buildTab3Ntag213Security'), 'Tab 3 NTAG213 Security missing');
    assert.ok(detailDart.includes('_buildTab4CarbonMrvAndEconomics'), 'Tab 4 Carbon MRV & Economics missing');
    assert.ok(scannerDart.includes('verifyNtag213Scan5Layer'), '5-Layer NTAG213 verification missing in scanner');
  });
});
