const sql = require('mssql');
const config = require('./config');
const logger = require('./utils/logger');

let poolPromise;

function getMssqlConfig() {
  const { db } = config;
  return {
    server: db.server,
    user: db.user,
    password: db.password,
    database: db.database,
    port: db.port,
    pool: db.pool,
    options: db.options,
    connectionTimeout: db.connectionTimeout,
    requestTimeout: db.requestTimeout,
  };
}

async function getPool() {
  if (!poolPromise) {
    const conf = getMssqlConfig();
    poolPromise = sql
      .connect(conf)
      .then((pool) => {
        logger.info('MSSQL connected');
        pool.on('error', (err) => {
          logger.error({ err }, 'MSSQL pool error');
        });
        return pool;
      })
      .catch((err) => {
        logger.error({ err }, 'MSSQL connection error');
        poolPromise = undefined; // allow retry on next call
        throw err;
      });
  }
  return poolPromise;
}

async function pingDb() {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT 1 AS ok');
    return result && result.recordset && result.recordset[0]?.ok === 1;
  } catch (err) {
    logger.warn({ err }, 'MSSQL ping failed');
    return false;
  }
}

module.exports = { getPool, pingDb };
