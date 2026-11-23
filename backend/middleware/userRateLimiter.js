const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { getRateLimitConfig } = require('../config/appConfig');

const rateLimitConfig = getRateLimitConfig();
const MAX_RATE_BUCKET_SIZE = 50000;
const AUTH_WINDOW_MS = 60 * 1000;
const AUTH_MAX_ATTEMPTS = 25;
const authAttemptBucket = new Map();

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown_ip';
}

function pruneAuthBucket(now) {
  for (const [k, v] of authAttemptBucket.entries()) {
    if (now >= v.resetAt) authAttemptBucket.delete(k);
    if (authAttemptBucket.size <= Math.floor(MAX_RATE_BUCKET_SIZE * 0.8)) break;
  }
  while (authAttemptBucket.size > MAX_RATE_BUCKET_SIZE) {
    const oldest = authAttemptBucket.keys().next().value;
    if (oldest === undefined) break;
    authAttemptBucket.delete(oldest);
  }
}

const baseUserLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs || 1000,
  max: rateLimitConfig.maxRequestsPerWindow || 50,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: rateLimitConfig.statusCode || 429,
  keyGenerator: (req) => {
    const reqUrl = req.originalUrl || req.path || '';
    if (reqUrl.includes('/auth/login') || reqUrl.includes('/auth/register') || reqUrl.includes('/auth/forgot-password') || reqUrl.includes('/auth/onboard-lead')) {
      return `ip:${getClientIp(req)}`;
    }
    if (req.user && req.user.id) {
      return `user_${req.user.id}`;
    }
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const secret = process.env.JWT_SECRET;
        const decoded = secret ? jwt.verify(token, secret) : jwt.decode(token);
        if (decoded && decoded.id) {
          return `user_${decoded.id}`;
        }
      } catch (_) {}
    }
    return `ip:${getClientIp(req)}`;
  },
  skip: (req) => {
    const p = req.originalUrl || req.path || '';
    if (p.includes('/auth')) {
      return false;
    }
    if (p.includes('/health') || p === '/' || p === '/healthz' || p.includes('/config/mapbox-token')) {
      return true;
    }
    return false;
  },
  handler: (req, res) => {
    const msg = rateLimitConfig.message || 'Thao tác quá nhanh! Giới hạn tối đa 50 yêu cầu/giây để bảo vệ hệ thống.';
    return res.status(429).json({
      error: msg,
      code: 'RATE_LIMIT_EXCEEDED',
      windowMs: rateLimitConfig.windowMs,
      limit: rateLimitConfig.maxRequestsPerWindow,
      retryAfterSeconds: 1
    });
  }
});

function userRateLimiter(req, res, next) {
  const reqUrl = req.originalUrl || req.path || '';
  if (reqUrl.includes('/auth/')) {
    const now = Date.now();
    const key = `ip:${getClientIp(req)}`;
    let entry = authAttemptBucket.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 1, resetAt: now + AUTH_WINDOW_MS };
    } else {
      entry.count += 1;
    }
    authAttemptBucket.set(key, entry);
    if (authAttemptBucket.size > MAX_RATE_BUCKET_SIZE) {
      pruneAuthBucket(now);
    }
    if (entry.count > AUTH_MAX_ATTEMPTS) {
      return res.status(429).json({
        error: 'Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau 1 phút.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
      });
    }
  }
  return baseUserLimiter(req, res, next);
}

module.exports = { userRateLimiter, authAttemptBucket, pruneAuthBucket };
