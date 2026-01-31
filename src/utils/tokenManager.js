const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { query } = require('../db');
const logger = require('./logger');

// Token expiry times
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
const EMAIL_VERIFICATION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_EXPIRY = 60 * 60 * 1000; // 1 hour

/**
 * Generate access token (short-lived)
 * @param {Object} payload - User data to encode
 * @returns {string} JWT access token
 */
function generateAccessToken(payload) {
    return jwt.sign(payload, config.security.jwtSecret, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
    });
}

/**
 * Generate refresh token (long-lived)
 * @param {Object} payload - User data to encode
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(payload) {
    return jwt.sign(payload, config.security.jwtSecret, {
        expiresIn: REFRESH_TOKEN_EXPIRY,
    });
}

/**
 * Verify JWT token
 * @param {string} token - Token to verify
 * @returns {Object|null} Decoded payload or null if invalid
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
 * Generate secure random token for email verification or password reset
 * @returns {string} Hex token
 */
function generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Store refresh token in database
 * @param {number} userId - User ID
 * @param {string} token - Refresh token
 * @param {string} userAgent - User agent string
 * @param {string} ipAddress - IP address
 * @returns {Promise<void>}
 */
async function storeRefreshToken(userId, token, userAgent, ipAddress) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
        [userId, token, expiresAt, userAgent, ipAddress],
    );
}

/**
 * Verify refresh token exists in database and is not expired
 * @param {string} token - Refresh token
 * @returns {Promise<Object|null>} Token data or null if invalid
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

    // Check if user is deleted
    if (tokenData.deleted_at) {
        return null;
    }

    return tokenData;
}

/**
 * Revoke refresh token (logout)
 * @param {string} token - Refresh token to revoke
 * @returns {Promise<void>}
 */
async function revokeRefreshToken(token) {
    await query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1`,
        [token],
    );
}

/**
 * Revoke all refresh tokens for a user
 * @param {number} userId - User ID
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
 * Clean up expired tokens (should be run periodically)
 * @returns {Promise<number>} Number of tokens deleted
 */
async function cleanupExpiredTokens() {
    const result = await query(
        `DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '30 days'`,
    );
    return result.rowCount || 0;
}

/**
 * Generate email verification token and store in database
 * @param {number} userId - User ID
 * @returns {Promise<string>} Verification token
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
 * Generate password reset token and store in database
 * @param {number} userId - User ID
 * @returns {Promise<string>} Reset token
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
 * Verify email verification token
 * @param {string} token - Verification token
 * @returns {Promise<Object|null>} User data or null if invalid
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
 * Verify password reset token
 * @param {string} token - Reset token
 * @returns {Promise<Object|null>} User data or null if invalid
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
