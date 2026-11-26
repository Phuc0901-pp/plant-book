import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.K6_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const JWT_TOKEN = __ENV.K6_JWT_TOKEN || '';
const FARM_ID = __ENV.K6_FARM_ID || '1';

export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '40s', target: 50 },
    { duration: '60s', target: 200 },
    { duration: '20s', target: 0 }
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400', 'p(99)<800']
  }
};

export default function runLoadTest() {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health 200': (r) => r.status === 200
  });

  if (JWT_TOKEN) {
    const headers = {
      Authorization: `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json'
    };

    const reportRes = http.get(`${BASE_URL}/api/plants/reports/query?farm_id=${FARM_ID}`, { headers });
    check(reportRes, {
      'reports query ok': (r) => r.status === 200
    });

    const biRes = http.get(`${BASE_URL}/api/analytics/bi-overview`, { headers });
    check(biRes, {
      'bi overview ok': (r) => r.status === 200 || r.status === 403
    });

    const datasetRes = http.get(`${BASE_URL}/api/farms/${FARM_ID}/full-dataset`, { headers });
    check(datasetRes, {
      'full dataset ok': (r) => r.status === 200 || r.status === 404
    });

    const syncRes = http.post(
      `${BASE_URL}/api/plants/offline-batch-sync`,
      JSON.stringify({ care_logs: [], field_mutations: [] }),
      { headers }
    );
    check(syncRes, {
      'offline batch sync ok': (r) => r.status === 200
    });
  }

  sleep(0.5);
}
