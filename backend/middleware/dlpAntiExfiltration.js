const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { extractClientIp } = require('./adminIpGuard');

const MAX_DLP_KEYS = 10000;
const _dlpBuckets = new Map();

function isBulkExportRequest(req) {
  if (!req) return false;
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') return false;
  const rawUrl = String(req.originalUrl || `${req.baseUrl || ''}${req.path || ''}` || '');
  const urlPath = rawUrl.split('?')[0];
  if (urlPath === '/api/database' || urlPath.startsWith('/api/database/')) return true;
  if (urlPath.includes('/full-dataset')) return true;
  if (urlPath.includes('/reports/query')) return true;
  if (urlPath === '/api/users' || urlPath === '/api/users/') return true;
  return false;
}

function extractActor(req) {
  if (req && req.user && req.user.id) {
    return { userId: req.user.id, role: req.user.role || null };
  }
  const authHeader = req && req.headers && (req.headers.authorization || req.headers.Authorization);
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ') && process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(authHeader.slice(7).trim(), process.env.JWT_SECRET);
      if (decoded && decoded.id) {
        return { userId: decoded.id, role: decoded.role || null };
      }
    } catch (_) {}
  }
  return { userId: null, role: null };
}

function extractFarmId(req, urlPath) {
  if (req && req.params && req.params.farmId) return String(req.params.farmId);
  if (req && req.query && req.query.farm_id) return String(req.query.farm_id);
  if (req && req.body && req.body.farm_id) return String(req.body.farm_id);
  const m = String(urlPath || '').match(/\/farms\/([^/]+)/i);
  return m && m[1] ? String(m[1]) : null;
}

function getOrCreateBucket(key) {
  if (!_dlpBuckets.has(key)) {
    if (_dlpBuckets.size >= MAX_DLP_KEYS) {
      const oldestKey = _dlpBuckets.keys().next().value;
      if (oldestKey !== undefined) _dlpBuckets.delete(oldestKey);
    }
    _dlpBuckets.set(key, { timestamps: [], farms: new Map() });
  }
  return _dlpBuckets.get(key);
}

async function dlpAntiExfiltration(req, res, next) {
  if (!isBulkExportRequest(req)) {
    return next();
  }

  const now = Date.now();
  const windowMs = Math.max(1000, parseInt(process.env.DLP_WINDOW_MS || '300000', 10) || 300000);
  const maxBulkOps = Math.max(1, parseInt(process.env.DLP_MAX_BULK_OPS_5M || '30', 10) || 30);
  const maxDistinctFarms = Math.max(1, parseInt(process.env.DLP_MAX_DISTINCT_FARMS_5M || '10', 10) || 10);

  const clientIp = extractClientIp(req);
  const actor = extractActor(req);
  const actorKey = actor.userId ? `user:${actor.userId}` : `ip:${clientIp || 'unknown'}`;
  const urlPath = String(req.originalUrl || `${req.baseUrl || ''}${req.path || ''}`).split('?')[0];
  const farmId = extractFarmId(req, urlPath);

  const bucket = getOrCreateBucket(actorKey);
  const cutoff = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter(ts => ts >= cutoff);
  for (const [fId, ts] of bucket.farms.entries()) {
    if (ts < cutoff) bucket.farms.delete(fId);
  }

  bucket.timestamps.push(now);
  if (farmId) {
    bucket.farms.set(farmId, now);
  }

  const exceededOps = bucket.timestamps.length > maxBulkOps;
  const exceededFarms = bucket.farms.size > maxDistinctFarms;

  if (!exceededOps && !exceededFarms) {
    return next();
  }

  const autoRevokeEnabled = String(process.env.DLP_AUTO_REVOKE || 'false').toLowerCase() === 'true';
  let autoRevoked = false;
  if (autoRevokeEnabled && actor.userId && typeof pool.query === 'function') {
    try {
      await pool.query(
        'UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = $1',
        [actor.userId]
      );
      autoRevoked = true;
    } catch (_) {}
  }

  if (typeof pool.query === 'function') {
    try {
      await pool.query(
        `INSERT INTO security_incidents (event_type, severity, user_id, ip_address, route_path, details)
         VALUES ('DLP_EXFILTRATION_BLOCKED', 'critical', $1, $2, $3, $4)`,
        [
          actor.userId,
          clientIp || null,
          urlPath,
          JSON.stringify({
            bulk_ops_window: bucket.timestamps.length,
            distinct_farms_window: bucket.farms.size,
            max_bulk_ops: maxBulkOps,
            max_distinct_farms: maxDistinctFarms,
            auto_revoked: autoRevoked
          })
        ]
      );
    } catch (_) {}
  }

  try {
    const { notifyAdmins } = require('../services/notificationDispatcher');
    notifyAdmins({
      eventCode: 'DLP_EXFILTRATION_BLOCKED',
      severity: 'danger',
      title: 'Báo động DLP: Chặn xuất dữ liệu hàng loạt',
      message: `Tài khoản #${actor.userId || 'ẩn danh'} (IP: ${clientIp || 'N/A'}) vượt ngưỡng truy xuất tại ${urlPath}${autoRevoked ? ' và đã bị thu hồi phiên JWT.' : '.'}`,
      actorUserId: actor.userId,
      metadata: { ip: clientIp, route: urlPath, auto_revoked: autoRevoked }
    }).catch(() => {});
  } catch (_) {}

  return res.status(429).json({
    error: 'Phát hiện hành vi trích xuất dữ liệu hàng loạt bất thường (ISO 27001 DLP Anti-Exfiltration).',
    code: 'DLP_EXFILTRATION_BLOCKED',
    retry_after_seconds: Math.ceil(windowMs / 1000),
    auto_revoked: autoRevoked
  });
}

dlpAntiExfiltration._resetDlpBuckets = function () {
  _dlpBuckets.clear();
};
dlpAntiExfiltration.isBulkExportRequest = isBulkExportRequest;
dlpAntiExfiltration.extractActor = extractActor;
dlpAntiExfiltration.MAX_DLP_KEYS = MAX_DLP_KEYS;

module.exports = dlpAntiExfiltration;
