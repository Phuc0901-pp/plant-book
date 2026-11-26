const assert = require('assert');
const crypto = require('crypto');

const BASE_URL = (process.env.E2E_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const METRICS_TOKEN = process.env.APM_METRICS_TOKEN || 'ci_metrics_token_iso';

async function apiReq(urlPath, opts = {}) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    ...opts,
    headers: {
      ...(opts.headers || {})
    }
  });
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/pdf')) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, buffer: buf };
  }
  const text = await res.text();
  let body = text;
  try { body = JSON.parse(text); } catch (_) {}
  return { status: res.status, headers: res.headers, body };
}

async function run() {
  const health = await apiReq('/api/health');
  assert.strictEqual(health.status, 200);
  assert.strictEqual(health.body.status, 'ok');

  const uniq = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const email = `e2e_owner_${uniq}@tanbao.vn`;
  const password = 'IsoE2ePassword@2026';

  const reg = await apiReq('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: 'E2E Chủ Vườn', email, password, phone: `09${String(Date.now()).slice(-8)}` })
  });
  assert.ok([200, 201].includes(reg.status), `Register failed: ${JSON.stringify(reg.body)}`);

  const login = await apiReq('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password })
  });
  assert.strictEqual(login.status, 200);
  const tok = login.body.token;
  assert.ok(tok, 'Login JWT missing');
  const authHdr = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };

  const farmRes = await apiReq('/api/farms', {
    method: 'POST',
    headers: authHdr,
    body: JSON.stringify({
      name: `Vườn E2E ${uniq}`,
      puc_code: `VN-E2E-${uniq.slice(-4)}`,
      area: 10000,
      latitude: 10.95,
      longitude: 107.25
    })
  });
  assert.ok([200, 201].includes(farmRes.status), `Farm creation failed: ${JSON.stringify(farmRes.body)}`);
  const farmId = (farmRes.body.farm && farmRes.body.farm.id) || farmRes.body.id;
  assert.ok(farmId, 'Farm ID missing');

  const batchRes = await apiReq('/api/plants/batch-range', {
    method: 'POST',
    headers: authHdr,
    body: JSON.stringify({
      farm_id: farmId,
      prefix: 'E2E-',
      start_num: 1,
      end_num: 3,
      plant_type: 'Sầu riêng',
      plant_variety: 'Ri6',
      location: 'Lô A, Hàng 1'
    })
  });
  assert.ok([200, 201].includes(batchRes.status), `Batch range failed: ${JSON.stringify(batchRes.body)}`);

  const listPlants = await apiReq(`/api/plants?farm_id=${farmId}`, { headers: { Authorization: `Bearer ${tok}` } });
  assert.strictEqual(listPlants.status, 200);
  const plantList = Array.isArray(listPlants.body) ? listPlants.body : (listPlants.body.plants || []);
  assert.ok(plantList.length >= 3, 'Expected >= 3 plants from batch-range');
  const plant1 = plantList[0];

  const today = new Date().toISOString().slice(0, 10);
  const sprayRes = await apiReq(`/api/plants/${plant1.id}/logs`, {
    method: 'POST',
    headers: authHdr,
    body: JSON.stringify({
      log_date: today,
      log_type: 'Phun thuốc',
      note: 'Phun phòng nấm PHI 14 ngày',
      details: { name: 'Ridomil Gold', active_ingredient: 'Metalaxyl', phi_days: 14 }
    })
  });
  assert.ok([200, 201].includes(sprayRes.status), `Spray log failed: ${JSON.stringify(sprayRes.body)}`);

  const clientUuid = `e2e_uuid_${uniq}`;
  const sync1 = await apiReq('/api/plants/offline-batch-sync', {
    method: 'POST',
    headers: authHdr,
    body: JSON.stringify({
      care_logs: [
        { client_uuid: `${clientUuid}_phi`, plant_id: plant1.id, log_type: 'Thu hoạch', log_date: today },
        { client_uuid: clientUuid, plant_id: plant1.id, log_type: 'Tưới nước', log_date: today, note: 'Tưới nhỏ giọt' }
      ],
      field_mutations: []
    })
  });
  assert.strictEqual(sync1.status, 200);
  assert.strictEqual(sync1.body.synced_logs, 1);
  assert.ok(sync1.body.rejected_items.some(r => r.code === 'PHI_VIOLATION_BLOCKED'));

  const syncReplay = await apiReq('/api/plants/offline-batch-sync', {
    method: 'POST',
    headers: authHdr,
    body: JSON.stringify({
      care_logs: [{ client_uuid: clientUuid, plant_id: plant1.id, log_type: 'Tưới nước', log_date: today }],
      field_mutations: []
    })
  });
  assert.strictEqual(syncReplay.status, 200);
  assert.strictEqual(syncReplay.body.synced_logs, 0);

  const reportQuery = await apiReq(`/api/plants/reports/query?farm_id=${farmId}`, { headers: { Authorization: `Bearer ${tok}` } });
  assert.strictEqual(reportQuery.status, 200);
  assert.ok(reportQuery.body.rows.length >= 2);

  const pdfRes = await apiReq('/api/plants/reports/export-pdf-signed', {
    method: 'POST',
    headers: authHdr,
    body: JSON.stringify({ farm_id: farmId, title: 'PG Real Integration Signed PDF' })
  });
  assert.strictEqual(pdfRes.status, 200);
  assert.strictEqual(pdfRes.buffer.subarray(0, 5).toString('ascii'), '%PDF-');
  const certUuid = pdfRes.headers.get('x-report-cert-uuid');
  assert.ok(certUuid, 'Missing X-Report-Cert-UUID');

  const verifyOk = await apiReq('/api/plants/public/verify-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cert_uuid: certUuid, pdf_base64: pdfRes.buffer.toString('base64') })
  });
  assert.strictEqual(verifyOk.status, 200);
  assert.strictEqual(verifyOk.body.valid, true);

  const tampered = Buffer.from(pdfRes.buffer);
  tampered[90] = tampered[90] === 65 ? 66 : 65;
  const verifyTampered = await apiReq('/api/plants/public/verify-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cert_uuid: certUuid, pdf_base64: tampered.toString('base64') })
  });
  assert.strictEqual(verifyTampered.status, 422);
  assert.strictEqual(verifyTampered.body.tampered, true);

  const metricsRes = await apiReq('/metrics', { headers: { Authorization: `Bearer ${METRICS_TOKEN}` } });
  assert.strictEqual(metricsRes.status, 200);
  assert.ok(String(metricsRes.body).includes('plantbook_http_requests_total'));

  console.log(JSON.stringify({ success: true, e2e: 'postgres-integration', farmId, certUuid }));
}

run().catch(err => {
  console.error('Postgres E2E failed:', err);
  process.exit(1);
});
