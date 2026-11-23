const rateLimit = require('express-rate-limit');

const MAX_BUCKET_SIZE = 50000;
const PUBLIC_NFC_WINDOW_MS = 60 * 1000;
const PUBLIC_NFC_MAX_REQ = 90;
const globalBucket = new Map();

function pruneBucket(now) {
  for (const [k, entry] of globalBucket.entries()) {
    if (now >= entry.resetAt) {
      globalBucket.delete(k);
    }
    if (globalBucket.size <= Math.floor(MAX_BUCKET_SIZE * 0.8)) {
      break;
    }
  }
  while (globalBucket.size > MAX_BUCKET_SIZE) {
    const oldestKey = globalBucket.keys().next().value;
    if (oldestKey === undefined) break;
    globalBucket.delete(oldestKey);
  }
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

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

function antiScraper(req, res, next) {
  const reqPath = req.originalUrl || req.path || '';
  if (reqPath.includes('/health') || reqPath === '/' || reqPath === '/healthz') {
    return next();
  }

  if (/\/api\/public|\/api\/nfc|\/nfc\//i.test(reqPath) || reqPath.startsWith('/public')) {
    const now = Date.now();
    const clientIp = getClientIp(req);
    const key = `pub_${clientIp}`;
    let entry = globalBucket.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 1, resetAt: now + PUBLIC_NFC_WINDOW_MS };
    } else {
      entry.count += 1;
    }
    globalBucket.set(key, entry);
    if (globalBucket.size > MAX_BUCKET_SIZE) {
      pruneBucket(now);
    }
    if (entry.count > PUBLIC_NFC_MAX_REQ) {
      return res.status(429).json({
        error: 'Quá nhiều yêu cầu truy vấn công khai/NFC. Vui lòng thử lại sau 1 phút.',
        code: 'TOO_MANY_PUBLIC_REQUESTS',
        limit: PUBLIC_NFC_MAX_REQ
      });
    }
  }

  const hasApiKey = Boolean(req.headers['x-api-key'] || (req.query && req.query.api_key));
  const authHeader = req.headers['authorization'] || '';
  const hasBearer = authHeader.startsWith('Bearer ') && authHeader.length > 20;
  const isB2BDataset = reqPath.includes('/full-dataset') || reqPath.includes('/api-link') || reqPath.includes('/offline-batch-sync');
  if (hasApiKey || (isB2BDataset && hasBearer)) {
    return next();
  }

  const userAgent = req.headers['user-agent'] || '';

  if (!userAgent.trim()) {
    return res.status(403).json({
      error: 'Truy cập bị chặn. Request thiếu User-Agent header.'
    });
  }

  for (const pattern of SUSPICIOUS_UA_PATTERNS) {
    if (pattern.test(userAgent)) {
      return res.status(403).json({
        error: 'Truy cập bị từ chối. Phát hiện công cụ cào dữ liệu tự động (Web Scraper / Bot).'
      });
    }
  }

  next();
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => {
    const p = req.originalUrl || req.path || '';
    if (p.includes('/auth')) {
      return false;
    }
    if (p.includes('/health') || p === '/' || p === '/healthz' || p.includes('/config/mapbox-token')) {
      return true;
    }
    if (req.headers['x-api-key'] || (req.query && req.query.api_key)) {
      return true;
    }
    return false;
  },
  message: {
    error: 'Tần suất gửi yêu cầu quá nhanh. Vui lòng thử lại sau 15 phút.'
  }
});

module.exports = { antiScraper, apiLimiter, globalBucket, pruneBucket };
