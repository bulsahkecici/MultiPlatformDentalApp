const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');
const logger = require('../utils/logger');

/**
 * Tedavi planına veya faturaya indirim uygular
 * Yalnızca sekreter
 */
async function applyDiscount(req, res, next) {
  try {
    const {
      treatmentPlanId,
      invoiceId,
      discountId,
      discountAmount,
      discountPercentage,
    } = req.body;

    if (!treatmentPlanId && !invoiceId) {
      return next(
        new AppError('Either treatmentPlanId or invoiceId is required', 400),
      );
    }

    if (!discountId && !discountAmount && !discountPercentage) {
      return next(new AppError('Discount information is required', 400));
    }

    // discountId sağlanmışsa indirim ayrıntılarını al
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

    // Tedavi planına uygula
    if (treatmentPlanId) {
      const planResult = await query(
        'SELECT total_estimated_cost, currency FROM treatment_plans WHERE id = $1',
        [treatmentPlanId],
      );

      if (planResult.rows.length === 0) {
        return next(new AppError('Treatment plan not found', 404));
      }

      const plan = planResult.rows[0];
      const baseCost = parseFloat(plan.total_estimated_cost || 0);
      let finalDiscount = 0;

      if (discount) {
        if (discount.discount_type === 'percentage') {
          finalDiscount = (baseCost * discount.discount_value) / 100;
          if (discount.max_discount) {
            finalDiscount = Math.min(finalDiscount, discount.max_discount);
          }
        } else {
          finalDiscount = discount.discount_value;
        }
      } else if (discountAmount) {
        finalDiscount = discountAmount;
      } else if (discountPercentage) {
        finalDiscount = (baseCost * discountPercentage) / 100;
      }

      finalDiscount = Math.min(finalDiscount, baseCost);

      // Tedavi planını indirimle güncelle
      await query(
        `UPDATE treatment_plans 
         SET total_estimated_cost = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [baseCost - finalDiscount, treatmentPlanId],
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

    // Faturaya uygula
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

      // Faturayı güncelle
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
 * Ödemeyi işler
 * Yalnızca sekreter/patron
 */
async function processPayment(req, res, next) {
  try {
    const { patientId, treatmentPlanId, amount, paymentMethod, notes } =
      req.body;

    if (!patientId || !amount || !paymentMethod) {
      return next(
        new AppError(
          'Patient ID, amount, and payment method are required',
          400,
        ),
      );
    }

    // Sağlanmışsa tedavi planını al
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

        // Hekimin commission_rate değeri varsa hekim ciro payını hesapla
        if (dentistId) {
          const dentistResult = await query(
            'SELECT commission_rate FROM users WHERE id = $1',
            [dentistId],
          );
          if (
            dentistResult.rows.length > 0 &&
            dentistResult.rows[0].commission_rate
          ) {
            const commissionRate = parseFloat(
              dentistResult.rows[0].commission_rate,
            );
            dentistCommission = (amount * commissionRate) / 100;
          }
        }
      }
    }

    // Ödeme kaydı oluştur
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

    // Hasta borcunu güncelle - yeni ödeme eklendikten sonra kalan borcu doğru hesapla
    await query(
      `INSERT INTO patient_debts (patient_id, total_debt, paid_amount, remaining_debt, updated_at)
            VALUES ($1, 
                COALESCE((SELECT total_debt FROM patient_debts WHERE patient_id = $1), 0),
                COALESCE((SELECT paid_amount FROM patient_debts WHERE patient_id = $1), 0) + $2,
                GREATEST(0, COALESCE((SELECT total_debt FROM patient_debts WHERE patient_id = $1), 0) - 
                           (COALESCE((SELECT paid_amount FROM patient_debts WHERE patient_id = $1), 0) + $2)),
                NOW())
            ON CONFLICT (patient_id) DO UPDATE SET
                paid_amount = patient_debts.paid_amount + $2,
                remaining_debt = GREATEST(0, patient_debts.total_debt - (patient_debts.paid_amount + $2)),
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
 * Onay bekleyen tedavi planlarını getirir
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
            -- Backward-compatible: some plans may still be stored as "planned"
            WHERE LOWER(tp.status) IN ('pending', 'planned')
            ORDER BY tp.created_at DESC`,
    );

    // Her plan için kalemleri al
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
 * Tedavi planını onaylar
 */
async function approveTreatmentPlan(req, res, next) {
  try {
    const planId = parseInt(req.params.id, 10);
    const { approved } = req.body;

    if (approved === undefined) {
      return next(new AppError('Approval status is required', 400));
    }

    const existingPlan = await query(
      'SELECT status, patient_id FROM treatment_plans WHERE id = $1',
      [planId],
    );
    if (existingPlan.rows.length === 0) {
      return next(new AppError('Treatment plan not found', 404));
    }
    if (existingPlan.rows[0].status === 'approved' && approved) {
      return next(new AppError('Treatment plan is already approved', 409));
    }

    // Kalemlerden toplam maliyeti hesapla
    const itemsResult = await query(
      'SELECT SUM(cost) as total FROM treatment_plan_items WHERE treatment_plan_id = $1',
      [planId],
    );
    const totalCost = parseFloat(itemsResult.rows[0].total || 0);

    // Plan durumunu ve toplam maliyeti güncelle
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

    // Onaylanmışsa hasta borcunu oluştur/güncelle
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
 * Hasta borcunu getirir
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

/**
 * Toplam alacakları getirir (tüm remaining_debt toplamı)
 */
async function getTotalReceivables(req, res, next) {
  try {
    const result = await query(
      'SELECT COALESCE(SUM(remaining_debt), 0) as total_receivables FROM patient_debts',
    );

    return res.status(200).json({
      totalReceivables: parseFloat(result.rows[0].total_receivables || 0),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch total receivables');
    return next(new AppError('Failed to fetch total receivables', 500));
  }
}

/**
 * Toplam geliri getirir (tüm ödemelerin toplamı)
 */
async function getTotalIncome(req, res, next) {
  try {
    const result = await query(
      'SELECT COALESCE(SUM(amount), 0) as total_income FROM payments',
    );

    return res.status(200).json({
      totalIncome: parseFloat(result.rows[0].total_income || 0),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch total income');
    return next(new AppError('Failed to fetch total income', 500));
  }
}

/**
 * Hasta ödeme geçmişini getirir
 */
async function getPatientPayments(req, res, next) {
  try {
    const patientId = parseInt(req.params.patientId, 10);

    const result = await query(
      `SELECT id, amount, payment_method, created_at, notes 
             FROM payments 
             WHERE patient_id = $1 
             ORDER BY created_at DESC`,
      [patientId],
    );

    return res.status(200).json({ payments: result.rows });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch patient payments');
    return next(new AppError('Failed to fetch patient payments', 500));
  }
}

module.exports = {
  applyDiscount,
  processPayment,
  getPendingTreatmentPlans,
  approveTreatmentPlan,
  getPatientDebt,
  getTotalReceivables,
  getTotalIncome,
  getPatientPayments,
};
