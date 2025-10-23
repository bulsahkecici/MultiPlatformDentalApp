const dotenv = require('dotenv');
const path = require('path');

// Load environment variables if .env exists (repo only ships .env.example)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '')
    return defaultValue;
  return String(value).toLowerCase() === 'true';
}

function parseList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT) || 3000,
  cors: {
    origins: parseList(process.env.CORS_ORIGINS), // e.g. https://app.example.com,https://admin.example.com
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || '',
    enableDemoAuth: parseBoolean(process.env.ENABLE_DEMO_AUTH, false),
  },
  db: {
    server: process.env.DB_SERVER || '',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 1433,
    pool: {
      max: process.env.DB_POOL_MAX ? Number(process.env.DB_POOL_MAX) : 10,
      min: process.env.DB_POOL_MIN ? Number(process.env.DB_POOL_MIN) : 0,
      idleTimeoutMillis: process.env.DB_POOL_IDLE
        ? Number(process.env.DB_POOL_IDLE)
        : 30000,
    },
    options: {
      encrypt: true, // Required for Azure / production per rules
      trustServerCertificate: false, // Do not relax TLS by default
    },
    connectionTimeout: process.env.DB_CONN_TIMEOUT
      ? Number(process.env.DB_CONN_TIMEOUT)
      : 10000,
    requestTimeout: process.env.DB_REQ_TIMEOUT
      ? Number(process.env.DB_REQ_TIMEOUT)
      : 15000,
  },
};

module.exports = config;
