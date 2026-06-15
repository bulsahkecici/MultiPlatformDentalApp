const bcrypt = require('bcryptjs');
const validator = require('validator');
const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { parseRolesCsv, serializeRolesCsv } = require('../utils/roles');
const {
  validatePasswordStrength,
  isPasswordReused,
} = require('../utils/passwordValidator');
const { generateEmailVerificationToken } = require('../utils/tokenManager');
const { sendVerificationEmail } = require('../utils/emailService');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');
const config = require('../config');

/**
 * Yeni kullanıcı oluşturur
 * Yalnızca admin
 */
async function createUser(req, res, next) {
  try {
    const {
      email,
      password,
      roles = [],
      firstName,
      lastName,
      phone,
      tcNo,
      address,
      iban,
      salary,
      commissionRate,
      university,
      diplomaDate,
      diplomaNo,
      specializations, // Array of specialization names
    } = req.body || {};

    // Girdiyi doğrula
    if (!email || !validator.isEmail(email)) {
      return next(new AppError('Valid email is required', 400));
    }

    if (!password) {
      return next(new AppError('Password is required', 400));
    }

    // Parola güçlülüğünü doğrula
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return next(
        new AppError('Password does not meet requirements', 400, {
          errors: passwordValidation.errors,
        }),
      );
    }

    // Role özgü doğrulamalar
    const isDentist = roles.includes('dentist');
    const isSecretary = roles.includes('secretary');

    if (isDentist) {
      if (
        !firstName ||
        !lastName ||
        !phone ||
        !tcNo ||
        !university ||
        !diplomaNo
      ) {
        return next(
          new AppError(
            'Doktor için ad, soyad, telefon, TC No, üniversite ve diploma no gereklidir',
            400,
          ),
        );
      }
    } else if (isSecretary) {
      if (!firstName || !lastName || !phone || !tcNo) {
        return next(
          new AppError(
            'Sekreter için ad, soyad, telefon ve TC No gereklidir',
            400,
          ),
        );
      }
    } else if (roles.includes('admin')) {
      if (!firstName || !lastName || !phone) {
        return next(
          new AppError('Patron için ad, soyad ve telefon gereklidir', 400),
        );
      }
    }

    // Kullanıcının zaten var olup olmadığını kontrol et
    const existing = await query('SELECT id FROM users WHERE email = $1', [
      email,
    ]);
    if (existing.rows.length > 0) {
      return next(new AppError('User with this email already exists', 409));
    }

    // Parolayı hash'le
    const passwordHash = await bcrypt.hash(password, 10);
    const rolesCsv = serializeRolesCsv(roles);
    const specializationsCsv =
      specializations && Array.isArray(specializations)
        ? specializations.join(',')
        : null;

    // Kullanıcıyı ek alanlarla oluştur
    const result = await query(
      `INSERT INTO users (
                email, password_hash, roles, email_verified, 
                first_name, last_name, phone, tc_no, address, iban, 
                salary, commission_rate, university, diploma_date, diploma_no, specializations,
                created_at, updated_at
            )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
       RETURNING id, email, roles, email_verified, created_at`,
      [
        email,
        passwordHash,
        rolesCsv,
        !config.email.enabled,
        firstName || null,
        lastName || null,
        phone || null,
        tcNo || null,
        address || null,
        iban || null,
        salary || null,
        commissionRate || null,
        university || null,
        diplomaDate || null,
        diplomaNo || null,
        specializationsCsv,
      ],
    );

    const user = result.rows[0];

    // Etkinse doğrulama e-postası gönder
    if (config.email.enabled) {
      const verificationToken = await generateEmailVerificationToken(user.id);
      await sendVerificationEmail(email, verificationToken);
    }

    // Parola geçmişine ekle
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
 * Tüm kullanıcıları sayfalama ve filtreleme ile getirir
 * Yalnızca admin
 */
async function getUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, search = '', role = '' } = req.query;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    const isSecretary = req.user.roles && req.user.roles.includes('secretary');

    // Sekreter, yalnızca randevu ekranları için hekim listesini sorgulayabilir.
    if (!isAdmin && isSecretary && role !== 'dentist') {
      return next(new AppError('Forbidden', 403));
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    // E-postaya göre ara
    if (search) {
      conditions.push(`email ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }

    // Role göre filtrele
    if (role) {
      conditions.push(`roles LIKE $${paramIndex++}`);
      params.push(`%${role}%`);
    }

    const whereClause = conditions.join(' AND ');

    // Toplam sayıyı al
    const countResult = await query(
      `SELECT COUNT(*) FROM users WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Kullanıcıları al (first_name, last_name, phone, tc_no users tablosunda)
    params.push(parseInt(limit, 10), offset);
    const result = await query(
      `SELECT id, email, roles, email_verified, last_login_at, created_at, updated_at,
                    first_name, last_name, phone, tc_no
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
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      phone: isAdmin ? user.phone || '' : '',
      tcNo: isAdmin ? user.tc_no || '' : '',
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
 * ID'ye göre tek bir kullanıcı getirir
 * Kendisi veya admin
 */
async function getUserById(req, res, next) {
  try {
    const userId = parseInt(req.params.id, 10);

    const result = await query(
      `SELECT id, email, roles, email_verified, first_name, last_name, phone, tc_no,
              address, iban, salary, commission_rate, university, diploma_date, diploma_no,
              specializations, last_login_at, created_at, updated_at
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
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        tcNo: user.tc_no,
        address: user.address,
        iban: user.iban,
        salary: user.salary,
        commissionRate: user.commission_rate,
        university: user.university,
        diplomaDate: user.diploma_date,
        diplomaNo: user.diploma_no,
        specializations: user.specializations,
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
 * Kullanıcıyı günceller
 * Kendisi veya admin
 */
async function updateUser(req, res, next) {
  try {
    const userId = parseInt(req.params.id, 10);
    const body = req.body || {};
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    const fieldMap = {
      email: 'email',
      firstName: 'first_name',
      lastName: 'last_name',
      phone: 'phone',
      tcNo: 'tc_no',
      address: 'address',
      iban: 'iban',
      university: 'university',
      diplomaNo: 'diploma_no',
      diplomaDate: 'diploma_date',
      specializations: 'specializations',
    };

    const adminOnlyFields = {
      salary: 'salary',
      commissionRate: 'commission_rate',
    };

    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (body.email) {
      if (!validator.isEmail(body.email)) {
        return next(new AppError('Valid email is required', 400));
      }
      const existing = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [body.email, userId],
      );
      if (existing.rows.length > 0) {
        return next(new AppError('Email already in use', 409));
      }
      setClauses.push(`email = $${paramIndex++}`);
      params.push(body.email);
      if (config.email.enabled) {
        setClauses.push('email_verified = false');
      }
    }

    Object.entries(fieldMap).forEach(([camel, snake]) => {
      if (body[camel] !== undefined && camel !== 'email') {
        setClauses.push(`${snake} = $${paramIndex++}`);
        params.push(body[camel]);
      }
    });

    if (isAdmin) {
      Object.entries(adminOnlyFields).forEach(([camel, snake]) => {
        if (body[camel] !== undefined) {
          setClauses.push(`${snake} = $${paramIndex++}`);
          params.push(body[camel]);
        }
      });
    }

    if (setClauses.length === 0) {
      return next(new AppError('No valid fields to update', 400));
    }

    setClauses.push('updated_at = NOW()');
    params.push(userId);

    const result = await query(
      `UPDATE users SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING id, email, roles, email_verified, first_name, last_name, phone,
                 commission_rate, salary, updated_at`,
      params,
    );

    if (result.rows.length === 0) {
      return next(new AppError('User not found', 404));
    }

    const user = result.rows[0];

    if (body.email && config.email.enabled) {
      const verificationToken = await generateEmailVerificationToken(user.id);
      await sendVerificationEmail(user.email, verificationToken);
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
      changes: body,
    });

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        roles: parseRolesCsv(user.roles),
        emailVerified: user.email_verified,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        commissionRate: user.commission_rate,
        salary: user.salary,
        updatedAt: user.updated_at,
      },
    });
  } catch (err) {
    return next(new AppError('Failed to update user', 500));
  }
}

/**
 * Kullanıcıyı siler (mantıksal silme / soft delete)
 * Yalnızca admin
 */
async function deleteUser(req, res, next) {
  try {
    const userId = parseInt(req.params.id, 10);

    // Kendini silmeyi engelle
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
 * Parolayı değiştirir
 * Yalnızca kendisi
 */
async function changePassword(req, res, next) {
  try {
    const userId = parseInt(req.params.id, 10);
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return next(new AppError('Current and new passwords are required', 400));
    }

    // Yeni parola güçlülüğünü doğrula
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return next(
        new AppError('Password does not meet requirements', 400, {
          errors: passwordValidation.errors,
        }),
      );
    }

    // Kullanıcıyı al
    const result = await query(
      'SELECT id, password_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId],
    );

    if (result.rows.length === 0) {
      return next(new AppError('User not found', 404));
    }

    const user = result.rows[0];

    // Mevcut parolayı doğrula
    const passwordValid = await bcrypt.compare(
      currentPassword,
      user.password_hash,
    );
    if (!passwordValid) {
      return next(new AppError('Current password is incorrect', 401));
    }

    // Parola geçmişini kontrol et
    const historyResult = await query(
      `SELECT password_hash FROM password_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, config.security.passwordHistoryCount],
    );

    const previousHashes = historyResult.rows.map((row) => row.password_hash);
    const isReused = await isPasswordReused(
      newPassword,
      previousHashes,
      bcrypt.compare,
    );

    if (isReused) {
      return next(
        new AppError(
          `Password cannot be one of your last ${config.security.passwordHistoryCount} passwords`,
          400,
        ),
      );
    }

    // Yeni parolayı hash'le
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Parolayı güncelle
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId],
    );

    // Parola geçmişine ekle
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
 * Kullanıcı rollerini günceller
 * Yalnızca admin
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
