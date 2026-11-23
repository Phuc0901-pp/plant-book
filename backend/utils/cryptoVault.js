const crypto = require('crypto');

const VAULT_PREFIX = 'enc:gcm:v1:';

function getVaultKey() {
  const rawSecret = process.env.CONFIG_VAULT_SECRET || process.env.JWT_SECRET || 'tanbao-config-vault-dev-key';
  return crypto.createHash('sha256').update(String(rawSecret)).digest();
}

function isEncryptedSecret(value) {
  return typeof value === 'string' && value.startsWith(VAULT_PREFIX);
}

function encryptSecret(plaintext) {
  if (plaintext === undefined || plaintext === null) return '';
  const str = String(plaintext);
  if (!str) return '';
  if (isEncryptedSecret(str)) return str;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getVaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VAULT_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSecret(value) {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (!str) return '';
  if (!isEncryptedSecret(str)) return str;
  const payload = str.slice(VAULT_PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) {
    const err = new Error('VAULT_TAMPERED_OR_INVALID_KEY');
    err.code = 'VAULT_TAMPERED_OR_INVALID_KEY';
    throw err;
  }
  const [ivHex, tagHex, cipherHex] = parts;
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(cipherHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getVaultKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (_) {
    const err = new Error('VAULT_TAMPERED_OR_INVALID_KEY');
    err.code = 'VAULT_TAMPERED_OR_INVALID_KEY';
    throw err;
  }
}

module.exports = {
  VAULT_PREFIX,
  getVaultKey,
  encryptSecret,
  decryptSecret,
  isEncryptedSecret
};
