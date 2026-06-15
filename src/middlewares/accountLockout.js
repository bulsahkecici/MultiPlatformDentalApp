const { query } = require('../db');
const logger = require('../utils/logger');
const { logAuthEvent, AuditEventType } = require('../utils/auditLogger');
const config = require('../config');

const MAX_FAILED_ATTEMPTS = config.security.maxFailedAttempts;
const LOCKOUT_DURATION_MS = config.security.lockoutDurationMinutes * 60 * 1000;

/**
 * İstekten istemci IP adresini alır
 * @param {Object} req - Express isteği
 * @returns {string} IP adresi
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Hesabın kilitli olup olmadığını kontrol eder
 * @param {string} email - Kullanıcı e-postası
 * @returns {Promise<Object>} { locked: boolean, unlockAt: Date|null }
 */
async function checkAccountLock(email) {
  const result = await query(
    `SELECT failed_login_attempts, account_locked_until 
     FROM users 
     WHERE email = $1`,
    [email],
  );

  if (result.rows.length === 0) {
    return { locked: false, unlockAt: null };
  }

  const user = result.rows[0];
  const now = new Date();

  // Hesabın şu anda kilitli olup olmadığını kontrol et
  if (user.account_locked_until && new Date(user.account_locked_until) > now) {
    return {
      locked: true,
      unlockAt: new Date(user.account_locked_until),
    };
  }

  // Kilit süresi dolmuşsa sayacı sıfırla
  if (user.account_locked_until && new Date(user.account_locked_until) <= now) {
    await query(
      `UPDATE users 
       SET failed_login_attempts = 0, account_locked_until = NULL 
       WHERE email = $1`,
      [email],
    );
    return { locked: false, unlockAt: null };
  }

  return { locked: false, unlockAt: null };
}

/**
 * Başarısız giriş denemesini kaydeder
 * @param {string} email - Kullanıcı e-postası
 * @param {string} ipAddress - IP adresi
 * @param {string} userAgent - Kullanıcı aracısı (user agent)
 * @returns {Promise<Object>} { locked: boolean, attempts: number, unlockAt: Date|null }
 */
async function recordFailedAttempt(email, ipAddress, userAgent) {
  // Başarısız deneme sayısını artır
  const result = await query(
    `UPDATE users 
     SET failed_login_attempts = failed_login_attempts + 1 
     WHERE email = $1 
     RETURNING id, failed_login_attempts`,
    [email],
  );

  if (result.rows.length === 0) {
    // Kullanıcı yok, ancak bunu açığa çıkarma
    return { locked: false, attempts: 0, unlockAt: null };
  }

  const user = result.rows[0];
  const attempts = user.failed_login_attempts;

  // Maksimum denemeye ulaşıldıysa hesabı kilitle
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    const unlockAt = new Date(Date.now() + LOCKOUT_DURATION_MS);

    await query(
      `UPDATE users 
       SET account_locked_until = $1 
       WHERE email = $2`,
      [unlockAt, email],
    );

    // Hesap kilitlemeyi günlüğe yaz
    await logAuthEvent({
      eventType: AuditEventType.ACCOUNT_LOCKED,
      userId: user.id,
      email,
      ipAddress,
      userAgent,
      success: true,
      reason: `Account locked after ${attempts} failed attempts`,
    });

    logger.warn(
      { email, attempts, unlockAt, ipAddress },
      'Account locked due to failed login attempts',
    );

    return { locked: true, attempts, unlockAt };
  }

  return { locked: false, attempts, unlockAt: null };
}

/**
 * Başarısız giriş denemelerini sıfırlar (başarılı girişte)
 * @param {string} email - Kullanıcı e-postası
 * @returns {Promise<void>}
 */
async function resetFailedAttempts(email) {
  await query(
    `UPDATE users 
     SET failed_login_attempts = 0, account_locked_until = NULL 
     WHERE email = $1`,
    [email],
  );
}

/**
 * Girişten önce hesap kilitlemesini kontrol eden ara katman (middleware)
 */
function checkLockout(req, res, next) {
  // Bu, login controller içinde çağrılacak
  // authController'da kullanılmak üzere dışa aktarıldı
  next();
}

module.exports = {
  getClientIp,
  checkAccountLock,
  recordFailedAttempt,
  resetFailedAttempts,
  checkLockout,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
};
