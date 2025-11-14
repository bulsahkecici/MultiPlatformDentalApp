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
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    enableDemoAuth: parseBoolean(process.env.ENABLE_DEMO_AUTH, false),
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    name: process.env.DB_NAME || 'dentalappdb',
    user: process.env.DB_USER || 'dentaluser',
    pass: process.env.DB_PASS || 'StrongPass123!',
    ssl: parseBoolean(process.env.DB_SSL, false),
    max: process.env.DB_POOL_MAX ? Number(process.env.DB_POOL_MAX) : 10,
    idleTimeoutMillis: process.env.DB_POOL_IDLE
      ? Number(process.env.DB_POOL_IDLE)
      : 30000,
  },
};

module.exports = config;
