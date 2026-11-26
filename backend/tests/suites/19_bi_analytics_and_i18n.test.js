const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { describe, it, assert } = require('../test-framework');

describe('Suite 19: Executive BI Financial Analytics, ML Predictive Yield & Export i18n (vi/en/zh)', () => {
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

  it('19.1 Backend route analytics.js implements 4 BI endpoints + i18n dictionary endpoint with RBAC finance redaction', () => {
    const routePath = path.join(rootDir, 'backend/routes/analytics.js');
    assert.ok(fs.existsSync(routePath), 'backend/routes/analytics.js must exist');
    const code = fs.readFileSync(routePath, 'utf8');

    assert.ok(code.includes("router.get('/bi-overview'"), 'Must expose GET /api/analytics/bi-overview');
    assert.ok(code.includes("router.get('/cost-breakdown'"), 'Must expose GET /api/analytics/cost-breakdown');
    assert.ok(code.includes("router.get('/plot-comparison'"), 'Must expose GET /api/analytics/plot-comparison');
    assert.ok(code.includes("router.get('/predictive-yield'"), 'Must expose GET /api/analytics/predictive-yield');
    assert.ok(code.includes("router.get('/i18n/:lang'"), 'Must expose GET /api/analytics/i18n/:lang');
    assert.ok(code.includes('FINANCE_REDACTED_ROLE'), 'Must enforce RBAC finance redaction for care_worker and auditor_readonly');
    assert.ok(code.includes('npk_fertilizer') && code.includes('pesticide_bvtv') && code.includes('labor_nhan_cong') && code.includes('water_energy'), 'Must analyze 4 core agricultural cost pillars');
  });

  it('19.2 Multi-language dictionaries (vi.json, en.json, zh.json) contain complete export & BI keys', () => {
    ['vi', 'en', 'zh'].forEach(lang => {
      const dictFile = path.join(rootDir, `frontend/i18n/${lang}.json`);
      assert.ok(fs.existsSync(dictFile), `frontend/i18n/${lang}.json must exist`);
      const parsed = JSON.parse(fs.readFileSync(dictFile, 'utf8'));
      assert.ok(parsed.meta && parsed.meta.lang === lang, `${lang}.json must define meta.lang`);
      assert.ok(parsed.traceability && parsed.traceability.field_puc_code, `${lang}.json must define PUC traceability keys`);
      assert.ok(parsed.bi && parsed.bi.kpi_roi && parsed.bi.kpi_cost_per_tree && parsed.bi.kpi_cost_per_ha, `${lang}.json must define Executive BI keys`);
    });
  });

  it('19.3 Universal i18n-engine.js & bi-analytics-widget.js are integrated across Public QR, Farmer, and Admin portals', () => {
    const i18nEnginePath = path.join(rootDir, 'frontend/public/js/i18n-engine.js');
    const biWidgetPath = path.join(rootDir, 'frontend/public/js/bi-analytics-widget.js');
    const plantHtmlPath = path.join(rootDir, 'frontend/public/plant.html');
    const userHtmlPath = path.join(rootDir, 'frontend/user/index.html');
    const adminHtmlPath = path.join(rootDir, 'frontend/admin/index.html');

    assert.ok(fs.existsSync(i18nEnginePath), 'i18n-engine.js must exist');
    assert.ok(fs.existsSync(biWidgetPath), 'bi-analytics-widget.js must exist');

    const plantHtml = fs.readFileSync(plantHtmlPath, 'utf8');
    const userHtml = fs.readFileSync(userHtmlPath, 'utf8');
    const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');

    assert.ok(plantHtml.includes('export-lang-switcher') && plantHtml.includes('i18n-engine.js'), 'Public QR plant.html must include language switcher and i18n-engine.js');
    assert.ok(userHtml.includes('executive-bi-analytics-root') && userHtml.includes('bi-analytics-widget.js'), 'Farmer portal index.html must include BI Analytics root and widget');
    assert.ok(adminHtml.includes('executive-bi-analytics-root') && adminHtml.includes('bi-analytics-widget.js'), 'Admin portal index.html must include BI Analytics root and widget');
  });

  it('19.4 BI Overview isolates metrics per farm_id and year, prevents null-farm leakage, and differentiates concurrent singleflight keys', async () => {
    const dbPath = path.join(backendDir, 'config/db.js');
    const authPath = path.join(backendDir, 'middleware/auth.js');
    const analyticsPath = path.join(backendDir, 'routes/analytics.js');

    const rawAnalytics = fs.readFileSync(analyticsPath, 'utf8');
    assert.ok(!rawAnalytics.includes('OR su.farm_id IS NULL'), 'analytics.js must not leak untagged su.farm_id IS NULL records when filtering by farm_id');

    const farmsData = [
      { id: 101, name: 'Vườn A', area: 10000, puc_code: 'PUC-A', vietgap_cert_number: 'VG-A', user_id: 1 },
      { id: 202, name: 'Vườn B', area: 20000, puc_code: 'PUC-B', vietgap_cert_number: 'VG-B', user_id: 1 }
    ];
    const plantsData = [
      { id: 1, tree_code: '001', plant_type: 'Sầu riêng', plant_variety: 'Dona', plot_code: 'Lô A1', farm_id: 101, farm_name: 'Vườn A', health_status: 'Tốt', plant_age: '6 năm' },
      { id: 2, tree_code: '002', plant_type: 'Sầu riêng', plant_variety: 'Ri6', plot_code: 'Lô A1', farm_id: 202, farm_name: 'Vườn B', health_status: 'Tốt', plant_age: '6 năm' },
      { id: 3, tree_code: '003', plant_type: 'Sầu riêng', plant_variety: 'Ri6', plot_code: 'Lô B2', farm_id: 202, farm_name: 'Vườn B', health_status: 'Tốt', plant_age: '6 năm' }
    ];
    const supplyUsages = [
      { id: 1, farm_id: 101, plant_id: 1, category: 'Phân bón', name: 'NPK', unit: 'kg', quantity: 10, unit_price: 50000, total_cost: 500000, usage_date: '2026-10-10' },
      { id: 2, farm_id: 202, plant_id: 2, category: 'Nhân công', name: 'Công chăm sóc', unit: 'công', quantity: 4, unit_price: 300000, total_cost: 1200000, usage_date: '2026-10-12' },
      { id: 3, farm_id: null, plant_id: null, category: 'Khác', name: 'Chi phí chung', unit: 'lần', quantity: 1, unit_price: 9999999, total_cost: 9999999, usage_date: '2026-10-15' }
    ];

    const mockPool = {
      async query(sql, params = []) {
        const s = String(sql).replace(/\s+/g, ' ').trim();
        if (s.startsWith('SELECT id, role, sub_role')) {
          return { rows: [{ id: 1, role: 'admin', sub_role: null, allow_view_finance: true, parent_user_id: null, farm_id: null }] };
        }
        if (s.includes('FROM farms WHERE COALESCE(is_deleted, false) = false')) {
          const fId = params[0];
          return { rows: fId ? farmsData.filter(f => f.id === Number(fId)) : farmsData };
        }
        if (s.includes('FROM plants p')) {
          const fId = params[0];
          return { rows: fId ? plantsData.filter(p => p.farm_id === Number(fId)) : plantsData };
        }
        if (s.includes('FROM supply_usages su')) {
          const fId = params[0];
          const yr = params[2];
          return {
            rows: supplyUsages.filter(su => {
              const matchFarm = !fId || su.farm_id === Number(fId);
              const matchYear = !yr || new Date(su.usage_date).getFullYear() === Number(yr);
              return matchFarm && matchYear;
            })
          };
        }
        return { rows: [] };
      }
    };

    await withMockedModules({
      [dbPath]: mockPool,
      [authPath]: (req, _res, next) => { req.user = { id: 1, role: 'admin' }; next(); },
      [analyticsPath]: null
    }, async () => {
      const analyticsRouter = require(analyticsPath);
      const [res101, res202, resAll, res2025] = await Promise.all([
        invokeRouter(analyticsRouter, '/api/analytics', 'GET', '/bi-overview?farm_id=101'),
        invokeRouter(analyticsRouter, '/api/analytics', 'GET', '/bi-overview?farm_id=202'),
        invokeRouter(analyticsRouter, '/api/analytics', 'GET', '/bi-overview'),
        invokeRouter(analyticsRouter, '/api/analytics', 'GET', '/bi-overview?farm_id=101&year=2025')
      ]);

      assert.strictEqual(res101.status, 200);
      assert.strictEqual(res101.body.summary.total_farms, 1);
      assert.strictEqual(res101.body.summary.total_trees, 1);
      assert.strictEqual(res101.body.summary.total_area_ha, 1);
      assert.strictEqual(res101.body.summary.total_investment_vnd, 500000);
      assert.strictEqual(res101.body.filter.farm_id, 101);
      assert.strictEqual(res101.body.selected_farm.name, 'Vườn A');

      assert.strictEqual(res202.status, 200);
      assert.strictEqual(res202.body.summary.total_farms, 1);
      assert.strictEqual(res202.body.summary.total_trees, 2);
      assert.strictEqual(res202.body.summary.total_area_ha, 2);
      assert.strictEqual(res202.body.summary.total_investment_vnd, 1200000);
      assert.strictEqual(res202.body.filter.farm_id, 202);
      assert.strictEqual(res202.body.selected_farm.name, 'Vườn B');

      assert.strictEqual(resAll.status, 200);
      assert.strictEqual(resAll.body.summary.total_farms, 2);
      assert.strictEqual(resAll.body.summary.total_trees, 3);
      assert.strictEqual(resAll.body.summary.total_area_ha, 3);
      assert.strictEqual(resAll.body.summary.total_investment_vnd, 11699999);
      assert.strictEqual(resAll.body.selected_farm, null);

      assert.strictEqual(res2025.status, 200);
      assert.strictEqual(res2025.body.filter.year, 2025);
      assert.strictEqual(res2025.body.summary.total_investment_vnd, 0);
    });
  });

  it('19.5 Plot ROI Matrix separates identical plot codes by farm_id and supports ?farm_id filtering', async () => {
    const dbPath = path.join(backendDir, 'config/db.js');
    const authPath = path.join(backendDir, 'middleware/auth.js');
    const analyticsPath = path.join(backendDir, 'routes/analytics.js');

    const farmsData = [
      { id: 101, name: 'Vườn A', area: 10000, user_id: 1 },
      { id: 202, name: 'Vườn B', area: 10000, user_id: 1 }
    ];
    const plantsData = [
      { id: 1, tree_code: '001', plant_type: 'Sầu riêng', plot_code: 'Lô A1', farm_id: 101, farm_name: 'Vườn A', health_status: 'Tốt', plant_age: '5 năm' },
      { id: 2, tree_code: '002', plant_type: 'Sầu riêng', plot_code: 'Lô A1', farm_id: 202, farm_name: 'Vườn B', health_status: 'Tốt', plant_age: '5 năm' }
    ];
    const supplyUsages = [
      { id: 1, farm_id: 101, plant_id: 1, category: 'Phân bón', total_cost: 400000, usage_date: '2026-10-10' },
      { id: 2, farm_id: 202, plant_id: 2, category: 'Nhân công', total_cost: 900000, usage_date: '2026-10-10' }
    ];

    const mockPool = {
      async query(sql, params = []) {
        const s = String(sql).replace(/\s+/g, ' ').trim();
        if (s.startsWith('SELECT id, role, sub_role')) {
          return { rows: [{ id: 1, role: 'admin', sub_role: null, allow_view_finance: true, parent_user_id: null, farm_id: null }] };
        }
        if (s.includes('FROM farms WHERE COALESCE(is_deleted, false) = false')) {
          const fId = params[0];
          return { rows: fId ? farmsData.filter(f => f.id === Number(fId)) : farmsData };
        }
        if (s.includes('FROM plants p')) {
          const fId = params[0];
          return { rows: fId ? plantsData.filter(p => p.farm_id === Number(fId)) : plantsData };
        }
        if (s.includes('FROM supply_usages su')) {
          const fId = params[0];
          return { rows: fId ? supplyUsages.filter(su => su.farm_id === Number(fId)) : supplyUsages };
        }
        return { rows: [] };
      }
    };

    await withMockedModules({
      [dbPath]: mockPool,
      [authPath]: (req, _res, next) => { req.user = { id: 1, role: 'admin' }; next(); },
      [analyticsPath]: null
    }, async () => {
      const analyticsRouter = require(analyticsPath);
      const [allPlotsRes, farm101PlotsRes] = await Promise.all([
        invokeRouter(analyticsRouter, '/api/analytics', 'GET', '/plot-comparison'),
        invokeRouter(analyticsRouter, '/api/analytics', 'GET', '/plot-comparison?farm_id=101')
      ]);

      assert.strictEqual(allPlotsRes.status, 200);
      assert.strictEqual(allPlotsRes.body.total_plots, 2);
      const p101 = allPlotsRes.body.plots.find(p => p.farm_id === 101);
      const p202 = allPlotsRes.body.plots.find(p => p.farm_id === 202);
      assert.ok(p101 && p202, 'Same-named Lô A1 from two farms must stay separate rows');
      assert.strictEqual(p101.farm_name, 'Vườn A');
      assert.strictEqual(p202.farm_name, 'Vườn B');
      assert.strictEqual(p101.total_cost_vnd, 400000);
      assert.strictEqual(p202.total_cost_vnd, 900000);

      assert.strictEqual(farm101PlotsRes.status, 200);
      assert.strictEqual(farm101PlotsRes.body.total_plots, 1);
      assert.strictEqual(farm101PlotsRes.body.plots[0].farm_id, 101);
      assert.strictEqual(farm101PlotsRes.body.plots[0].farm_name, 'Vườn A');
    });
  });

  it('19.6 BI widget renders Farm/Year dropdowns, passes ?farm_id & ?year to APIs, and shows Farm column in Plot ROI Matrix', async () => {
    const biWidgetPath = path.join(rootDir, 'frontend/public/js/bi-analytics-widget.js');
    const code = fs.readFileSync(biWidgetPath, 'utf8');

    assert.ok(code.includes('bi-farm-filter-select'), 'Must render farm selector dropdown');
    assert.ok(code.includes('bi-year-filter-select'), 'Must render year selector dropdown');
    assert.ok(code.includes('switchBiFarmFilter'), 'Must expose window.switchBiFarmFilter');
    assert.ok(code.includes('switchBiYearFilter'), 'Must expose window.switchBiYearFilter');
    assert.ok(code.includes("fetch('/api/farms'"), 'Must load farms list from /api/farms');

    const rootEl = { innerHTML: '' };
    const fetchedUrls = [];
    const windowObj = {
      addEventListener: () => {},
      PlantBookI18n: {
        getLanguage: () => 'vi',
        getCurrency: () => 'VND',
        formatCurrency: (v) => `${Math.round(Number(v) || 0)} ₫`,
        t: (k, fb) => fb || k
      }
    };
    const sandbox = {
      window: windowObj,
      document: {
        getElementById: (id) => (id === 'executive-bi-analytics-root' ? rootEl : null),
        createElement: () => ({ style: {} }),
        body: { appendChild: () => {} }
      },
      localStorage: {
        getItem: (k) => (k === 'pb_token' ? 'mock_admin_jwt' : (k === 'user' ? JSON.stringify({ id: 1, role: 'admin' }) : null))
      },
      URLSearchParams,
      performance: { now: () => 0 },
      console,
      fetch: async (url) => {
        fetchedUrls.push(url);
        if (url === '/api/farms') {
          return {
            ok: true,
            status: 200,
            json: async () => ([
              { id: 101, name: 'Vườn A', plant_count: 20, area: 991 },
              { id: 202, name: 'Vườn B', plant_count: 15, area: 5000 }
            ])
          };
        }
        if (url.startsWith('/api/analytics/bi-overview')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data_source: 'LIVE_DATABASE_ACCOUNTING',
              usage_batches_count: 5,
              selected_farm: { id: 101, name: 'Vườn A' },
              summary: {
                total_farms: 1,
                total_trees: 20,
                total_area_ha: 0.099,
                total_investment_vnd: 5000000,
                cost_per_tree_vnd: 250000,
                cost_per_hectare_vnd: 50505050,
                projected_season_revenue_vnd: 25000000,
                revenue_per_tree_vnd: 1250000,
                revenue_per_hectare_vnd: 252525252,
                net_profit_vnd: 20000000,
                roi_percent: 400,
                gross_margin_percent: 80,
                predicted_yield_kg: 300,
                predicted_yield_tons_per_ha: 3.03,
                ml_confidence_percent: 95,
                ml_r_squared: 0.91
              },
              cost_pillars: []
            })
          };
        }
        if (url.startsWith('/api/analytics/plot-comparison')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              total_plots: 1,
              plots: [{
                farm_id: 101,
                farm_name: 'Vườn A',
                plot_code: 'Lô A1',
                tree_count: 20,
                estimated_area_ha: 0.099,
                cost_per_tree_vnd: 250000,
                cost_per_hectare_vnd: 50505050,
                predicted_yield_kg: 300,
                predicted_revenue_vnd: 25000000,
                roi_percent: 400,
                efficiency_grade: 'A+'
              }]
            })
          };
        }
        return { ok: true, status: 200, json: async () => ({ monthly_cashflow: [], agronomic_recommendations: [] }) };
      }
    };
    vm.runInNewContext(code, sandbox);

    await windowObj.loadExecutiveBiAnalytics('101', '2026');
    assert.ok(fetchedUrls.includes('/api/farms'), 'Must fetch /api/farms');
    assert.ok(fetchedUrls.includes('/api/analytics/bi-overview?farm_id=101&year=2026'), 'Must pass farm_id and year to /bi-overview');
    assert.ok(rootEl.innerHTML.includes('id="bi-farm-filter-select"'), 'Rendered DOM must contain farm dropdown');
    assert.ok(rootEl.innerHTML.includes('📍 Vườn A'), 'Rendered DOM must show active farm scope badge');
    assert.ok(rootEl.innerHTML.includes('Vườn B (15 cây)'), 'Rendered DOM must list other farms in dropdown');

    windowObj.switchBiInternalPane('plots');
    assert.ok(rootEl.innerHTML.includes('Trang trại'), 'Plot ROI Matrix must include Farm column header');
    assert.ok(rootEl.innerHTML.includes("switchBiFarmFilter('101')"), 'Clicking farm name in Plot ROI Matrix must filter by farm_id');
  });
});
