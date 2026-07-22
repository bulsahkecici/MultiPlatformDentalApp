const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const config = require('../config');

const MAGIC = Buffer.from('DENTDOC1');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const key = crypto
  .createHash('sha256')
  .update(config.security.dataEncryptionKey, 'utf8')
  .digest();

function storageRoot() {
  return path.resolve(process.cwd(), config.storage.documentDir);
}

function resolveStoragePath(storageKey) {
  if (!/^[a-f0-9-]+\.enc$/i.test(storageKey)) {
    throw new Error('Invalid document storage key');
  }
  const root = storageRoot();
  const resolved = path.resolve(root, storageKey);
  if (path.dirname(resolved) !== root) {
    throw new Error('Document path escaped storage root');
  }
  return resolved;
}

async function storeEncryptedDocument(buffer) {
  const root = storageRoot();
  await fs.mkdir(root, { recursive: true });

  const storageKey = `${crypto.randomUUID()}.enc`;
  const finalPath = resolveStoragePath(storageKey);
  const tempPath = `${finalPath}.tmp`;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([MAGIC, iv, tag, encrypted]);

  try {
    await fs.writeFile(tempPath, payload, { flag: 'wx', mode: 0o600 });
    await fs.rename(tempPath, finalPath);
  } catch (err) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw err;
  }

  return {
    storageKey,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

async function readEncryptedDocument(storageKey, expectedSha256) {
  const payload = await fs.readFile(resolveStoragePath(storageKey));
  const minimumLength = MAGIC.length + IV_BYTES + TAG_BYTES;
  if (
    payload.length < minimumLength ||
    !payload.subarray(0, MAGIC.length).equals(MAGIC)
  ) {
    throw new Error('Invalid encrypted document format');
  }

  let offset = MAGIC.length;
  const iv = payload.subarray(offset, offset + IV_BYTES);
  offset += IV_BYTES;
  const tag = payload.subarray(offset, offset + TAG_BYTES);
  offset += TAG_BYTES;
  const encrypted = payload.subarray(offset);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  const actualSha256 = crypto
    .createHash('sha256')
    .update(decrypted)
    .digest('hex');
  if (expectedSha256 && actualSha256 !== expectedSha256) {
    throw new Error('Document integrity check failed');
  }
  return decrypted;
}

async function deleteEncryptedDocument(storageKey) {
  await fs.rm(resolveStoragePath(storageKey), { force: true });
}

module.exports = {
  storeEncryptedDocument,
  readEncryptedDocument,
  deleteEncryptedDocument,
};
