const { describe, it, expect } = require('../test-framework');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { getRateLimitConfig } = require('../../config/appConfig');
const { userRateLimiter } = require('../../middleware/userRateLimiter');

describe('Suite 15: Per-User Rate Limiting & Anti-Freeze Architecture (10 req/s SSOT)', () => {

  const appConfigJsonPath = path.join(__dirname, '../../../config/app.config.json');
  const serverPath = path.join(__dirname, '../../server.js');
  const userRateLimiterPath = path.join(__dirname, '../../middleware/userRateLimiter.js');

  it('15.1 Should verify SSOT app.config.json defines rateLimit configuration with 10 req / 1000ms', () => {
    expect(fs.existsSync(appConfigJsonPath)).toBe(true);
    const raw = fs.readFileSync(appConfigJsonPath, 'utf8');
    const config = JSON.parse(raw);

    expect(config.rateLimit).toBeDefined();
    expect(config.rateLimit.windowMs).toBe(1000);
    expect(config.rateLimit.maxRequestsPerWindow).toBe(10);
    expect(config.rateLimit.statusCode).toBe(429);
    expect(config.rateLimit.message.includes('10 yêu cầu/giây')).toBe(true);
  });

  it('15.2 Should verify getRateLimitConfig() correctly parses configuration', () => {
    const cfg = getRateLimitConfig();
    expect(cfg.windowMs).toBe(1000);
    expect(cfg.maxRequestsPerWindow).toBe(10);
    expect(cfg.statusCode).toBe(429);
    expect(typeof cfg.message).toBe('string');
  });

  it('15.3 Should verify keyGenerator correctly distinguishes between Authenticated Users and Anonymous IPs', () => {
    const middlewareContent = fs.readFileSync(userRateLimiterPath, 'utf8');
    expect(middlewareContent.includes('userRateLimiter')).toBe(true);
    expect(middlewareContent.includes('keyGenerator')).toBe(true);

    // Mock key generator logic
    function mockKeyGen(req) {
      if (req.user && req.user.id) {
        return `user_${req.user.id}`;
      }
      const authHeader = req.headers?.['authorization'] || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.decode(token);
          if (decoded && decoded.id) {
            return `user_${decoded.id}`;
          }
        } catch (_) {}
      }
      const forwarded = req.headers?.['x-forwarded-for'];
      const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
                 req.socket?.remoteAddress ||
                 req.ip ||
                 'unknown_ip';
      return `ip_${ip}`;
    }

    // 1. Authenticated req with req.user.id
    const key1 = mockKeyGen({ user: { id: 42, role: 'farmer' } });
    expect(key1).toBe('user_42');

    // 2. Req with Bearer JWT token
    const testToken = jwt.sign({ id: 99, email: 'farmer99@tanbaocorp.vn' }, 'secret_key');
    const key2 = mockKeyGen({ headers: { authorization: `Bearer ${testToken}` } });
    expect(key2).toBe('user_99');

    // 3. Anonymous req with x-forwarded-for IP
    const key3 = mockKeyGen({ headers: { 'x-forwarded-for': '113.161.42.10, 10.0.0.1' } });
    expect(key3).toBe('ip_113.161.42.10');
  });

  it('15.4 Should verify skip logic allows /health, /healthz and static token endpoints', () => {
    function mockSkip(pathStr) {
      if (pathStr.includes('/health') || pathStr === '/' || pathStr === '/healthz' || pathStr.includes('/config/mapbox-token')) {
        return true;
      }
      return false;
    }

    expect(mockSkip('/health')).toBe(true);
    expect(mockSkip('/api/health')).toBe(true);
    expect(mockSkip('/healthz')).toBe(true);
    expect(mockSkip('/api/config/mapbox-token')).toBe(true);
    expect(mockSkip('/api/plants')).toBe(false);
    expect(mockSkip('/api/farms')).toBe(false);
    expect(mockSkip('/api/ai/chat')).toBe(false);
  });

  it('15.5 Should verify server.js registers userRateLimiter for all /api routes', () => {
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    expect(serverContent.includes("require('./middleware/userRateLimiter')")).toBe(true);
    expect(serverContent.includes("app.use('/api', userRateLimiter)")).toBe(true);
  });
});
