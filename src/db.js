const { Pool } = require('pg');
const config = require('./config');
const logger = require('./utils/logger');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.pass,
  max: config.db.max,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  logger.error({ err }, 'PostgreSQL pool error');
});

async function query(text, params = []) {
  return pool.query(text, params);
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

module.exports = { pool, query, pingDb };
