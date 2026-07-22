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

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

function parseTrustProxy(value) {
  if (value === undefined || value === null || value === '') {
    // Production reverse proxy aynı makinede çalışır; yalnızca loopback'ten
    // gelen X-Forwarded-* başlıklarına güvenilir. Geliştirmede proxy yoktur.
    return isProduction ? 'loopback' : false;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'false') return false;
  if (normalized === 'true') return true;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  const entries = parseList(value);
  return entries.length > 1 ? entries : entries[0];
}

// Production'da dev fallback sırlarıyla çalışmayı reddet (fail-fast)
if (isProduction) {
  const problems = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret') {
    problems.push('JWT_SECRET must be set to a strong secret in production');
  }
  if (!process.env.DB_PASS || process.env.DB_PASS === 'StrongPass123!') {
    problems.push(
      'DB_PASS must be set to a non-default password in production',
    );
  }
  if (String(process.env.TRUST_PROXY || '').toLowerCase() === 'true') {
    problems.push(
      'TRUST_PROXY=true trusts arbitrary proxy headers; use loopback or explicit proxy CIDRs',
    );
  }
  if (
    parseBoolean(process.env.DB_SSL, false) &&
    !parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, true)
  ) {
    problems.push(
      'DB_SSL_REJECT_UNAUTHORIZED must remain true in production when DB_SSL is enabled',
    );
  }
  if (
    !process.env.DATA_ENCRYPTION_KEY ||
    process.env.DATA_ENCRYPTION_KEY.length < 32
  ) {
    problems.push(
      'DATA_ENCRYPTION_KEY must be set to a strong value in production',
    );
  }
  if (
    !process.env.BACKUP_ENCRYPTION_KEY ||
    process.env.BACKUP_ENCRYPTION_KEY.length < 32
  ) {
    problems.push(
      'BACKUP_ENCRYPTION_KEY must be set to a strong value in production',
    );
  }
  if (problems.length > 0) {
    console.error('FATAL configuration errors:\n- ' + problems.join('\n- '));
    process.exit(1);
  }
}

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT) || 3000,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  cors: {
    origins:
      parseList(process.env.CORS_ORIGINS).length > 0
        ? parseList(process.env.CORS_ORIGINS)
        : ['http://localhost:4200', 'http://localhost:3000'], // Default for development
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    // Refresh token'lar ayrı bir secret ile imzalanır (tanımlı değilse
    // JWT_SECRET'a düşer) — access token doğrulaması bu secret'ı hiç
    // tanımadığından, refresh token'ın kendisi API'ye Bearer olarak asla
    // kabul edilmez (bkz. tokenType kontrolü, middlewares/auth.js).
    jwtRefreshSecret:
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'dev-secret',
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
    dataEncryptionKey:
      process.env.DATA_ENCRYPTION_KEY ||
      'development-data-encryption-key-change-me',
    backupEncryptionKey:
      process.env.BACKUP_ENCRYPTION_KEY ||
      'development-backup-encryption-key-change-me',
    mfaRequiredRoles:
      parseList(process.env.MFA_REQUIRED_ROLES).length > 0
        ? parseList(process.env.MFA_REQUIRED_ROLES)
        : isProduction
          ? ['admin', 'dentist']
          : [],
  },
  storage: {
    documentDir: process.env.DOCUMENT_STORAGE_DIR || 'data/patient-documents',
    documentMaxBytes: process.env.DOCUMENT_MAX_BYTES
      ? Number(process.env.DOCUMENT_MAX_BYTES)
      : 20 * 1024 * 1024,
  },
  backup: {
    directory: process.env.BACKUP_DIR || 'backups',
    retentionDays: Number(process.env.BACKUP_RETENTION_DAYS) || 30,
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    name: process.env.DB_NAME || 'dentalappdb',
    user: process.env.DB_USER || 'dentaluser',
    pass: process.env.DB_PASS || 'StrongPass123!',
    ssl: parseBoolean(process.env.DB_SSL, false),
    sslRejectUnauthorized: parseBoolean(
      process.env.DB_SSL_REJECT_UNAUTHORIZED,
      true,
    ),
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
  business: {
    // Bu orandan yüksek manuel indirim talepleri sekreter tarafından
    // doğrudan uygulanamaz — patron onayı bekleyen bir işlem (financial_transactions,
    // status='pending_approval') olarak kaydedilir. Admin/patron için eşik uygulanmaz.
    highDiscountApprovalThresholdPercent:
      Number(process.env.HIGH_DISCOUNT_THRESHOLD_PERCENT) || 20,
  },
};

module.exports = config;
