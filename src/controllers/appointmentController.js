const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');
const { isDentist } = require('../middlewares/auth');
const logger = require('../utils/logger');
const { notifyAppointment } = require('../services/notificationHub');

/**
 * Hekimin yalnızca kendi randevusuna erişmesini garanti eder
 */
function assertDentistOwnsAppointment(req, appointment) {
  if (isDentist(req) && appointment.dentist_id !== req.user.sub) {
    return false;
  }
  return true;
}

/**
 * Yeni randevu oluşturur
 */
async function createAppointment(req, res, next) {
  try {
    logger.info({ body: req.body, user: req.user }, 'Creating appointment');

    const {
      patientId,
      dentistId,
      appointmentDate,
      startTime,
      endTime,
      appointmentType,
      status,
      notes,
    } = req.body || {};

    // Zorunlu alanları doğrula
    if (!patientId || !appointmentDate || !startTime || !endTime) {
      logger.warn(
        { body: req.body },
        'Missing required fields for appointment',
      );
      return next(
        new AppError(
          'Patient ID, appointment date, start time, and end time are required',
          400,
        ),
      );
    }

    // Çakışmaları kontrol et
    const conflictCheck = await query(
      `SELECT id FROM appointments 
       WHERE dentist_id = $1 
       AND appointment_date = $2 
       AND status NOT IN ('cancelled', 'no_show')
       AND (
         (start_time <= $3 AND end_time > $3) OR
         (start_time < $4 AND end_time >= $4) OR
         (start_time >= $3 AND end_time <= $4)
       )`,
      [dentistId || req.user.sub, appointmentDate, startTime, endTime],
    );

    if (conflictCheck.rows.length > 0) {
      return next(
        new AppError(
          'Bu tarih ve saatte zaten hasta randevusu bulunmaktadır',
          409,
        ),
      );
    }

    // Saat formatını doğrula
    if (
      typeof startTime !== 'string' ||
      !/^\d{2}:\d{2}:\d{2}$/.test(startTime)
    ) {
      logger.warn(
        { startTime, type: typeof startTime },
        'Invalid start time format',
      );
      return next(
        new AppError(
          `Invalid start time format. Expected HH:mm:ss, got: ${startTime} (type: ${typeof startTime})`,
          400,
        ),
      );
    }
    if (typeof endTime !== 'string' || !/^\d{2}:\d{2}:\d{2}$/.test(endTime)) {
      logger.warn({ endTime, type: typeof endTime }, 'Invalid end time format');
      return next(
        new AppError(
          `Invalid end time format. Expected HH:mm:ss, got: ${endTime} (type: ${typeof endTime})`,
          400,
        ),
      );
    }

    // Tarih formatını doğrula
    if (
      typeof appointmentDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)
    ) {
      return next(
        new AppError(
          'Invalid appointment date format. Expected YYYY-MM-DD',
          400,
        ),
      );
    }

    // Randevuyu oluştur
    let result;
    const insertParams = [
      patientId,
      dentistId || req.user.sub,
      appointmentDate,
      startTime,
      endTime,
      appointmentType || null,
      notes || null,
      status || 'scheduled',
      req.user.sub,
      req.user.sub,
    ];

    logger.info(
      { params: insertParams },
      'Inserting appointment into database',
    );

    try {
      result = await query(
        `INSERT INTO appointments (
            patient_id, dentist_id, appointment_date, start_time, end_time,
            appointment_type, notes, status, created_by, updated_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
          RETURNING id`,
        insertParams,
      );

      // Oluşturulan randevuyu hasta ve hekim bilgileriyle al
      if (result.rows.length > 0) {
        const appointmentId = result.rows[0].id;
        result = await query(
          `SELECT 
                a.*,
                p.first_name as patient_first_name,
                p.last_name as patient_last_name,
                p.email as patient_email,
                p.phone as patient_phone,
                u.email as dentist_email
               FROM appointments a
               LEFT JOIN patients p ON a.patient_id = p.id
               LEFT JOIN users u ON a.dentist_id = u.id
               WHERE a.id = $1`,
          [appointmentId],
        );
      }
    } catch (dbError) {
      logger.error(
        {
          dbError: {
            code: dbError.code,
            message: dbError.message,
            detail: dbError.detail,
            constraint: dbError.constraint,
          },
          params: insertParams,
        },
        'Database error while creating appointment',
      );

      // Veritabanına özgü hataları işle
      if (dbError.code === '23503') {
        // Foreign key violation
        return next(
          new AppError(
            `Invalid patient ID or dentist ID: ${dbError.detail || dbError.message}`,
            400,
          ),
        );
      }
      if (dbError.code === '23505') {
        // Unique violation
        return next(
          new AppError(
            `Appointment conflict detected: ${dbError.detail || dbError.message}`,
            409,
          ),
        );
      }
      if (dbError.code === '22007') {
        // Invalid datetime format
        return next(
          new AppError(
            `Invalid date or time format: ${dbError.detail || dbError.message}`,
            400,
          ),
        );
      }
      // Dıştaki catch tarafından yakalanması için yeniden fırlat
      throw dbError;
    }

    const appointment = result.rows[0];

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    await logDataEvent({
      eventType: AuditEventType.APPOINTMENT_CREATED,
      userId: req.user.sub,
      ipAddress,
      userAgent,
      resourceType: 'appointment',
      resourceId: appointment.id,
      changes: { patientId, appointmentDate, startTime, endTime },
    });

    const notifyIds = [appointment.dentist_id, req.user.sub].filter(Boolean);
    await notifyAppointment(
      'created',
      {
        id: appointment.id,
        appointmentDate: appointment.appointment_date,
        startTime: appointment.start_time,
      },
      [...new Set(notifyIds)],
    );

    return res.status(201).json({ appointment });
  } catch (err) {
    logger.error(
      {
        err: {
          message: err.message,
          code: err.code,
          detail: err.detail,
          constraint: err.constraint,
        },
        body: req.body,
        stack: err.stack,
      },
      'Failed to create appointment',
    );

    // Geliştirme ortamında daha fazla ayrıntı göster
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const errorMessage = isDevelopment
      ? `Failed to create appointment: ${err.message}`
      : 'Failed to create appointment';

    const errorDetails = isDevelopment
      ? {
          originalError: err.message,
          code: err.code,
          detail: err.detail,
          constraint: err.constraint,
          stack: err.stack,
        }
      : {
          originalError: err.message,
        };

    return next(new AppError(errorMessage, 500, errorDetails));
  }
}

/**
 * Randevuları filtreleyerek getirir
 */
async function getAppointments(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      patientId,
      dentistId,
      startDate,
      endDate,
      status,
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const conditions = []; // appointments tablosunda deleted_at yok
    const params = [];
    let paramIndex = 1;

    // Diş hekimi sadece kendi randevularını görebilir
    if (isDentist(req)) {
      conditions.push(`dentist_id = $${paramIndex++}`);
      params.push(req.user.sub);
    } else if (dentistId) {
      conditions.push(`dentist_id = $${paramIndex++}`);
      params.push(parseInt(dentistId, 10));
    }

    if (patientId) {
      conditions.push(`patient_id = $${paramIndex++}`);
      params.push(parseInt(patientId, 10));
    }

    if (startDate) {
      conditions.push(`appointment_date >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`appointment_date <= $${paramIndex++}`);
      params.push(endDate);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause =
      conditions.length > 0 ? conditions.join(' AND ') : '1=1';

    // Toplam sayıyı al
    const countResult = await query(
      `SELECT COUNT(*) FROM appointments WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Randevuları hasta ve hekim bilgileriyle al
    params.push(parseInt(limit, 10), offset);
    const result = await query(
      `SELECT 
        a.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        u.email as dentist_email
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN users u ON a.dentist_id = u.id
       WHERE ${whereClause}
       ORDER BY a.appointment_date DESC, a.start_time DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params,
    );

    return res.status(200).json({
      appointments: result.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch appointments');
    return next(new AppError('Failed to fetch appointments', 500));
  }
}

/**
 * ID'ye göre tek bir randevu getirir
 */
async function getAppointmentById(req, res, next) {
  try {
    const appointmentId = parseInt(req.params.id, 10);

    const result = await query(
      `SELECT 
        a.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.email as patient_email,
        p.phone as patient_phone,
        u.email as dentist_email
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN users u ON a.dentist_id = u.id
       WHERE a.id = $1`,
      [appointmentId],
    );

    if (result.rows.length === 0) {
      return next(new AppError('Appointment not found', 404));
    }

    if (!assertDentistOwnsAppointment(req, result.rows[0])) {
      return next(new AppError('Forbidden', 403));
    }

    return res.status(200).json({ appointment: result.rows[0] });
  } catch (err) {
    return next(new AppError('Failed to fetch appointment', 500));
  }
}

/**
 * Randevuyu günceller
 */
async function updateAppointment(req, res, next) {
  try {
    const appointmentId = parseInt(req.params.id, 10);
    const {
      patientId,
      dentistId,
      appointmentDate,
      startTime,
      endTime,
      status,
      appointmentType,
      notes,
      cancellationReason,
    } = req.body || {};

    // Güncelleme sorgusunu oluştur
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (appointmentDate) {
      setClauses.push(`appointment_date = $${paramIndex++}`);
      params.push(appointmentDate);
    }

    if (patientId) {
      setClauses.push(`patient_id = $${paramIndex++}`);
      params.push(patientId);
    }

    if (dentistId) {
      // Hekim kullanıcı randevuları başka bir hekime atayamaz.
      if (isDentist(req) && dentistId !== req.user.sub) {
        return next(new AppError('Forbidden', 403));
      }
      setClauses.push(`dentist_id = $${paramIndex++}`);
      params.push(dentistId);
    }

    if (startTime) {
      setClauses.push(`start_time = $${paramIndex++}`);
      params.push(startTime);
    }

    if (endTime) {
      setClauses.push(`end_time = $${paramIndex++}`);
      params.push(endTime);
    }

    if (status) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (appointmentType !== undefined) {
      setClauses.push(`appointment_type = $${paramIndex++}`);
      params.push(appointmentType);
    }

    if (notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }

    if (cancellationReason !== undefined) {
      setClauses.push(`cancellation_reason = $${paramIndex++}`);
      params.push(cancellationReason);
    }

    if (setClauses.length === 0) {
      return next(new AppError('No valid fields to update', 400));
    }

    const existingAppt = await query(
      'SELECT dentist_id FROM appointments WHERE id = $1',
      [appointmentId],
    );
    if (existingAppt.rows.length === 0) {
      return next(new AppError('Appointment not found', 404));
    }
    if (!assertDentistOwnsAppointment(req, existingAppt.rows[0])) {
      return next(new AppError('Forbidden', 403));
    }

    setClauses.push(`updated_by = $${paramIndex++}`);
    params.push(req.user.sub);
    setClauses.push('updated_at = NOW()');

    params.push(appointmentId);

    const result = await query(
      `UPDATE appointments 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      return next(new AppError('Appointment not found', 404));
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    await logDataEvent({
      eventType: AuditEventType.APPOINTMENT_UPDATED,
      userId: req.user.sub,
      ipAddress,
      userAgent,
      resourceType: 'appointment',
      resourceId: appointmentId,
      changes: req.body,
    });

    return res.status(200).json({ appointment: result.rows[0] });
  } catch (err) {
    return next(new AppError('Failed to update appointment', 500));
  }
}

/**
 * Randevuyu iptal eder
 */
async function cancelAppointment(req, res, next) {
  try {
    const appointmentId = parseInt(req.params.id, 10);
    const { cancellationReason } = req.body || {};

    const result = await query(
      `UPDATE appointments 
       SET status = 'cancelled',
           cancellation_reason = $1,
           updated_by = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [cancellationReason || null, req.user.sub, appointmentId],
    );

    if (result.rows.length === 0) {
      return next(new AppError('Appointment not found', 404));
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    await logDataEvent({
      eventType: AuditEventType.APPOINTMENT_CANCELLED,
      userId: req.user.sub,
      ipAddress,
      userAgent,
      resourceType: 'appointment',
      resourceId: appointmentId,
      changes: { status: 'cancelled', cancellationReason },
    });

    return res.status(200).json({ appointment: result.rows[0] });
  } catch (err) {
    return next(new AppError('Failed to cancel appointment', 500));
  }
}

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
};
