const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');

/**
 * Create new treatment record
 */
async function createTreatment(req, res, next) {
    try {
        const {
            patientId,
            appointmentId,
            dentistId,
            treatmentDate,
            treatmentType,
            toothNumber,
            description,
            diagnosis,
            procedureNotes,
            cost,
            currency = 'USD',
            status = 'completed',
        } = req.body || {};

        // Validate required fields
        if (!patientId || !treatmentDate || !treatmentType) {
            return next(
                new AppError(
                    'Patient ID, treatment date, and treatment type are required',
                    400,
                ),
            );
        }

        // Create treatment
        const result = await query(
            `INSERT INTO treatments (
        patient_id, appointment_id, dentist_id, treatment_date, treatment_type,
        tooth_number, description, diagnosis, procedure_notes, cost, currency,
        status, created_by, updated_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *`,
            [
                patientId,
                appointmentId || null,
                dentistId || req.user.sub,
                treatmentDate,
                treatmentType,
                toothNumber || null,
                description || null,
                diagnosis || null,
                procedureNotes || null,
                cost || null,
                currency,
                status,
                req.user.sub,
                req.user.sub,
            ],
        );

        const treatment = result.rows[0];

        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        await logDataEvent({
            eventType: AuditEventType.TREATMENT_CREATED,
            userId: req.user.sub,
            ipAddress,
            userAgent,
            resourceType: 'treatment',
            resourceId: treatment.id,
            changes: { patientId, treatmentType, cost },
        });

        return res.status(201).json({ treatment });
    } catch (err) {
        return next(new AppError('Failed to create treatment', 500));
    }
}

/**
 * Get treatments with filtering
 */
async function getTreatments(req, res, next) {
    try {
        const {
            page = 1,
            limit = 20,
            patientId,
            dentistId,
            startDate,
            endDate,
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
            conditions.push(`treatment_date >= $${paramIndex++}`);
            params.push(startDate);
        }

        if (endDate) {
            conditions.push(`treatment_date <= $${paramIndex++}`);
            params.push(endDate);
        }

        const whereClause = conditions.join(' AND ');

        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) FROM treatments WHERE ${whereClause}`,
            params,
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // Get treatments with patient and dentist info
        params.push(parseInt(limit, 10), offset);
        const result = await query(
            `SELECT 
        t.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        u.email as dentist_email
       FROM treatments t
       LEFT JOIN patients p ON t.patient_id = p.id
       LEFT JOIN users u ON t.dentist_id = u.id
       WHERE ${whereClause}
       ORDER BY t.treatment_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            params,
        );

        return res.status(200).json({
            treatments: result.rows,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total,
                pages: Math.ceil(total / parseInt(limit, 10)),
            },
        });
    } catch (err) {
        return next(new AppError('Failed to fetch treatments', 500));
    }
}

/**
 * Get single treatment by ID
 */
async function getTreatmentById(req, res, next) {
    try {
        const treatmentId = parseInt(req.params.id, 10);

        const result = await query(
            `SELECT 
        t.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        u.email as dentist_email
       FROM treatments t
       LEFT JOIN patients p ON t.patient_id = p.id
       LEFT JOIN users u ON t.dentist_id = u.id
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
            [treatmentId],
        );

        if (result.rows.length === 0) {
            return next(new AppError('Treatment not found', 404));
        }

        return res.status(200).json({ treatment: result.rows[0] });
    } catch (err) {
        return next(new AppError('Failed to fetch treatment', 500));
    }
}

/**
 * Update treatment
 */
async function updateTreatment(req, res, next) {
    try {
        const treatmentId = parseInt(req.params.id, 10);
        const updates = req.body || {};

        // Build update query
        const allowedFields = [
            'treatment_date',
            'treatment_type',
            'tooth_number',
            'description',
            'diagnosis',
            'procedure_notes',
            'cost',
            'currency',
            'status',
        ];

        const setClauses = [];
        const params = [];
        let paramIndex = 1;

        Object.keys(updates).forEach((key) => {
            const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
            if (allowedFields.includes(snakeKey)) {
                setClauses.push(`${snakeKey} = $${paramIndex++}`);
                params.push(updates[key]);
            }
        });

        if (setClauses.length === 0) {
            return next(new AppError('No valid fields to update', 400));
        }

        setClauses.push(`updated_by = $${paramIndex++}`);
        params.push(req.user.sub);
        setClauses.push(`updated_at = NOW()`);

        params.push(treatmentId);

        const result = await query(
            `UPDATE treatments 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
            params,
        );

        if (result.rows.length === 0) {
            return next(new AppError('Treatment not found', 404));
        }

        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        await logDataEvent({
            eventType: AuditEventType.TREATMENT_UPDATED,
            userId: req.user.sub,
            ipAddress,
            userAgent,
            resourceType: 'treatment',
            resourceId: treatmentId,
            changes: updates,
        });

        return res.status(200).json({ treatment: result.rows[0] });
    } catch (err) {
        return next(new AppError('Failed to update treatment', 500));
    }
}

module.exports = {
    createTreatment,
    getTreatments,
    getTreatmentById,
    updateTreatment,
};
