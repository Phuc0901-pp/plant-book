const fs = require('fs');
const path = require('path');
const { describe, test, assert } = require('../test-framework');

const rootDir = path.resolve(__dirname, '../../..');

describe('Suite 27: ISO Master Upgrade — Schema, Offline Tx Sync, RBAC UX, Reports, Routing & Performance', () => {
  test('27.1 [ISO-01] Migration 016, init.js schema parity, ENABLE_DEMO_SEED gate & /full-dataset fields', () => {
    const mig016 = fs.readFileSync(path.join(rootDir, 'backend/db/migrations/016_iso_schema_parity_and_perf.sql'), 'utf8');
    const mig008 = fs.readFileSync(path.join(rootDir, 'backend/db/migrations/008_utf8_and_hashchain_optimization.sql'), 'utf8');
    const initJs = fs.readFileSync(path.join(rootDir, 'backend/db/init.js'), 'utf8');
    const farmsJs = fs.readFileSync(path.join(rootDir, 'backend/routes/farms.js'), 'utf8');

    assert.ok(mig016.startsWith('-- +migrate Up'), 'Migration 016 header missing');
    assert.ok(mig016.includes('idx_plant_logs_client_uuid_uniq'), 'client_uuid unique index missing in Migration 016');
    assert.ok(mig008.includes("'\"done\"'::jsonb"), 'Migration 008 JSONB fix missing');
    assert.ok(initJs.includes('ENABLE_DEMO_SEED'), 'init.js demo seed gate missing');
    assert.ok(initJs.includes('client_uuid'), 'init.js plant_logs.client_uuid column missing');
    assert.ok(farmsJs.includes('pm.uploaded_at'), '/full-dataset pm.uploaded_at fix missing');
    assert.ok(farmsJs.includes('quarantine_until:'), '/full-dataset quarantine_until field missing');
  });

  test('27.2 [ISO-02] Transactional /offline-batch-sync, SAVEPOINT, PHI/Expiry gate & Web/Mobile parity', () => {
    const mediaLogsJs = fs.readFileSync(path.join(rootDir, 'backend/routes/plants/media-logs.routes.js'), 'utf8');
    const offlineSyncJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/core/offline-sync.js'), 'utf8');
    const apiJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/core/api.js'), 'utf8');
    const mobileSyncDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/services/offline_sync_service.dart'), 'utf8');
    const cacheDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/services/cache_service.dart'), 'utf8');

    assert.ok(mediaLogsJs.includes("SAVEPOINT ${spName}"), 'Per-item savepoint missing in offline-batch-sync');
    assert.ok(mediaLogsJs.includes('authorizePlantAccess(db, req.user, pid, true)'), 'authorizePlantAccess write check missing');
    assert.ok(mediaLogsJs.includes("'PHI_VIOLATION_BLOCKED'"), 'PHI gate missing in offline-batch-sync');
    assert.ok(mediaLogsJs.includes("'SUPPLY_EXPIRED'"), 'Expired supply check missing in offline-batch-sync');
    assert.ok(mediaLogsJs.includes("'INVALID_GPS_ISO19115'"), 'ISO 19115 GPS check missing in offline-batch-sync');
    assert.ok(offlineSyncJs.includes('/plants/${mut.plant_id}/nfc'), 'Web fallback must use PUT /nfc');
    assert.ok(!offlineSyncJs.includes('nfc-assign'), 'Web fallback must not call legacy nfc-assign');
    assert.ok(apiJs.includes('apiErr.code'), 'Frontend api() must propagate error codes');
    assert.ok(mobileSyncDart.includes("'mutation_type': mutationType"), 'Flutter batch sync missing mutation_type');
    assert.ok(cacheDart.includes("'client_uuid': clientUuid"), 'Flutter Hive cache missing client_uuid');
  });

  test('27.3 [ISO-03] RBAC UI flags, real GPS enforcement, NFC locks, Admin 401 refresh & guard usability', () => {
    const logsJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/modules/logs.js'), 'utf8');
    const userPlantsJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/modules/plants.js'), 'utf8');
    const adminPlantsJs = fs.readFileSync(path.join(rootDir, 'frontend/admin/js/plants.js'), 'utf8');
    const adminAppJs = fs.readFileSync(path.join(rootDir, 'frontend/admin/js/app.js'), 'utf8');
    const secGuardJs = fs.readFileSync(path.join(rootDir, 'frontend/assets/js/enterprise-security-guard.js'), 'utf8');

    assert.ok(!logsJs.includes('rbac.isFarmOwner'), 'logs.js must not reference undefined rbac.isFarmOwner');
    assert.ok(!logsJs.includes('rbac.isAuditor'), 'logs.js must not reference undefined rbac.isAuditor');
    assert.ok(logsJs.includes('!rbac.isReadonlyAuditor'), 'logs.js must check !rbac.isReadonlyAuditor');
    assert.ok(!userPlantsJs.includes('11.8333'), 'user plants.js must not fallback to fake 11.8333');
    assert.ok(!adminPlantsJs.includes('11.8333'), 'admin plants.js must not fallback to fake 11.8333');
    assert.ok(userPlantsJs.includes('_isSubmittingUserFieldTag'), 'user NFC double-submit lock missing');
    assert.ok(adminPlantsJs.includes('_isSubmittingAdminFieldTag'), 'admin NFC double-submit lock missing');
    assert.ok(adminAppJs.includes('tryAdminRefreshJwtToken'), 'admin single-flight 401 refresh missing');
    assert.ok(secGuardJs.includes('antiDebugging: false'), 'antiDebugging loop must be disabled');
  });

  test('27.4 [ISO-04] Report Query Engine, route ordering, active_ingredient propagation & public hashes', async () => {
    const reportSvc = require('../../services/reportQueryService');
    const coreSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/plants/core.routes.js'), 'utf8');
    const publicSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/plants/public.routes.js'), 'utf8');
    const farmsSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/farms.js'), 'utf8');

    const q = reportSvc.resolveReportDateRange({ period: 'quarter', year: 2026, quarter: 3 });
    assert.strictEqual(q.date_from, '2026-07-01');
    assert.strictEqual(q.date_to, '2026-09-30');
    assert.strictEqual(reportSvc.matchesTreeCodeRange('SR-12', 'SR-01', 'SR-20'), true);
    assert.strictEqual(reportSvc.matchesTreeCodeRange('SR-25', 'SR-01', 'SR-20'), false);

    assert.ok(coreSrc.indexOf("'/reports/query'") < coreSrc.indexOf("'/:id(\\\\d+)'"), '/reports/query must precede /:id');
    assert.ok(coreSrc.indexOf("'/logs/farm/:farmId(\\\\d+)'") < coreSrc.indexOf("'/:id(\\\\d+)'"), '/logs/farm/:farmId must precede /:id');
    assert.ok(publicSrc.includes('record_hash: log.record_hash || null'), 'public logs must preserve record_hash');
    assert.ok(publicSrc.includes('puc_code: plant.puc_code || null'), '/export-vietgap must include puc_code');
    assert.ok(farmsSrc.includes("req.query.role || ''"), '/full-dataset must honor role=care_worker');
  });

  test('27.5 [ISO-05] 3-portal ISO-22005 report filters, CSV injection guard, popup fix & dynamic PHI', () => {
    const logsHtml = fs.readFileSync(path.join(rootDir, 'frontend/user/src/views/logs.html'), 'utf8');
    const logsJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/modules/logs.js'), 'utf8');
    const reportJs = fs.readFileSync(path.join(rootDir, 'frontend/public/js/report.js'), 'utf8');
    const certJs = fs.readFileSync(path.join(rootDir, 'frontend/public/js/plant-export-certs.js'), 'utf8');
    const adminDbJs = fs.readFileSync(path.join(rootDir, 'frontend/admin/js/database.js'), 'utf8');

    assert.ok(logsHtml.includes('id="modal-export-plot-id"'), 'User export modal missing plot filter');
    assert.ok(logsHtml.includes('id="modal-export-period-preset"'), 'User export modal missing period preset');
    assert.ok(logsJs.includes('const preOpenedWin ='), 'User export must open print window synchronously');
    assert.ok(logsJs.includes('/^[=+\\-@\\t\\r]/'), 'User CSV must guard against formula injection');
    assert.ok(reportJs.includes('/^[=+\\-@\\t\\r]/'), 'Public report CSV must guard against formula injection');
    assert.ok(reportJs.includes('Vi Phạm PHI'), 'Public report must render dynamic PHI status');
    assert.ok(!certJs.includes('-VERIFIED-SECURE'), 'Public cert must not use fake -VERIFIED-SECURE string');
    assert.ok(adminDbJs.includes('exportDbFarmReportCsv'), 'Admin database portal missing ISO CSV export');
  });

  test('27.6 [ISO-06] URL deep-linking, SW scope pinning, Escape modal close, deduplicated server routes & Flutter vi_VN', () => {
    const routerJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/core/router.js'), 'utf8');
    const authJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/auth.js'), 'utf8');
    const userAppJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/app.js'), 'utf8');
    const adminAppJs = fs.readFileSync(path.join(rootDir, 'frontend/admin/js/app.js'), 'utf8');
    const serverJs = fs.readFileSync(path.join(rootDir, 'backend/server.js'), 'utf8');
    const mainDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/main.dart'), 'utf8');

    assert.ok(routerJs.includes("const prefix = role === 'admin' ? 'adm' : 'usr';"), 'generateIsoPublicId prefix fix missing');
    assert.ok(authJs.includes('window.handleRouteFromHash()'), 'auth showApp deep link restore missing');
    assert.ok(userAppJs.includes("register('/user/sw.js', { scope: '/user/' })"), 'SW registration scope missing');
    assert.ok(userAppJs.includes("e.key !== 'Escape'"), 'User Escape modal handler missing');
    assert.ok(adminAppJs.includes("e.key !== 'Escape'"), 'Admin Escape modal handler missing');
    const usrRouteMatches = serverJs.match(/app\.get\(\[[\s\S]*?'\/usr-\*'/g) || [];
    assert.strictEqual(usrRouteMatches.length, 1, 'Duplicate /usr-* route in server.js must stay removed');
    assert.ok(mainDart.includes("initializeDateFormatting('vi_VN', null)"), 'Flutter vi_VN init missing');
  });

  test('27.7 [ISO-07 & ISO-08] Auth active-ping throttle, BI singleflight, plot cache & shared unit/RBAC services', () => {
    const unitSvc = require('../../services/unitConversionService');
    const rbacSvc = require('../../services/rbacScopeService');
    const authMiddlewareSrc = fs.readFileSync(path.join(rootDir, 'backend/middleware/auth.js'), 'utf8');
    const analyticsSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/analytics.js'), 'utf8');
    const singleflightSrc = fs.readFileSync(path.join(rootDir, 'backend/services/singleflight.js'), 'utf8');
    const coreSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/plants/core.routes.js'), 'utf8');

    assert.ok(authMiddlewareSrc.includes('shouldPingUserActive'), 'Auth active-ping throttle missing');
    assert.strictEqual((analyticsSrc.match(/singleflight\.do\(/g) || []).length, 4, 'All 4 BI endpoints must use singleflight.do');
    assert.ok(!singleflightSrc.includes('setImmediate'), 'singleflight cleanup must run synchronously in finally');
    assert.ok(coreSrc.includes('const resolvedPlots = new Set();'), 'batch-range plot cache missing');

    assert.strictEqual(unitSvc.convertAmountToBaseUnit(500, 'gam', 'kg'), 0.5);
    assert.strictEqual(unitSvc.convertAmountToBaseUnit(250, 'lít', 'm3', 'Tưới nước'), 0.25);
    assert.strictEqual(unitSvc.normalizeAreaToSquareMeters(2.5, 'ha'), 25000);

    assert.strictEqual(rbacSvc.isFinanceRedactedForUser({ role: 'user', sub_role: 'care_worker' }), true);
    assert.strictEqual(rbacSvc.isFinanceRedactedForUser({ role: 'user', sub_role: 'farm_owner' }), false);
    assert.strictEqual(rbacSvc.canUserWriteFarmData({ role: 'user', sub_role: 'auditor_readonly' }), false);
    assert.strictEqual(rbacSvc.canUserDeleteFarmData({ role: 'user', sub_role: 'farm_manager' }), true);
    assert.deepStrictEqual(rbacSvc.resolveUserTenantScope({ id: 9, parent_user_id: 2, farm_id: 4, assigned_plant_ids: [10, '11'] }), {
      isAdmin: false,
      ownerUserId: 2,
      assignedFarmId: 4,
      assignedPlantIds: [10, 11]
    });
  });
});
