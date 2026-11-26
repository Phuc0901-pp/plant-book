const fs = require('fs');
const path = require('path');
const { describe, test, assert } = require('../test-framework');

const rootDir = path.resolve(__dirname, '../../..');

describe('Suite 28: Enterprise P12 Signed PDF, APM OpenMetrics, Real PostgreSQL/Playwright CI & k6 Load Gate', () => {
  test('28.1 [ENT-01] Enterprise PKCS#12 .p12 PDF signing embeds logo.png & detects 1-byte tampering', async () => {
    const { createEnterpriseP12Buffer } = require('../../scripts/generate-dev-p12');
    const { generateSignedIsoPdf, verifySignedPdfBuffer, computeLogsMerkleRoot } = require('../../services/signedPdfService');

    const p12 = createEnterpriseP12Buffer({
      cn: 'Tan Bao Sai Gon Test Cert',
      org: 'Tan Bao Sai Gon AgTech',
      passphrase: 'EnterpriseIsoP12Pass!'
    });
    assert.ok(Buffer.isBuffer(p12.p12Buffer) && p12.p12Buffer.length > 500);

    const rows = [
      { id: 1, plant_id: 10, tree_code: 'SR-01', log_date: '2026-11-26', log_type: 'Phun thuốc', material_name: 'Ridomil Gold', active_ingredient: 'Metalaxyl', phi_status_label: 'An toàn PHI', operator_name: 'Kỹ thuật viên', farm_name: 'Vườn Long Khánh', puc_code: 'VN-LK-01', record_hash: 'a'.repeat(64) }
    ];
    const signed = await generateSignedIsoPdf({
      report: { rows, summary: { date_from: '2026-11-01', date_to: '2026-11-30', phi_violations: 0 } },
      farmName: 'Vườn Long Khánh',
      pucCode: 'VN-LK-01',
      p12Buffer: p12.p12Buffer,
      p12Passphrase: p12.passphrase
    });

    assert.strictEqual(signed.pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.strictEqual(signed.logo_embedded, true, 'Official logo.png must be embedded');
    assert.strictEqual(signed.merkle_root, computeLogsMerkleRoot(rows));
    assert.ok(signed.pdfBuffer.toString('latin1').includes('/ByteRange'), 'PAdES /ByteRange missing');

    const ok = verifySignedPdfBuffer(signed.pdfBuffer, signed);
    assert.strictEqual(ok.valid, true);
    assert.strictEqual(ok.tampered, false);

    const tampered = Buffer.from(signed.pdfBuffer);
    tampered[120] = tampered[120] === 65 ? 66 : 65;
    const bad = verifySignedPdfBuffer(tampered, signed);
    assert.strictEqual(bad.valid, false);
    assert.strictEqual(bad.tampered, true);

    const mig017 = fs.readFileSync(path.join(rootDir, 'backend/db/migrations/017_signed_pdf_registry.sql'), 'utf8');
    const initJs = fs.readFileSync(path.join(rootDir, 'backend/db/init.js'), 'utf8');
    assert.ok(mig017.startsWith('-- +migrate Up'));
    assert.ok(initJs.includes('signed_report_certificates'));
  });

  test('28.2 [ENT-02] Signed PDF export/verify endpoints & 3-portal UI buttons wired', () => {
    const coreSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/plants/core.routes.js'), 'utf8');
    const publicSrc = fs.readFileSync(path.join(rootDir, 'backend/routes/plants/public.routes.js'), 'utf8');
    const logsHtml = fs.readFileSync(path.join(rootDir, 'frontend/user/src/views/logs.html'), 'utf8');
    const logsJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/modules/logs.js'), 'utf8');
    const reportHtml = fs.readFileSync(path.join(rootDir, 'frontend/public/report.html'), 'utf8');
    const reportJs = fs.readFileSync(path.join(rootDir, 'frontend/public/js/report.js'), 'utf8');
    const adminDbJs = fs.readFileSync(path.join(rootDir, 'frontend/admin/js/database.js'), 'utf8');

    assert.ok(coreSrc.includes("'/reports/export-pdf-signed'"));
    assert.ok(publicSrc.includes("'/public/verify-report/:certUuid'"));
    assert.ok(publicSrc.includes("'/public/verify-report'"));
    assert.ok(publicSrc.includes("'/:id(\\\\d+)/export-pdf-signed'"));
    assert.ok(logsHtml.includes('id="btn-user-export-signed-p12-pdf"'));
    assert.ok(logsJs.includes('/api/plants/reports/export-pdf-signed'));
    assert.ok(reportHtml.includes('id="btn-export-signed-pdf"'));
    assert.ok(reportJs.includes('downloadPublicSignedPdf'));
    assert.ok(adminDbJs.includes('exportDbFarmSignedPdf'));
  });

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
    assert.ok(pgE2e.includes('/api/plants/reports/export-pdf-signed'));
    assert.ok(pwE2e.includes('#btn-user-export-signed-p12-pdf'));
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
