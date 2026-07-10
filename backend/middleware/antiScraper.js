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
  // Exclude simple health check
  if (req.path === '/api/health') {
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

  // 3. Block other bot-like headers (e.g. Sec-Fetch-Dest checks, etc. can be added if needed)
  next();
}

/**
 * Global rate limiter to protect API against high-frequency crawling and brute force.
 * Limits each IP to 150 requests per 15 minutes.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // Limit each IP to 150 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Tần suất gửi yêu cầu quá nhanh. Vui lòng thử lại sau 15 phút.'
  }
});

module.exports = { antiScraper, apiLimiter };
