const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const config = require('../src/config');

const MAGIC = Buffer.from('DENTBAK1');
const IV_BYTES = 12;

function encryptionKey() {
  const value = config.security.backupEncryptionKey;
  if (!value || value.length < 32) {
    throw new Error(
      'BACKUP_ENCRYPTION_KEY must contain at least 32 characters',
    );
  }
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function childExit(child, label) {
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
          new Error(`${label} exited with code ${code}: ${stderr.trim()}`),
        );
    });
  });
}

async function applyRetention(backupDir) {
  const cutoff = Date.now() - config.backup.retentionDays * 24 * 60 * 60 * 1000;
  const entries = await fs.promises.readdir(backupDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isFile() && /^dentalapp-.*\.dump\.enc$/.test(entry.name),
      )
      .map(async (entry) => {
        const target = path.join(backupDir, entry.name);
        const stat = await fs.promises.stat(target);
        if (stat.mtimeMs < cutoff) await fs.promises.unlink(target);
      }),
  );
}

async function main() {
  const backupDir = path.resolve(config.backup.directory);
  await fs.promises.mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const requestedPath = process.argv[2];
  const outputPath = requestedPath
    ? path.resolve(requestedPath)
    : path.join(backupDir, `dentalapp-${timestamp}.dump.enc`);
  if (!outputPath.endsWith('.dump.enc')) {
    throw new Error('Backup output must end with .dump.enc');
  }
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const output = fs.createWriteStream(outputPath, { flags: 'wx', mode: 0o600 });
  output.write(Buffer.concat([MAGIC, iv]));

  const dump = spawn(
    process.env.PG_DUMP_BIN || 'pg_dump',
    [
      '--host',
      config.db.host,
      '--port',
      String(config.db.port),
      '--username',
      config.db.user,
      '--format=custom',
      '--no-owner',
      config.db.name,
    ],
    { env: { ...process.env, PGPASSWORD: config.db.pass }, windowsHide: true },
  );

  try {
    await Promise.all([
      pipeline(dump.stdout, cipher, output),
      childExit(dump, 'pg_dump'),
    ]);
    await fs.promises.appendFile(outputPath, cipher.getAuthTag());
    if (path.dirname(outputPath) === backupDir) await applyRetention(backupDir);
    console.log(`Encrypted backup created: ${outputPath}`);
  } catch (error) {
    await fs.promises.rm(outputPath, { force: true });
    throw error;
  }
}

main().catch((error) => {
  console.error(`Backup failed: ${error.message}`);
  process.exitCode = 1;
});
