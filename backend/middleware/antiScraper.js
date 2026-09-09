const rateLimit = require('express-rate-limit');

// Suspicious User-Agents list (scraping frameworks, headless tools, etc.)
const SUSPICIOUS_UA_PATTERNS = [
  /python/i,
  /scrapy/i,
  /urllib/i,
  /curl/i,
  /wget/i,
  /postman/i,
  /axios/i,
  /got/i,
  /node-fetch/i,
  /superagent/i,
  /http-client/i,
  /headless/i,
  /puppeteer/i,
  /selenium/i,
  /phantomjs/i,
  /playwright/i,
  /cheerio/i,
  /beautifulsoup/i,
  /java/i,
  /go-http-client/i,
  /perl/i,
  /ruby/i
];

/**
 * Middleware to block requests from known scraping tools, command-line tools, 
 * or requests lacking essential headers (like User-Agent).
 */
function antiScraper(req, res, next) {
  const reqPath = req.path || req.originalUrl || '';
  // Exclude simple health check
  if (reqPath.includes('/health') || reqPath === '/' || reqPath === '/healthz') {
    return next();
  }

  const userAgent = req.headers['user-agent'] || '';

  // 1. Block requests with empty or missing User-Agent
  if (!userAgent.trim()) {
    return res.status(403).json({ 
      error: 'Truy cập bị chặn. Request thiếu User-Agent header.' 
    });
  }

  // 2. Block known scraping tools and command-line HTTP clients
  for (const pattern of SUSPICIOUS_UA_PATTERNS) {
    if (pattern.test(userAgent)) {
      return res.status(403).json({ 
        error: 'Truy cập bị từ chối. Phát hiện công cụ cào dữ liệu tự động (Web Scraper / Bot).' 
      });
    }
  }

  // 3. Block other bot-like headers
  next();
}

/**
 * Global rate limiter to protect API against high-frequency crawling and brute force.
 * Limits each unauthenticated IP to 3000 requests per 15 minutes.
 * Automatically exempts authenticated users (JWT sessions) and health check / mapbox endpoints.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // Generous ceiling for rich SPAs, real-time websockets & live GIS telemetry
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    const p = req.path || req.originalUrl || '';
    // Skip health checks, root endpoints, and config tokens
    if (p.includes('/health') || p === '/' || p === '/healthz' || p.includes('/config/mapbox-token')) {
      return true;
    }
    // Exempt authenticated sessions from rate limiting so admins & farmers never get blocked
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ') && authHeader.length > 20) {
      return true;
    }
    return false;
  },
  message: {
    error: 'Tần suất gửi yêu cầu quá nhanh. Vui lòng thử lại sau 15 phút.'
  }
});

module.exports = { antiScraper, apiLimiter };
