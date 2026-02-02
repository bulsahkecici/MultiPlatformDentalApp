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
 * Secretary only
 */
async function processPayment(req, res, next) {
    try {
        const { invoiceId, paymentMethod, paymentDate, amount, notes } = req.body;

        if (!invoiceId || !paymentMethod || !amount) {
            return next(new AppError('Invoice ID, payment method, and amount are required', 400));
        }

        const invoiceResult = await query(
            'SELECT total, status FROM invoices WHERE id = $1',
            [invoiceId],
        );

        if (invoiceResult.rows.length === 0) {
            return next(new AppError('Invoice not found', 404));
        }

        const invoice = invoiceResult.rows[0];

        // Update invoice payment
        await query(
            `UPDATE invoices 
       SET payment_method = $1,
           payment_date = $2,
           status = 'paid',
           notes = COALESCE(notes || E'\\n', '') || $3,
           updated_at = NOW()
       WHERE id = $4`,
            [paymentMethod, paymentDate || new Date().toISOString().split('T')[0], notes || '', invoiceId],
        );

        await logDataEvent({
            eventType: AuditEventType.DATA_MODIFIED,
            userId: req.user.sub,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || '',
            resourceType: 'invoice',
            resourceId: invoiceId,
            changes: { paymentMethod, amount, status: 'paid' },
        });

        return res.status(200).json({
            success: true,
            message: 'Payment processed successfully',
        });
    } catch (err) {
        logger.error({ err }, 'Failed to process payment');
        return next(new AppError('Failed to process payment', 500));
    }
}

module.exports = {
    applyDiscount,
    processPayment,
};
