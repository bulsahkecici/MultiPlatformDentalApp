const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { query } = require('../db');
const logger = require('./logger');

// Token geçerlilik süreleri
const ACCESS_TOKEN_EXPIRY = '1h'; // 1 saat (15 dakikadan uzatıldı)
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 gün
const EMAIL_VERIFICATION_EXPIRY = 24 * 60 * 60 * 1000; // 24 saat
const PASSWORD_RESET_EXPIRY = 60 * 60 * 1000; // 1 saat

/**
 * Erişim token'ı (access token) üretir (kısa ömürlü)
 * @param {Object} payload - Kodlanacak kullanıcı verisi
 * @returns {string} JWT erişim token'ı
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, config.security.jwtSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Yenileme token'ı (refresh token) üretir (uzun ömürlü)
 * @param {Object} payload - Kodlanacak kullanıcı verisi
 * @returns {string} JWT yenileme token'ı
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, config.security.jwtSecret, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

/**
 * JWT token'ını doğrular
 * @param {string} token - Doğrulanacak token
 * @returns {Object|null} Çözülen payload veya geçersizse null
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.security.jwtSecret);
  } catch (err) {
    logger.debug({ err }, 'Token verification failed');
    return null;
  }
}

/**
 * E-posta doğrulama veya parola sıfırlama için güvenli rastgele token üretir
 * @returns {string} Hex token
 */
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Yenileme token'ını veritabanında saklar
 * @param {number} userId - Kullanıcı ID'si
 * @param {string} token - Yenileme token'ı
 * @param {string} userAgent - Kullanıcı aracısı (user agent) dizesi
 * @param {string} ipAddress - IP adresi
 * @returns {Promise<void>}
 */
async function storeRefreshToken(userId, token, userAgent, ipAddress) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 gün

  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, token, expiresAt, userAgent, ipAddress],
  );
}

/**
 * Yenileme token'ının veritabanında var olduğunu ve süresinin dolmadığını doğrular
 * @param {string} token - Yenileme token'ı
 * @returns {Promise<Object|null>} Token verisi veya geçersizse null
 */
async function verifyRefreshToken(token) {
  const result = await query(
    `SELECT rt.*, u.id, u.email, u.roles, u.email_verified, u.deleted_at
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
    [token],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const tokenData = result.rows[0];

  // Kullanıcının silinmiş olup olmadığını kontrol et
  if (tokenData.deleted_at) {
    return null;
  }

  return tokenData;
}

/**
 * Yenileme token'ını iptal eder (çıkış)
 * @param {string} token - İptal edilecek yenileme token'ı
 * @returns {Promise<void>}
 */
async function revokeRefreshToken(token) {
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1', [
    token,
  ]);
}

/**
 * Yenileme token'ını döndürür: eskisini iptal eder ve yenisini üretip saklar.
 * @param {string} currentToken - İstemci tarafından sağlanan yenileme token'ı
 * @param {string} userAgent - Kullanıcı aracısı (user agent) dizesi
 * @param {string} ipAddress - İstemci IP'si
 * @returns {Promise<{tokenData: object, newRefreshToken: string}|null>}
 */
async function rotateRefreshToken(currentToken, userAgent, ipAddress) {
  const tokenData = await verifyRefreshToken(currentToken);
  if (!tokenData) {
    return null;
  }

  // Yeniden kullanımı önlemek için eski token'ı iptal et
  await revokeRefreshToken(currentToken);

  const payload = {
    id: tokenData.user_id || tokenData.id,
    email: tokenData.email,
    roles: tokenData.roles,
  };

  const newRefreshToken = generateRefreshToken(payload);
  await storeRefreshToken(
    tokenData.user_id || tokenData.id,
    newRefreshToken,
    userAgent,
    ipAddress,
  );

  return { tokenData, newRefreshToken };
}

/**
 * Bir kullanıcının tüm yenileme token'larını iptal eder
 * @param {number} userId - Kullanıcı ID'si
 * @returns {Promise<void>}
 */
async function revokeAllUserTokens(userId) {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}

/**
 * Süresi dolmuş token'ları temizler (periyodik olarak çalıştırılmalı)
 * @returns {Promise<number>} Silinen token sayısı
 */
async function cleanupExpiredTokens() {
  const result = await query(
    "DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '30 days'",
  );
  return result.rowCount || 0;
}

/**
 * E-posta doğrulama token'ı üretir ve veritabanında saklar
 * @param {number} userId - Kullanıcı ID'si
 * @returns {Promise<string>} Doğrulama token'ı
 */
async function generateEmailVerificationToken(userId) {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY);

  await query(
    `UPDATE users
     SET email_verification_token = $1, email_verification_expires = $2
     WHERE id = $3`,
    [token, expiresAt, userId],
  );

  return token;
}

/**
 * Parola sıfırlama token'ı üretir ve veritabanında saklar
 * @param {number} userId - Kullanıcı ID'si
 * @returns {Promise<string>} Sıfırlama token'ı
 */
async function generatePasswordResetToken(userId) {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY);

  await query(
    `UPDATE users
     SET password_reset_token = $1, password_reset_expires = $2
     WHERE id = $3`,
    [token, expiresAt, userId],
  );

  return token;
}

/**
 * E-posta doğrulama token'ını doğrular
 * @param {string} token - Doğrulama token'ı
 * @returns {Promise<Object|null>} Kullanıcı verisi veya geçersizse null
 */
async function verifyEmailVerificationToken(token) {
  const result = await query(
    `SELECT id, email FROM users
     WHERE email_verification_token = $1
     AND email_verification_expires > NOW()
     AND email_verified = false`,
    [token],
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Parola sıfırlama token'ını doğrular
 * @param {string} token - Sıfırlama token'ı
 * @returns {Promise<Object|null>} Kullanıcı verisi veya geçersizse null
 */
async function verifyPasswordResetToken(token) {
  const result = await query(
    `SELECT id, email FROM users
     WHERE password_reset_token = $1
     AND password_reset_expires > NOW()`,
    [token],
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  generateSecureToken,
  storeRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  verifyEmailVerificationToken,
  verifyPasswordResetToken,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
};
