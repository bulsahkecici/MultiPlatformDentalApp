const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');
const logger = require('../utils/logger');

/**
 * Apply discount to treatment plan or invoice
 * Secretary only
 */
async function applyDiscount(req, res, next) {
    try {
        const { treatmentPlanId, invoiceId, discountId, discountAmount, discountPercentage } = req.body;

        if (!treatmentPlanId && !invoiceId) {
            return next(new AppError('Either treatmentPlanId or invoiceId is required', 400));
        }

        if (!discountId && !discountAmount && !discountPercentage) {
            return next(new AppError('Discount information is required', 400));
        }

        // Get discount details if discountId provided
        let discount = null;
        if (discountId) {
            const discountResult = await query(
                'SELECT * FROM discounts WHERE id = $1 AND is_active = true',
                [discountId],
            );
            if (discountResult.rows.length === 0) {
                return next(new AppError('Discount not found or inactive', 404));
            }
            discount = discountResult.rows[0];
        }

        // Apply to treatment plan
        if (treatmentPlanId) {
            const planResult = await query(
                'SELECT total_estimated_cost, currency FROM treatment_plans WHERE id = $1',
                [treatmentPlanId],
            );

            if (planResult.rows.length === 0) {
                return next(new AppError('Treatment plan not found', 404));
            }

            const plan = planResult.rows[0];
            let finalDiscount = 0;

            if (discount) {
                if (discount.discount_type === 'percentage') {
                    finalDiscount = (plan.total_estimated_cost * discount.discount_value) / 100;
                    if (discount.max_discount) {
                        finalDiscount = Math.min(finalDiscount, discount.max_discount);
                    }
                } else {
                    finalDiscount = discount.discount_value;
                }
            } else if (discountAmount) {
                finalDiscount = discountAmount;
            } else if (discountPercentage) {
                finalDiscount = (plan.total_estimated_cost * discountPercentage) / 100;
            }

            // Update treatment plan with discount
            await query(
                `UPDATE treatment_plans 
         SET total_estimated_cost = total_estimated_cost - $1,
             updated_at = NOW()
         WHERE id = $2`,
                [finalDiscount, treatmentPlanId],
            );

            await logDataEvent({
                eventType: AuditEventType.DATA_MODIFIED,
                userId: req.user.sub,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || '',
                resourceType: 'treatment_plan',
                resourceId: treatmentPlanId,
                changes: { discount: finalDiscount },
            });

            return res.status(200).json({
                success: true,
                discount: finalDiscount,
                message: 'Discount applied to treatment plan',
            });
        }

        // Apply to invoice
        if (invoiceId) {
            const invoiceResult = await query(
                'SELECT subtotal, total FROM invoices WHERE id = $1',
                [invoiceId],
            );

            if (invoiceResult.rows.length === 0) {
                return next(new AppError('Invoice not found', 404));
            }

            const invoice = invoiceResult.rows[0];
            let finalDiscount = 0;

            if (discount) {
                if (discount.discount_type === 'percentage') {
                    finalDiscount = (invoice.subtotal * discount.discount_value) / 100;
                    if (discount.max_discount) {
                        finalDiscount = Math.min(finalDiscount, discount.max_discount);
                    }
                } else {
                    finalDiscount = discount.discount_value;
                }
            } else if (discountAmount) {
                finalDiscount = discountAmount;
            } else if (discountPercentage) {
                finalDiscount = (invoice.subtotal * discountPercentage) / 100;
            }

            // Update invoice
            await query(
                `UPDATE invoices 
         SET discount = $1,
             total = subtotal - $1 + tax,
             updated_at = NOW()
         WHERE id = $2`,
                [finalDiscount, invoiceId],
            );

            await logDataEvent({
                eventType: AuditEventType.DATA_MODIFIED,
                userId: req.user.sub,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || '',
                resourceType: 'invoice',
                resourceId: invoiceId,
                changes: { discount: finalDiscount },
            });

            return res.status(200).json({
                success: true,
                discount: finalDiscount,
                message: 'Discount applied to invoice',
            });
        }
    } catch (err) {
        logger.error({ err }, 'Failed to apply discount');
        return next(new AppError('Failed to apply discount', 500));
    }
}

/**
 * Process payment
 * Secretary/Patron only
 */
async function processPayment(req, res, next) {
    try {
        const { patientId, treatmentPlanId, amount, paymentMethod, notes } = req.body;

        if (!patientId || !amount || !paymentMethod) {
            return next(new AppError('Patient ID, amount, and payment method are required', 400));
        }

        // Get treatment plan if provided
        let dentistId = null;
        let dentistCommission = null;
        
        if (treatmentPlanId) {
            const planResult = await query(
                'SELECT dentist_id, total_estimated_cost FROM treatment_plans WHERE id = $1',
                [treatmentPlanId],
            );
            
            if (planResult.rows.length > 0) {
                const plan = planResult.rows[0];
                dentistId = plan.dentist_id;
                
                // Calculate dentist commission if dentist has commission_rate
                if (dentistId) {
                    const dentistResult = await query(
                        'SELECT commission_rate FROM users WHERE id = $1',
                        [dentistId],
                    );
                    if (dentistResult.rows.length > 0 && dentistResult.rows[0].commission_rate) {
                        const commissionRate = parseFloat(dentistResult.rows[0].commission_rate);
                        dentistCommission = (amount * commissionRate) / 100;
                    }
                }
            }
        }

        // Create payment record
        const paymentResult = await query(
            `INSERT INTO payments (
                patient_id, treatment_plan_id, amount, payment_method, 
                dentist_commission, dentist_id, notes, created_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            RETURNING *`,
            [
                patientId,
                treatmentPlanId || null,
                amount,
                paymentMethod,
                dentistCommission,
                dentistId,
                notes || null,
                req.user.sub,
            ],
        );

        // Update patient debt
        await query(
            `INSERT INTO patient_debts (patient_id, total_debt, paid_amount, remaining_debt, updated_at)
            VALUES ($1, 
                COALESCE((SELECT total_debt FROM patient_debts WHERE patient_id = $1), 0),
                COALESCE((SELECT paid_amount FROM patient_debts WHERE patient_id = $1), 0) + $2,
                GREATEST(0, COALESCE((SELECT total_debt FROM patient_debts WHERE patient_id = $1), 0) - 
                           COALESCE((SELECT paid_amount FROM patient_debts WHERE patient_id = $1), 0) - $2),
                NOW())
            ON CONFLICT (patient_id) DO UPDATE SET
                paid_amount = patient_debts.paid_amount + $2,
                remaining_debt = GREATEST(0, patient_debts.total_debt - patient_debts.paid_amount - $2),
                updated_at = NOW()`,
            [patientId, amount],
        );

        await logDataEvent({
            eventType: AuditEventType.DATA_CREATED,
            userId: req.user.sub,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || '',
            resourceType: 'payment',
            resourceId: paymentResult.rows[0].id,
            changes: { patientId, amount, paymentMethod },
        });

        return res.status(201).json({
            success: true,
            payment: paymentResult.rows[0],
            message: 'Payment processed successfully',
        });
    } catch (err) {
        logger.error({ err }, 'Failed to process payment');
        return next(new AppError('Failed to process payment', 500));
    }
}

/**
 * Get pending treatment plans for approval
 */
async function getPendingTreatmentPlans(req, res, next) {
    try {
        const result = await query(
            `SELECT tp.*, 
                p.first_name || ' ' || p.last_name as patient_name,
                u.email as dentist_email
            FROM treatment_plans tp
            LEFT JOIN patients p ON tp.patient_id = p.id
            LEFT JOIN users u ON tp.dentist_id = u.id
            WHERE tp.status = 'pending'
            ORDER BY tp.created_at DESC`,
        );

        // Get items for each plan
        const plans = await Promise.all(
            result.rows.map(async (plan) => {
                const itemsResult = await query(
                    'SELECT * FROM treatment_plan_items WHERE treatment_plan_id = $1',
                    [plan.id],
                );
                return {
                    ...plan,
                    items: itemsResult.rows,
                };
            }),
        );

        return res.status(200).json({ plans });
    } catch (err) {
        logger.error({ err }, 'Failed to fetch pending treatment plans');
        return next(new AppError('Failed to fetch pending treatment plans', 500));
    }
}

/**
 * Approve treatment plan
 */
async function approveTreatmentPlan(req, res, next) {
    try {
        const planId = parseInt(req.params.id, 10);
        const { approved } = req.body;

        if (approved === undefined) {
            return next(new AppError('Approval status is required', 400));
        }

        // Calculate total cost from items
        const itemsResult = await query(
            'SELECT SUM(cost) as total FROM treatment_plan_items WHERE treatment_plan_id = $1',
            [planId],
        );
        const totalCost = parseFloat(itemsResult.rows[0].total || 0);

        // Update plan status and total cost
        const result = await query(
            `UPDATE treatment_plans 
            SET status = $1, 
                total_estimated_cost = $2,
                updated_at = NOW()
            WHERE id = $3
            RETURNING *`,
            [approved ? 'approved' : 'cancelled', totalCost, planId],
        );

        if (result.rows.length === 0) {
            return next(new AppError('Treatment plan not found', 404));
        }

        // If approved, create/update patient debt
        if (approved) {
            const plan = result.rows[0];
            await query(
                `INSERT INTO patient_debts (patient_id, total_debt, paid_amount, remaining_debt, updated_at)
                VALUES ($1, $2, 0, $2, NOW())
                ON CONFLICT (patient_id) DO UPDATE SET
                    total_debt = patient_debts.total_debt + $2,
                    remaining_debt = patient_debts.remaining_debt + $2,
                    updated_at = NOW()`,
                [plan.patient_id, totalCost],
            );
        }

        await logDataEvent({
            eventType: AuditEventType.DATA_MODIFIED,
            userId: req.user.sub,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || '',
            resourceType: 'treatment_plan',
            resourceId: planId,
            changes: { status: approved ? 'approved' : 'cancelled' },
        });

        return res.status(200).json({
            success: true,
            plan: result.rows[0],
            message: `Treatment plan ${approved ? 'approved' : 'cancelled'}`,
        });
    } catch (err) {
        logger.error({ err }, 'Failed to approve treatment plan');
        return next(new AppError('Failed to approve treatment plan', 500));
    }
}

/**
 * Get patient debt
 */
async function getPatientDebt(req, res, next) {
    try {
        const patientId = parseInt(req.params.patientId, 10);

        const result = await query(
            'SELECT * FROM patient_debts WHERE patient_id = $1',
            [patientId],
        );

        if (result.rows.length === 0) {
            return res.status(200).json({
                debt: {
                    patientId,
                    totalDebt: 0,
                    paidAmount: 0,
                    remainingDebt: 0,
                },
            });
        }

        return res.status(200).json({ debt: result.rows[0] });
    } catch (err) {
        logger.error({ err }, 'Failed to fetch patient debt');
        return next(new AppError('Failed to fetch patient debt', 500));
    }
}

module.exports = {
    applyDiscount,
    processPayment,
    getPendingTreatmentPlans,
    approveTreatmentPlan,
    getPatientDebt,
};
