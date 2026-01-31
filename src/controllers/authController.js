const bcrypt = require('bcryptjs');
const validator = require('validator');
const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { parseRolesCsv } = require('../utils/roles');
const { validatePasswordStrength, isPasswordReused } = require('../utils/passwordValidator');
const {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  verifyEmailVerificationToken,
  verifyPasswordResetToken,
} = require('../utils/tokenManager');
const {
  checkAccountLock,
  recordFailedAttempt,
  resetFailedAttempts,
  getClientIp,
} = require('../middlewares/accountLockout');
const { logAuthEvent, AuditEventType } = require('../utils/auditLogger');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} = require('../utils/emailService');
const config = require('../config');

/**
 * Login endpoint
 * Returns access token and refresh token
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    // Validate input
    if (!email || !password) {
      return next(new AppError('Email and password are required', 400));
    }

    if (!validator.isEmail(email)) {
      return next(new AppError('Invalid email format', 400));
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    // Check if account is locked
    const lockStatus = await checkAccountLock(email);
    if (lockStatus.locked) {
      const minutesRemaining = Math.ceil(
        (lockStatus.unlockAt - new Date()) / 1000 / 60,
      );

      await logAuthEvent({
        eventType: AuditEventType.LOGIN_FAILED,
        userId: null,
        email,
        ipAddress,
        userAgent,
        success: false,
        reason: 'Account locked',
      });

      return next(
        new AppError(
          `Account is locked. Please try again in ${minutesRemaining} minutes.`,
          403,
        ),
      );
    }

    // Get user from database
    const result = await query(
      `SELECT id, email, password_hash, roles, email_verified, deleted_at 
       FROM users WHERE email = $1`,
      [email],
    );

    const user = result.rows && result.rows[0];

    // Check if user exists and is not deleted
    if (!user || user.deleted_at) {
      await recordFailedAttempt(email, ipAddress, userAgent);

      await logAuthEvent({
        eventType: AuditEventType.LOGIN_FAILED,
        userId: null,
        email,
        ipAddress,
        userAgent,
        success: false,
        reason: 'Invalid credentials',
      });

      return next(new AppError('Invalid credentials', 401));
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      const failureResult = await recordFailedAttempt(email, ipAddress, userAgent);

      await logAuthEvent({
        eventType: AuditEventType.LOGIN_FAILED,
        userId: user.id,
        email,
        ipAddress,
        userAgent,
        success: false,
        reason: 'Invalid password',
      });

      if (failureResult.locked) {
        return next(
          new AppError(
            `Too many failed attempts. Account locked for ${config.security.lockoutDurationMinutes} minutes.`,
            403,
          ),
        );
      }

      return next(new AppError('Invalid credentials', 401));
    }

    // Check if email is verified (if email service is enabled)
    if (config.email.enabled && !user.email_verified) {
      return next(
        new AppError(
          'Please verify your email address before logging in',
          403,
        ),
      );
    }

    // Reset failed login attempts
    await resetFailedAttempts(email);

    // Update last login time
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [
      user.id,
    ]);

    // Generate tokens
    const roles = parseRolesCsv(user.roles);
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      roles,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token
    await storeRefreshToken(user.id, refreshToken, userAgent, ipAddress);

    // Log successful login
    await logAuthEvent({
      eventType: AuditEventType.LOGIN_SUCCESS,
      userId: user.id,
      email,
      ipAddress,
      userAgent,
      success: true,
    });

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        roles,
      },
    });
  } catch (err) {
    return next(new AppError('Login failed', 500));
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
      return next(new AppError('Refresh token is required', 400));
    }

    // Verify refresh token
    const tokenData = await verifyRefreshToken(refreshToken);
    if (!tokenData) {
      return next(new AppError('Invalid or expired refresh token', 401));
    }

    // Generate new access token
    const roles = parseRolesCsv(tokenData.roles);
    const tokenPayload = {
      sub: tokenData.id,
      email: tokenData.email,
      roles,
    };

    const newAccessToken = generateAccessToken(tokenPayload);

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    // Log token refresh
    await logAuthEvent({
      eventType: AuditEventType.TOKEN_REFRESH,
      userId: tokenData.id,
      email: tokenData.email,
      ipAddress,
      userAgent,
      success: true,
    });

    return res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (err) {
    return next(new AppError('Token refresh failed', 401));
  }
}

/**
 * Logout - revoke refresh token
 */
async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body || {};

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    if (req.user) {
      await logAuthEvent({
        eventType: AuditEventType.LOGOUT,
        userId: req.user.sub,
        email: req.user.email,
        ipAddress,
        userAgent,
        success: true,
      });
    }

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    return next(new AppError('Logout failed', 500));
  }
}

/**
 * Request password reset email
 */
async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body || {};

    if (!email || !validator.isEmail(email)) {
      return next(new AppError('Valid email is required', 400));
    }

    // Get user
    const result = await query(
      'SELECT id, email, deleted_at FROM users WHERE email = $1',
      [email],
    );

    const user = result.rows && result.rows[0];

    // Always return success to prevent email enumeration
    // But only send email if user exists and is not deleted
    if (user && !user.deleted_at) {
      const resetToken = await generatePasswordResetToken(user.id);

      if (config.email.enabled) {
        await sendPasswordResetEmail(email, resetToken);
      }

      const ipAddress = getClientIp(req);
      const userAgent = req.headers['user-agent'] || '';

      await logAuthEvent({
        eventType: AuditEventType.PASSWORD_RESET_REQUEST,
        userId: user.id,
        email,
        ipAddress,
        userAgent,
        success: true,
      });
    }

    return res.status(200).json({
      message: 'If the email exists, a password reset link has been sent',
    });
  } catch (err) {
    return next(new AppError('Password reset request failed', 500));
  }
}

/**
 * Reset password using token
 */
async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return next(new AppError('Token and new password are required', 400));
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return next(
        new AppError('Password does not meet requirements', 400, {
          errors: passwordValidation.errors,
        }),
      );
    }

    // Verify reset token
    const user = await verifyPasswordResetToken(token);
    if (!user) {
      return next(new AppError('Invalid or expired reset token', 400));
    }

    // Check password history
    const historyResult = await query(
      `SELECT password_hash FROM password_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [user.id, config.security.passwordHistoryCount],
    );

    const previousHashes = historyResult.rows.map((row) => row.password_hash);
    const isReused = await isPasswordReused(newPassword, previousHashes, bcrypt.compare);

    if (isReused) {
      return next(
        new AppError(
          `Password cannot be one of your last ${config.security.passwordHistoryCount} passwords`,
          400,
        ),
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await query(
      `UPDATE users 
       SET password_hash = $1, 
           password_reset_token = NULL, 
           password_reset_expires = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, user.id],
    );

    // Add to password history
    await query(
      'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
      [user.id, passwordHash],
    );

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    await logAuthEvent({
      eventType: AuditEventType.PASSWORD_RESET_COMPLETE,
      userId: user.id,
      email: user.email,
      ipAddress,
      userAgent,
      success: true,
    });

    return res.status(200).json({
      message: 'Password reset successfully',
    });
  } catch (err) {
    return next(new AppError('Password reset failed', 500));
  }
}

/**
 * Verify email address
 */
async function verifyEmail(req, res, next) {
  try {
    const { token } = req.params;

    if (!token) {
      return next(new AppError('Verification token is required', 400));
    }

    // Verify token
    const user = await verifyEmailVerificationToken(token);
    if (!user) {
      return next(new AppError('Invalid or expired verification token', 400));
    }

    // Mark email as verified
    await query(
      `UPDATE users 
       SET email_verified = true,
           email_verification_token = NULL,
           email_verification_expires = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id],
    );

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    await logAuthEvent({
      eventType: AuditEventType.EMAIL_VERIFICATION,
      userId: user.id,
      email: user.email,
      ipAddress,
      userAgent,
      success: true,
    });

    // Send welcome email
    if (config.email.enabled) {
      await sendWelcomeEmail(user.email);
    }

    return res.status(200).json({
      message: 'Email verified successfully',
    });
  } catch (err) {
    return next(new AppError('Email verification failed', 500));
  }
}

/**
 * Resend verification email
 */
async function resendVerification(req, res, next) {
  try {
    const { email } = req.body || {};

    if (!email || !validator.isEmail(email)) {
      return next(new AppError('Valid email is required', 400));
    }

    // Get user
    const result = await query(
      `SELECT id, email, email_verified, deleted_at 
       FROM users WHERE email = $1`,
      [email],
    );

    const user = result.rows && result.rows[0];

    // Always return success to prevent email enumeration
    if (user && !user.deleted_at && !user.email_verified) {
      const verificationToken = await generateEmailVerificationToken(user.id);

      if (config.email.enabled) {
        await sendVerificationEmail(email, verificationToken);
      }
    }

    return res.status(200).json({
      message: 'If the email exists and is unverified, a verification link has been sent',
    });
  } catch (err) {
    return next(new AppError('Failed to resend verification email', 500));
  }
}

module.exports = {
  login,
  refreshToken,
  logout,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerification,
};
