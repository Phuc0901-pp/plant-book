const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'tbsg_agtech_enterprise_secret_key_2026_plantbook';
const KEY = crypto.createHash('sha256').update(SECRET).digest(); // 32 bytes for AES-256

/**
 * Encrypt a numeric or string user ID into a secure URL-safe token (usr_...)
 * Uses AES-256-GCM with authenticated tag
 */
function encodeUserId(userId) {
  if (!userId) return null;
  const iv = crypto.randomBytes(12); // 12 bytes IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  
  const payload = JSON.stringify({
    uid: parseInt(userId),
    t: Date.now(),
    nonce: crypto.randomBytes(4).toString('hex')
  });

  let encrypted = cipher.update(payload, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  // Format: usr_[iv].[encrypted].[tag] (URL-safe)
  return `usr_${iv.toString('hex')}_${encrypted}_${tag}`;
}

/**
 * Decrypt a secure URL-safe token back to user ID
 * Returns null if invalid or tampered
 */
function decodeUserId(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('usr_')) {
    return null;
  }
  try {
    const parts = token.replace('usr_', '').split('_');
    if (parts.length !== 3) return null;

    const [ivHex, encryptedHex, tagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const data = JSON.parse(decrypted);
    return data && data.uid ? data.uid : null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  encodeUserId,
  decodeUserId
};
