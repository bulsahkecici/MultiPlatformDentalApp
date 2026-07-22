const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Writable } = require('stream');
const { pipeline } = require('stream/promises');
const config = require('../src/config');

const MAGIC = Buffer.from('DENTBAK1');
const HEADER_BYTES = MAGIC.length + 12;
const TAG_BYTES = 16;

function encryptionKey() {
  const value = config.security.backupEncryptionKey;
  if (!value || value.length < 32) {
    throw new Error(
      'BACKUP_ENCRYPTION_KEY must contain at least 32 characters',
    );
  }
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function childExit(child) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`pg_restore exited with code ${code}: ${stderr.trim()}`),
        );
    });
  });
}

async function readMetadata(filePath) {
  const stat = await fs.promises.stat(filePath);
  if (stat.size <= HEADER_BYTES + TAG_BYTES)
    throw new Error('Backup is truncated');
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const header = Buffer.alloc(HEADER_BYTES);
    const tag = Buffer.alloc(TAG_BYTES);
    await handle.read(header, 0, header.length, 0);
    await handle.read(tag, 0, tag.length, stat.size - TAG_BYTES);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error('Unsupported backup format');
    }
    return { stat, iv: header.subarray(MAGIC.length), tag };
  } finally {
    await handle.close();
  }
}

async function main() {
  const input = process.argv[2];
  const confirmation = process.argv.find((arg) =>
    arg.startsWith('--confirm-database='),
  );
  if (!input || confirmation !== `--confirm-database=${config.db.name}`) {
    throw new Error(
      `Usage: npm run db:restore -- <file.dump.enc> --confirm-database=${config.db.name}`,
    );
  }
  const inputPath = path.resolve(input);
  const { stat, iv, tag } = await readMetadata(inputPath);
  const createDecipher = () => {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      iv,
    );
    decipher.setAuthTag(tag);
    return decipher;
  };

  // GCM etiketi akışın sonunda doğrulanır. Veriyi pg_restore'a vermeden önce
  // ayrı bir geçişte doğrulayarak bozuk/manipüle edilmiş bir yedeğin veritabanını
  // kısmen değiştirmesini önleriz; düz metin hiçbir aşamada diske yazılmaz.
  const verificationStream = fs.createReadStream(inputPath, {
    start: HEADER_BYTES,
    end: stat.size - TAG_BYTES - 1,
  });
  await pipeline(
    verificationStream,
    createDecipher(),
    new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    }),
  );

  const restore = spawn(
    process.env.PG_RESTORE_BIN || 'pg_restore',
    [
      '--host',
      config.db.host,
      '--port',
      String(config.db.port),
      '--username',
      config.db.user,
      '--dbname',
      config.db.name,
      '--clean',
      '--if-exists',
      '--no-owner',
    ],
    { env: { ...process.env, PGPASSWORD: config.db.pass }, windowsHide: true },
  );

  const encrypted = fs.createReadStream(inputPath, {
    start: HEADER_BYTES,
    end: stat.size - TAG_BYTES - 1,
  });
  await Promise.all([
    pipeline(encrypted, createDecipher(), restore.stdin),
    childExit(restore),
  ]);
  console.log(`Database ${config.db.name} restored from encrypted backup.`);
}

main().catch((error) => {
  console.error(`Restore failed: ${error.message}`);
  process.exitCode = 1;
});
