const validator = require('validator');
const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');

/**
 * Create new patient
 */
async function createPatient(req, res, next) {
    try {
        const {
            firstName,
            lastName,
            dateOfBirth,
            gender,
            email,
            phone,
            address,
            city,
            country,
            bloodType,
            allergies,
            medicalConditions,
            currentMedications,
            emergencyContactName,
            emergencyContactPhone,
            insuranceProvider,
            insurancePolicyNumber,
            notes,
            institutionAgreementId,
            discountReasonIds, // Array of discount reason IDs
        } = req.body || {};

        // Validate required fields
        if (!firstName || !lastName) {
            return next(new AppError('First name and last name are required', 400));
        }

        if (email && !validator.isEmail(email)) {
            return next(new AppError('Invalid email format', 400));
        }

        // Create patient
        const result = await query(
            `INSERT INTO patients (
        first_name, last_name, date_of_birth, gender, email, phone,
        address, city, country, blood_type, allergies,
        medical_conditions, current_medications, emergency_contact_name,
        emergency_contact_phone, insurance_provider, insurance_policy_number,
        notes, institution_agreement_id, created_by, updated_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW()
      ) RETURNING *`,
            [
                firstName,
                lastName,
                dateOfBirth || null,
                gender || null,
                email || null,
                phone || null,
                address || null,
                city || null,
                country || null,
                bloodType || null,
                allergies || null,
                medicalConditions || null,
                currentMedications || null,
                emergencyContactName || null,
                emergencyContactPhone || null,
                insuranceProvider || null,
                insurancePolicyNumber || null,
                notes || null,
                institutionAgreementId || null,
                req.user.sub,
                req.user.sub,
            ],
        );

        const patient = result.rows[0];
        
        // Link discount reasons if provided
        if (discountReasonIds && Array.isArray(discountReasonIds) && discountReasonIds.length > 0) {
            for (const reasonId of discountReasonIds) {
                await query(
                    'INSERT INTO patient_discount_reasons (patient_id, discount_reason_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [patient.id, reasonId]
                );
            }
        }

        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        await logDataEvent({
            eventType: AuditEventType.PATIENT_CREATED,
            userId: req.user.sub,
            ipAddress,
            userAgent,
            resourceType: 'patient',
            resourceId: patient.id,
            changes: { firstName, lastName, email },
        });

        return res.status(201).json({ patient });
    } catch (err) {
        return next(new AppError('Failed to create patient', 500));
    }
}

/**
 * Get all patients with pagination and search
 */
async function getPatients(req, res, next) {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;

        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const conditions = ['deleted_at IS NULL'];
        const params = [];
        let paramIndex = 1;

        // Search by name, email, or phone
        if (search) {
            conditions.push(
                `(first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR phone ILIKE $${paramIndex})`,
            );
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = conditions.join(' AND ');

        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) FROM patients WHERE ${whereClause}`,
            params,
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // Get patients
        params.push(parseInt(limit, 10), offset);
        const result = await query(
            `SELECT id, first_name, last_name, date_of_birth, gender, email, phone, city, created_at
       FROM patients
       WHERE ${whereClause}
       ORDER BY last_name, first_name
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            params,
        );

        return res.status(200).json({
            patients: result.rows,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total,
                pages: Math.ceil(total / parseInt(limit, 10)),
            },
        });
    } catch (err) {
        return next(new AppError('Failed to fetch patients', 500));
    }
}

/**
 * Get single patient by ID
 */
async function getPatientById(req, res, next) {
    try {
        const patientId = parseInt(req.params.id, 10);

        const result = await query(
            `SELECT p.*, ia.institution_name, ia.discount_percentage
            FROM patients p
            LEFT JOIN institution_agreements ia ON p.institution_agreement_id = ia.id
            WHERE p.id = $1 AND p.deleted_at IS NULL`,
            [patientId],
        );

        if (result.rows.length === 0) {
            return next(new AppError('Patient not found', 404));
        }

        const patient = result.rows[0];

        // Get discount reasons
        const discountReasonsResult = await query(
            `SELECT dr.id, dr.name 
            FROM discount_reasons dr
            INNER JOIN patient_discount_reasons pdr ON dr.id = pdr.discount_reason_id
            WHERE pdr.patient_id = $1 AND dr.is_active = true`,
            [patientId],
        );

        patient.discount_reasons = discountReasonsResult.rows;

        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        await logDataEvent({
            eventType: AuditEventType.PATIENT_VIEWED,
            userId: req.user.sub,
            ipAddress,
            userAgent,
            resourceType: 'patient',
            resourceId: patientId,
        });

        return res.status(200).json({ patient });
    } catch (err) {
        return next(new AppError('Failed to fetch patient', 500));
    }
}

/**
 * Update patient
 */
async function updatePatient(req, res, next) {
    try {
        const patientId = parseInt(req.params.id, 10);
        const updates = req.body || {};

        // Build update query dynamically
        const allowedFields = [
            'first_name',
            'last_name',
            'date_of_birth',
            'gender',
            'email',
            'phone',
            'address',
            'city',
            'country',
            'blood_type',
            'allergies',
            'medical_conditions',
            'current_medications',
            'emergency_contact_name',
            'emergency_contact_phone',
            'insurance_provider',
            'insurance_policy_number',
            'notes',
            'institution_agreement_id',
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

        params.push(patientId);

        const result = await query(
            `UPDATE patients 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
            params,
        );

        if (result.rows.length === 0) {
            return next(new AppError('Patient not found', 404));
        }
        
        // Update discount reasons if provided
        if (updates.discountReasonIds !== undefined) {
            // Delete existing links
            await query('DELETE FROM patient_discount_reasons WHERE patient_id = $1', [patientId]);
            
            // Add new links
            if (Array.isArray(updates.discountReasonIds) && updates.discountReasonIds.length > 0) {
                for (const reasonId of updates.discountReasonIds) {
                    await query(
                        'INSERT INTO patient_discount_reasons (patient_id, discount_reason_id) VALUES ($1, $2)',
                        [patientId, reasonId]
                    );
                }
            }
        }

        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        await logDataEvent({
            eventType: AuditEventType.PATIENT_UPDATED,
            userId: req.user.sub,
            ipAddress,
            userAgent,
            resourceType: 'patient',
            resourceId: patientId,
            changes: updates,
        });

        return res.status(200).json({ patient: result.rows[0] });
    } catch (err) {
        return next(new AppError('Failed to update patient', 500));
    }
}

/**
 * Delete patient (soft delete)
 */
async function deletePatient(req, res, next) {
    try {
        const patientId = parseInt(req.params.id, 10);

        const result = await query(
            `UPDATE patients 
       SET deleted_at = NOW(), updated_at = NOW(), updated_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
            [req.user.sub, patientId],
        );

        if (result.rows.length === 0) {
            return next(new AppError('Patient not found', 404));
        }

        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        await logDataEvent({
            eventType: AuditEventType.PATIENT_DELETED,
            userId: req.user.sub,
            ipAddress,
            userAgent,
            resourceType: 'patient',
            resourceId: patientId,
        });

        return res.status(200).json({ message: 'Patient deleted successfully' });
    } catch (err) {
        return next(new AppError('Failed to delete patient', 500));
    }
}

module.exports = {
    createPatient,
    getPatients,
    getPatientById,
    updatePatient,
    deletePatient,
};
