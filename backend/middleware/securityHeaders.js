/* ═══════════════════════════════════════════════════════════════
   Plant Book – Backend Enterprise
   middleware/securityHeaders.js — OWASP ASVS HTTP Security Headers & CORS Whitelist
   ═══════════════════════════════════════════════════════════════ */

const DEFAULT_ALLOWED_ORIGINS = [
  'https://plant-book.onrender.com',
  'https://plant-book-api.onrender.com',
  'capacitor://localhost',
  'ionic://localhost'
];

function getAllowedOrigins() {
  const envRaw = process.env.CORS_ALLOWED_ORIGINS || '';
  const fromEnv = envRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv])];
}

function isOriginAllowed(origin) {
  // Native Mobile App (Flutter/Dart http), curl, and server-to-server calls omit Origin
  if (!origin) return true;

  // Local development & LAN testing (localhost / 127.0.0.1 / 192.168.x.x / 10.x.x.x)
  if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/i.test(origin)) {
    return true;
  }

  const allowed = getAllowedOrigins();
  if (allowed.includes('*')) return true;
  return allowed.includes(origin);
}

function buildCorsOptions() {
  return {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy blocked origin: ${origin}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Api-Key',
      'X-Client-Version',
      'X-Client-Signature',
      'X-Client-Nonce',
      'X-Client-Timestamp',
      'X-Requested-With'
    ]
  };
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=(self)');
  res.setHeader('X-XSS-Protection', '0');

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

module.exports = {
  securityHeaders,
  buildCorsOptions,
  isOriginAllowed,
  getAllowedOrigins
};
