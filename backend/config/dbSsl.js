const CLOUD_SSL = Object.freeze({ rejectUnauthorized: false });

const FALSY = ['false', 'disable', 'disabled', '0', 'off', 'no'];
const TRUTHY = ['true', 'require', 'required', '1', 'on', 'yes'];

function extractHost(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const normalized = url.replace(/^postgres(ql)?:\/\//i, 'http://');
    return new URL(normalized).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch (_) {
    return '';
  }
}

function extractSslMode(url) {
  if (!url || typeof url !== 'string') return '';
  const m = url.match(/[?&]sslmode=([^&#]+)/i);
  return m ? decodeURIComponent(m[1]).toLowerCase() : '';
}

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
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (!h.includes('.') && !h.includes(':')) return true;

  return false;
}

function resolveSslConfig(url, opts = {}) {
  const env = opts.env || process.env;
  const override = String(env.DB_SSL || '').trim().toLowerCase();
  if (FALSY.includes(override)) return false;
  if (TRUTHY.includes(override)) return { ...CLOUD_SSL };

  const sslmode = extractSslMode(url);
  if (sslmode === 'disable') return false;
  if (sslmode) return { ...CLOUD_SSL };

  const host = opts.host ? String(opts.host).toLowerCase() : extractHost(url);
  if (isPrivateHost(host)) return false;

  return { ...CLOUD_SSL };
}

function maskConnectionString(url) {
  if (!url || typeof url !== 'string') return '';
  return url.replace(/(\/\/[^:/@]+:)([^@]*)(@)/, '$1****$3');
}

module.exports = { resolveSslConfig, isPrivateHost, extractHost, extractSslMode, maskConnectionString };
