const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../db');
const { AppError } = require('../utils/errorResponder');
const {
  createMfaEnrollment,
  generateRecoveryCodes,
  checkTotp,
  verifyMfaCode,
  hashRecoveryCode,
} = require('../services/mfaService');
const { logAuthEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');

async function getMfaStatus(req, res, next) {
  try {
    const result = await query(
      'SELECT mfa_enabled FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.user.sub],
    );
    if (result.rows.length === 0) throw new AppError('User not found', 404);
    return res.status(200).json({ enabled: result.rows[0].mfa_enabled });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to read MFA status', 500));
  }
}

async function setupMfa(req, res, next) {
  try {
    const user = await query(
      'SELECT id, email, mfa_enabled FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.user.sub],
    );
    if (user.rows.length === 0) throw new AppError('User not found', 404);
    if (user.rows[0].mfa_enabled) {
      throw new AppError('MFA is already enabled', 409);
    }
    const enrollment = createMfaEnrollment(user.rows[0].email);
    await query(
      `UPDATE users SET mfa_pending_secret_encrypted = $1, updated_at = NOW()
       WHERE id = $2`,
      [enrollment.encryptedSecret, req.user.sub],
    );
    return res.status(200).json({
      secret: enrollment.secret,
      otpauthUrl: enrollment.otpauthUrl,
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to start MFA setup', 500));
  }
}

async function enableMfa(req, res, next) {
  try {
    const code = String(req.body?.code || '').trim();
    if (!code) throw new AppError('MFA verification code is required', 400);
    const user = await query(
      `SELECT id, email, mfa_pending_secret_encrypted
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [req.user.sub],
    );
    if (user.rows.length === 0) throw new AppError('User not found', 404);
    const pendingSecret = user.rows[0].mfa_pending_secret_encrypted;
    if (!pendingSecret)
      throw new AppError('MFA setup has not been started', 409);
    if (!checkTotp(pendingSecret, code)) {
      throw new AppError('Invalid MFA verification code', 401);
    }

    const recoveryCodes = generateRecoveryCodes();
    const recoveryHashes = recoveryCodes.map(hashRecoveryCode);
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE users
         SET mfa_enabled = true,
             mfa_secret_encrypted = mfa_pending_secret_encrypted,
             mfa_pending_secret_encrypted = NULL,
             mfa_recovery_codes = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(recoveryHashes), req.user.sub],
      );
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [
        req.user.sub,
      ]);
    });

    await logAuthEvent({
      eventType: AuditEventType.MFA_ENABLED,
      userId: req.user.sub,
      email: user.rows[0].email,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      success: true,
    });
    return res.status(200).json({ enabled: true, recoveryCodes });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to enable MFA', 500));
  }
}

async function disableMfa(req, res, next) {
  try {
    const { password, code } = req.body || {};
    if (!password || !code) {
      throw new AppError('Password and MFA code are required', 400);
    }
    const userResult = await query(
      `SELECT id, email, password_hash, mfa_enabled, mfa_secret_encrypted,
              mfa_recovery_codes
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [req.user.sub],
    );
    if (userResult.rows.length === 0) throw new AppError('User not found', 404);
    const user = userResult.rows[0];
    if (!user.mfa_enabled) throw new AppError('MFA is not enabled', 409);
    if (!(await bcrypt.compare(password, user.password_hash))) {
      throw new AppError('Current password is incorrect', 401);
    }
    if (!(await verifyMfaCode(user, code, query))) {
      throw new AppError('Invalid MFA code', 401);
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE users
         SET mfa_enabled = false, mfa_secret_encrypted = NULL,
             mfa_pending_secret_encrypted = NULL, mfa_recovery_codes = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [req.user.sub],
      );
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [
        req.user.sub,
      ]);
    });
    await logAuthEvent({
      eventType: AuditEventType.MFA_DISABLED,
      userId: req.user.sub,
      email: user.email,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      success: true,
    });
    return res.status(200).json({ enabled: false });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to disable MFA', 500));
  }
}

module.exports = { getMfaStatus, setupMfa, enableMfa, disableMfa };
