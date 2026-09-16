/* ═══════════════════════════════════════════════════════════════
   Plant Book – Backend
   middleware/userRateLimiter.js — Per-User & Per-IP Rate Limiter (10 req/s SSOT)
   Protects server against DDoS, UI freeze, accidental click spamming & bot overload.
   ═══════════════════════════════════════════════════════════════ */

const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { getRateLimitConfig } = require('../config/appConfig');

const rateLimitConfig = getRateLimitConfig();

/**
 * Per-User / Per-IP High Frequency Rate Limiter (10 req/s SSOT)
 */
const userRateLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs || 1000, // 1 second
  max: rateLimitConfig.maxRequestsPerWindow || 10, // 10 requests per 1s
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: rateLimitConfig.statusCode || 429,
  keyGenerator: (req) => {
    // 1. If req.user is already attached by auth middleware
    if (req.user && req.user.id) {
      return `user_${req.user.id}`;
    }
    // 2. If Authorization header contains Bearer JWT token, decode user ID
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
    // 3. Fallback to client real IP
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
               req.socket?.remoteAddress ||
               req.ip ||
               'unknown_ip';
    return `ip_${ip}`;
  },
  skip: (req) => {
    const p = req.path || req.originalUrl || '';
    // Skip health checks, ping endpoints, and static config tokens
    if (p.includes('/health') || p === '/' || p === '/healthz' || p.includes('/config/mapbox-token')) {
      return true;
    }
    return false;
  },
  handler: (req, res) => {
    const msg = rateLimitConfig.message || 'Thao tác quá nhanh! Giới hạn tối đa 10 yêu cầu/giây để bảo vệ hệ thống.';
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
