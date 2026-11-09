/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/**
 * Suite 19: Executive BI Financial Analytics, ML Yield Forecast & Export i18n (vi/en/zh)
 */

const fs = require('fs');
const path = require('path');
const { describe, it, assert } = require('../test-framework');

describe('Suite 19: Executive BI Financial Analytics, ML Predictive Yield & Export i18n (vi/en/zh)', () => {
  const rootDir = path.join(__dirname, '../../..');

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
});
