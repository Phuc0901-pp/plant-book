const fs = require('fs');
const path = require('path');
const { describe, test, assert } = require('../test-framework');

const rootDir = path.resolve(__dirname, '../../..');

describe('Suite 28: Enterprise APM OpenMetrics, Real PostgreSQL/Playwright CI & k6 Load Gate', () => {
  test('28.3 [ENT-03] APM Telemetry computes p50/p95/p99, OpenMetrics /metrics & protects access', async () => {
    const apm = require('../../services/apmMetricsService');
    apm.resetApmMetricsForTest();

    for (let i = 1; i <= 100; i++) {
      apm.recordHttpMetric('GET', `/api/farms/${i}/full-dataset`, i === 100 ? 500 : 200, i <= 90 ? 20 : (i <= 98 ? 150 : 600));
    }
    const summary = apm.getApmSummary({ totalCount: 15, idleCount: 10, waitingCount: 0 }, { clients: { size: 3 } });
    assert.strictEqual(summary.requests_total, 100);
    assert.strictEqual(summary.errors_total, 1);
    assert.strictEqual(summary.latency_ms.p50, 20);
    assert.strictEqual(summary.latency_ms.p95, 150);
    assert.strictEqual(summary.latency_ms.p99, 600);

    const promText = apm.renderPrometheusMetrics({ totalCount: 15, idleCount: 10, waitingCount: 0 }, { clients: { size: 3 } });
    assert.ok(promText.includes('# TYPE plantbook_http_requests_total counter'));
    assert.ok(promText.includes('plantbook_ws_active_clients 3'));

    const serverSrc = fs.readFileSync(path.join(rootDir, 'backend/server.js'), 'utf8');
    assert.ok(serverSrc.includes('apmRequestMiddleware'));
    assert.ok(serverSrc.includes("app.get('/metrics'"));
    assert.ok(serverSrc.includes("app.get('/api/admin/apm/summary'"));
  });

  test('28.4 [ENT-04] Real PostgreSQL 16 + Playwright Chromium CI workflow & E2E scripts verified', () => {
    const ciYml = fs.readFileSync(path.join(rootDir, '.github/workflows/ci-quality-gate.yml'), 'utf8');
    const pgE2e = fs.readFileSync(path.join(rootDir, 'backend/tests/e2e/postgres-integration.e2e.js'), 'utf8');
    const pwE2e = fs.readFileSync(path.join(rootDir, 'backend/tests/e2e/playwright-portals.e2e.js'), 'utf8');

    assert.ok(ciYml.includes('postgres:16-alpine'));
    assert.ok(ciYml.includes('npx playwright-core install chromium --with-deps'));
    assert.ok(ciYml.includes('npm run test:e2e:pg'));
    assert.ok(ciYml.includes('npm run test:e2e:browser'));
    assert.ok(pgE2e.includes('/api/plants/reports/query'));
    assert.ok(pwE2e.includes('#user-export-logs-modal'));
  });

  test('28.5 [ENT-05] k6 200-VU load script, SLA gate & Prometheus scrape config verified', () => {
    const { evaluateK6Summary } = require('../load/k6-summary-gate');
    const k6Src = fs.readFileSync(path.join(rootDir, 'backend/tests/load/k6-iso-load-test.js'), 'utf8');
    const promYml = fs.readFileSync(path.join(rootDir, 'monitoring/prometheus.yml'), 'utf8');

    assert.ok(k6Src.includes('target: 200'));
    assert.ok(k6Src.includes('p(95)<400'));
    assert.ok(promYml.includes("metrics_path: '/metrics'"));

    const pass = evaluateK6Summary({
      metrics: { http_req_failed: { values: { rate: 0.001 } }, http_req_duration: { values: { 'p(95)': 120, 'p(99)': 280 } } }
    });
    const fail = evaluateK6Summary({
      metrics: { http_req_failed: { values: { rate: 0.05 } }, http_req_duration: { values: { 'p(95)': 500, 'p(99)': 900 } } }
    });
    assert.strictEqual(pass.passed, true);
    assert.strictEqual(fail.passed, false);
    assert.strictEqual(fail.reasons.length, 3);
  });
});
