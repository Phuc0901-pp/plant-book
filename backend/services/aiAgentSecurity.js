const crypto = require('crypto');

function deriveEncryptionKey(secretOverride) {
  const rawSecret = secretOverride || process.env.AI_DATA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'tanbao_ai_dev_fallback_key_32b';
  return crypto.createHash('sha256').update(String(rawSecret)).digest();
}

function encryptAgentPayload(payload, secretOverride) {
  const key = deriveEncryptionKey(secretOverride);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload ?? null);
  const encrypted = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptAgentPayload(encryptedStr, secretOverride) {
  if (typeof encryptedStr !== 'string' || !encryptedStr.startsWith('enc:v1:')) {
    throw new Error('INVALID_ENCRYPTED_PAYLOAD_FORMAT');
  }
  const parts = encryptedStr.split(':');
  if (parts.length !== 5) {
    throw new Error('INVALID_ENCRYPTED_PAYLOAD_STRUCTURE');
  }
  const iv = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const ciphertext = Buffer.from(parts[4], 'base64');
  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error('INVALID_CRYPTO_PARAMETERS');
  }
  const key = deriveEncryptionKey(secretOverride);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

function redactPiiForLlm(text) {
  let out = String(text || '');
  const redactions = [];

  const replacePattern = (regex, prefix, isSingleTag = false) => {
    let idx = 0;
    out = out.replace(regex, (match) => {
      idx += 1;
      const token = isSingleTag ? `[${prefix}]` : `[${prefix}_${idx}]`;
      redactions.push({ type: prefix, token, length: match.length });
      return token;
    });
  };

  replacePattern(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, 'REDACTED_SECRET', true);
  replacePattern(/\btb_live_[A-Za-z0-9_]{8,}\b/g, 'REDACTED_SECRET', true);
  replacePattern(/\bAIza[0-9A-Za-z_-]{20,}\b/g, 'REDACTED_SECRET', true);
  replacePattern(/(?:password|passwd|mat_khau|secret)\s*[:=]\s*[^\s,;]+/gi, 'REDACTED_SECRET', true);
  replacePattern(/[\p{L}\p{N}._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu, 'REDACTED_EMAIL');
  replacePattern(/(?:\+84|84|0)(?:3|5|7|8|9)\d{8}\b/g, 'REDACTED_PHONE');
  replacePattern(/\b0\d{11}\b/g, 'REDACTED_ID');

  return {
    sanitizedText: out,
    redactionCount: redactions.length,
    redactions
  };
}

function sanitizeUntrustedDbText(str, maxLen = 240) {
  if (str === null || str === undefined) return '';
  let clean = String(str)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/<\|im_start\|>|<\|im_end\|>/gi, ' ')
    .replace(/\b(?:ignore\s+(?:all\s+)?previous\s+instructions|disregard\s+all\s+rules|system\s*:|assistant\s*:)/gi, '[filtered]');
  clean = clean.replace(/\s+/g, ' ').trim();
  if (clean.length > maxLen) {
    clean = clean.slice(0, maxLen - 1) + '…';
  }
  return clean;
}

function scanAndSanitizeAgentOutput(reply) {
  let out = String(reply || '');
  const leakedPatterns = [];

  const scanAndReplace = (regex, label) => {
    if (regex.test(out)) {
      leakedPatterns.push(label);
      out = out.replace(regex, '[REDACTED_DLP]');
    }
  };

  scanAndReplace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, 'JWT_TOKEN');
  scanAndReplace(/\btb_live_[A-Za-z0-9_]{8,}\b/g, 'FARM_API_KEY');
  scanAndReplace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, 'GOOGLE_API_KEY');
  scanAndReplace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'POSTGRES_URI');
  scanAndReplace(/SELECT\s+\*\s+FROM\s+users\b/gi, 'SQL_USER_DUMP');

  return {
    reply: out,
    leakedPatterns
  };
}

function verifyAgronomySafetyReply(reply, userQuery, toolContexts = []) {
  const originalReply = String(reply || '');
  let out = originalReply;
  const safetyFlags = [];

  const chemicalRegex = /(mancozeb|metalaxyl|fosetyl|chlorpyrifos|abamectin|thuốc\s*bvtv|thuốc\s*hóa\s*học|thuốc\s*trừ\s*sâu|thuốc\s*trị\s*nấm)/i;
  const microbialRegex = /(trichoderma|bacillus|men\s*em|vi\s*sinh)/i;
  const gapRegex = /(10\s*(?:-|–|đến|to)\s*15\s*ngày|cách\s*(?:ly\s*)?(?:ít\s*nhất\s*)?1[0-5]\s*ngày)/i;

  if (chemicalRegex.test(originalReply) && microbialRegex.test(originalReply) && !gapRegex.test(originalReply)) {
    safetyFlags.push('BIOSECURITY_MICROBIAL_GAP_WARNING');
    out += '\n\n⚠️ **Cảnh báo An toàn Sinh học VietGAP:** Sau khi phun/tưới thuốc BVTV hóa học, **BẮT BUỘC cách ly ít nhất 10 – 15 ngày** mới được bón/tưới chế phẩm vi sinh (Trichoderma, Bacillus, men EM) để tránh diệt mất hệ vi sinh có lợi.';
  }

  const hasQuarantinePlant = Array.isArray(toolContexts) && toolContexts.some(ctxItem => {
    if (!ctxItem) return false;
    if (ctxItem.phi_status === 'quarantine') return true;
    const text = typeof ctxItem === 'string' ? ctxItem : JSON.stringify(ctxItem);
    return text.includes('"phi_status":"quarantine"') || text.includes('quarantine');
  });
  const mentionsHarvest = /thu\s*hoạch/i.test(`${originalReply} ${userQuery || ''}`);
  const mentionsPhiSafe = /(thời\s*gian\s*cách\s*ly|cách\s*ly\s*thu\s*hoạch|\bPHI\b|tạm\s*ngưng\s*thu\s*hái|chưa\s*(?:được\s*)?thu\s*hoạch)/i.test(originalReply);

  if (hasQuarantinePlant && mentionsHarvest && !mentionsPhiSafe) {
    safetyFlags.push('PHI_QUARANTINE_WARNING');
    out += '\n\n🚫 **Cảnh báo Thời gian Cách ly (PHI):** Dữ liệu vườn ghi nhận có cây đang ở trạng thái **cách ly sau phun thuốc (`quarantine`)**. Tuyệt đối chưa thu hoạch cho đến khi hết đủ ngày PHI trên nhãn thuốc để đạt chuẩn VietGAP/xuất khẩu.';
  }

  return {
    reply: out,
    safetyFlags
  };
}

class AgentRateLimiter {
  constructor(options = {}) {
    this.maxKeys = options.maxKeys || 20000;
    this.buckets = new Map();
    this.tierLimits = options.tierLimits || {
      normal: { perMinute: 3, perDay: 20 },
      pro: { perMinute: 10, perDay: 100 },
      admin: { perMinute: 60, perDay: 1000 }
    };
  }

  check(userId, tier = 'normal', nowMs = Date.now()) {
    const key = String(userId || 'anon');
    const limits = this.tierLimits[tier] || this.tierLimits.normal;
    const dayKey = new Date(nowMs).toISOString().slice(0, 10);

    if (!this.buckets.has(key) && this.buckets.size >= this.maxKeys) {
      const oldestKey = this.buckets.keys().next().value;
      if (oldestKey !== undefined) this.buckets.delete(oldestKey);
    }

    let rec = this.buckets.get(key);
    if (!rec) {
      rec = { timestamps: [], dayKey, dayCount: 0 };
      this.buckets.set(key, rec);
    }

    if (rec.dayKey !== dayKey) {
      rec.dayKey = dayKey;
      rec.dayCount = 0;
    }

    const windowStart = nowMs - 60000;
    rec.timestamps = rec.timestamps.filter(ts => ts > windowStart);

    if (rec.timestamps.length >= limits.perMinute) {
      const oldestInWindow = rec.timestamps[0] || nowMs;
      const retryAfterSec = Math.max(1, Math.ceil((oldestInWindow + 60000 - nowMs) / 1000));
      return {
        allowed: false,
        retryAfterSec,
        remainingMinute: 0,
        remainingDay: Math.max(0, limits.perDay - rec.dayCount),
        limitType: 'MINUTE_QUOTA_EXCEEDED'
      };
    }

    if (rec.dayCount >= limits.perDay) {
      const endOfDayMs = Date.UTC(
        new Date(nowMs).getUTCFullYear(),
        new Date(nowMs).getUTCMonth(),
        new Date(nowMs).getUTCDate() + 1
      );
      const retryAfterSec = Math.max(1, Math.ceil((endOfDayMs - nowMs) / 1000));
      return {
        allowed: false,
        retryAfterSec,
        remainingMinute: Math.max(0, limits.perMinute - rec.timestamps.length),
        remainingDay: 0,
        limitType: 'DAILY_QUOTA_EXCEEDED'
      };
    }

    rec.timestamps.push(nowMs);
    rec.dayCount += 1;

    return {
      allowed: true,
      retryAfterSec: 0,
      remainingMinute: Math.max(0, limits.perMinute - rec.timestamps.length),
      remainingDay: Math.max(0, limits.perDay - rec.dayCount),
      limitType: null
    };
  }

  reset() {
    this.buckets.clear();
  }
}

class AgentBulkhead {
  constructor(options = {}) {
    this.maxConcurrent = Number(options.maxConcurrent) > 0 ? Number(options.maxConcurrent) : 25;
    this.inFlight = 0;
    this.totalAccepted = 0;
    this.totalRejected = 0;
  }

  acquire() {
    if (this.inFlight >= this.maxConcurrent) {
      this.totalRejected += 1;
      return false;
    }
    this.inFlight += 1;
    this.totalAccepted += 1;
    return true;
  }

  release() {
    if (this.inFlight > 0) {
      this.inFlight -= 1;
    }
  }

  getStats() {
    return {
      inFlight: this.inFlight,
      maxConcurrent: this.maxConcurrent,
      totalAccepted: this.totalAccepted,
      totalRejected: this.totalRejected
    };
  }
}

class ModelCircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = Number(options.failureThreshold) > 0 ? Number(options.failureThreshold) : 3;
    this.cooldownMs = Number(options.cooldownMs) > 0 ? Number(options.cooldownMs) : 60000;
    this.models = new Map();
  }

  _ensure(modelName) {
    const key = String(modelName || 'default');
    if (!this.models.has(key)) {
      this.models.set(key, { state: 'CLOSED', failures: 0, openedAt: null });
    }
    return this.models.get(key);
  }

  canAttempt(modelName, nowMs = Date.now()) {
    const entry = this._ensure(modelName);
    if (entry.state === 'CLOSED') return true;
    if (entry.state === 'OPEN') {
      if (entry.openedAt !== null && (nowMs - entry.openedAt) >= this.cooldownMs) {
        entry.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(modelName) {
    const entry = this._ensure(modelName);
    entry.state = 'CLOSED';
    entry.failures = 0;
    entry.openedAt = null;
  }

  recordFailure(modelName, nowMs = Date.now()) {
    const entry = this._ensure(modelName);
    entry.failures += 1;
    if (entry.state === 'HALF_OPEN' || entry.failures >= this.failureThreshold) {
      entry.state = 'OPEN';
      entry.openedAt = nowMs;
    }
  }

  getState(modelName, nowMs = Date.now()) {
    const entry = this._ensure(modelName);
    if (entry.state === 'OPEN' && entry.openedAt !== null && (nowMs - entry.openedAt) >= this.cooldownMs) {
      return { state: 'HALF_OPEN', failures: entry.failures, openedAt: entry.openedAt };
    }
    return { ...entry };
  }
}

function trimHistoryToBudget(history, maxTurns = 10, maxChars = 4000) {
  if (!Array.isArray(history) || history.length === 0) return [];
  const kept = [];
  let usedChars = 0;
  for (let i = history.length - 1; i >= 0 && kept.length < maxTurns; i--) {
    const item = history[i];
    if (!item || typeof item.text !== 'string' || !item.text.trim()) continue;
    const text = item.text.trim();
    if (kept.length > 0 && usedChars + text.length > maxChars) break;
    const clippedText = text.length > maxChars ? text.slice(0, maxChars) : text;
    kept.push({
      role: item.role === 'user' ? 'user' : 'model',
      text: clippedText
    });
    usedChars += clippedText.length;
  }
  return kept.reverse();
}

function stripEmptyValues(val) {
  if (val === null || val === undefined || val === '') return undefined;
  if (Array.isArray(val)) {
    const cleaned = val.map(stripEmptyValues).filter(v => v !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      const cleaned = stripEmptyValues(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return val;
}

function compactToolPayload(data, maxChars = 3200) {
  const cleaned = stripEmptyValues(data);
  if (cleaned === undefined) return {};
  let serialized = JSON.stringify(cleaned);
  if (serialized.length <= maxChars) return cleaned;

  if (typeof cleaned === 'object' && !Array.isArray(cleaned)) {
    const trimmedObj = { ...cleaned };
    const arrayKeys = Object.keys(trimmedObj).filter(k => Array.isArray(trimmedObj[k]));
    for (const k of arrayKeys) {
      while (trimmedObj[k].length > 1 && JSON.stringify(trimmedObj).length > maxChars) {
        trimmedObj[k] = trimmedObj[k].slice(0, Math.max(1, Math.floor(trimmedObj[k].length / 2)));
        trimmedObj.truncated = true;
      }
    }
    if (JSON.stringify(trimmedObj).length <= maxChars) return trimmedObj;
  }

  return {
    truncated: true,
    summary: serialized.slice(0, Math.max(64, maxChars - 40)) + '…'
  };
}

function buildSemanticCacheKey(message, scope = 'global') {
  const normalized = String(message || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const digest = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  return `ai_l0_${scope}_${digest}`;
}

module.exports = {
  deriveEncryptionKey,
  encryptAgentPayload,
  decryptAgentPayload,
  redactPiiForLlm,
  sanitizeUntrustedDbText,
  scanAndSanitizeAgentOutput,
  verifyAgronomySafetyReply,
  AgentRateLimiter,
  AgentBulkhead,
  ModelCircuitBreaker,
  trimHistoryToBudget,
  compactToolPayload,
  buildSemanticCacheKey
};
