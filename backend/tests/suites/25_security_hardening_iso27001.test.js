const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { describe, it, expect } = require('../test-framework');

describe('Suite 25: Security Hardening (ISO/IEC 27001, OWASP ASVS & API Security)', () => {
  const rootDir = path.join(__dirname, '../../..');

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

  function invokeRouter(router, baseMount, method, url, body = {}, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = {
        method,
        url,
        originalUrl: `${baseMount}${url}`,
        path: url,
        headers,
        query: {},
        body,
        params: {},
        app: { get: () => null }
      };
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(payload) { resolve({ status: this.statusCode, body: payload }); },
        send(payload) { resolve({ status: this.statusCode, body: payload }); }
      };
      router.handle(req, res, (err) => reject(err || new Error(`Unhandled ${method} ${url}`)));
    });
  }

  it('25.1 [SEC-01] Farm IoT endpoints block cross-tenant IDOR (403), invalid IDs (400), missing farms (404), and allow authorized owners/admin', async () => {
    const dbPath = path.join(rootDir, 'backend/config/db.js');
    const authPath = path.join(rootDir, 'backend/middleware/auth.js');
    const redisPath = path.join(rootDir, 'backend/config/redis.js');
    const farmsPath = path.join(rootDir, 'backend/routes/farms.js');

    let currentUser = { id: 99, role: 'farmer', farm_id: 2 };
    const farmsDb = [{ id: 1, user_id: 10, is_deleted: false }];
    const iotDb = [{ farm_id: 1, air_data: { temp: 29 }, soil_data: { moisture: 60 }, water_data: { ph: 6.5 }, weather_forecast: [], updated_at: new Date().toISOString() }];

    await withMockedModules({
      [farmsPath]: null,
      [dbPath]: {
        query: async (sql, params = []) => {
          if (sql.includes('SELECT id, user_id FROM farms')) {
            const f = farmsDb.find(x => x.id === Number(params[0]) && !x.is_deleted);
            return { rows: f ? [f] : [] };
          }
          if (sql.includes('SELECT * FROM farm_iot_sensors')) {
            const r = iotDb.find(x => x.farm_id === Number(params[0]));
            return { rows: r ? [r] : [] };
          }
          if (sql.includes('INSERT INTO farm_iot_sensors')) {
            return { rows: [{ farm_id: Number(params[0]), air_data: params[1], soil_data: params[2], water_data: params[3], weather_forecast: params[4], updated_at: new Date().toISOString() }] };
          }
          return { rows: [] };
        }
      },
      [authPath]: (req, res, next) => { req.user = currentUser; next(); },
      [redisPath]: { getCache: async () => null, setCache: async () => {}, delCache: async () => {}, delCacheByPattern: async () => {} }
    }, async () => {
      const farmsRouter = require(farmsPath);

      const r1 = await invokeRouter(farmsRouter, '/api/farms', 'GET', '/1/iot-data');
      expect(r1.status).toBe(403);
      expect(r1.body.code).toBe('FARM_ACCESS_DENIED');

      const r2 = await invokeRouter(farmsRouter, '/api/farms', 'POST', '/1/iot-data/refresh');
      expect(r2.status).toBe(403);
      expect(r2.body.code).toBe('FARM_ACCESS_DENIED');

      const r3 = await invokeRouter(farmsRouter, '/api/farms', 'GET', '/-5/iot-data');
      expect(r3.status).toBe(400);
      expect(r3.body.code).toBe('INVALID_FARM_ID');

      const r4 = await invokeRouter(farmsRouter, '/api/farms', 'GET', '/999/iot-data');
      expect(r4.status).toBe(404);
      expect(r4.body.code).toBe('FARM_NOT_FOUND');

      currentUser = { id: 10, role: 'farmer', farm_id: null };
      const r5 = await invokeRouter(farmsRouter, '/api/farms', 'GET', '/1/iot-data');
      expect(r5.status).toBe(200);
      expect(r5.body.success).toBe(true);

      currentUser = { id: 55, role: 'user', parent_user_id: 10, farm_id: null };
      const r6 = await invokeRouter(farmsRouter, '/api/farms', 'POST', '/1/iot-data/refresh');
      expect(r6.status).toBe(200);

      currentUser = { id: 1, role: 'admin' };
      const r7 = await invokeRouter(farmsRouter, '/api/farms', 'GET', '/1/iot-data');
      expect(r7.status).toBe(200);
    });
  });

  it('25.2 [SEC-02] /api/costs enforces RBAC finance redaction, cross-farm isolation, and positive amount validation', async () => {
    const dbPath = path.join(rootDir, 'backend/config/db.js');
    const authPath = path.join(rootDir, 'backend/middleware/auth.js');
    const costsPath = path.join(rootDir, 'backend/routes/costs.js');

    let currentUser = { id: 30, role: 'farmer', sub_role: 'care_worker', allow_view_finance: false };
    const farmsDb = [{ id: 1, user_id: 10 }, { id: 2, user_id: 99 }];

    await withMockedModules({
      [costsPath]: null,
      [dbPath]: {
        query: async (sql, params = []) => {
          if (sql.includes('SELECT id, user_id FROM farms')) {
            const f = farmsDb.find(x => x.id === Number(params[0]));
            return { rows: f ? [f] : [] };
          }
          if (sql.includes('FROM fixed_assets fa')) {
            return { rows: [{ id: 1, name: 'Irrigation', category: 'Water', year: 2024, cost: 50000000, life: 5, farm_id: 1, user_id: 10 }] };
          }
          if (sql.includes('SELECT id FROM supplies')) return { rows: [{ id: 5 }] };
          if (sql.includes('INSERT INTO supply_usages')) {
            return { rows: [{ id: 2, user_id: params[0], supply_id: params[1], farm_id: params[2], total_cost: params[6] }] };
          }
          return { rows: [] };
        }
      },
      [authPath]: (req, res, next) => { req.user = currentUser; next(); }
    }, async () => {
      const costsRouter = require(costsPath);

      const rCare = await invokeRouter(costsRouter, '/api/costs', 'GET', '/consumables');
      expect(rCare.status).toBe(403);
      expect(rCare.body.code).toBe('FINANCE_REDACTED_ROLE');

      currentUser = { id: 31, role: 'farmer', sub_role: 'auditor_readonly', allow_view_finance: false };
      const rAud = await invokeRouter(costsRouter, '/api/costs', 'POST', '/fixed', { farm_id: 1, name: 'Pump', cost: 1000000 });
      expect(rAud.status).toBe(403);
      expect(rAud.body.code).toBe('FINANCE_REDACTED_ROLE');

      currentUser = { id: 99, role: 'farmer', sub_role: 'farm_owner', allow_view_finance: true, farm_id: 2 };
      const rCross = await invokeRouter(costsRouter, '/api/costs', 'POST', '/consumables', { farm_id: 1, name: 'NPK', qty: 5, price: 20000 });
      expect(rCross.status).toBe(403);
      expect(rCross.body.code).toBe('FARM_ACCESS_DENIED');

      currentUser = { id: 10, role: 'farmer', sub_role: 'farm_owner', allow_view_finance: true };
      const rNeg = await invokeRouter(costsRouter, '/api/costs', 'POST', '/consumables', { farm_id: 1, name: 'NPK', qty: -5, price: 20000 });
      expect(rNeg.status).toBe(400);
      expect(rNeg.body.code).toBe('INVALID_AMOUNT');

      currentUser = { id: 25, role: 'farmer', sub_role: 'farm_manager', parent_user_id: 10, allow_view_finance: true };
      const rMgr = await invokeRouter(costsRouter, '/api/costs', 'GET', '/fixed');
      expect(rMgr.status).toBe(200);
      expect(rMgr.body[0].dep_per_year).toBe(10000000);

      const rOk = await invokeRouter(costsRouter, '/api/costs', 'POST', '/consumables', { farm_id: 1, name: 'NPK', qty: 4, price: 25000 });
      expect(rOk.status).toBe(201);
      expect(rOk.body.total_cost).toBe(100000);
    });
  });

  it('25.3 [SEC-03] Tight CORS whitelist blocks spoofed *.onrender.com & emits COOP/CORP headers at high throughput', () => {
    const sec = require(path.join(rootDir, 'backend/middleware/securityHeaders.js'));

    expect(sec.isOriginAllowed('https://evil-attacker.onrender.com')).toBe(false);
    expect(sec.isOriginAllowed('https://tanbaocorp.vn.evil.com')).toBe(false);
    expect(sec.isOriginAllowed('https://plant-book.onrender.com')).toBe(true);
    expect(sec.isOriginAllowed('https://dev-plantbook.onrender.com')).toBe(true);
    expect(sec.isOriginAllowed('https://tanbaocorp-agritech.vn')).toBe(true);

    const headers = {};
    let nextCalled = false;
    sec.securityHeaders({ secure: true, headers: { 'x-forwarded-proto': 'https' } }, { setHeader: (k, v) => { headers[k] = v; } }, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups');
    expect(headers['Cross-Origin-Resource-Policy']).toBe('same-site');

    const t0 = performance.now();
    for (let i = 0; i < 10000; i++) {
      sec.isOriginAllowed('https://evil-attacker.onrender.com');
      sec.isOriginAllowed('https://plant-book.onrender.com');
    }
    const elapsedMs = performance.now() - t0;
    expect(elapsedMs).toBeLessThan(500);
  });

  it('25.4 [SEC-04] Auth enforces 5-attempt account lockout, token_version revocation, and /refresh rotation', async () => {
    const prevSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'suite25_iso27001_jwt_secret_2026';

    const dbPath = path.join(rootDir, 'backend/config/db.js');
    const authMwPath = path.join(rootDir, 'backend/middleware/auth.js');
    const authRouterPath = path.join(rootDir, 'backend/routes/auth.js');

    const userRow = {
      id: 10,
      email: 'farmer10@tanbaocorp.vn',
      password_hash: bcrypt.hashSync('CorrectPass@123', 4),
      role: 'farmer',
      sub_role: 'farm_owner',
      full_name: 'Nông hộ A',
      farm_id: 1,
      approved: true,
      token_version: 1,
      failed_login_attempts: 0,
      locked_until: null,
      allow_view_finance: true,
      view_plants_scope: 'all',
      allow_shared_history: true,
      allow_view_supplies: true
    };

    try {
      await withMockedModules({
        [authMwPath]: null,
        [authRouterPath]: null,
        [dbPath]: {
          query: async (sql, params = []) => {
            if (sql.includes('SELECT * FROM users WHERE LOWER(email)')) {
              return { rows: params[0] === userRow.email ? [{ ...userRow }] : [] };
            }
            if (sql.includes('SELECT * FROM users WHERE id=$1')) {
              return { rows: Number(params[0]) === userRow.id ? [{ ...userRow }] : [] };
            }
            if (sql.includes('COALESCE(token_version, 1) as token_version')) {
              return { rows: Number(params[0]) === userRow.id ? [{ ...userRow }] : [] };
            }
            if (sql.includes('UPDATE users SET failed_login_attempts = $1, locked_until')) {
              userRow.failed_login_attempts = params[0];
              userRow.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
              return { rows: [] };
            }
            if (sql.includes('UPDATE users SET failed_login_attempts = $1 WHERE id = $2')) {
              userRow.failed_login_attempts = params[0];
              return { rows: [] };
            }
            if (sql.includes('failed_login_attempts = 0, locked_until = NULL')) {
              userRow.failed_login_attempts = 0;
              userRow.locked_until = null;
              if (sql.includes('token_version = COALESCE(token_version, 1) + 1')) {
                userRow.token_version += 1;
                userRow.password_hash = params[0];
              }
              return { rows: [] };
            }
            if (sql.includes('UPDATE users SET is_online = false') && sql.includes('token_version = COALESCE(token_version, 1) + 1')) {
              userRow.token_version += 1;
              return { rows: [] };
            }
            return { rows: [] };
          }
        }
      }, async () => {
        const authMw = require(authMwPath);
        const authRouter = require(authRouterPath);

        const runMw = (token) => new Promise((resolve) => {
          const req = { headers: { authorization: `Bearer ${token}` } };
          const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ passed: false, status: this.statusCode, body: b }); } };
          authMw(req, res, () => resolve({ passed: true, user: req.user }));
        });

        for (let i = 1; i <= 4; i++) {
          const rBad = await invokeRouter(authRouter, '/api/auth', 'POST', '/login', { email: userRow.email, password: 'Wrong' });
          expect(rBad.status).toBe(401);
        }
        const rLock = await invokeRouter(authRouter, '/api/auth', 'POST', '/login', { email: userRow.email, password: 'Wrong' });
        expect(rLock.status).toBe(429);
        expect(rLock.body.code).toBe('ACCOUNT_LOCKED');

        userRow.locked_until = null;
        userRow.failed_login_attempts = 0;

        const rOk = await invokeRouter(authRouter, '/api/auth', 'POST', '/login', { email: userRow.email, password: 'CorrectPass@123' });
        expect(rOk.status).toBe(200);
        expect(jwt.verify(rOk.body.token, process.env.JWT_SECRET).tv).toBe(1);

        const rLogout = await invokeRouter(authRouter, '/api/auth', 'POST', '/logout', {}, { authorization: `Bearer ${rOk.body.token}` });
        expect(rLogout.status).toBe(200);
        expect(userRow.token_version).toBe(2);

        const rOldTok = await runMw(rOk.body.token);
        expect(rOldTok.passed).toBe(false);
        expect(rOldTok.status).toBe(401);
        expect(rOldTok.body.code).toBe('TOKEN_REVOKED');

        const rOk2 = await invokeRouter(authRouter, '/api/auth', 'POST', '/login', { email: userRow.email, password: 'CorrectPass@123' });
        const rRef = await invokeRouter(authRouter, '/api/auth', 'POST', '/refresh', {}, { authorization: `Bearer ${rOk2.body.token}` });
        expect(rRef.status).toBe(200);
        expect(jwt.verify(rRef.body.token, process.env.JWT_SECRET).tv).toBe(2);
      });
    } finally {
      if (prevSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = prevSecret;
    }
  });

  it('25.5 [SEC-05] NFC HMAC guard rejects missing production secret, prevents timingSafeEqual RangeError, and achieves high throughput', () => {
    const nfcSec = require(path.join(rootDir, 'backend/services/nfcSecurityService.js'));
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.NFC_HMAC_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.NFC_HMAC_SECRET;
      let threw = false;
      try { nfcSec.getNfcHmacSecret(); } catch (e) { threw = e.message.includes('CRITICAL_SECURITY_CONFIG'); }
      expect(threw).toBe(true);

      process.env.NFC_HMAC_SECRET = 'Prod_AgTech_NTAG213_Strong_Secret_2026';
      const sig = nfcSec.generateHmacSignature('04:20:CF:5A:25:20:91', 42);
      expect(nfcSec.verifyHmacSignature('04:20:CF:5A:25:20:91', 42, sig)).toBe(true);
      expect(nfcSec.verifyHmacSignature('04:20:CF:5A:25:20:91', 42, 'deadbeef')).toBe(false);
      expect(nfcSec.verifyHmacSignature('04:20:CF:5A:25:20:91', 42, 'x'.repeat(64))).toBe(false);

      const t0 = performance.now();
      for (let i = 0; i < 2000; i++) {
        const s = nfcSec.generateHmacSignature('04:20:CF:5A:25:20:91', i);
        expect(nfcSec.verifyHmacSignature('04:20:CF:5A:25:20:91', i, s)).toBe(true);
      }
      expect(performance.now() - t0).toBeLessThan(1000);
    } finally {
      if (prevEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevEnv;
      if (prevSecret === undefined) delete process.env.NFC_HMAC_SECRET; else process.env.NFC_HMAC_SECRET = prevSecret;
    }
  });

  it('25.6 [SEC-06] Migration 014 & init.js keep schema parity for saved_reports and auth hardening columns', () => {
    const mig014Path = path.join(rootDir, 'backend/db/migrations/014_security_hardening_and_saved_reports.sql');
    const initJs = fs.readFileSync(path.join(rootDir, 'backend/db/init.js'), 'utf8');
    expect(fs.existsSync(mig014Path)).toBe(true);
    const sql014 = fs.readFileSync(mig014Path, 'utf8');

    expect(/^\s*BEGIN\s*;/m.test(sql014)).toBe(false);
    expect(/^\s*COMMIT\s*;/m.test(sql014)).toBe(false);
    expect(sql014.includes('CREATE TABLE IF NOT EXISTS saved_reports')).toBe(true);
    expect(sql014.includes('token_version')).toBe(true);
    expect(sql014.includes('failed_login_attempts')).toBe(true);
    expect(sql014.includes('locked_until')).toBe(true);
    expect(initJs.includes('token_version')).toBe(true);
    expect(initJs.includes('locked_until')).toBe(true);
  });
});
