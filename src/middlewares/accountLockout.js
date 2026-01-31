const { query } = require('../db');
const logger = require('../utils/logger');
const { logAuthEvent, AuditEventType } = require('../utils/auditLogger');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Get client IP address from request
 * @param {Object} req - Express request
 * @returns {string} IP address
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
 * Check if account is locked
 * @param {string} email - User email
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

    // Check if account is currently locked
    if (user.account_locked_until && new Date(user.account_locked_until) > now) {
        return {
            locked: true,
            unlockAt: new Date(user.account_locked_until),
        };
    }

    // If lock has expired, reset the counter
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
 * Record failed login attempt
 * @param {string} email - User email
 * @param {string} ipAddress - IP address
 * @param {string} userAgent - User agent
 * @returns {Promise<Object>} { locked: boolean, attempts: number, unlockAt: Date|null }
 */
async function recordFailedAttempt(email, ipAddress, userAgent) {
    // Increment failed attempts
    const result = await query(
        `UPDATE users 
     SET failed_login_attempts = failed_login_attempts + 1 
     WHERE email = $1 
     RETURNING id, failed_login_attempts`,
        [email],
    );

    if (result.rows.length === 0) {
        // User doesn't exist, but don't reveal that
        return { locked: false, attempts: 0, unlockAt: null };
    }

    const user = result.rows[0];
    const attempts = user.failed_login_attempts;

    // Lock account if max attempts reached
    if (attempts >= MAX_FAILED_ATTEMPTS) {
        const unlockAt = new Date(Date.now() + LOCKOUT_DURATION_MS);

        await query(
            `UPDATE users 
       SET account_locked_until = $1 
       WHERE email = $2`,
            [unlockAt, email],
        );

        // Log account lockout
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
 * Reset failed login attempts (on successful login)
 * @param {string} email - User email
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
 * Middleware to check account lockout before login
 */
function checkLockout(req, res, next) {
    // This will be called in the login controller
    // Exported for use in authController
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
