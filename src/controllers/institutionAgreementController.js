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
        
        // Get category discounts for each agreement; ensure numeric fields are numbers for JSON
        const agreements = await Promise.all(
            result.rows.map(async (row) => {
                const categoryDiscountsResult = await query(
                    'SELECT category_name, discount_percentage FROM institution_agreement_category_discounts WHERE institution_agreement_id = $1',
                    [row.id]
                );
                const category_discounts = categoryDiscountsResult.rows.reduce((acc, r) => {
                    acc[r.category_name] = parseFloat(r.discount_percentage) || 0;
                    return acc;
                }, {});
                return {
                    id: Number(row.id),
                    institution_name: row.institution_name || '',
                    contact_person: row.contact_person,
                    contact_phone: row.contact_phone,
                    contact_email: row.contact_email,
                    discount_percentage: parseFloat(row.discount_percentage) || 0,
                    is_active: Boolean(row.is_active),
                    notes: row.notes,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    created_by: row.created_by,
                    updated_by: row.updated_by,
                    category_discounts,
                };
            })
        );
        
        return res.status(200).json({ agreements });
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
            discountPercentage = 0,
            notes,
            categoryDiscounts, // Object with category_name -> discount_percentage
        } = req.body || {};

        if (!institutionName) {
            return next(new AppError('Institution name is required', 400));
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

        // Insert category discounts if provided
        if (categoryDiscounts && typeof categoryDiscounts === 'object') {
            try {
                for (const [categoryName, discountPercent] of Object.entries(categoryDiscounts)) {
                    // Convert to number if it's a string
                    const discountValue = typeof discountPercent === 'string' 
                        ? parseFloat(discountPercent) 
                        : discountPercent;
                    
                    if (discountValue > 0 && discountValue <= 100) {
                        await query(
                            `INSERT INTO institution_agreement_category_discounts 
                            (institution_agreement_id, category_name, discount_percentage, created_at, updated_at)
                            VALUES ($1, $2, $3, NOW(), NOW())
                            ON CONFLICT (institution_agreement_id, category_name) 
                            DO UPDATE SET discount_percentage = $3, updated_at = NOW()`,
                            [agreement.id, categoryName, discountValue]
                        );
                    }
                }
            } catch (categoryErr) {
                const logger = require('../utils/logger');
                logger.error({ err: categoryErr, agreementId: agreement.id, categoryDiscounts }, 
                    'Failed to insert category discounts');
                // Continue even if category discounts fail - the agreement was created
            }
        }

        // Fetch category discounts for response
        const categoryDiscountsResult = await query(
            'SELECT category_name, discount_percentage FROM institution_agreement_category_discounts WHERE institution_agreement_id = $1',
            [agreement.id]
        );
        const categoryDiscountsObj = categoryDiscountsResult.rows.reduce((acc, row) => {
            acc[row.category_name] = parseFloat(row.discount_percentage);
            return acc;
        }, {});

        const agreementWithDiscounts = {
            ...agreement,
            category_discounts: categoryDiscountsObj
        };

        await logDataEvent({
            eventType: AuditEventType.DATA_CREATED,
            userId: req.user.sub,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || '',
            resourceType: 'institution_agreement',
            resourceId: agreement.id,
            changes: { institutionName, discountPercentage, categoryDiscounts: categoryDiscountsObj },
        });

        return res.status(201).json({ agreement: agreementWithDiscounts });
    } catch (err) {
        const logger = require('../utils/logger');
        logger.error({ err, body: req.body }, 'Failed to create institution agreement');
        return next(new AppError(`Failed to create institution agreement: ${err.message}`, 500));
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

        // Handle category discounts update if provided
        if (updates.categoryDiscounts && typeof updates.categoryDiscounts === 'object') {
            // Delete existing category discounts
            await query(
                'DELETE FROM institution_agreement_category_discounts WHERE institution_agreement_id = $1',
                [agreementId]
            );
            
            // Insert new category discounts
            for (const [categoryName, discountPercent] of Object.entries(updates.categoryDiscounts)) {
                if (discountPercent > 0 && discountPercent <= 100) {
                    await query(
                        `INSERT INTO institution_agreement_category_discounts 
                        (institution_agreement_id, category_name, discount_percentage, created_at, updated_at)
                        VALUES ($1, $2, $3, NOW(), NOW())`,
                        [agreementId, categoryName, discountPercent]
                    );
                }
            }
        }

        // Fetch category discounts for response
        const categoryDiscountsResult = await query(
            'SELECT category_name, discount_percentage FROM institution_agreement_category_discounts WHERE institution_agreement_id = $1',
            [agreementId]
        );
        const categoryDiscountsObj = categoryDiscountsResult.rows.reduce((acc, row) => {
            acc[row.category_name] = parseFloat(row.discount_percentage);
            return acc;
        }, {});

        const agreementWithDiscounts = {
            ...result.rows[0],
            category_discounts: categoryDiscountsObj
        };

        await logDataEvent({
            eventType: AuditEventType.DATA_MODIFIED,
            userId: req.user.sub,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || '',
            resourceType: 'institution_agreement',
            resourceId: agreementId,
            changes: updates,
        });

        return res.status(200).json({ agreement: agreementWithDiscounts });
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
