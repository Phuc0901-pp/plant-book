const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { getRateLimitConfig } = require('../config/appConfig');

const rateLimitConfig = getRateLimitConfig();

const userRateLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs || 1000,
  max: rateLimitConfig.maxRequestsPerWindow || 50,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: rateLimitConfig.statusCode || 429,
  keyGenerator: (req) => {
    if (req.user && req.user.id) {
      return `user_${req.user.id}`;
    }
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          return `user_${decoded.id}`;
        }
      } catch (_) {}
    }
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
               req.socket?.remoteAddress ||
               req.ip ||
               'unknown_ip';
    return `ip_${ip}`;
  },
  skip: (req) => {
    const p = req.path || req.originalUrl || '';
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

module.exports = { userRateLimiter };
