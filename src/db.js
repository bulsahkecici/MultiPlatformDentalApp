const { Pool, types } = require('pg');
const config = require('./config');
const logger = require('./utils/logger');

// PostgreSQL DATE (OID 1082) varsayılan olarak yerel gece yarısı bir JS Date
// nesnesine ayrıştırılır; bu nesne JSON'a çevrilirken toISOString() UTC'ye
// kaydırır. UTC'nin doğusundaki (ör. Türkiye, UTC+3) sunucularda bu, her
// appointment/treatment/doğum tarihinin API yanıtlarında bir gün geriye
// kaymasına yol açar (örn. 2026-07-20 -> "2026-07-19T21:00:00.000Z"). DATE
// kolonlarını ham 'YYYY-MM-DD' string olarak döndürerek bunu önlüyoruz.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.pass,
  max: config.db.max,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  ssl: config.db.ssl
    ? { rejectUnauthorized: config.db.sslRejectUnauthorized }
    : undefined,
});

pool.on('error', (err) => {
  logger.error({ err }, 'PostgreSQL pool error');
});

async function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Birden fazla yazmayı tek bir atomik işlemde çalıştırır.
 * `fn` bir `client` alır (BEGIN yapılmış); `fn` içindeki tüm sorgular bu
 * client üzerinden çalıştırılmalıdır (üstteki `query()` değil — o ayrı bir
 * bağlantı kullanır ve aynı transaction'a dahil olmaz).
 * `fn` hata fırlatırsa ROLLBACK yapılır ve hata olduğu gibi yeniden fırlatılır.
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error({ err: rollbackErr }, 'Failed to rollback transaction');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function pingDb() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    logger.warn({ err }, 'PostgreSQL ping failed');
    return false;
  }
}

module.exports = { pool, query, pingDb, withTransaction };
