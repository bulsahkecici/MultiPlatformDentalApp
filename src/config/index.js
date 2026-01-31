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
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  cors: {
    origins: parseList(process.env.CORS_ORIGINS), // e.g. https://app.example.com,https://admin.example.com
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    enableDemoAuth: parseBoolean(process.env.ENABLE_DEMO_AUTH, false),
    // Account lockout settings
    maxFailedAttempts: Number(process.env.MAX_FAILED_ATTEMPTS) || 5,
    lockoutDurationMinutes: Number(process.env.LOCKOUT_DURATION_MINUTES) || 15,
    // Password policy
    passwordMinLength: Number(process.env.PASSWORD_MIN_LENGTH) || 8,
    requirePasswordComplexity: parseBoolean(
      process.env.REQUIRE_PASSWORD_COMPLEXITY,
      true,
    ),
    passwordHistoryCount: Number(process.env.PASSWORD_HISTORY_COUNT) || 3,
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
  email: {
    enabled: parseBoolean(process.env.EMAIL_ENABLED, false),
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: parseBoolean(process.env.EMAIL_SECURE, false),
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@dentalapp.com',
  },
};

module.exports = config;
