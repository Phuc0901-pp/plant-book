/* ════════════════════════════════════════════════════════════════════
   Plant Book — Backend
   config/dbSsl.js — Tự động nhận diện chế độ SSL cho kết nối PostgreSQL
   - Cloud (Supabase / Render / Neon...)  → bật SSL
   - NAS công ty / LAN / Docker nội bộ    → tắt SSL
   Thứ tự ưu tiên:
     1. Biến môi trường DB_SSL (false|disable|0|off  hoặc  true|require|1|on)
     2. Tham số sslmode trong connection string
     3. Nhận diện host nội bộ (localhost, IP private, *.local, tên service Docker)
     4. Mặc định: bật SSL (an toàn cho Cloud)
   ════════════════════════════════════════════════════════════════════ */

const CLOUD_SSL = Object.freeze({ rejectUnauthorized: false });

const FALSY = ['false', 'disable', 'disabled', '0', 'off', 'no'];
const TRUTHY = ['true', 'require', 'required', '1', 'on', 'yes'];

/**
 * Lấy hostname từ connection string PostgreSQL.
 * @param {string} url
 * @returns {string} hostname viết thường, '' nếu không đọc được
 */
function extractHost(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const normalized = url.replace(/^postgres(ql)?:\/\//i, 'http://');
    return new URL(normalized).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch (_) {
    return '';
  }
}

/**
 * Lấy giá trị sslmode trong connection string (nếu có).
 * @param {string} url
 * @returns {string} sslmode viết thường, '' nếu không có
 */
function extractSslMode(url) {
  if (!url || typeof url !== 'string') return '';
  const m = url.match(/[?&]sslmode=([^&#]+)/i);
  return m ? decodeURIComponent(m[1]).toLowerCase() : '';
}

/**
 * Host có thuộc mạng nội bộ (NAS / LAN / Docker) hay không.
 * @param {string} host
 * @returns {boolean}
 */
function isPrivateHost(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '::1' || h === 'host.docker.internal') return true;
  if (h.endsWith('.local') || h.endsWith('.lan') || h.endsWith('.internal') || h.endsWith('.home.arpa')) return true;

  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1], 10), parseInt(ipv4[2], 10)];
    if (a === 127 || a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // Tailscale / CGNAT
    return false;
  }

  // Tên service Docker Compose (không có dấu chấm): postgres, tanbao-postgres-nas...
  if (!h.includes('.') && !h.includes(':')) return true;

  return false;
}

/**
 * Trả về cấu hình `ssl` cho node-postgres.
 * @param {string} [url] connection string
 * @param {object} [opts]
 * @param {string} [opts.host] host (khi dùng DB_HOST thay cho URL)
 * @param {object} [opts.env] nguồn biến môi trường (mặc định process.env)
 * @returns {false|{rejectUnauthorized:boolean}}
 */
function resolveSslConfig(url, opts = {}) {
  const env = opts.env || process.env;
  const override = String(env.DB_SSL || '').trim().toLowerCase();
  if (FALSY.includes(override)) return false;
  if (TRUTHY.includes(override)) return { ...CLOUD_SSL };

  const sslmode = extractSslMode(url);
  if (sslmode === 'disable') return false;
  if (sslmode) return { ...CLOUD_SSL }; // allow / prefer / require / verify-*

  const host = opts.host ? String(opts.host).toLowerCase() : extractHost(url);
  if (isPrivateHost(host)) return false;

  return { ...CLOUD_SSL };
}

/**
 * Che mật khẩu trong connection string để in log an toàn.
 * @param {string} url
 * @returns {string}
 */
function maskConnectionString(url) {
  if (!url || typeof url !== 'string') return '';
  return url.replace(/(\/\/[^:/@]+:)([^@]*)(@)/, '$1****$3');
}

module.exports = { resolveSslConfig, isPrivateHost, extractHost, extractSslMode, maskConnectionString };
