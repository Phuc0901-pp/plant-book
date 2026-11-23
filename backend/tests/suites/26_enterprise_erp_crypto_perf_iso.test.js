const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jwt = require('jsonwebtoken');
const { describe, it, expect } = require('../test-framework');

describe('Suite 26: Enterprise Agri-ERP, Zero-Trust Crypto, WMS, PHI, IoT & Ops Hardening (ISO 25010 / 27001 / 22005)', () => {
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

  function invokeMiddleware(mw, req) {
    return new Promise((resolve) => {
      const res = {
        statusCode: 200,
        _headers: {},
        setHeader(k, v) { this._headers[k] = v; },
        getHeader(k) { return this._headers[k]; },
        status(c) { this.statusCode = c; return this; },
        json(p) { resolve({ status: this.statusCode, body: p, nextCalled: false }); },
        send(p) { resolve({ status: this.statusCode, body: p, nextCalled: false }); }
      };
      mw(req, res, () => resolve({ status: 200, body: null, nextCalled: true }));
    });
  }

  it('26.1 [ERP-SUB-01] Sub-account real-time batch care attribution, LATERAL latest care & supply tracking', async () => {
    const coreSrc = fs.readFileSync(path.join(backendDir, 'routes/plants/core.routes.js'), 'utf8');
    const suppliesSrc = fs.readFileSync(path.join(backendDir, 'routes/supplies.js'), 'utf8');
    expect(coreSrc.includes('LEFT JOIN LATERAL')).toBe(true);
    expect(coreSrc.includes('last_care_operator')).toBe(true);
    expect(suppliesSrc.includes('updated_by_name')).toBe(true);

    const dbPath = path.join(backendDir, 'config/db.js');
    const authPath = path.join(backendDir, 'middleware/auth.js');
    const redisPath = path.join(backendDir, 'config/redis.js');
    const mediaPath = path.join(backendDir, 'routes/plants/media-logs.routes.js');
    const helpersPath = path.join(backendDir, 'routes/plants/helpers.js');

    const insertedLogs = [];
    let nextId = 1;
    const subWorker = {
      id: 31,
      role: 'farmer',
      sub_role: 'care_worker',
      parent_user_id: 10,
      full_name: 'Kỹ Thuật Viên B',
      farm_id: 100
    };

    const mockPool = {
      async connect() {
        return {
          query: (sql, params) => mockPool.query(sql, params),
          release: () => {}
        };
      },
      async query(sql, params = []) {
        const s = String(sql).replace(/\s+/g, ' ').trim();
        if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') return { rows: [] };
        if (s.includes('FROM plants p LEFT JOIN farms f ON f.id = p.farm_id WHERE p.id = ANY')) {
          return {
            rows: [
              { id: 1, tree_code: 'SR-01', plant_type: 'Sầu riêng', farm_id: 100, farm_owner_id: 10, farm_puc_code: 'PUC-01', phi_until_date: null },
              { id: 2, tree_code: 'SR-02', plant_type: 'Sầu riêng', farm_id: 100, farm_owner_id: 10, farm_puc_code: 'PUC-01', phi_until_date: null },
              { id: 3, tree_code: 'SR-03', plant_type: 'Sầu riêng', farm_id: 100, farm_owner_id: 10, farm_puc_code: 'PUC-01', phi_until_date: null }
            ]
          };
        }
        if (s.startsWith('INSERT INTO plant_logs')) {
          const row = {
            id: nextId++,
            plant_id: params[0],
            log_date: params[1],
            log_type: params[2],
            note: params[3],
            details: JSON.parse(params[5] || '{}'),
            created_by: params[6],
            operator_name: params[9]
          };
          insertedLogs.push(row);
          return { rows: [row] };
        }
        if (s.includes('SELECT pl.record_hash FROM plant_logs pl')) return { rows: [] };
        return { rows: [] };
      }
    };

    await withMockedModules({
      [dbPath]: mockPool,
      [authPath]: (req, _res, next) => { req.user = subWorker; next(); },
      [redisPath]: { getCache: async () => null, setCache: async () => true, delCache: async () => 0, delCacheByPattern: async () => 0 },
      [helpersPath]: null,
      [mediaPath]: null
    }, async () => {
      const mediaRouter = require(mediaPath);
      const batchRes = await invokeRouter(mediaRouter, '/api/plants', 'POST', '/batch-care-logs', {
        plant_ids: [1, 2, 3],
        log_type: 'Bón phân',
        note: 'Bón NPK định kỳ',
        performed_at: '2026-11-23T08:30:00.000Z'
      });
      expect(batchRes.status).toBe(201);
      expect(insertedLogs.length).toBe(3);
      expect(insertedLogs[0].operator_name).toBe('Kỹ Thuật Viên B');
      expect(typeof insertedLogs[0].details.performed_at).toBe('string');
      expect(Date.parse(insertedLogs[0].details.performed_at) > 0).toBe(true);
    });
  });

  it('26.2 [SEC-07 & SEC-08] AES-256-GCM vault roundtrip, SQLi allowlist, password_hash removal & public scrubbing', async () => {
    const cryptoVault = require(path.join(backendDir, 'utils/cryptoVault.js'));
    const encrypted = cryptoVault.encryptSecret('zalo_secret_demo_999');
    expect(encrypted.startsWith('enc:gcm:v1:')).toBe(true);
    expect(cryptoVault.decryptSecret(encrypted)).toBe('zalo_secret_demo_999');

    const parts = encrypted.split(':');
    parts[parts.length - 1] = 'ff' + parts[parts.length - 1].slice(2);
    let tamperedFailed = false;
    try {
      cryptoVault.decryptSecret(parts.join(':'));
    } catch (e) {
      tamperedFailed = e.code === 'VAULT_TAMPERED_OR_INVALID_KEY';
    }
    expect(tamperedFailed).toBe(true);

    const dbPath = path.join(backendDir, 'config/db.js');
    const authPath = path.join(backendDir, 'middleware/auth.js');
    const adminPath = path.join(backendDir, 'middleware/admin.js');
    const redisPath = path.join(backendDir, 'config/redis.js');
    const queuePath = path.join(backendDir, 'services/queueService.js');
    const helpersPath = path.join(backendDir, 'routes/plants/helpers.js');
    const databasePath = path.join(backendDir, 'routes/database.js');
    const publicPath = path.join(backendDir, 'routes/plants/public.routes.js');

    let blockAuth = false;
    const currentUser = { id: 1, role: 'admin', sub_role: 'farm_owner', full_name: 'Admin' };

    const mockPool = {
      async query(sql) {
        const s = String(sql).replace(/\s+/g, ' ').trim();
        if (s.includes('FROM information_schema.columns')) {
          return { rows: [{ column_name: 'id' }, { column_name: 'email' }, { column_name: 'role' }, { column_name: 'password_hash' }] };
        }
        if (s.startsWith('SELECT COUNT(*)::int as count FROM')) return { rows: [{ count: 1 }] };
        if (s.startsWith('SELECT * FROM "users"')) {
          return { rows: [{ id: 1, email: 'farmer@tb.vn', role: 'farmer', password_hash: '$2b$10$hash' }] };
        }
        if (s.includes('FROM plants p') && s.includes('p.is_public=true')) {
          return { rows: [{ id: 22, farm_id: 5, tree_code: 'SR-22', plant_type: 'Sầu riêng', owner_name: 'Chủ Vườn', owner_phone: '0909123456', owner_email: 'private@tb.vn' }] };
        }
        if (s.includes('FROM plant_logs pl')) {
          return { rows: [{ id: 9, plant_id: 22, log_date: '2026-11-22', log_type: 'Thu hoạch', note: 'Tốt', details: { amount: 50, unit: 'kg', total_revenue: 4000000, total_cost: 250000 } }] };
        }
        if (s.includes('FROM supply_usages su')) {
          return { rows: [{ id: 8, supply_id: 50, supply_name: 'NPK', quantity: 2, unit_price: 19000, total_cost: 38000 }] };
        }
        return { rows: [] };
      }
    };

    await withMockedModules({
      [dbPath]: mockPool,
      [authPath]: (req, res, next) => {
        if (blockAuth) return res.status(401).json({ error: 'Unauthorized' });
        req.user = currentUser;
        next();
      },
      [adminPath]: (req, res, next) => {
        if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin' });
        next();
      },
      [redisPath]: { getCache: async () => null, setCache: async () => true, delCache: async () => 0, delCacheByPattern: async () => 0 },
      [queuePath]: { publish: async () => true, registerWorker: () => {}, getMetrics: () => ({}), shutdown: () => {} },
      [helpersPath]: null,
      [databasePath]: null,
      [publicPath]: null
    }, async () => {
      const dbRouter = require(databasePath);
      const pubRouter = require(publicPath);

      const sqliRes = await invokeRouter(dbRouter, '/api/database', 'POST', '/tables/users/records', { 'x; DROP TABLE users;--': 'bad' });
      expect(sqliRes.status).toBe(400);
      expect(sqliRes.body.code).toBe('INVALID_COLUMN_NAME');

      const usersList = await invokeRouter(dbRouter, '/api/database', 'GET', '/tables/users/records');
      expect(usersList.status).toBe(200);
      expect(usersList.body.records[0].password_hash).toBe(undefined);

      blockAuth = true;
      const unauthGps = await invokeRouter(pubRouter, '/api/plants', 'POST', '/public/22/gps', { latitude: 10.9, longitude: 107.1 });
      expect(unauthGps.status).toBe(401);

      const pubPlant = await invokeRouter(pubRouter, '/api/plants', 'GET', '/public/sr-22');
      expect(pubPlant.status).toBe(200);
      expect(pubPlant.body.owner_phone).toBe(undefined);
      expect(pubPlant.body.owner_email).toBe(undefined);
      expect(pubPlant.body.logs[0].details.total_revenue).toBe(undefined);
    });
  });

  it('26.3 [SEC-09 & SEC-10] Zero-Trust IDOR, bounded buckets, JWT WS scoping & production error masking', async () => {
    const dbPath = path.join(backendDir, 'config/db.js');
    const helpersPath = path.join(backendDir, 'routes/plants/helpers.js');
    const queuePath = path.join(backendDir, 'services/queueService.js');
    const serverPath = path.join(backendDir, 'server.js');
    const errorHandler = require(path.join(backendDir, 'middleware/errorHandler.js'));
    const { antiScraper, globalBucket, pruneBucket } = require(path.join(backendDir, 'middleware/antiScraper.js'));
    const { authAttemptBucket, pruneAuthBucket } = require(path.join(backendDir, 'middleware/userRateLimiter.js'));

    const mockPool = {
      async query(sql, params = []) {
        const s = String(sql).replace(/\s+/g, ' ').trim();
        if (s.includes('FROM farms WHERE id = $1')) {
          return { rows: Number(params[0]) === 101 ? [{ id: 101, user_id: 10, created_by: 10 }] : [] };
        }
        if (s.includes('FROM plants p LEFT JOIN farms f ON f.id = p.farm_id WHERE p.id = $1')) {
          return { rows: Number(params[0]) === 501 ? [{ id: 501, farm_id: 101, farm_owner_id: 10 }] : [] };
        }
        return { rows: [] };
      }
    };

    await withMockedModules({
      [dbPath]: mockPool,
      [helpersPath]: null
    }, async () => {
      const helpers = require(helpersPath);
      const crossFarm = await helpers.authorizeFarmAccess(mockPool, { id: 99, role: 'farmer', sub_role: 'farm_owner', farm_id: 202 }, 101, false);
      expect(crossFarm.ok).toBe(false);
      expect(crossFarm.status).toBe(403);

      const ownerPlant = await helpers.authorizePlantAccess(mockPool, { id: 10, role: 'farmer', sub_role: 'farm_owner' }, 501, true);
      expect(ownerPlant.ok).toBe(true);
    });

    globalBucket.clear();
    for (let i = 0; i < 50005; i++) {
      globalBucket.set(`pub_${i}`, { count: 1, resetAt: Date.now() + 10000 });
      authAttemptBucket.set(`auth_${i}`, { count: 1, resetAt: Date.now() + 10000 });
    }
    pruneBucket(Date.now());
    pruneAuthBucket(Date.now());
    expect(globalBucket.size <= 50000).toBe(true);
    expect(authAttemptBucket.size <= 50000).toBe(true);
    globalBucket.clear();
    authAttemptBucket.clear();

    const scraperRes = await invokeMiddleware(antiScraper, {
      originalUrl: '/api/farms/101/full-dataset',
      path: '/farms/101/full-dataset',
      ip: '198.51.100.77',
      headers: { 'user-agent': 'curl/8.4.0' },
      query: {}
    });
    expect(scraperRes.status).toBe(403);

    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'suite26_ws_secret_key_1234567890';
    process.env.NODE_ENV = 'production';
    try {
      let errJson = null;
      const errRes = { status() { return this; }, json(b) { errJson = b; }, send(b) { errJson = b; } };
      errorHandler(new Error('SELECT * FROM users WHERE password_hash = secret'), { originalUrl: '/api/test', path: '/api/test', method: 'GET' }, errRes, () => {});
      expect(String(errJson.error).includes('password_hash')).toBe(false);

      let serverExports = null;
      await withMockedModules({
        [dbPath]: { async query() { return { rows: [] }; }, async readQuery() { return { rows: [] }; } },
        [queuePath]: { publish: async () => true, registerWorker: () => {}, getMetrics: () => ({}), shutdown: () => {} },
        [serverPath]: null
      }, async () => {
        serverExports = require(serverPath);
      });

      const tokA = jwt.sign({ id: 10, role: 'farmer', farm_id: 101 }, process.env.JWT_SECRET);
      const userA = serverExports.authenticateWsToken(tokA);
      expect(serverExports.authenticateWsToken('forged.jwt.value')).toBe(null);
      expect(userA.id).toBe(10);
      expect(serverExports.shouldDeliverBroadcast(userA, 'plants_updated', { farmId: 101 })).toBe(true);
      expect(serverExports.shouldDeliverBroadcast({ id: 20, role: 'farmer', farm_id: 202 }, 'plants_updated', { farmId: 101 })).toBe(false);
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.JWT_SECRET = prevSecret;
    }
  });

  it('26.4 [SEC-11] Flutter NTAG213 HMAC guard, NDEF URI 0x01..0x04, SecureStorage & Frontend XSS/single-flight refresh', async () => {
    const cryptoDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/core/security/crypto_security_service.dart'), 'utf8');
    const scannerDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/components/qr_nfc_scanner.dart'), 'utf8');
    const apiDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/services/api_service.dart'), 'utf8');

    expect(cryptoDart.includes('isHex16')).toBe(false);
    expect(cryptoDart.includes('constantTimeEquals(cleanSig, expectedSig)')).toBe(true);
    expect(scannerDart.includes('prefix >= 0x01 && prefix <= 0x04')).toBe(true);
    expect(apiDart.includes('FlutterSecureStorage')).toBe(true);
    expect(apiDart.includes("setString('pb_token'")).toBe(false);
    expect(apiDart.includes('_secureOfflineVerifierKey')).toBe(true);

    const usersJs = fs.readFileSync(path.join(rootDir, 'frontend/admin/js/users.js'), 'utf8');
    const notifJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/modules/notifications.js'), 'utf8');
    const subJs = fs.readFileSync(path.join(rootDir, 'frontend/public/js/sub-gateway.js'), 'utf8');
    const biJs = fs.readFileSync(path.join(rootDir, 'frontend/public/js/bi-analytics-widget.js'), 'utf8');
    const logsJs = fs.readFileSync(path.join(rootDir, 'frontend/user/js/modules/logs.js'), 'utf8');

    expect(usersJs.includes('escapeHtml(r.full_name || r.email)')).toBe(true);
    expect(notifJs.includes('${esc(n.title)}')).toBe(true);
    expect(subJs.includes('escHtml(f.name)')).toBe(true);
    expect(biJs.includes('${esc(pl.plot_code)}')).toBe(true);
    expect(logsJs.includes('${esc(farmName)}')).toBe(true);

    let refreshCount = 0;
    const store = { pb_token: 'old_jwt' };
    const apiSrc = fs.readFileSync(path.join(rootDir, 'frontend/user/js/core/api.js'), 'utf8')
      .replace(/export /g, '')
      .replace('window.isProUser = isProUser;', '')
      .replace('window.getCurrentUserRbac = getCurrentUserRbac;', '');
    const sandbox = {
      window: {},
      FormData: undefined,
      URLSearchParams,
      console,
      Promise,
      Math,
      setTimeout,
      localStorage: {
        getItem: (k) => store[k] || null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
      },
      fetch: async (url, opts = {}) => {
        if (url === '/api/auth/refresh') {
          refreshCount++;
          await new Promise((r) => setTimeout(r, 10));
          return { ok: true, status: 200, headers: { get: () => 'application/json' }, async json() { return { success: true, token: 'new_jwt' }; } };
        }
        const authHdr = opts.headers && opts.headers.Authorization;
        if (authHdr === 'Bearer old_jwt') {
          return { ok: false, status: 401, headers: { get: () => 'application/json' }, async json() { return { error: 'Expired' }; } };
        }
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, async json() { return { ok: true }; } };
      }
    };
    vm.createContext(sandbox);
    vm.runInContext(`${apiSrc}\nthis.__testExports = { api, getToken: () => token };`, sandbox);
    const [r1, r2] = await Promise.all([sandbox.__testExports.api('/plants'), sandbox.__testExports.api('/plants')]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(refreshCount).toBe(1);
    expect(store.pb_token).toBe('new_jwt');
  });

  it('26.5 [ERP-01 & ERP-02] Hard PHI gate (409), 15m sealed SHA-256 chain (409), moving-avg restock & expired supply block (400)', async () => {
    const dbPath = path.join(backendDir, 'config/db.js');
    const authPath = path.join(backendDir, 'middleware/auth.js');
    const redisPath = path.join(backendDir, 'config/redis.js');
    const queuePath = path.join(backendDir, 'services/queueService.js');
    const auditPath = path.join(backendDir, 'services/auditLogger.js');
    const historyPath = path.join(backendDir, 'routes/history.js');
    const helpersPath = path.join(backendDir, 'routes/plants/helpers.js');
    const mediaPath = path.join(backendDir, 'routes/plants/media-logs.routes.js');
    const suppliesPath = path.join(backendDir, 'routes/supplies.js');

    const currentUser = { id: 10, role: 'farmer', sub_role: 'farm_owner', full_name: 'Chu Vuon', farm_id: 101 };
    const oldLog = {
      id: 2,
      plant_id: 501,
      log_date: '2026-11-22',
      log_type: 'Tưới nước',
      note: 'Sealed',
      details: { amount: 20 },
      created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      created_by: 10,
      is_locked: true
    };
    const supply701 = {
      id: 701,
      user_id: 10,
      farm_id: 101,
      category: 'Bón phân',
      name: 'NPK 16-16-8',
      unit: 'kg',
      package_qty: 10,
      package_unit: 'bao',
      package_price: 1000000,
      unit_price: 100000,
      unit_price_small: 10000,
      stock_quantity: 10,
      batch_no: 'LOT-01',
      expiry_date: '2027-12-31',
      min_stock_alert: 15
    };
    const supply702 = {
      id: 702,
      user_id: 10,
      farm_id: 101,
      category: 'Phun thuốc',
      name: 'Abamectin Quá Hạn',
      unit: 'chai',
      package_qty: 1,
      package_unit: 'chai',
      package_price: 120000,
      unit_price: 120000,
      unit_price_small: 120000,
      stock_quantity: 2,
      batch_no: 'LOT-OLD',
      expiry_date: '2023-01-01',
      min_stock_alert: 5
    };

    const mockPool = {
      async connect() {
        return {
          query: (sql, params) => mockPool.query(sql, params),
          release: () => {}
        };
      },
      async query(sql, params = []) {
        const s = String(sql).replace(/\s+/g, ' ').trim();
        if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') return { rows: [] };
        if (s.includes('FROM plants p') && (s.includes('WHERE p.id = $1') || s.includes('WHERE p.id=$1'))) {
          return { rows: [{ id: 501, farm_id: 101, tree_code: 'SR-01', farm_owner_id: 10, farm_puc_code: 'PUC-01', phi_until_date: '2099-12-31' }] };
        }
        if (s.includes('SELECT * FROM plant_logs WHERE id=$1 AND plant_id=$2')) return { rows: [oldLog] };
        if (s.includes('FROM supplies WHERE id = $1')) {
          if (Number(params[0]) === 701) return { rows: [{ ...supply701 }] };
          if (Number(params[0]) === 702) return { rows: [{ ...supply702 }] };
          return { rows: [] };
        }
        if (s.startsWith('UPDATE supplies SET stock_quantity = $1, package_price = $2')) {
          supply701.stock_quantity = params[0];
          supply701.package_price = params[1];
          supply701.unit_price = params[2];
          supply701.unit_price_small = params[3];
          return { rows: [{ ...supply701 }] };
        }
        if (s.startsWith('INSERT INTO supply_restock_logs')) {
          return { rows: [{ id: 99, supply_id: params[0], added_qty: params[4], unit_price: params[7] }] };
        }
        return { rows: [] };
      }
    };

    await withMockedModules({
      [dbPath]: mockPool,
      [authPath]: (req, _res, next) => { req.user = currentUser; next(); },
      [redisPath]: { getCache: async () => null, setCache: async () => true, delCache: async () => 0, delCacheByPattern: async () => 0 },
      [queuePath]: { publish: async () => true, registerWorker: () => {}, getMetrics: () => ({}), shutdown: () => {} },
      [auditPath]: { logAudit: () => {} },
      [historyPath]: { logAuditAction: () => {} },
      [helpersPath]: null,
      [mediaPath]: null,
      [suppliesPath]: null
    }, async () => {
      const helpers = require(helpersPath);
      const mediaRouter = require(mediaPath);
      const suppliesRouter = require(suppliesPath);

      const h1 = helpers.computeCanonicalPlantLogHash(null, { id: 1, plant_id: 501, log_date: '2026-11-22', log_type: 'Tưới nước', note: 'OK', details: { b: 2, a: 1 }, created_by: 10 });
      const h2 = helpers.computeCanonicalPlantLogHash(null, { id: 1, plant_id: 501, log_date: '2026-11-22', log_type: 'Tưới nước', note: 'OK', details: { a: 1, b: 2 }, created_by: 10 });
      expect(h1).toBe(h2);

      const phiRes = await invokeRouter(mediaRouter, '/api/plants', 'POST', '/501/logs', { log_type: 'Thu hoạch', note: 'Harvest in PHI' });
      expect(phiRes.status).toBe(409);
      expect(phiRes.body.code).toBe('PHI_VIOLATION_BLOCKED');

      const immRes = await invokeRouter(mediaRouter, '/api/plants', 'PUT', '/501/logs/2', { note: 'Tamper after grace' });
      expect(immRes.status).toBe(409);
      expect(immRes.body.code).toBe('LOG_SEALED_IMMUTABLE');

      const restockRes = await invokeRouter(suppliesRouter, '/api/supplies', 'POST', '/701/restock', {
        added_qty: 1,
        new_package_price: 2000000,
        batch_no: 'LOT-02',
        expiry_date: '2028-01-01'
      });
      expect(restockRes.status).toBe(200);
      expect(restockRes.body.supply.stock_quantity).toBe(20);
      expect(restockRes.body.supply.unit_price).toBe(150000);

      const expiredUsage = await invokeRouter(suppliesRouter, '/api/supplies', 'POST', '/usages', {
        supply_id: 702,
        quantity: 1,
        note: 'Use expired bottle'
      });
      expect(expiredUsage.status).toBe(400);
      expect(expiredUsage.body.code).toBe('SUPPLY_EXPIRED');
    });
  });

  it('26.6 [ERP-03, ERP-04 & OPS-01] Plot direct/overhead BI, Carbon MRV, zero fake IoT, device ingest, Redis SCAN, queueService, /api/health & SW', async () => {
    const dbPath = path.join(backendDir, 'config/db.js');
    const authPath = path.join(backendDir, 'middleware/auth.js');
    const redisPath = path.join(backendDir, 'config/redis.js');
    const analyticsPath = path.join(backendDir, 'routes/analytics.js');
    const notificationsPath = path.join(backendDir, 'routes/notifications.js');
    const devicesPath = path.join(backendDir, 'routes/devices.js');
    const farmsPath = path.join(backendDir, 'routes/farms.js');

    const prevSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'suite26_erp04_secret_1234567890';
    try {
      const currentUser = { id: 10, role: 'farmer', sub_role: 'farm_owner', allow_view_finance: true, farm_id: 101 };
      const devicesList = [{ id: 1, farm_id: 101, secret_token: 'tok_real_sensor_123456', status: 'Hoạt động' }];
      const alertRules = [{ id: 1, user_id: 10, farm_id: 101, title: 'Ẩm độ thấp', category_type: 'danger', match_type: 'AND', is_enabled: true, conditions_json: [{ metric: 'soil_moisture', operator: '<', value: 40 }] }];
      const createdNotifs = [];

      const mockPool = {
        async query(sql, params = []) {
          const s = String(sql).replace(/\s+/g, ' ').trim();
          if (s.includes('FROM farms f') && s.includes('WHERE f.id = $1')) {
            return { rows: [{ id: 101, name: 'Farm A', user_id: 10, owner_id: 10, current_api_key_version: 1, is_api_enabled: true, created_at: new Date('2025-01-01') }] };
          }
          if (s.includes('FROM farms WHERE COALESCE(is_deleted')) return { rows: [{ id: 101, name: 'Farm A', area: 20000, user_id: 10 }] };
          if (s.includes('FROM farms WHERE id = $1')) return { rows: [{ id: 101, user_id: 10, created_by: 10 }] };
          if (s.includes('FROM supply_usages su') && !s.includes('SUM(su.total_cost)')) {
            return { rows: [{ id: 1, plant_id: 1, farm_id: 101, category: 'Bón phân', name: 'NPK', total_cost: 900000, usage_date: '2026-11-20' }] };
          }
          if (s.includes('FROM plant_logs pl') && !s.includes('SUM(')) {
            return { rows: [{ id: 11, plant_id: null, log_type: 'Làm cỏ', log_date: '2026-11-20', details: { total_cost: 300000 } }] };
          }
          if (s.includes('FROM plants p')) {
            return {
              rows: [
                { id: 1, tree_code: 'SR-01', plant_type: 'Sầu riêng', plot_code: 'Lô A1', plant_age: '2 năm', farm_id: 101, data: {} },
                { id: 2, tree_code: 'SR-02', plant_type: 'Sầu riêng', plot_code: 'Lô B2', plant_age: '5 năm', farm_id: 101, data: {} },
                { id: 3, tree_code: 'SR-03', plant_type: 'Sầu riêng', plot_code: 'Lô B2', plant_age: '10 năm', farm_id: 101, data: {} }
              ]
            };
          }
          if (s.includes('FROM plants WHERE farm_id = $1 AND deleted_at IS NULL')) {
            return {
              rows: [
                { id: 1, tree_code: 'SR-01', plant_type: 'Sầu riêng', plot_code: 'Lô A1', plant_age: '2 năm', farm_id: 101, data: {} },
                { id: 2, tree_code: 'SR-02', plant_type: 'Sầu riêng', plot_code: 'Lô B2', plant_age: '5 năm', farm_id: 101, data: {} },
                { id: 3, tree_code: 'SR-03', plant_type: 'Sầu riêng', plot_code: 'Lô B2', plant_age: '10 năm', farm_id: 101, data: {} }
              ]
            };
          }
          if (s.startsWith('SELECT * FROM user_notifications WHERE user_id = $1')) return { rows: [] };
          if (s.includes('SELECT COUNT(*)::int as count FROM user_notifications')) return { rows: [{ count: 0 }] };
          if (s.includes('FROM devices WHERE id = $1')) return { rows: devicesList.filter(d => d.id === Number(params[0])) };
          if (s.includes('FROM devices WHERE secret_token = $1')) return { rows: devicesList.filter(d => d.secret_token === params[0]) };
          if (s.includes('FROM user_alert_rules r')) return { rows: alertRules };
          if (s.startsWith('INSERT INTO user_notifications')) {
            createdNotifs.push({ user_id: params[0], title: params[1] });
            return { rows: [{ id: createdNotifs.length }] };
          }
          if (s.startsWith('SELECT') && s.includes('FROM users WHERE id')) {
            return { rows: [{ ...currentUser }] };
          }
          return { rows: [] };
        }
      };

      await withMockedModules({
        [dbPath]: mockPool,
        [authPath]: (req, _res, next) => { req.user = currentUser; next(); },
        [redisPath]: { getCache: async () => null, setCache: async () => true, delCache: async () => 0, delCacheByPattern: async () => 0 },
        [analyticsPath]: null,
        [notificationsPath]: null,
        [devicesPath]: null,
        [farmsPath]: null
      }, async () => {
        const analyticsRouter = require(analyticsPath);
        const notificationsRouter = require(notificationsPath);
        const devicesRouter = require(devicesPath);
        const farmsRouter = require(farmsPath);

        const plotRes = await invokeRouter(analyticsRouter, '/api/analytics', 'GET', '/plot-comparison?farm_id=101');
        expect(plotRes.status).toBe(200);
        const a1 = plotRes.body.plots.find(p => p.plot_code === 'Lô A1');
        const b2 = plotRes.body.plots.find(p => p.plot_code === 'Lô B2');
        expect(a1.direct_cost_vnd).toBe(900000);
        expect(a1.allocated_overhead_vnd).toBe(100000);
        expect(b2.direct_cost_vnd).toBe(0);
        expect(b2.allocated_overhead_vnd).toBe(200000);

        const farmTok = jwt.sign({ id: 10, role: 'farmer', tv: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const datasetRes = await invokeRouter(farmsRouter, '/api/farms', 'GET', '/101/full-dataset', {}, { authorization: `Bearer ${farmTok}` });
        expect(datasetRes.status).toBe(200);
        const carbon = datasetRes.body.iso27001_governance_and_carbon_mrv.carbon_footprint_and_credits_mrv;
        expect(carbon.annual_age_stratified_co2_tco2e).toBe(0.065);
        expect(carbon.age_strata_breakdown.juvenile_lt_3yr.count).toBe(1);
        expect(carbon.age_strata_breakdown.mature_3_to_7yr.count).toBe(1);
        expect(carbon.age_strata_breakdown.prime_gt_7yr.count).toBe(1);

        const notifRes = await invokeRouter(notificationsRouter, '/api/notifications', 'GET', '/');
        expect(notifRes.status).toBe(200);
        expect(notifRes.body.notifications.length).toBe(0);

        const iotEmpty = await invokeRouter(farmsRouter, '/api/farms', 'GET', '/101/iot-data');
        expect(iotEmpty.status).toBe(200);
        expect(iotEmpty.body.status).toBe('NO_DEVICE_CONNECTED');

        const badIngest = await invokeRouter(devicesRouter, '/api/devices', 'POST', '/telemetry-ingest', { metrics: { soil_moisture: 25 } }, { 'x-device-token': 'bad_token' });
        expect(badIngest.status).toBe(401);

        const goodIngest = await invokeRouter(devicesRouter, '/api/devices', 'POST', '/telemetry-ingest', {
          device_id: 1,
          metrics: { soil_moisture: 28, air_temp: 33 }
        }, { 'x-device-token': 'tok_real_sensor_123456' });
        expect(goodIngest.status).toBe(201);
        expect(goodIngest.body.triggered_alerts_count).toBe(1);
        expect(createdNotifs.length).toBe(1);
      });

      const redisSrc = fs.readFileSync(path.join(backendDir, 'config/redis.js'), 'utf8');
      const queueSrc = fs.readFileSync(path.join(backendDir, 'services/queueService.js'), 'utf8');
      const serverSrc = fs.readFileSync(path.join(backendDir, 'server.js'), 'utf8');
      const initSrc = fs.readFileSync(path.join(backendDir, 'db/init.js'), 'utf8');
      const swSrc = fs.readFileSync(path.join(rootDir, 'frontend/user/sw.js'), 'utf8');
      const userHtml = fs.readFileSync(path.join(rootDir, 'frontend/user/index.html'), 'utf8');

      let dbHealthy = true;
      let scanCalls = 0;
      let unlinkCalls = 0;
      const prevRedisUrl = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://127.0.0.1:6379';
      const serverPath = path.join(backendDir, 'server.js');
      const queuePath = path.join(backendDir, 'services/queueService.js');
      const ioredisStub = class MockIoRedis {
        on(ev, cb) {
          if (ev === 'connect' && typeof cb === 'function') cb();
        }
        async scan(cursor) {
          scanCalls += 1;
          if (cursor === '0') return ['42', ['plants_1']];
          return ['0', ['plants_2']];
        }
        async unlink(...keys) { unlinkCalls += keys.length; return keys.length; }
        async del(...keys) { unlinkCalls += keys.length; return keys.length; }
        async ping() { return 'PONG'; }
        async keys() { throw new Error('FORBIDDEN_BLOCKING_KEYS'); }
      };
      try {
        await withMockedModules({
          [require.resolve(path.join(backendDir, 'node_modules/ioredis'))]: ioredisStub,
          [dbPath]: {
            async query(sql) {
              if (String(sql).trim() === 'SELECT 1' && !dbHealthy) throw new Error('DB_DOWN');
              return { rows: [{ ok: 1 }] };
            },
            async readQuery() { return { rows: [] }; }
          },
          [redisPath]: null,
          [queuePath]: { publish: async () => true, registerWorker: () => {}, getMetrics: () => ({}), shutdown: () => {} },
          [serverPath]: null
        }, async () => {
          const loadedRedis = require(redisPath);
          await loadedRedis.setCache('plants_mem', { ok: true }, 60);
          await loadedRedis.delCacheByPattern('plants_');
          expect(scanCalls).toBe(2);
          expect(unlinkCalls).toBe(2);
          const memAfter = await loadedRedis.getCache('plants_mem');
          expect(memAfter).toBe(null);

          const loadedServer = require(serverPath);
          const hOk = await invokeRouter(loadedServer.app, '', 'GET', '/api/health');
          expect(hOk.status).toBe(200);
          expect(hOk.body.status).toBe('ok');
          expect(hOk.body.checks.database).toBe('up');
          expect(hOk.body.checks.cache_mode).toBe('redis');

          dbHealthy = false;
          const hDown = await invokeRouter(loadedServer.app, '', 'GET', '/api/health');
          expect(hDown.status).toBe(503);
          expect(hDown.body.status).toBe('degraded');
          expect(hDown.body.checks.database).toBe('down');
        });
      } finally {
        if (prevRedisUrl === undefined) delete process.env.REDIS_URL;
        else process.env.REDIS_URL = prevRedisUrl;
      }

      expect(redisSrc.includes('redisClient.keys(')).toBe(false);
      expect(redisSrc.includes('redisClient.scan(')).toBe(true);
      expect(queueSrc.includes("'MAXLEN', '~', '10000'")).toBe(true);
      expect(queueSrc.includes('maxConcurrency = 5')).toBe(true);
      expect(serverSrc.includes('gracefulShutdown')).toBe(true);
      expect(serverSrc.includes('SELECT 1')).toBe(true);
      expect(initSrc.includes('Bùi Văn Dũng')).toBe(false);
      expect(initSrc.includes('2683740')).toBe(false);
      expect(swSrc.includes('/user/views/')).toBe(false);
      expect(swSrc.includes('/user/js/supplies.js')).toBe(true);
      expect(userHtml.includes("navigator.serviceWorker.register('/user/sw.js'")).toBe(true);
    } finally {
      process.env.JWT_SECRET = prevSecret;
    }
  });
});
