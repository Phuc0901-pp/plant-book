const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'tbsg_agtech_enterprise_secret_key_2026_plantbook';
const KEY = crypto.createHash('sha256').update(SECRET).digest();

function encodeUserId(userId) {
  if (!userId) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);

  const payload = JSON.stringify({
    uid: parseInt(userId),
    t: Date.now(),
    nonce: crypto.randomBytes(4).toString('hex')
  });

  let encrypted = cipher.update(payload, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `usr_${iv.toString('hex')}_${encrypted}_${tag}`;
}

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
