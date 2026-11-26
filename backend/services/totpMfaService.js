const crypto = require('crypto');
const { encryptSecret, decryptSecret } = require('../utils/cryptoVault');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateBase32Secret(byteLen = 20) {
  return base32Encode(crypto.randomBytes(byteLen));
}

function generateTotpCode(secretBase32, timestampMs = Date.now(), stepSec = 30, digits = 6) {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(timestampMs / 1000 / stepSec);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  const otp = binCode % (10 ** digits);
  return String(otp).padStart(digits, '0');
}

function verifyTotpCode(secretOrEncrypted, tokenInput, windowSteps = 1, nowMs = Date.now()) {
  if (!secretOrEncrypted || !tokenInput) return false;
  const codeStr = String(tokenInput).replace(/\s+/g, '').trim();
  if (!/^\d{6}$/.test(codeStr)) return false;

  const secretBase32 = decryptSecret(String(secretOrEncrypted));
  if (!secretBase32) return false;

  const a = Buffer.from(codeStr, 'utf8');
  for (let w = -windowSteps; w <= windowSteps; w++) {
    const candidate = generateTotpCode(secretBase32, nowMs + w * 30000);
    const b = Buffer.from(candidate, 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
}

function buildOtpAuthUri({ accountName, issuer = 'TanBaoAgTech', secretBase32 }) {
  const safeIssuer = encodeURIComponent(issuer);
  const safeAccount = encodeURIComponent(accountName || 'admin@tanbao.vn');
  return `otpauth://totp/${safeIssuer}:${safeAccount}?secret=${encodeURIComponent(secretBase32)}&issuer=${safeIssuer}&algorithm=SHA1&digits=6&period=30`;
}

function encryptTotpSecret(secretBase32) {
  return encryptSecret(secretBase32);
}

module.exports = {
  base32Encode,
  base32Decode,
  generateBase32Secret,
  generateTotpCode,
  verifyTotpCode,
  buildOtpAuthUri,
  encryptTotpSecret
};
