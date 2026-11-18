const rateLimit = require('express-rate-limit');

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
  const reqPath = req.path || req.originalUrl || '';
  if (reqPath.includes('/health') || reqPath === '/' || reqPath === '/healthz') {
    return next();
  }

  const hasApiKey = req.headers['x-api-key'] || (req.query && req.query.api_key);
  const isB2BDataset = reqPath.includes('/full-dataset') || reqPath.includes('/api-link') || reqPath.includes('/offline-batch-sync');
  if (hasApiKey || isB2BDataset) {
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
  skip: (req) => {
    const p = req.path || req.originalUrl || '';
    if (p.includes('/health') || p === '/' || p === '/healthz' || p.includes('/config/mapbox-token')) {
      return true;
    }
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ') && authHeader.length > 20) {
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

module.exports = { antiScraper, apiLimiter };
