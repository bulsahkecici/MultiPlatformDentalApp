const bcrypt = require('bcryptjs');
const validator = require('validator');
const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { parseRolesCsv, serializeRolesCsv } = require('../utils/roles');
const { validatePasswordStrength, isPasswordReused } = require('../utils/passwordValidator');
const { generateEmailVerificationToken } = require('../utils/tokenManager');
const { sendVerificationEmail } = require('../utils/emailService');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');
const config = require('../config');

/**
 * Create new user
 * Admin only
 */
async function createUser(req, res, next) {
    try {
        const { email, password, roles = [] } = req.body || {};

        // Validate input
        if (!email || !validator.isEmail(email)) {
            return next(new AppError('Valid email is required', 400));
        }

        if (!password) {
            return next(new AppError('Password is required', 400));
        }

        // Validate password strength
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
            return next(
                new AppError('Password does not meet requirements', 400, {
                    errors: passwordValidation.errors,
                }),
            );
        }

        // Check if user already exists
        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return next(new AppError('User with this email already exists', 409));
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        const rolesCsv = serializeRolesCsv(roles);

        // Create user
        const result = await query(
            `INSERT INTO users (email, password_hash, roles, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, roles, email_verified, created_at`,
            [email, passwordHash, rolesCsv, !config.email.enabled], // Auto-verify if email disabled
        );

        const user = result.rows[0];

        // Send verification email if enabled
        if (config.email.enabled) {
            const verificationToken = await generateEmailVerificationToken(user.id);
            await sendVerificationEmail(email, verificationToken);
        }

        // Add to password history
        await query(
            'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
            [user.id, passwordHash],
        );

        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        await logDataEvent({
            eventType: AuditEventType.USER_CREATED,
            userId: req.user.sub,
            ipAddress,
            userAgent,
            resourceType: 'user',
            resourceId: user.id,
            changes: { email, roles },
        });

        return res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                roles: parseRolesCsv(user.roles),
                emailVerified: user.email_verified,
                createdAt: user.created_at,
            },
        });
    } catch (err) {
        return next(new AppError('Failed to create user', 500));
    }
}

/**
 * Get all users with pagination and filtering
 * Admin only
 */
async function getUsers(req, res, next) {
    try {
        const { page = 1, limit = 20, search = '', role = '' } = req.query;

        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const conditions = ['deleted_at IS NULL'];
        const params = [];
        let paramIndex = 1;

        // Search by email
        if (search) {
            conditions.push(`email ILIKE $${paramIndex++}`);
            params.push(`%${search}%`);
        }

        // Filter by role
        if (role) {
            conditions.push(`roles LIKE $${paramIndex++}`);
            params.push(`%${role}%`);
        }

        const whereClause = conditions.join(' AND ');

        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) FROM users WHERE ${whereClause}`,
            params,
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // Get users
        params.push(parseInt(limit, 10), offset);
        const result = await query(
            `SELECT id, email, roles, email_verified, last_login_at, created_at, updated_at
       FROM users
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            params,
        );

        const users = result.rows.map((user) => ({
            id: user.id,
            email: user.email,
            roles: parseRolesCsv(user.roles),
            emailVerified: user.email_verified,
            lastLoginAt: user.last_login_at,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
        }));

        return res.status(200).json({
            users,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total,
                pages: Math.ceil(total / parseInt(limit, 10)),
            },
        });
    } catch (err) {
        return next(new AppError('Failed to fetch users', 500));
    }
}

/**
 * Get single user by ID
 * Self or admin
 */
async function getUserById(req, res, next) {
    try {
        const userId = parseInt(req.params.id, 10);

        const result = await query(
            `SELECT id, email, roles, email_verified, last_login_at, created_at, updated_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
            [userId],
        );

        if (result.rows.length === 0) {
            return next(new AppError('User not found', 404));
        }

        const user = result.rows[0];

        return res.status(200).json({
            user: {
                id: user.id,
                email: user.email,
                roles: parseRolesCsv(user.roles),
                emailVerified: user.email_verified,
                lastLoginAt: user.last_login_at,
                createdAt: user.created_at,
                updatedAt: user.updated_at,
            },
        });
    } catch (err) {
        return next(new AppError('Failed to fetch user', 500));
    }
}

/**
 * Update user
 * Self or admin
 */
async function updateUser(req, res, next) {
    try {
        const userId = parseInt(req.params.id, 10);
        const { email } = req.body || {};

        // Only allow email updates for now (roles handled separately)
        if (!email || !validator.isEmail(email)) {
            return next(new AppError('Valid email is required', 400));
        }

        // Check if email is already taken by another user
        const existing = await query(
            'SELECT id FROM users WHERE email = $1 AND id != $2',
            [email, userId],
        );

        if (existing.rows.length > 0) {
            return next(new AppError('Email already in use', 409));
        }

        // Update user
        const result = await query(
            `UPDATE users 
       SET email = $1, email_verified = false, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, email, roles, email_verified, updated_at`,
            [email, userId],
        );

        if (result.rows.length === 0) {
            return next(new AppError('User not found', 404));
        }

        const user = result.rows[0];

        // Send new verification email
        if (config.email.enabled) {
            const verificationToken = await generateEmailVerificationToken(user.id);
            await sendVerificationEmail(email, verificationToken);
        }

        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        await logDataEvent({
            eventType: AuditEventType.USER_UPDATED,
            userId: req.user.sub,
            ipAddress,
            userAgent,
            resourceType: 'user',
            resourceId: userId,
            changes: { email },
        });

        return res.status(200).json({
            user: {
                id: user.id,
                email: user.email,
                roles: parseRolesCsv(user.roles),
                emailVerified: user.email_verified,
                updatedAt: user.updated_at,
            },
        });
    } catch (err) {
        return next(new AppError('Failed to update user', 500));
    }
}

/**
 * Delete user (soft delete)
 * Admin only
 */
async function deleteUser(req, res, next) {
    try {
        const userId = parseInt(req.params.id, 10);

        // Prevent self-deletion
        if (req.user.sub === userId) {
            return next(new AppError('Cannot delete your own account', 400));
        }

        const result = await query(
            `UPDATE users 
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
            [userId],
        );

        if (result.rows.length === 0) {
            return next(new AppError('User not found', 404));
        }

        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        await logDataEvent({
            eventType: AuditEventType.USER_DELETED,
            userId: req.user.sub,
            ipAddress,
            userAgent,
            resourceType: 'user',
            resourceId: userId,
        });

        return res.status(200).json({
            message: 'User deleted successfully',
        });
    } catch (err) {
        return next(new AppError('Failed to delete user', 500));
    }
}

/**
 * Change password
 * Self only
 */
async function changePassword(req, res, next) {
    try {
        const userId = parseInt(req.params.id, 10);
        const { currentPassword, newPassword } = req.body || {};

        if (!currentPassword || !newPassword) {
            return next(new AppError('Current and new passwords are required', 400));
        }

        // Validate new password strength
        const passwordValidation = validatePasswordStrength(newPassword);
        if (!passwordValidation.valid) {
            return next(
                new AppError('Password does not meet requirements', 400, {
                    errors: passwordValidation.errors,
                }),
            );
        }

        // Get user
        const result = await query(
            'SELECT id, password_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
            [userId],
        );

        if (result.rows.length === 0) {
            return next(new AppError('User not found', 404));
        }

        const user = result.rows[0];

        // Verify current password
        const passwordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!passwordValid) {
            return next(new AppError('Current password is incorrect', 401));
        }

        // Check password history
        const historyResult = await query(
            `SELECT password_hash FROM password_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
            [userId, config.security.passwordHistoryCount],
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

        // Update password
        await query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, userId],
        );

        // Add to password history
        await query(
            'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
            [userId, passwordHash],
        );

        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        await logDataEvent({
            eventType: AuditEventType.PASSWORD_CHANGE,
            userId: req.user.sub,
            ipAddress,
            userAgent,
            resourceType: 'user',
            resourceId: userId,
        });

        return res.status(200).json({
            message: 'Password changed successfully',
        });
    } catch (err) {
        return next(new AppError('Failed to change password', 500));
    }
}

/**
 * Update user roles
 * Admin only
 */
async function updateRoles(req, res, next) {
    try {
        const userId = parseInt(req.params.id, 10);
        const { roles } = req.body || {};

        if (!Array.isArray(roles)) {
            return next(new AppError('Roles must be an array', 400));
        }

        const rolesCsv = serializeRolesCsv(roles);

        const result = await query(
            `UPDATE users 
       SET roles = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, email, roles`,
            [rolesCsv, userId],
        );

        if (result.rows.length === 0) {
            return next(new AppError('User not found', 404));
        }

        const user = result.rows[0];

        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        await logDataEvent({
            eventType: AuditEventType.USER_ROLE_CHANGED,
            userId: req.user.sub,
            ipAddress,
            userAgent,
            resourceType: 'user',
            resourceId: userId,
            changes: { roles },
        });

        return res.status(200).json({
            user: {
                id: user.id,
                email: user.email,
                roles: parseRolesCsv(user.roles),
            },
        });
    } catch (err) {
        return next(new AppError('Failed to update roles', 500));
    }
}

module.exports = {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    changePassword,
    updateRoles,
};
