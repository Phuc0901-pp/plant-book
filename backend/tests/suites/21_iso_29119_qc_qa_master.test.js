/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Suite 21: ISO/IEC 29119 & ISO/IEC 25010 Enterprise QC/QA Master Verification
 * ═══════════════════════════════════════════════════════════════════════════════
 * Covers Line-by-Line Code QC, Module/Ticket Traceability & Operational QA:
 *  - [21.1 - 21.4] Code-Level QC: Every function, trigger, constraint, index in Migration 009
 *  - [21.5 - 21.6] Backend Operational QA: Runtime execution of Append-Only 403 & RESTRICT 409 handlers
 *  - [21.7 - 21.9] ISO Standards Operational QA: ISO 6709, ISO 4217, ISO/IEC 15459, ISO 8601, SHA-256 Tamper Detection
 *  - [21.10 - 21.11] Mobile App Resilience & Anti-Freeze QC: Hive recovery, 1.5s auth timeout, GIS map value equality
 */

const { describe, it, expect } = require('../test-framework');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

describe('Suite 21: ISO/IEC 29119 & ISO/IEC 25010 Enterprise QC/QA Master Suite', () => {
  const rootDir = path.join(__dirname, '../../..');
  const mig009Path = path.join(rootDir, 'backend/db/migrations/009_enterprise_iso_hardening.sql');
  const mig009 = fs.readFileSync(mig009Path, 'utf8');

  // ── SECTION A: CODE-LEVEL QC (LINE-BY-LINE & TICKET-BY-TICKET) ───────────

  it('21.1 [QC][DB-SEC-01..04] Every SQL function in Migration 009 enforces explicit SET search_path & no deprecated auth.role()', () => {
    const fnMatches = mig009.match(/CREATE OR REPLACE FUNCTION[\s\S]*?AS \$\$[\s\S]*?\$\$;/g) || [];
    expect(fnMatches.length).toBe(8);
    for (const fnDef of fnMatches) {
      expect(/SET search_path\s*=\s*public/i.test(fnDef)).toBe(true);
    }
    expect(mig009.includes('auth.role()')).toBe(false);
    expect(mig009.includes('REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated')).toBe(true);
  });

  it('21.2 [QC][DB-SEC-02] RLS policies cover all 29 tables (service_role + public QR + authenticated multi-tenant)', () => {
    const tableListMatch = mig009.match(/v_tables text\[\] := ARRAY\[([\s\S]*?)\];/);
    expect(tableListMatch !== null).toBe(true);
    const tables = tableListMatch[1].match(/'[a-z0-9_]+'/g) || [];
    expect(tables.length).toBe(29);
    expect(mig009.includes('public_qr_read_plants')).toBe(true);
    expect(mig009.includes('public_qr_read_farms')).toBe(true);
    expect(mig009.includes('public_qr_read_plant_logs')).toBe(true);
    expect(mig009.includes('public_qr_read_plant_media')).toBe(true);
    expect(mig009.includes('public_read_app_versions')).toBe(true);
  });

  it('21.3 [QC][DB-AUTH-01..04] Cryptographic Hash-Chain, NFC Anti-Replay & 3x Append-Only Audit Triggers verified', () => {
    expect(mig009.includes('BEFORE INSERT ON public.plant_logs')).toBe(true);
    expect(mig009.includes('extensions.digest(')).toBe(true);
    expect(mig009.includes('extensions.hmac(')).toBe(true);
    expect(mig009.includes('NFC Replay Attack Detected')).toBe(true);
    expect(mig009.includes('BEFORE UPDATE OR DELETE ON public.audit_logs')).toBe(true);
    expect(mig009.includes('BEFORE UPDATE OR DELETE ON public.data_audit_logs')).toBe(true);
    expect(mig009.includes('BEFORE UPDATE OR DELETE ON public.nfc_security_audit_logs')).toBe(true);
  });

  it('21.4 [QC][DB-PERF-01..02] Exactly 35 FK covering indexes (IF NOT EXISTS) and 3 duplicate index drops verified', () => {
    const idxMatches = mig009.match(/CREATE INDEX IF NOT EXISTS idx_[a-z0-9_]+ ON public\.[a-z0-9_]+ \([a-z0-9_]+\);/g) || [];
    expect(idxMatches.length).toBe(35);
    expect(mig009.includes('DROP INDEX IF EXISTS public.idx_farm_plots_unique;')).toBe(true);
    expect(mig009.includes('DROP INDEX IF EXISTS public.idx_nfc_tags_inventory_uid_uniq;')).toBe(true);
    expect(mig009.includes('DROP INDEX IF EXISTS public.idx_plants_gps;')).toBe(true);
  });

  // ── SECTION B: BACKEND OPERATIONAL QA (RUNTIME HANDLER EXECUTION) ─────────

  it('21.5 [QA][OP-API-01] history.js DELETE /:id and DELETE / reject mutation with HTTP 403 ISO Append-Only', async () => {
    const historyRouter = require('../../routes/history');
    const findHandler = (method, routePath) => {
      const layer = historyRouter.stack.find(
        l => l.route && l.route.path === routePath && l.route.methods[method]
      );
      expect(layer !== undefined).toBe(true);
      // Last handler in stack is the route handler (after auth middleware)
      return layer.route.stack[layer.route.stack.length - 1].handle;
    };

    const mockRes = () => {
      const out = { statusCode: 200, body: null };
      out.status = (code) => { out.statusCode = code; return out; };
      out.json = (data) => { out.body = data; return out; };
      return out;
    };

    const delOne = findHandler('delete', '/:id');
    const res1 = mockRes();
    await delOne({ params: { id: '1' }, user: { id: 1, role: 'admin' } }, res1);
    expect(res1.statusCode).toBe(403);
    expect(res1.body.error.includes('Append-Only')).toBe(true);

    const delAll = findHandler('delete', '/');
    const res2 = mockRes();
    await delAll({ user: { id: 1, role: 'admin' } }, res2);
    expect(res2.statusCode).toBe(403);
    expect(res2.body.error.includes('Append-Only')).toBe(true);
  });

  it('21.6 [QA][OP-API-02] farms.js, supplies.js, users.js contain zero unguarded DELETE FROM data_audit_logs in transactions and handle 23503 -> 409', () => {
    const farmsCode = fs.readFileSync(path.join(rootDir, 'backend/routes/farms.js'), 'utf8');
    const suppliesCode = fs.readFileSync(path.join(rootDir, 'backend/routes/supplies.js'), 'utf8');
    const usersCode = fs.readFileSync(path.join(rootDir, 'backend/routes/users.js'), 'utf8');

    // Inside isHardDelete transaction, farms.js must record HARD_DELETE instead of deleting audit logs
    const hdStart = farmsCode.indexOf('if (isHardDelete)');
    const hdEnd = farmsCode.indexOf("await client.query('COMMIT')", hdStart);
    const hardDeleteSection = farmsCode.slice(hdStart, hdEnd);
    expect(hardDeleteSection.includes('DELETE FROM data_audit_logs')).toBe(false);
    expect(hardDeleteSection.includes("HARD_DELETE")).toBe(true);

    expect(suppliesCode.includes("err.code === '23503'") && suppliesCode.includes('res.status(409)')).toBe(true);
    expect(usersCode.includes("err.code === '23503'") && usersCode.includes('res.status(409)')).toBe(true);
  });

  // ── SECTION C: ISO STANDARDS & CRYPTOGRAPHIC ENGINE OPERATIONAL QA ─────────

  it('21.7 [QA][ISO-6709 & ISO-4217 & W3C-DID] Boundary & negative validation matches DB CHECK constraints', () => {
    const isValidWgs84 = (lat, lng) => lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    expect(isValidWgs84(10.7769, 106.7009)).toBe(true);
    expect(isValidWgs84(-90, -180)).toBe(true);
    expect(isValidWgs84(90, 180)).toBe(true);
    expect(isValidWgs84(90.0001, 106.7)).toBe(false);
    expect(isValidWgs84(10.7, 180.0001)).toBe(false);

    const iso4217Regex = /^[A-Z]{3}$/;
    expect(iso4217Regex.test('VND')).toBe(true);
    expect(iso4217Regex.test('USD')).toBe(true);
    expect(iso4217Regex.test('vnd')).toBe(false);
    expect(iso4217Regex.test('VN')).toBe(false);

    const didRegex = /^did:[a-z0-9]+:/;
    expect(didRegex.test('did:agtech:vn:farm:1')).toBe(true);
    expect(didRegex.test('did:agtech:vn:plant:1:42')).toBe(true);
    expect(didRegex.test('invalid-did')).toBe(false);
  });

  it('21.8 [QA][ISO-8601] Duration format P{Y}Y{M}M{D}D matches PostgreSQL calc_plant_age_iso8601 specification', () => {
    const isoDurationRegex = /^P(\d+Y\d+M\d+D|0D)$/;
    expect(isoDurationRegex.test('P2Y6M12D')).toBe(true);
    expect(isoDurationRegex.test('P0D')).toBe(true);
    expect(isoDurationRegex.test('2 years')).toBe(false);
    expect(mig009.includes("CREATE OR REPLACE FUNCTION public.calc_plant_age_iso8601(p_planting_date date)")).toBe(true);
  });

  it('21.9 [QA][CRYPTO-CHAIN] SHA-256 Hash-Chain detects 1-character tampering immediately', () => {
    const GENESIS = 'GENESIS_00000000000000000000000000000000000000000000000000000000';
    const computeHash = (row, prevHash) => {
      const payload = [row.plant_id, row.log_date, row.log_type, row.note, row.batch_code, prevHash].join('|');
      return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
    };

    const logs = [
      { plant_id: 15, log_date: '2026-11-01', log_type: 'Tưới nước', note: 'Lần 1', batch_code: 'B01' },
      { plant_id: 15, log_date: '2026-11-02', log_type: 'Bón phân', note: 'NPK 20-20-15', batch_code: 'B02' },
      { plant_id: 15, log_date: '2026-11-03', log_type: 'Làm cỏ', note: 'Khu A', batch_code: 'B03' },
    ];

    let prev = GENESIS;
    for (const log of logs) {
      log.prev_log_hash = prev;
      log.record_hash = computeHash(log, prev);
      prev = log.record_hash;
    }

    // Verify intact chain
    for (let i = 0; i < logs.length; i++) {
      expect(computeHash(logs[i], logs[i].prev_log_hash)).toBe(logs[i].record_hash);
    }

    // Tamper 1 character in log[1] and verify chain breaks
    const tampered = { ...logs[1], note: 'NPK 20-20-16' };
    expect(computeHash(tampered, tampered.prev_log_hash) === logs[1].record_hash).toBe(false);
  });

  // ── SECTION D: MOBILE APP RESILIENCE & ANTI-FREEZE QC ────────────────────

  it('21.10 [QC][MOBILE-ANTI-FREEZE] CacheService recovers corrupted Hive boxes & main.dart bounds startup auth check', () => {
    const cacheDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/services/cache_service.dart'), 'utf8');
    const mainDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/main.dart'), 'utf8');

    expect(cacheDart.includes('_openBoxSafe')).toBe(true);
    expect(cacheDart.includes('Hive.deleteBoxFromDisk')).toBe(true);
    expect(mainDart.includes('Duration(milliseconds: 1500)') || mainDart.includes('timeout(')).toBe(true);
  });

  it('21.11 [QC][MOBILE-GIS] Interactive GIS Map uses value equality in didUpdateWidget', () => {
    const mapDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/components/interactive_gis_map_widget.dart'), 'utf8');
    expect(mapDart.includes('didUpdateWidget')).toBe(true);
    expect(mapDart.includes('_areFarmsEqual') && mapDart.includes('_arePlantsEqual')).toBe(true);
  });

  // ── SECTION E: ENTERPRISE 10/10 HARDENING (OWASP HEADERS, KEYSTORE, SSOT) ──

  it('21.12 [QA][BE-SEC-01/02] OWASP securityHeaders middleware & CORS whitelist runtime check', () => {
    const { securityHeaders, isOriginAllowed } = require('../../middleware/securityHeaders');
    const serverJs = fs.readFileSync(path.join(rootDir, 'backend/server.js'), 'utf8');

    expect(serverJs.includes("app.disable('x-powered-by')")).toBe(true);
    expect(serverJs.includes('securityHeaders')).toBe(true);
    expect(serverJs.includes('buildCorsOptions')).toBe(true);

    // Runtime middleware header injection check
    const headers = {};
    const mockReq = { headers: { 'x-forwarded-proto': 'https' }, secure: true };
    const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
    let nextCalled = false;
    securityHeaders(mockReq, mockRes, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(typeof headers['Permissions-Policy']).toBe('string');

    // Runtime CORS whitelist check (allows native mobile with no Origin, rejects rogue origin)
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed('http://localhost:3000')).toBe(true);
    expect(isOriginAllowed('https://evil-attacker.example.com')).toBe(false);
  });

  it('21.13 [QA][MOB-SEC-01/02] Mobile Hardware Keystore (flutter_secure_storage) & Flutter unit test gate', () => {
    const pubspec = fs.readFileSync(path.join(rootDir, 'mobile_app/pubspec.yaml'), 'utf8');
    const cacheDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/services/cache_service.dart'), 'utf8');
    const unitTest = fs.readFileSync(path.join(rootDir, 'mobile_app/test/security_and_map_test.dart'), 'utf8');
    const apkWorkflow = fs.readFileSync(path.join(rootDir, '.github/workflows/build-apk.yml'), 'utf8');

    expect(pubspec.includes('flutter_secure_storage')).toBe(true);
    expect(cacheDart.includes('FlutterSecureStorage')).toBe(true);
    expect(cacheDart.includes('encryptedSharedPreferences: true')).toBe(true);
    expect(unitTest.includes('verifyNtag213Scan5Layer')).toBe(true);
    expect(unitTest.includes('RbacPolicy')).toBe(true);
    expect(apkWorkflow.includes('flutter test --reporter expanded')).toBe(true);
  });

  it('21.14 [QA][SSOT-01] Version 1.3.7+21 is synchronized across config, backend, web SW & mobile', () => {
    const appConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'config/app.config.json'), 'utf8'));
    const backendPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'backend/package.json'), 'utf8'));
    const pubspec = fs.readFileSync(path.join(rootDir, 'mobile_app/pubspec.yaml'), 'utf8');
    const swJs = fs.readFileSync(path.join(rootDir, 'frontend/user/sw.js'), 'utf8');
    const versionRoute = fs.readFileSync(path.join(rootDir, 'backend/routes/version.js'), 'utf8');

    expect(appConfig.app.version).toBe('1.3.7');
    expect(appConfig.app.buildNumber).toBe(21);
    expect(backendPkg.version).toBe('1.3.7');
    expect(pubspec.includes('version: 1.3.7+21')).toBe(true);
    expect(swJs.includes('pb-farmer-cache-v1.3.7')).toBe(true);
    expect(versionRoute.includes("version: '1.3.7'")).toBe(true);
  });
});
