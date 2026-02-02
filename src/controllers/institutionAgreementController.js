const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');

/**
 * Get all institution agreements
 */
async function getInstitutionAgreements(req, res, next) {
    try {
        const { isActive } = req.query;
        let queryStr = 'SELECT * FROM institution_agreements WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (isActive !== undefined) {
            queryStr += ` AND is_active = $${paramIndex++}`;
            params.push(isActive === 'true');
        }

        queryStr += ' ORDER BY institution_name';

        const result = await query(queryStr, params);
        return res.status(200).json({ agreements: result.rows });
    } catch (err) {
        return next(new AppError('Failed to fetch institution agreements', 500));
    }
}

/**
 * Create new institution agreement
 */
async function createInstitutionAgreement(req, res, next) {
    try {
        const {
            institutionName,
            contactPerson,
            contactPhone,
            contactEmail,
            discountPercentage,
            notes,
        } = req.body || {};

        if (!institutionName || discountPercentage === undefined) {
            return next(new AppError('Institution name and discount percentage are required', 400));
        }

        if (discountPercentage < 0 || discountPercentage > 100) {
            return next(new AppError('Discount percentage must be between 0 and 100', 400));
        }

        const result = await query(
            `INSERT INTO institution_agreements (
                institution_name, contact_person, contact_phone, contact_email,
                discount_percentage, notes, is_active, created_by, updated_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW(), NOW())
            RETURNING *`,
            [
                institutionName,
                contactPerson || null,
                contactPhone || null,
                contactEmail || null,
                discountPercentage,
                notes || null,
                req.user.sub,
            ],
        );

        const agreement = result.rows[0];

        await logDataEvent({
            eventType: AuditEventType.DATA_CREATED,
            userId: req.user.sub,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || '',
            resourceType: 'institution_agreement',
            resourceId: agreement.id,
            changes: { institutionName, discountPercentage },
        });

        return res.status(201).json({ agreement });
    } catch (err) {
        return next(new AppError('Failed to create institution agreement', 500));
    }
}

/**
 * Update institution agreement
 */
async function updateInstitutionAgreement(req, res, next) {
    try {
        const agreementId = parseInt(req.params.id, 10);
        const updates = req.body || {};

        const allowedFields = [
            'institution_name',
            'contact_person',
            'contact_phone',
            'contact_email',
            'discount_percentage',
            'is_active',
            'notes',
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

        setClauses.push('updated_at = NOW()');
        params.push(agreementId);

        const result = await query(
            `UPDATE institution_agreements 
            SET ${setClauses.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *`,
            params,
        );

        if (result.rows.length === 0) {
            return next(new AppError('Institution agreement not found', 404));
        }

        await logDataEvent({
            eventType: AuditEventType.DATA_MODIFIED,
            userId: req.user.sub,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || '',
            resourceType: 'institution_agreement',
            resourceId: agreementId,
            changes: updates,
        });

        return res.status(200).json({ agreement: result.rows[0] });
    } catch (err) {
        return next(new AppError('Failed to update institution agreement', 500));
    }
}

/**
 * Get all discount reasons
 */
async function getDiscountReasons(req, res, next) {
    try {
        const { isActive } = req.query;
        let queryStr = 'SELECT * FROM discount_reasons WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (isActive !== undefined) {
            queryStr += ` AND is_active = $${paramIndex++}`;
            params.push(isActive === 'true');
        }

        queryStr += ' ORDER BY name';

        const result = await query(queryStr, params);
        return res.status(200).json({ reasons: result.rows });
    } catch (err) {
        return next(new AppError('Failed to fetch discount reasons', 500));
    }
}

module.exports = {
    getInstitutionAgreements,
    createInstitutionAgreement,
    updateInstitutionAgreement,
    getDiscountReasons,
};
