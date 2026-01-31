const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');

/**
 * Create new appointment
 */
async function createAppointment(req, res, next) {
    try {
        const {
            patientId,
            dentistId,
            appointmentDate,
            startTime,
            endTime,
            appointmentType,
            notes,
        } = req.body || {};

        // Validate required fields
        if (!patientId || !appointmentDate || !startTime || !endTime) {
            return next(
                new AppError(
                    'Patient ID, appointment date, start time, and end time are required',
                    400,
                ),
            );
        }

        // Check for conflicts
        const conflictCheck = await query(
            `SELECT id FROM appointments 
       WHERE dentist_id = $1 
       AND appointment_date = $2 
       AND status NOT IN ('cancelled', 'no_show')
       AND (
         (start_time <= $3 AND end_time > $3) OR
         (start_time < $4 AND end_time >= $4) OR
         (start_time >= $3 AND end_time <= $4)
       )
       AND deleted_at IS NULL`,
            [dentistId || req.user.sub, appointmentDate, startTime, endTime],
        );

        if (conflictCheck.rows.length > 0) {
            return next(
                new AppError('Time slot conflicts with existing appointment', 409),
            );
        }

        // Create appointment
        const result = await query(
            `INSERT INTO appointments (
        patient_id, dentist_id, appointment_date, start_time, end_time,
        appointment_type, notes, status, created_by, updated_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9, NOW(), NOW())
      RETURNING *`,
            [
                patientId,
                dentistId || req.user.sub,
                appointmentDate,
                startTime,
                endTime,
                appointmentType || null,
                notes || null,
                req.user.sub,
                req.user.sub,
            ],
        );

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

        return res.status(201).json({ appointment });
    } catch (err) {
        return next(new AppError('Failed to create appointment', 500));
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
        const conditions = ['deleted_at IS NULL'];
        const params = [];
        let paramIndex = 1;

        if (patientId) {
            conditions.push(`patient_id = $${paramIndex++}`);
            params.push(parseInt(patientId, 10));
        }

        if (dentistId) {
            conditions.push(`dentist_id = $${paramIndex++}`);
            params.push(parseInt(dentistId, 10));
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

        const whereClause = conditions.join(' AND ');

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
        u.email as dentist_email
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN users u ON a.dentist_id = u.id
       WHERE a.id = $1 AND a.deleted_at IS NULL`,
            [appointmentId],
        );

        if (result.rows.length === 0) {
            return next(new AppError('Appointment not found', 404));
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
        const {
            appointmentDate,
            startTime,
            endTime,
            status,
            appointmentType,
            notes,
            cancellationReason,
        } = req.body || {};

        // Build update query
        const setClauses = [];
        const params = [];
        let paramIndex = 1;

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
        setClauses.push(`updated_at = NOW()`);

        params.push(appointmentId);

        const result = await query(
            `UPDATE appointments 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
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
 * Cancel appointment
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
       WHERE id = $3 AND deleted_at IS NULL
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
