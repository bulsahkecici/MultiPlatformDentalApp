const crypto = require('crypto');
const config = require('../config');

const key = crypto
  .createHash('sha256')
  .update(config.security.dataEncryptionKey, 'utf8')
  .digest();

function encryptText(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted]
    .map((part) => part.toString('base64url'))
    .join('.');
}

function decryptText(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid protected value');
  const [iv, tag, encrypted] = parts.map((part) =>
    Buffer.from(part, 'base64url'),
  );
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
}

function hashRecoveryCode(value) {
  return crypto
    .createHash('sha256')
    .update(String(value).trim().toUpperCase())
    .digest('hex');
}

module.exports = { encryptText, decryptText, hashRecoveryCode };
