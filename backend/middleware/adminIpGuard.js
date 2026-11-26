const pool = require('../config/db');

function normalizeIp(raw) {
  if (!raw) return '';
  let ip = String(raw).trim();
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  return ip;
}

function extractClientIp(req) {
  if (!req) return '';
  const xff = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
  if (xff) return normalizeIp(xff);
  if (req.ip) return normalizeIp(req.ip);
  if (req.socket && req.socket.remoteAddress) return normalizeIp(req.socket.remoteAddress);
  if (req.connection && req.connection.remoteAddress) return normalizeIp(req.connection.remoteAddress);
  return '';
}

function ipv4ToInt(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (let i = 0; i < 4; i++) {
    if (!/^\d{1,3}$/.test(parts[i])) return null;
    const octet = Number(parts[i]);
    if (octet < 0 || octet > 255) return null;
    num = ((num << 8) | octet) >>> 0;
  }
  return num >>> 0;
}

function ipMatchesRule(clientIp, rule) {
  const normalizedClient = normalizeIp(clientIp);
  const rawRule = String(rule || '').trim();
  if (!normalizedClient || !rawRule) return false;
  if (rawRule === '*') return true;
  if (rawRule.toLowerCase() === 'localhost' && normalizedClient === '127.0.0.1') return true;
  const normalizedRule = normalizeIp(rawRule);
  if (normalizedClient === normalizedRule) return true;

  if (normalizedRule.includes('/')) {
    const slashIdx = normalizedRule.indexOf('/');
    const cidrIp = normalizedRule.slice(0, slashIdx).trim();
    const prefix = parseInt(normalizedRule.slice(slashIdx + 1).trim(), 10);
    if (Number.isInteger(prefix) && prefix >= 0 && prefix <= 32) {
      const clientInt = ipv4ToInt(normalizedClient);
      const cidrInt = ipv4ToInt(cidrIp);
      if (clientInt !== null && cidrInt !== null) {
        const mask = prefix === 0 ? 0 : ((~0 << (32 - prefix)) >>> 0);
        return ((clientInt & mask) >>> 0) === ((cidrInt & mask) >>> 0);
      }
    }
  }
  return false;
}

function parseAllowlist(envVal, userAllowedIps) {
  const tokens = [];
  if (envVal) {
    String(envVal).split(/[,\s;]+/).forEach(t => {
      const s = t.trim();
      if (s) tokens.push(s);
    });
  }
  if (Array.isArray(userAllowedIps)) {
    userAllowedIps.forEach(t => {
      const s = String(t || '').trim();
      if (s) tokens.push(s);
    });
  } else if (typeof userAllowedIps === 'string' && userAllowedIps.trim()) {
    userAllowedIps.split(/[,\s;]+/).forEach(t => {
      const s = t.trim();
      if (s) tokens.push(s);
    });
  }
  return Array.from(new Set(tokens));
}

async function adminIpGuard(req, res, next) {
  let userAllowedIps = (req.user && req.user.allowed_ips !== undefined) ? req.user.allowed_ips : null;
  if (userAllowedIps === null && req.user && req.user.id && typeof pool.query === 'function') {
    try {
      const r = await pool.query('SELECT allowed_ips FROM users WHERE id = $1', [req.user.id]);
      if (r && r.rows && r.rows[0] && r.rows[0].allowed_ips) {
        userAllowedIps = r.rows[0].allowed_ips;
      }
    } catch (_) {}
  }

  const allowlist = parseAllowlist(process.env.ADMIN_IP_ALLOWLIST || '', userAllowedIps);
  if (allowlist.length === 0) {
    return next();
  }

  const clientIp = extractClientIp(req);
  const allowed = allowlist.some(rule => ipMatchesRule(clientIp, rule));
  if (allowed) {
    return next();
  }

  try {
    await pool.query(
      `INSERT INTO security_incidents (event_type, severity, user_id, ip_address, route_path, details)
       VALUES ('ADMIN_IP_FORBIDDEN', 'high', $1, $2, $3, $4)`,
      [
        req.user ? req.user.id : null,
        clientIp || null,
        req.originalUrl || req.path || '',
        JSON.stringify({ allowlist_count: allowlist.length, role: req.user ? req.user.role : null })
      ]
    );
  } catch (_) {}

  return res.status(403).json({
    error: 'Địa chỉ IP không nằm trong danh sách cho phép truy cập quản trị (ISO 27001 IP Allowlist).',
    code: 'ADMIN_IP_FORBIDDEN',
    ip: clientIp
  });
}

adminIpGuard.extractClientIp = extractClientIp;
adminIpGuard.ipMatchesRule = ipMatchesRule;
adminIpGuard.parseAllowlist = parseAllowlist;

module.exports = adminIpGuard;
