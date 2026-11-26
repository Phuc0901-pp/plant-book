const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { describe, it, assert } = require('../test-framework');
const { buildAll, injectContentHashes } = require('../../scripts/build-html');
const { computePolygonAreaM2, auditAndNormalizeFarmArea } = require('../../services/unitConversionService');

describe('Suite 32: Content-Hash Cache-Busting, Farm Area m²/ha Audit & Zero-Lag Auto-Refresh', () => {
  const rootDir = path.join(__dirname, '../../..');
  const backendDir = path.join(rootDir, 'backend');

  function withMockedModules(mocks, fn) {
    const snapshots = new Map();
    for (const [modPath, mockExports] of Object.entries(mocks)) {
      const resolved = require.resolve(modPath);
      snapshots.set(resolved, require.cache[resolved]);
      if (mockExports === null) {
        delete require.cache[resolved];
      } else {
        require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: mockExports };
      }
    }
    return Promise.resolve().then(fn).finally(() => {
      for (const [resolved, prev] of snapshots.entries()) {
        if (prev) require.cache[resolved] = prev;
        else delete require.cache[resolved];
      }
    });
  }

  function invokeRouter(router, baseMount, method, rawUrl, body = {}, headers = {}) {
    return new Promise((resolve, reject) => {
      const qIdx = rawUrl.indexOf('?');
      const pathOnly = qIdx >= 0 ? rawUrl.slice(0, qIdx) : rawUrl;
      const query = {};
      if (qIdx >= 0) {
        const sp = new URLSearchParams(rawUrl.slice(qIdx + 1));
        for (const [k, v] of sp.entries()) query[k] = v;
      }
      const req = {
        method,
        url: rawUrl,
        originalUrl: `${baseMount}${rawUrl}`,
        path: pathOnly,
        protocol: 'https',
        ip: headers['x-test-ip'] || '127.0.0.1',
        headers,
        query,
        body,
        params: {},
        get(h) { return this.headers[String(h).toLowerCase()] || 'localhost'; },
        app: { get: () => null }
      };
      const res = {
        statusCode: 200,
        _headers: {},
        setHeader(k, v) { this._headers[k] = v; },
        getHeader(k) { return this._headers[k]; },
        status(c) { this.statusCode = c; return this; },
        json(p) { resolve({ status: this.statusCode, body: p }); },
        send(p) { resolve({ status: this.statusCode, body: p }); }
      };
      router.handle(req, res, (err) => reject(err || new Error(`Unhandled ${method} ${rawUrl}`)));
    });
  }

  it('32.1 Content-hash cache-busting injects deterministic SHA-256 asset hashes, ignores CDNs, and changes when files change', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-hash-test-'));
    try {
      fs.mkdirSync(path.join(tmpDir, 'js'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'css'), { recursive: true });
      const jsFile = path.join(tmpDir, 'js/sample.js');
      const cssFile = path.join(tmpDir, 'css/style.css');
      fs.writeFileSync(jsFile, 'console.log("v1");', 'utf8');
      fs.writeFileSync(cssFile, 'body{color:#000}', 'utf8');

      const rawHtml = [
        '<link rel="stylesheet" href="/css/style.css?v=v1.3.7">',
        '<script src="https://cdn.example.com/lib.js"></script>',
        '<script type="module" src="/js/sample.js?v=v1.3.7"></script>'
      ].join('\n');

      const cfg = { app: { versionTag: 'v1.3.7' } };
      const hashed1 = injectContentHashes(rawHtml, cfg, tmpDir, new Map());
      assert.ok(/\/css\/style\.css\?v=v1\.3\.7-[0-9a-f]{8}/.test(hashed1));
      assert.ok(/\/js\/sample\.js\?v=v1\.3\.7-[0-9a-f]{8}/.test(hashed1));
      assert.ok(hashed1.includes('src="https://cdn.example.com/lib.js"'), 'External CDN URLs must stay untouched');

      fs.writeFileSync(jsFile, 'console.log("v2_modified");', 'utf8');
      const hashed2 = injectContentHashes(rawHtml, cfg, tmpDir, new Map());
      const m1 = hashed1.match(/\/js\/sample\.js\?v=v1\.3\.7-([0-9a-f]{8})/);
      const m2 = hashed2.match(/\/js\/sample\.js\?v=v1\.3\.7-([0-9a-f]{8})/);
      assert.ok(m1 && m2);
      assert.notStrictEqual(m1[1], m2[1], 'Asset content change must produce a new cache-busting hash');

      const buildRes = buildAll();
      assert.strictEqual(buildRes.admin, true);
      assert.strictEqual(buildRes.user, true);

      const adminHtml = fs.readFileSync(path.join(rootDir, 'frontend/admin/index.html'), 'utf8');
      const userHtml = fs.readFileSync(path.join(rootDir, 'frontend/user/index.html'), 'utf8');
      assert.ok(/\/js\/smart-auto-refresh\.js\?v=v[\w.]+-[0-9a-f]{8}/.test(adminHtml));
      assert.ok(/\/js\/smart-auto-refresh\.js\?v=v[\w.]+-[0-9a-f]{8}/.test(userHtml));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('32.2 auditAndNormalizeFarmArea fixes ha-in-m2 inputs, huge outliers, and computes polygon areas accurately', () => {
    const rectPoly = [
      [108.167000, 13.122000],
      [108.167280, 13.122000],
      [108.167280, 13.122300],
      [108.167000, 13.122300],
      [108.167000, 13.122000]
    ];
    const polyM2 = computePolygonAreaM2(rectPoly);
    assert.ok(polyM2 > 900 && polyM2 < 1100, `Expected ~1000 m² polygon, got ${polyM2}`);

    const haEntry = auditAndNormalizeFarmArea({ id: 1, name: 'Vườn nhập theo ha', area: 1.5, polygon_coordinates: null }, 120);
    assert.strictEqual(haEntry.anomaly, true);
    assert.strictEqual(haEntry.status, 'ENTERED_IN_HA');
    assert.strictEqual(haEntry.normalizedM2, 15000);
    assert.strictEqual(haEntry.normalizedHa, 1.5);

    const hugeOutlier = auditAndNormalizeFarmArea({ id: 2, name: 'Vườn lỗi outlier', area: 38149894, polygon_coordinates: rectPoly }, 20);
    assert.strictEqual(hugeOutlier.anomaly, true);
    assert.strictEqual(hugeOutlier.status, 'OUTLIER_HUGE_AREA');
    assert.strictEqual(hugeOutlier.normalizedM2, polyM2);

    const missingArea = auditAndNormalizeFarmArea({ id: 3, name: 'Vườn thiếu area', area: 0, polygon_coordinates: rectPoly }, 15);
    assert.strictEqual(missingArea.anomaly, true);
    assert.strictEqual(missingArea.status, 'MISSING_AREA_FROM_POLYGON');
    assert.strictEqual(missingArea.normalizedM2, polyM2);

    const healthyFarm = auditAndNormalizeFarmArea({ id: 4, name: 'Vườn A', area: 991, polygon_coordinates: rectPoly }, 20);
    assert.strictEqual(healthyFarm.anomaly, false);
    assert.strictEqual(healthyFarm.status, 'OK');
    assert.strictEqual(healthyFarm.normalizedM2, 991);
  });

  it('32.3 POST /api/farms/audit-normalize-areas repairs anomalies and BI /bi-overview uses normalized areas', async () => {
    const dbPath = path.join(backendDir, 'config/db.js');
    const authPath = path.join(backendDir, 'middleware/auth.js');
    const adminPath = path.join(backendDir, 'middleware/admin.js');
    const redisPath = path.join(backendDir, 'config/redis.js');
    const farmsPath = path.join(backendDir, 'routes/farms.js');
    const analyticsPath = path.join(backendDir, 'routes/analytics.js');

    const farmsDb = [
      { id: 101, name: 'Vườn A', area: 991, polygon_coordinates: null, user_id: 1, plant_count: 20 },
      { id: 202, name: 'Vườn Lỗi Ha', area: 2.5, polygon_coordinates: null, user_id: 1, plant_count: 150 },
      { id: 303, name: 'Vườn Outlier', area: 38140000, polygon_coordinates: null, user_id: 1, plant_count: 20 }
    ];
    const updatesExecuted = [];
    let cacheCleared = false;

    const mockPool = {
      async query(sql, params = []) {
        const s = String(sql).replace(/\s+/g, ' ').trim();
        if (s.includes('FROM farms f') && s.includes('COUNT(DISTINCT p.id)')) {
          return { rows: farmsDb.map(f => ({ ...f })) };
        }
        if (s.startsWith('UPDATE farms SET area = $1')) {
          updatesExecuted.push({ area: params[0], id: params[1] });
          const target = farmsDb.find(f => f.id === Number(params[1]));
          if (target) target.area = params[0];
          return { rows: [] };
        }
        if (s.startsWith('SELECT id, role, sub_role')) {
          return { rows: [{ id: 1, role: 'admin', sub_role: null, allow_view_finance: true }] };
        }
        if (s.includes('FROM farms WHERE COALESCE(is_deleted, false) = false')) {
          return { rows: farmsDb.map(f => ({ ...f })) };
        }
        if (s.includes('FROM plants p')) {
          return {
            rows: [
              { id: 1, farm_id: 101, farm_name: 'Vườn A', tree_code: '001', plant_type: 'Sầu riêng', health_status: 'Tốt', plant_age: '5 năm' },
              { id: 2, farm_id: 202, farm_name: 'Vườn Lỗi Ha', tree_code: '002', plant_type: 'Sầu riêng', health_status: 'Tốt', plant_age: '5 năm' },
              { id: 3, farm_id: 303, farm_name: 'Vườn Outlier', tree_code: '003', plant_type: 'Sầu riêng', health_status: 'Tốt', plant_age: '5 năm' }
            ]
          };
        }
        return { rows: [] };
      }
    };

    await withMockedModules({
      [dbPath]: mockPool,
      [authPath]: (req, _res, next) => { req.user = { id: 1, role: 'admin' }; next(); },
      [adminPath]: (_req, _res, next) => next(),
      [redisPath]: {
        getCache: async () => null,
        setCache: async () => true,
        delCache: async () => 0,
        delCacheByPattern: async () => { cacheCleared = true; return 1; }
      },
      [farmsPath]: null,
      [analyticsPath]: null
    }, async () => {
      const farmsRouter = require(farmsPath);
      const analyticsRouter = require(analyticsPath);

      const dryRes = await invokeRouter(farmsRouter, '/api/farms', 'POST', '/audit-normalize-areas', { dry_run: true });
      assert.strictEqual(dryRes.status, 200);
      assert.strictEqual(dryRes.body.dry_run, true);
      assert.strictEqual(dryRes.body.anomalies_found, 2);
      assert.strictEqual(dryRes.body.repaired_count, 0);
      assert.strictEqual(updatesExecuted.length, 0);

      const biBeforeRepair = await invokeRouter(analyticsRouter, '/api/analytics', 'GET', '/bi-overview');
      assert.strictEqual(biBeforeRepair.status, 200);
      assert.ok(biBeforeRepair.body.summary.total_area_ha < 5, `BI must neutralize huge outlier before DB repair, got ${biBeforeRepair.body.summary.total_area_ha}`);
      assert.strictEqual(biBeforeRepair.body.area_audit_warnings.length, 2);

      const fixRes = await invokeRouter(farmsRouter, '/api/farms', 'POST', '/audit-normalize-areas', { dry_run: false });
      assert.strictEqual(fixRes.status, 200);
      assert.strictEqual(fixRes.body.repaired_count, 2);
      assert.strictEqual(cacheCleared, true);
      assert.strictEqual(updatesExecuted[0].id, 202);
      assert.strictEqual(updatesExecuted[0].area, 25000);
      assert.strictEqual(updatesExecuted[1].id, 303);
      assert.strictEqual(updatesExecuted[1].area, 1280);
    });
  });

  it('32.4 SmartAutoRefresh skips refresh during active user interaction, modals, typing, GIS drawing, and hidden tabs', async () => {
    const code = fs.readFileSync(path.join(rootDir, 'frontend/public/js/smart-auto-refresh.js'), 'utf8');

    let docState = {
      readyState: 'complete',
      visibilityState: 'visible',
      activeElement: { tagName: 'BODY', isContentEditable: false },
      modals: [],
      activeSectionId: 'page-dashboard'
    };
    let drawMode = 'simple_select';
    let dashboardCalls = 0;
    let biCalls = 0;
    let gisFarmCalls = 0;
    let notifCalls = 0;

    const windowObj = {
      scrollY: 120,
      scrollX: 0,
      scrollTo: () => {},
      requestAnimationFrame: (fn) => fn(),
      requestIdleCallback: (fn) => fn(),
      getComputedStyle: (el) => el.style || { display: 'none' },
      drawControl: { getMode: () => drawMode },
      updateDashboardMetricsOnly: () => { dashboardCalls += 1; },
      loadExecutiveBiAnalytics: () => { biCalls += 1; },
      loadFarmsList: () => { gisFarmCalls += 1; },
      loadAdminNotifications: () => { notifCalls += 1; }
    };

    const sandbox = {
      window: windowObj,
      document: {
        get readyState() { return docState.readyState; },
        get visibilityState() { return docState.visibilityState; },
        get activeElement() { return docState.activeElement; },
        addEventListener: () => {},
        querySelectorAll: (sel) => (sel === '.modal-overlay' ? docState.modals : []),
        querySelector: (sel) => {
          if (sel === '.page-section.active') return { id: docState.activeSectionId };
          if (sel === '.content') return { scrollTop: 50 };
          return null;
        }
      },
      navigator: { onLine: true },
      localStorage: { getItem: (k) => (k === 'pb_token' ? 'tok_ok' : null) },
      setTimeout: (fn) => fn,
      clearTimeout: () => {},
      Date
    };

    vm.runInNewContext(code, sandbox);
    const sar = windowObj.SmartAutoRefresh;
    assert.ok(sar && typeof sar.shouldSkipRefresh === 'function');

    docState.visibilityState = 'hidden';
    assert.strictEqual(sar.shouldSkipRefresh().reason, 'TAB_HIDDEN');
    docState.visibilityState = 'visible';

    docState.activeElement = { tagName: 'INPUT', isContentEditable: false };
    assert.strictEqual(sar.shouldSkipRefresh().reason, 'INPUT_FOCUSED');
    docState.activeElement = { tagName: 'BODY', isContentEditable: false };

    docState.modals = [{ style: { display: 'flex' } }];
    assert.strictEqual(sar.shouldSkipRefresh().reason, 'MODAL_OPEN');
    docState.modals = [];

    drawMode = 'draw_polygon';
    assert.strictEqual(sar.shouldSkipRefresh().reason, 'MAP_DRAWING_ACTIVE');
    drawMode = 'simple_select';

    sar.markInteraction();
    assert.strictEqual(sar.shouldSkipRefresh(Date.now() + 500).reason, 'RECENT_INTERACTION');

    const didRun = await sar.triggerNow();
    assert.strictEqual(didRun, false, 'triggerNow must respect idleGraceMs after interaction');

    docState.visibilityState = 'visible';
    assert.strictEqual(sar.shouldSkipRefresh(Date.now() + 10000).skip, false);

    docState.activeSectionId = 'page-gis';
    const ranWhenIdle = await (async () => {
      const s = sar.getState();
      if (s.lastInteractionAt > 0) {
        await new Promise(r => setTimeout(r, 1));
      }
      return sar.shouldSkipRefresh(Date.now() + 5000);
    })();
    assert.strictEqual(ranWhenIdle.skip, false);

    const idleSandbox = {
      ...sandbox,
      window: {
        scrollY: 0,
        scrollX: 0,
        scrollTo: () => {},
        requestAnimationFrame: (fn) => fn(),
        requestIdleCallback: (fn) => fn(),
        getComputedStyle: (el) => el.style || { display: 'none' },
        drawControl: { getMode: () => 'simple_select' },
        updateDashboardMetricsOnly: () => { dashboardCalls += 1; },
        loadExecutiveBiAnalytics: () => { biCalls += 1; },
        loadFarmsList: () => { gisFarmCalls += 1; },
        loadAdminNotifications: () => { notifCalls += 1; }
      }
    };
    vm.runInNewContext(code, idleSandbox);
    docState.activeSectionId = 'page-dashboard';
    const dashOk = await idleSandbox.window.SmartAutoRefresh.triggerNow();
    assert.strictEqual(dashOk, true);
    assert.strictEqual(dashboardCalls, 1);
    assert.strictEqual(biCalls, 1);
    assert.strictEqual(notifCalls, 1);

    docState.activeSectionId = 'page-gis';
    const gisOk = await idleSandbox.window.SmartAutoRefresh.triggerNow();
    assert.strictEqual(gisOk, true);
    assert.strictEqual(gisFarmCalls, 0, 'Auto refresh must NEVER disrupt GIS map state');
    assert.strictEqual(notifCalls, 2);
  });
});
