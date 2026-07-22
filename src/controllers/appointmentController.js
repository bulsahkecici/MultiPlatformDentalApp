const { query, withTransaction } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');
const { isDentist } = require('../middlewares/auth');
const logger = require('../utils/logger');
const { notifyUser, notifyRole } = require('../services/notificationHub');

// Sadece "HH:mm:ss" şekline değil, gerçek saat/dakika/saniye aralığına da
// bakar — eski `\d{2}:\d{2}:\d{2}` deseni "09:60:00" gibi geçersiz bir saati
// de kabul ediyordu (bkz. web'deki slot hesaplama hatasının backend'de neden
// hiç yakalanmadığı).
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

function isValidTimeString(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

const NON_BLOCKING_STATUSES = ['cancelled', 'no_show'];

/**
 * Verilen dişhekimi+tarih+saat aralığı için, kendi ID'si hariç tutularak,
 * çakışan (iptal/no-show olmayan) bir randevu olup olmadığını kontrol eder.
 * Create ve update akışlarının ikisinde de aynı sorgu/kilit mantığını
 * kullanmak için ortak fonksiyona çıkarıldı.
 */
async function assertNoConflict(
  client,
  { dentistId, appointmentDate, startTime, endTime, excludeAppointmentId },
) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `appointment:${dentistId}:${appointmentDate}`,
  ]);

  const params = [dentistId, appointmentDate, startTime, endTime];
  let excludeClause = '';
  if (excludeAppointmentId) {
    params.push(excludeAppointmentId);
    excludeClause = `AND id <> $${params.length}`;
  }

  const conflictCheck = await client.query(
    `SELECT id FROM appointments
     WHERE dentist_id = $1
     AND appointment_date = $2
     AND status NOT IN ('cancelled', 'no_show')
     ${excludeClause}
     AND (
       (start_time <= $3 AND end_time > $3) OR
       (start_time < $4 AND end_time >= $4) OR
       (start_time >= $3 AND end_time <= $4)
     )`,
    params,
  );

  if (conflictCheck.rows.length > 0) {
    throw new AppError(
      'Bu tarih ve saatte zaten hasta randevusu bulunmaktadır',
      409,
    );
  }
}

/**
 * Randevu bildirimlerini gönderir (fire-and-forget; notify* kendi hatasını yakalar).
 * İlgili dişhekimine kalıcı bildirim, sekreterlere canlı yayın.
 */
function emitAppointmentNotification(action, appointment, actorUserId) {
  const titles = {
    created: 'Yeni randevu',
    updated: 'Randevu güncellendi',
    cancelled: 'Randevu iptal edildi',
  };
  const notification = {
    type: 'appointment',
    title: titles[action] || 'Randevu',
    message:
      `${appointment.appointment_date instanceof Date ? appointment.appointment_date.toISOString().split('T')[0] : appointment.appointment_date} ${appointment.start_time || ''}`.trim(),
    data: { appointmentId: appointment.id, action },
  };
  if (appointment.dentist_id && appointment.dentist_id !== actorUserId) {
    notifyUser(appointment.dentist_id, notification);
  }
  notifyRole('secretary', notification);
}

/**
 * Create new appointment
 */
async function createAppointment(req, res, next) {
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

  // Not: notes hasta sağlık bilgisi içerebilir — loglara hiçbir zaman
  // req.body'nin tamamı ya da notes alanı yazılmaz, sadece kimlik alanları.
  logger.info(
    {
      patientId,
      dentistId: dentistId || req.user.sub,
      appointmentDate,
      createdBy: req.user.sub,
    },
    'Creating appointment',
  );

  // Validate required fields
  if (!patientId || !appointmentDate || !startTime || !endTime) {
    return next(
      new AppError(
        'Patient ID, appointment date, start time, and end time are required',
        400,
      ),
    );
  }

  // Validate time format
  if (!isValidTimeString(startTime)) {
    return next(
      new AppError(
        `Invalid start time format. Expected HH:mm:ss (00-23:00-59:00-59), got: ${startTime}`,
        400,
      ),
    );
  }
  if (!isValidTimeString(endTime)) {
    return next(
      new AppError(
        `Invalid end time format. Expected HH:mm:ss (00-23:00-59:00-59), got: ${endTime}`,
        400,
      ),
    );
  }

  // Validate date format
  if (
    typeof appointmentDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)
  ) {
    return next(
      new AppError('Invalid appointment date format. Expected YYYY-MM-DD', 400),
    );
  }

  // Bitiş saati başlangıçtan sonra olmalı — aksi halde negatif/sıfır süreli
  // bir randevu veritabanına yazılabilirdi.
  if (endTime <= startTime) {
    return next(new AppError('End time must be after start time', 400));
  }

  const effectiveDentistId = dentistId || req.user.sub;
  const insertParams = [
    patientId,
    effectiveDentistId,
    appointmentDate,
    startTime,
    endTime,
    appointmentType || null,
    notes || null,
    status || 'scheduled',
    req.user.sub,
    req.user.sub,
  ];

  try {
    // Çakışma kontrolü + ekleme tek transaction içinde ve dişhekimi+tarih
    // bazında bir advisory lock ile serileştirilir. Bu olmadan iki eşzamanlı
    // istek çakışma kontrolünü birlikte geçip aynı slota iki randevu yazabilir
    // (klasik TOCTOU yarış durumu).
    const appointment = await withTransaction(async (client) => {
      await assertNoConflict(client, {
        dentistId: effectiveDentistId,
        appointmentDate,
        startTime,
        endTime,
      });

      const inserted = await client.query(
        `INSERT INTO appointments (
            patient_id, dentist_id, appointment_date, start_time, end_time,
            appointment_type, notes, status, created_by, updated_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
          RETURNING id`,
        insertParams,
      );

      const appointmentId = inserted.rows[0].id;
      const full = await client.query(
        `SELECT
              a.*,
              p.first_name as patient_first_name,
              p.last_name as patient_last_name,
              p.email as patient_email,
              p.phone as patient_phone,
              u.email as dentist_email,
              u.first_name as dentist_first_name,
              u.last_name as dentist_last_name
             FROM appointments a
             LEFT JOIN patients p ON a.patient_id = p.id
             LEFT JOIN users u ON a.dentist_id = u.id
             WHERE a.id = $1`,
        [appointmentId],
      );
      return full.rows[0];
    });

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

    emitAppointmentNotification('created', appointment, req.user.sub);

    return res.status(201).json({ appointment });
  } catch (err) {
    // Bilerek fırlatılan iş kuralı hataları (ör. 409 çakışma) doğrudan geçer
    if (err instanceof AppError) {
      return next(err);
    }

    logger.error(
      {
        err: {
          message: err.message,
          code: err.code,
          detail: err.detail,
          constraint: err.constraint,
        },
        patientId,
        appointmentDate,
      },
      'Failed to create appointment',
    );

    // Handle database-specific errors
    if (err.code === '23503') {
      // Foreign key violation
      return next(
        new AppError(
          `Invalid patient ID or dentist ID: ${err.detail || err.message}`,
          400,
        ),
      );
    }
    if (err.code === '23505') {
      // Unique violation
      return next(
        new AppError(
          `Appointment conflict detected: ${err.detail || err.message}`,
          409,
        ),
      );
    }
    if (err.code === '22007') {
      // Invalid datetime format
      return next(
        new AppError(
          `Invalid date or time format: ${err.detail || err.message}`,
          400,
        ),
      );
    }

    // In development, show more details
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
 * Get appointments with filtering
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
    const conditions = []; // appointments table doesn't have deleted_at
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

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM appointments WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get appointments with patient and dentist info
    params.push(parseInt(limit, 10), offset);
    const result = await query(
      `SELECT 
        a.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        u.email as dentist_email,
        u.first_name as dentist_first_name,
        u.last_name as dentist_last_name
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
 * Get single appointment by ID
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
        u.email as dentist_email,
        u.first_name as dentist_first_name,
        u.last_name as dentist_last_name
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN users u ON a.dentist_id = u.id
       WHERE a.id = $1`,
      [appointmentId],
    );

    if (result.rows.length === 0) {
      return next(new AppError('Appointment not found', 404));
    }

    // Diş hekimi sadece kendi randevusunu görebilir (IDOR koruması)
    if (isDentist(req) && result.rows[0].dentist_id !== req.user.sub) {
      return next(new AppError('Forbidden', 403));
    }

    return res.status(200).json({ appointment: result.rows[0] });
  } catch (err) {
    return next(new AppError('Failed to fetch appointment', 500));
  }
}

/**
 * Update appointment
 */
async function updateAppointment(req, res, next) {
  try {
    const appointmentId = parseInt(req.params.id, 10);

    // Mevcut kaydı önceden çekiyoruz: hem IDOR kontrolü hem de "sadece bazı
    // alanlar gönderildiğinde" geçerli olacak nihai (effective) tarih/saat/
    // dişhekimi değerlerini hesaplamak için gerekli — aksi halde ör. sadece
    // startTime değişip endTime değişmediğinde çakışma/sıra kontrolü yanlış
    // (eksik) verilerle yapılırdı.
    const current = await query(
      'SELECT dentist_id, appointment_date, start_time, end_time, status FROM appointments WHERE id = $1',
      [appointmentId],
    );
    if (current.rows.length === 0) {
      return next(new AppError('Appointment not found', 404));
    }
    const existing = current.rows[0];

    // Diş hekimi sadece kendi randevusunu güncelleyebilir (IDOR koruması)
    if (isDentist(req) && existing.dentist_id !== req.user.sub) {
      return next(new AppError('Forbidden', 403));
    }

    const {
      dentistId,
      appointmentDate,
      startTime,
      endTime,
      status,
      appointmentType,
      notes,
      cancellationReason,
    } = req.body || {};

    if (dentistId) {
      // Dişhekimi randevusunu başka bir dişhekimine devredemez (IDOR koruması)
      if (isDentist(req) && dentistId !== req.user.sub) {
        return next(new AppError('Forbidden', 403));
      }
    }

    if (startTime !== undefined && !isValidTimeString(startTime)) {
      return next(
        new AppError(
          `Invalid start time format. Expected HH:mm:ss (00-23:00-59:00-59), got: ${startTime}`,
          400,
        ),
      );
    }
    if (endTime !== undefined && !isValidTimeString(endTime)) {
      return next(
        new AppError(
          `Invalid end time format. Expected HH:mm:ss (00-23:00-59:00-59), got: ${endTime}`,
          400,
        ),
      );
    }
    if (
      appointmentDate !== undefined &&
      (typeof appointmentDate !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate))
    ) {
      return next(
        new AppError(
          'Invalid appointment date format. Expected YYYY-MM-DD',
          400,
        ),
      );
    }

    // Değişmeyen alanlar için mevcut kayıttaki değerler kullanılır — böylece
    // "sadece startTime gönderildi" gibi kısmi güncellemelerde de nihai
    // (kaydedilecek) aralık doğru şekilde bitiş>başlangıç ve çakışma
    // kontrolünden geçer.
    const effectiveDentistId = dentistId || existing.dentist_id;
    const effectiveDate = appointmentDate || existing.appointment_date;
    const effectiveStart = startTime || existing.start_time;
    const effectiveEnd = endTime || existing.end_time;
    const effectiveStatus = status || existing.status;

    if (effectiveEnd <= effectiveStart) {
      return next(new AppError('End time must be after start time', 400));
    }

    // Build update query
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (dentistId) {
      setClauses.push(`dentist_id = $${paramIndex++}`);
      params.push(dentistId);
    }

    if (appointmentDate) {
      setClauses.push(`appointment_date = $${paramIndex++}`);
      params.push(appointmentDate);
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

    setClauses.push(`updated_by = $${paramIndex++}`);
    params.push(req.user.sub);
    setClauses.push('updated_at = NOW()');

    params.push(appointmentId);

    // Randevunun doktor/tarih/saatini etkileyen bir alan değişiyorsa ve yeni
    // durum "engelleyici" ise (iptal/no-show değilse), create akışıyla aynı
    // advisory-lock + çakışma kontrolünden geçirilir — kendi ID'si hariç
    // tutularak. Böylece bir randevuyu "düzenle" ile başka bir doktorun dolu
    // saatine taşımak artık create ile aynı korumadan geçer.
    const touchesSchedule =
      dentistId !== undefined ||
      appointmentDate !== undefined ||
      startTime !== undefined ||
      endTime !== undefined;
    const needsConflictCheck =
      touchesSchedule && !NON_BLOCKING_STATUSES.includes(effectiveStatus);

    const updated = await withTransaction(async (client) => {
      if (needsConflictCheck) {
        await assertNoConflict(client, {
          dentistId: effectiveDentistId,
          appointmentDate: effectiveDate,
          startTime: effectiveStart,
          endTime: effectiveEnd,
          excludeAppointmentId: appointmentId,
        });
      }

      const result = await client.query(
        `UPDATE appointments
         SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        params,
      );

      return result.rows[0];
    });

    if (!updated) {
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

    emitAppointmentNotification('updated', updated, req.user.sub);

    return res.status(200).json({ appointment: updated });
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    return next(new AppError('Failed to update appointment', 500));
  }
}

/**
 * Cancel appointment
 */
async function cancelAppointment(req, res, next) {
  try {
    const appointmentId = parseInt(req.params.id, 10);
    // Web istemcisi `reason`, desktop `cancellationReason` gönderir — ikisini de kabul et
    const body = req.body || {};
    const cancellationReason = body.cancellationReason ?? body.reason;

    // Diş hekimi sadece kendi randevusunu iptal edebilir (IDOR koruması)
    if (isDentist(req)) {
      const ownership = await query(
        'SELECT dentist_id FROM appointments WHERE id = $1',
        [appointmentId],
      );
      if (ownership.rows.length === 0) {
        return next(new AppError('Appointment not found', 404));
      }
      if (ownership.rows[0].dentist_id !== req.user.sub) {
        return next(new AppError('Forbidden', 403));
      }
    }

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

    emitAppointmentNotification('cancelled', result.rows[0], req.user.sub);

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
