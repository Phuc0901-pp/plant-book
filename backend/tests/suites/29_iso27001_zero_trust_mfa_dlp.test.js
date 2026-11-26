const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { describe, test, assert } = require('../test-framework');

const rootDir = path.resolve(__dirname, '../../..');

describe('Suite 29: ISO/IEC 27001 Zero-Trust Defense — TOTP MFA, Admin IP Guard, DLP, CSP & UI Guard', () => {
  test('29.1 [SEC-ISO-01] RFC 6238 TOTP MFA, AES-256-GCM vault, Migration 018 & Session Kill-Switch', async () => {
    const prevSecret = process.env.JWT_SECRET;
    const prevKey = process.env.FIELD_ENCRYPTION_KEY;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'suite29_iso27001_secret_min_32_chars';
    process.env.FIELD_ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const dbPath = require.resolve('../../config/db');
    const authMwPath = require.resolve('../../middleware/auth');
    const authRoutePath = require.resolve('../../routes/auth');
    const origDb = require.cache[dbPath];
    const origAuthMw = require.cache[authMwPath];
    const origAuthRoute = require.cache[authRoutePath];

    try {
      const totp = require('../../services/totpMfaService');
      const secret = totp.generateBase32Secret(20);
      const encrypted = totp.encryptTotpSecret(secret);
      assert.ok(encrypted !== secret && encrypted.startsWith('enc:gcm:v1:'));
      const code = totp.generateTotpCode(secret);
      assert.strictEqual(totp.verifyTotpCode(encrypted, code), true);
      assert.strictEqual(totp.verifyTotpCode(encrypted, '000000'), false);
      assert.ok(totp.buildOtpAuthUri({ accountName: 'admin@tanbao.vn', secretBase32: secret }).startsWith('otpauth://totp/'));

      const passHash = await bcrypt.hash('ZeroTrust@2026', 6);
      const users = [
        {
          id: 1,
          email: 'admin@tanbao.vn',
          phone: '0901000999',
          password_hash: passHash,
          full_name: 'Admin ISO',
          role: 'admin',
          sub_role: 'farm_owner',
          approved: true,
          token_version: 1,
          mfa_enabled: true,
          totp_secret_enc: encrypted,
          account_tier: 'pro'
        }
      ];
      const incidents = [];
      require.cache[dbPath] = {
        id: dbPath,
        filename: dbPath,
        loaded: true,
        exports: {
          async query(sql, params = []) {
            const s = sql.replace(/\s+/g, ' ').trim();
            if (s.includes('FROM users WHERE LOWER(email)')) {
              const u = users.find(x => x.email === String(params[0]).toLowerCase());
              return { rows: u ? [{ ...u }] : [] };
            }
            if (s.includes('INSERT INTO security_incidents')) {
              const m = s.match(/VALUES\s*\(\s*'([A-Z0-9_]+)'/);
              incidents.push({ event_type: m ? m[1] : params[0] });
              return { rows: [] };
            }
            if (s.startsWith("UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE role = 'admin'")) {
              users.forEach(u => { if (u.role === 'admin') u.token_version++; });
              return { rows: users.filter(u => u.role === 'admin').map(u => ({ id: u.id })) };
            }
            return { rows: [] };
          }
        }
      };
      require.cache[authMwPath] = {
        id: authMwPath,
        filename: authMwPath,
        loaded: true,
        exports: (req, res, next) => { req.user = { id: 1, role: 'admin', email: 'admin@tanbao.vn' }; next(); }
      };

      delete require.cache[authRoutePath];
      const authRouter = require('../../routes/auth');

      const invoke = (method, routePath, body) => {
        const layer = authRouter.stack.find(l => l.route && l.route.path === routePath && l.route.methods[method]);
        const handlers = layer.route.stack.map(s => s.handle);
        return new Promise((resolve, reject) => {
          const req = { method: method.toUpperCase(), path: routePath, headers: {}, body, ip: '127.0.0.1', app: { get: () => null } };
          const res = {
            statusCode: 200,
            status(c) { this.statusCode = c; return this; },
            json(payload) { resolve({ status: this.statusCode, body: payload }); return this; }
          };
          let idx = 0;
          const next = (err) => {
            if (err) return reject(err);
            const fn = handlers[idx++];
            if (!fn) return resolve({ status: res.statusCode, body: null });
            Promise.resolve(fn(req, res, next)).catch(reject);
          };
          next();
        });
      };

      const challenge = await invoke('post', '/login', { email: 'admin@tanbao.vn', password: 'ZeroTrust@2026' });
      assert.strictEqual(challenge.status, 200);
      assert.strictEqual(challenge.body.code, 'MFA_TOTP_REQUIRED');

      const badOtp = await invoke('post', '/login', { email: 'admin@tanbao.vn', password: 'ZeroTrust@2026', totp_code: '000000' });
      assert.strictEqual(badOtp.status, 401);
      assert.strictEqual(badOtp.body.code, 'INVALID_MFA_CODE');
      assert.ok(incidents.some(x => x.event_type === 'INVALID_MFA_LOGIN'));

      const validOtp = await invoke('post', '/login', { email: 'admin@tanbao.vn', password: 'ZeroTrust@2026', totp_code: totp.generateTotpCode(secret) });
      assert.strictEqual(validOtp.status, 200);
      assert.ok(validOtp.body.token);

      const kill = await invoke('post', '/revoke-all-sessions', { scope: 'all_admins' });
      assert.strictEqual(kill.status, 200);
      assert.strictEqual(users[0].token_version, 2);
      assert.ok(incidents.some(x => x.event_type === 'SESSION_KILL_SWITCH'));

      const mig018 = fs.readFileSync(path.join(rootDir, 'backend/db/migrations/018_admin_zero_trust_security.sql'), 'utf8');
      const initSrc = fs.readFileSync(path.join(rootDir, 'backend/db/init.js'), 'utf8');
      for (const col of ['mfa_enabled', 'totp_secret_enc', 'mfa_backup_codes_hash', 'allowed_ips', 'security_incidents']) {
        assert.ok(mig018.includes(col), `Migration 018 missing ${col}`);
        assert.ok(initSrc.includes(col), `init.js missing ${col}`);
      }
    } finally {
      if (origDb) require.cache[dbPath] = origDb; else delete require.cache[dbPath];
      if (origAuthMw) require.cache[authMwPath] = origAuthMw; else delete require.cache[authMwPath];
      if (origAuthRoute) require.cache[authRoutePath] = origAuthRoute; else delete require.cache[authRoutePath];
      if (prevSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = prevSecret;
      if (prevKey === undefined) delete process.env.FIELD_ENCRYPTION_KEY; else process.env.FIELD_ENCRYPTION_KEY = prevKey;
    }
  });

  test('29.2 [SEC-ISO-02] adminIpGuard IP/CIDR allowlist blocks unauthorized IPs & server mounts security-incidents API', async () => {
    const prevAllow = process.env.ADMIN_IP_ALLOWLIST;
    const dbPath = require.resolve('../../config/db');
    const guardPath = require.resolve('../../middleware/adminIpGuard');
    const origDb = require.cache[dbPath];
    const origGuard = require.cache[guardPath];

    try {
      const incidents = [];
      require.cache[dbPath] = {
        id: dbPath,
        filename: dbPath,
        loaded: true,
        exports: {
          async query(sql, params = []) {
            const s = sql.replace(/\s+/g, ' ').trim();
            if (s.includes('INSERT INTO security_incidents')) {
              const m = s.match(/VALUES\s*\(\s*'([A-Z0-9_]+)'/);
              incidents.push({ event_type: m ? m[1] : 'UNKNOWN', ip: params[1] });
            }
            return { rows: [] };
          }
        }
      };

      delete require.cache[guardPath];
      const adminIpGuard = require('../../middleware/adminIpGuard');
      assert.strictEqual(adminIpGuard.ipMatchesRule('::ffff:192.168.10.25', '192.168.10.0/24'), true);
      assert.strictEqual(adminIpGuard.ipMatchesRule('203.113.10.5', '10.0.0.0/8'), false);

      process.env.ADMIN_IP_ALLOWLIST = '10.0.0.0/8, 127.0.0.1';
      let blocked = null;
      await adminIpGuard(
        { headers: { 'x-forwarded-for': '203.113.10.99' }, ip: '127.0.0.1', originalUrl: '/api/database', user: { id: 1, role: 'admin', allowed_ips: '' } },
        { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(p) { blocked = { status: this.statusCode, body: p }; return this; } },
        () => { throw new Error('Should not allow unapproved IP'); }
      );
      assert.strictEqual(blocked.status, 403);
      assert.strictEqual(blocked.body.code, 'ADMIN_IP_FORBIDDEN');
      assert.ok(incidents.some(x => x.event_type === 'ADMIN_IP_FORBIDDEN' && x.ip === '203.113.10.99'));

      let allowed = false;
      await adminIpGuard(
        { headers: { 'x-forwarded-for': '10.8.8.8' }, ip: '127.0.0.1', originalUrl: '/api/database', user: { id: 1, role: 'admin', allowed_ips: '' } },
        { status() { throw new Error('Allowed IP should pass'); } },
        () => { allowed = true; }
      );
      assert.strictEqual(allowed, true);

      const serverSrc = fs.readFileSync(path.join(rootDir, 'backend/server.js'), 'utf8');
      assert.ok(serverSrc.includes("'/api/admin/security-incidents'"));
      assert.ok(serverSrc.includes('adminIpGuard'));
    } finally {
      if (origDb) require.cache[dbPath] = origDb; else delete require.cache[dbPath];
      if (origGuard) require.cache[guardPath] = origGuard; else delete require.cache[guardPath];
      if (prevAllow === undefined) delete process.env.ADMIN_IP_ALLOWLIST; else process.env.ADMIN_IP_ALLOWLIST = prevAllow;
    }
  });

  test('29.3 [SEC-ISO-03] dlpAntiExfiltration throttles bulk export, logs incidents & auto-revokes token_version', async () => {
    const prevSecret = process.env.JWT_SECRET;
    const prevOps = process.env.DLP_MAX_BULK_OPS_5M;
    const prevFarms = process.env.DLP_MAX_DISTINCT_FARMS_5M;
    const prevRevoke = process.env.DLP_AUTO_REVOKE;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'suite29_iso27001_secret_min_32_chars';
    process.env.DLP_MAX_BULK_OPS_5M = '2';
    process.env.DLP_MAX_DISTINCT_FARMS_5M = '2';
    process.env.DLP_AUTO_REVOKE = 'true';

    const dbPath = require.resolve('../../config/db');
    const dlpPath = require.resolve('../../middleware/dlpAntiExfiltration');
    const origDb = require.cache[dbPath];
    const origDlp = require.cache[dlpPath];

    try {
      const users = [{ id: 501, token_version: 1 }];
      const incidents = [];
      require.cache[dbPath] = {
        id: dbPath,
        filename: dbPath,
        loaded: true,
        exports: {
          async query(sql, params = []) {
            const s = sql.replace(/\s+/g, ' ').trim();
            if (s.startsWith('UPDATE users SET token_version')) {
              const u = users.find(x => x.id === params[0]);
              if (u) u.token_version++;
            } else if (s.includes('INSERT INTO security_incidents')) {
              const m = s.match(/VALUES\s*\(\s*'([A-Z0-9_]+)'/);
              incidents.push({ event_type: m ? m[1] : 'UNKNOWN', user_id: params[0] });
            }
            return { rows: [] };
          }
        }
      };

      delete require.cache[dlpPath];
      const dlp = require('../../middleware/dlpAntiExfiltration');
      dlp._resetDlpBuckets();
      assert.strictEqual(dlp.MAX_DLP_KEYS, 10000);
      assert.strictEqual(dlp.isBulkExportRequest({ method: 'GET', originalUrl: '/api/farms/1/full-dataset' }), true);
      assert.strictEqual(dlp.isBulkExportRequest({ method: 'GET', originalUrl: '/api/users/me' }), false);

      const tok = jwt.sign({ id: 501, role: 'admin', tv: 1 }, process.env.JWT_SECRET, { expiresIn: '30m' });
      const invokeDlp = async (url) => {
        let passed = false;
        let blocked = null;
        await dlp(
          { method: 'GET', originalUrl: url, headers: { authorization: `Bearer ${tok}` }, ip: '10.0.0.9' },
          { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(p) { blocked = { status: this.statusCode, body: p }; return this; } },
          () => { passed = true; }
        );
        return { passed, blocked };
      };

      assert.strictEqual((await invokeDlp('/api/database/export')).passed, true);
      assert.strictEqual((await invokeDlp('/api/database/export')).passed, true);
      const r3 = await invokeDlp('/api/database/export');
      assert.strictEqual(r3.passed, false);
      assert.strictEqual(r3.blocked.status, 429);
      assert.strictEqual(r3.blocked.body.code, 'DLP_EXFILTRATION_BLOCKED');
      assert.strictEqual(r3.blocked.body.auto_revoked, true);
      assert.strictEqual(users[0].token_version, 2);
      assert.ok(incidents.some(x => x.event_type === 'DLP_EXFILTRATION_BLOCKED' && x.user_id === 501));

      const serverSrc = fs.readFileSync(path.join(rootDir, 'backend/server.js'), 'utf8');
      assert.ok(serverSrc.includes('dlpAntiExfiltration'));
      dlp._resetDlpBuckets();
    } finally {
      if (origDb) require.cache[dbPath] = origDb; else delete require.cache[dbPath];
      if (origDlp) require.cache[dlpPath] = origDlp; else delete require.cache[dlpPath];
      if (prevSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = prevSecret;
      if (prevOps === undefined) delete process.env.DLP_MAX_BULK_OPS_5M; else process.env.DLP_MAX_BULK_OPS_5M = prevOps;
      if (prevFarms === undefined) delete process.env.DLP_MAX_DISTINCT_FARMS_5M; else process.env.DLP_MAX_DISTINCT_FARMS_5M = prevFarms;
      if (prevRevoke === undefined) delete process.env.DLP_AUTO_REVOKE; else process.env.DLP_AUTO_REVOKE = prevRevoke;
    }
  });

  test('29.4 [SEC-ISO-04] Admin JWT 30m + HttpOnly cookie, CSP header & env-aware right-click/F12 UI guard', async () => {
    const prevSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'suite29_iso27001_secret_min_32_chars';

    const dbPath = require.resolve('../../config/db');
    const authMwPath = require.resolve('../../middleware/auth');
    const authRoutePath = require.resolve('../../routes/auth');
    const origDb = require.cache[dbPath];
    const origAuthMw = require.cache[authMwPath];
    const origAuthRoute = require.cache[authRoutePath];

    try {
      const passHash = await bcrypt.hash('Cookie@2026', 6);
      const users = [
        { id: 1, email: 'admin@tanbao.vn', phone: '0901', password_hash: passHash, full_name: 'Admin', role: 'admin', sub_role: 'farm_owner', approved: true, token_version: 1, mfa_enabled: false },
        { id: 2, email: 'user@tanbao.vn', phone: '0902', password_hash: passHash, full_name: 'Farmer', role: 'user', sub_role: 'farm_owner', approved: true, token_version: 1, mfa_enabled: false }
      ];
      require.cache[dbPath] = {
        id: dbPath,
        filename: dbPath,
        loaded: true,
        exports: {
          async query(sql, params = []) {
            const s = sql.replace(/\s+/g, ' ').trim();
            if (s.includes('FROM users WHERE LOWER(email)')) {
              const u = users.find(x => x.email === String(params[0]).toLowerCase());
              return { rows: u ? [{ ...u }] : [] };
            }
            if (s.includes('FROM users WHERE id = $1 LIMIT 1')) {
              const u = users.find(x => x.id === params[0]);
              return { rows: u ? [{ ...u }] : [] };
            }
            return { rows: [] };
          }
        }
      };
      require.cache[authMwPath] = {
        id: authMwPath,
        filename: authMwPath,
        loaded: true,
        exports: (req, res, next) => { req.user = { id: 1, role: 'admin' }; next(); }
      };
      delete require.cache[authRoutePath];
      const authRouter = require('../../routes/auth');

      const invoke = (method, routePath, body) => {
        const layer = authRouter.stack.find(l => l.route && l.route.path === routePath && l.route.methods[method]);
        const handlers = layer.route.stack.map(s => s.handle);
        return new Promise((resolve, reject) => {
          const cookies = {};
          const req = { method: method.toUpperCase(), path: routePath, headers: {}, body, ip: '127.0.0.1', secure: true, app: { get: () => null } };
          const res = {
            statusCode: 200,
            cookie(n, v, o) { cookies[n] = { v, o }; return this; },
            status(c) { this.statusCode = c; return this; },
            json(p) { resolve({ status: this.statusCode, body: p, cookies }); return this; }
          };
          let idx = 0;
          const next = (err) => {
            if (err) return reject(err);
            const fn = handlers[idx++];
            if (!fn) return resolve({ status: res.statusCode, body: null, cookies });
            Promise.resolve(fn(req, res, next)).catch(reject);
          };
          next();
        });
      };

      const adminRes = await invoke('post', '/login', { email: 'admin@tanbao.vn', password: 'Cookie@2026' });
      const adminDecoded = jwt.decode(adminRes.body.token);
      assert.strictEqual(adminDecoded.exp - adminDecoded.iat, 1800);
      assert.strictEqual(adminRes.cookies.pb_admin_session.o.httpOnly, true);
      assert.strictEqual(adminRes.cookies.pb_admin_session.o.sameSite, 'strict');

      const userRes = await invoke('post', '/login', { email: 'user@tanbao.vn', password: 'Cookie@2026' });
      const userDecoded = jwt.decode(userRes.body.token);
      assert.strictEqual(userDecoded.exp - userDecoded.iat, 604800);
      assert.strictEqual(userRes.cookies.pb_admin_session, undefined);

      const { securityHeaders } = require('../../middleware/securityHeaders');
      const headers = {};
      securityHeaders({ secure: true, headers: {} }, { setHeader(k, v) { headers[k] = v; } }, () => {});
      assert.ok(headers['Content-Security-Policy'] && headers['Content-Security-Policy'].includes("object-src 'none'"));

      const guardSrc = fs.readFileSync(path.join(rootDir, 'frontend/assets/js/enterprise-security-guard.js'), 'utf8');
      const runGuard = (hostname) => {
        const events = [];
        const sb = {
          location: { hostname },
          document: { readyState: 'complete', addEventListener(t) { events.push(t); }, getElementById() { return null; }, body: { appendChild() {} } },
          console: { log() {} },
          setTimeout() {},
          setInterval() {}
        };
        sb.window = sb;
        vm.runInNewContext(guardSrc, sb);
        return { guard: sb.__TBSG_SECURITY_GUARD__, events };
      };
      const prod = runGuard('plant-book.onrender.com');
      assert.strictEqual(prod.guard.config.blockContextMenu, true);
      assert.strictEqual(prod.guard.config.blockShortcuts, true);
      assert.strictEqual(prod.guard.config.antiDebugging, false);
      assert.ok(prod.events.includes('contextmenu') && prod.events.includes('keydown'));

      const local = runGuard('localhost');
      assert.strictEqual(local.guard.config.blockContextMenu, false);
      assert.strictEqual(local.guard.config.blockShortcuts, false);
    } finally {
      if (origDb) require.cache[dbPath] = origDb; else delete require.cache[dbPath];
      if (origAuthMw) require.cache[authMwPath] = origAuthMw; else delete require.cache[authMwPath];
      if (origAuthRoute) require.cache[authRoutePath] = origAuthRoute; else delete require.cache[authRoutePath];
      if (prevSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = prevSecret;
    }
  });
});
