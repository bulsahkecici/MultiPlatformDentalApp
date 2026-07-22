const { query, withTransaction } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');
const { isAdmin } = require('../middlewares/auth');
const config = require('../config');
const logger = require('../utils/logger');
const { notifyUser, notifyRole } = require('../services/notificationHub');

/**
 * Hareket bazlı finansal defter (financial_transactions) için tek yazma
 * noktası — her para hareketi (tahakkuk, ödeme, indirim, iade) kim/ne
 * zaman/hangi gerekçeyle yapıldı bilgisiyle, değişmez bir satır olarak
 * kaydedilir. `client` hem düz `query` fonksiyonu hem de bir transaction
 * client'ı olabilir (ikisi de aynı `query(sql, params)` imzasına sahip).
 */
async function insertFinancialTransaction(
  client,
  {
    patientId,
    transactionType,
    amount,
    currency = 'TRY',
    treatmentPlanId = null,
    paymentId = null,
    referenceTransactionId = null,
    status = 'completed',
    reason = null,
    createdBy,
    approvedBy = null,
  },
) {
  const result = await client.query(
    `INSERT INTO financial_transactions (
        patient_id, transaction_type, amount, currency, treatment_plan_id,
        payment_id, reference_transaction_id, status, reason, created_by,
        approved_by, approved_at, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
     RETURNING *`,
    [
      patientId,
      transactionType,
      amount,
      currency,
      treatmentPlanId,
      paymentId,
      referenceTransactionId,
      status,
      reason,
      createdBy,
      approvedBy,
      approvedBy ? new Date() : null,
    ],
  );
  return result.rows[0];
}

/**
 * Bekleyen bir 'refund' işleminin bakiye etkisini uygular (onay anında ya da
 * patron doğrudan iade ederken). Tek noktadan çağrılır ki onay akışı ile
 * doğrudan-iade akışı aynı mantığı kullansın.
 */
async function executeRefundBalanceEffect(client, transaction) {
  const amount = parseFloat(transaction.amount);
  await client.query(
    `INSERT INTO patient_debts (patient_id, total_debt, paid_amount, remaining_debt, updated_at)
        VALUES ($1, 0, 0, $2, NOW())
        ON CONFLICT (patient_id) DO UPDATE SET
            paid_amount = GREATEST(0, patient_debts.paid_amount - $2),
            remaining_debt = patient_debts.remaining_debt + $2,
            updated_at = NOW()`,
    [transaction.patient_id, amount],
  );
}

/**
 * Apply discount to treatment plan or invoice.
 * Secretary/admin — ama etkin indirim oranı yapılandırılmış eşiği
 * (config.business.highDiscountApprovalThresholdPercent) aşıyorsa ve
 * istek admin'den gelmiyorsa, indirim hemen uygulanmaz: patron onayı
 * bekleyen bir financial_transactions kaydı (status='pending_approval')
 * olarak oluşturulur (bkz. approveFinancialTransaction).
 *
 * Not: invoice hedefi (invoiceId) bu onay akışına dahil edilmedi — `invoices`
 * tablosu bu kod tabanında hiçbir yerde gerçekten oluşturulmuyor (bkz.
 * adminController.js yorumu: "invoices tablosuna hiç yazılmıyor"), yani bu
 * dal zaten ölü kod; gerçek akış her zaman treatmentPlanId ile çalışıyor.
 */
async function applyDiscount(req, res, next) {
  try {
    const {
      treatmentPlanId,
      invoiceId,
      discountId,
      discountAmount,
      discountPercentage,
      reason,
    } = req.body;

    if (!treatmentPlanId && !invoiceId) {
      return next(
        new AppError('Either treatmentPlanId or invoiceId is required', 400),
      );
    }

    if (!discountId && !discountAmount && !discountPercentage) {
      return next(new AppError('Discount information is required', 400));
    }

    if (
      discountAmount !== undefined &&
      discountAmount !== null &&
      !(Number.isFinite(Number(discountAmount)) && Number(discountAmount) >= 0)
    ) {
      return next(
        new AppError('discountAmount must be a non-negative number', 400),
      );
    }

    if (
      discountPercentage !== undefined &&
      discountPercentage !== null &&
      !(
        Number.isFinite(Number(discountPercentage)) &&
        Number(discountPercentage) >= 0 &&
        Number(discountPercentage) <= 100
      )
    ) {
      return next(
        new AppError('discountPercentage must be between 0 and 100', 400),
      );
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
      const outcome = await withTransaction(async (client) => {
        // FOR UPDATE: aynı plana eşzamanlı iki indirim isteği gelirse
        // ikincisi birincisi bitene kadar bekler (çift indirim/yarış durumu
        // koruması) — D10'daki "aynı indirim isteğinin tekrarı çift indirim
        // oluşturmamalı" gereksinimi.
        const planResult = await client.query(
          'SELECT patient_id, status, total_estimated_cost, currency FROM treatment_plans WHERE id = $1 FOR UPDATE',
          [treatmentPlanId],
        );

        if (planResult.rows.length === 0) {
          return { notFound: true };
        }

        const plan = planResult.rows[0];
        const currentTotal = parseFloat(plan.total_estimated_cost) || 0;
        let finalDiscount = 0;

        if (discount) {
          if (discount.discount_type === 'percentage') {
            finalDiscount = (currentTotal * discount.discount_value) / 100;
            if (discount.max_discount) {
              finalDiscount = Math.min(finalDiscount, discount.max_discount);
            }
          } else {
            finalDiscount = discount.discount_value;
          }
        } else if (discountAmount) {
          finalDiscount = Number(discountAmount);
        } else if (discountPercentage) {
          finalDiscount = (currentTotal * Number(discountPercentage)) / 100;
        }

        if (!(finalDiscount > 0)) {
          throw new AppError('Computed discount must be greater than 0', 400);
        }
        if (finalDiscount > currentTotal) {
          throw new AppError(
            'Discount cannot exceed the current plan total',
            400,
          );
        }

        const effectivePercentage =
          currentTotal > 0 ? (finalDiscount / currentTotal) * 100 : 0;
        const needsApproval =
          effectivePercentage >
            config.business.highDiscountApprovalThresholdPercent &&
          !isAdmin(req);

        if (needsApproval) {
          if (!reason || !String(reason).trim()) {
            throw new AppError(
              `Bu oranın (%${config.business.highDiscountApprovalThresholdPercent}) üzerindeki indirim talepleri için gerekçe zorunludur`,
              400,
            );
          }

          const pendingCheck = await client.query(
            `SELECT id FROM financial_transactions
             WHERE status = 'pending_approval' AND transaction_type = 'discount'
             AND treatment_plan_id = $1`,
            [treatmentPlanId],
          );
          if (pendingCheck.rows.length > 0) {
            throw new AppError(
              'Bu plan için zaten bekleyen bir indirim talebi var',
              409,
            );
          }

          const pendingTx = await insertFinancialTransaction(client, {
            patientId: plan.patient_id,
            transactionType: 'discount',
            amount: finalDiscount,
            currency: plan.currency || 'TRY',
            treatmentPlanId,
            status: 'pending_approval',
            reason: String(reason).trim(),
            createdBy: req.user.sub,
          });

          return { notFound: false, pending: true, transaction: pendingTx };
        }

        // Eşik altında ya da admin — hemen uygula.
        await client.query(
          `UPDATE treatment_plans
           SET total_estimated_cost = total_estimated_cost - $1,
               updated_at = NOW()
           WHERE id = $2`,
          [finalDiscount, treatmentPlanId],
        );

        // Plan zaten onaylanmışsa (yani tutarı patient_debts'e daha önce
        // tahakkuk ettirilmişse), asıl borç bakiyesi de aynı miktarda
        // düşürülmeli — aksi halde plan ekranında indirim görünür ama
        // hastanın gerçek borcu hiç değişmemiş olurdu (bu, canlı doğrulama
        // sırasında yakalanan gerçek bir tutarsızlıktı). Plan hâlâ
        // 'pending' ise patient_debts'e zaten hiçbir şey yazılmamıştır —
        // dokunulmaz (approveTreatmentPlan onay anında kendi güncel
        // toplamını sıfırdan hesaplayıp yazar).
        if (plan.status === 'approved') {
          await client.query(
            `UPDATE patient_debts
             SET total_debt = GREATEST(0, total_debt - $2),
                 remaining_debt = GREATEST(0, (total_debt - $2) - paid_amount),
                 updated_at = NOW()
             WHERE patient_id = $1`,
            [plan.patient_id, finalDiscount],
          );
        }

        const completedTx = await insertFinancialTransaction(client, {
          patientId: plan.patient_id,
          transactionType: 'discount',
          amount: finalDiscount,
          currency: plan.currency || 'TRY',
          treatmentPlanId,
          status: 'completed',
          reason: reason ? String(reason).trim() : null,
          createdBy: req.user.sub,
          approvedBy: req.user.sub,
        });

        return {
          notFound: false,
          pending: false,
          finalDiscount,
          transaction: completedTx,
        };
      });

      if (outcome.notFound) {
        return next(new AppError('Treatment plan not found', 404));
      }

      await logDataEvent({
        eventType: AuditEventType.DATA_MODIFIED,
        userId: req.user.sub,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || '',
        resourceType: 'treatment_plan',
        resourceId: treatmentPlanId,
        changes: {
          discount: outcome.transaction.amount,
          pending: outcome.pending,
        },
      });

      if (outcome.pending) {
        notifyRole('admin', {
          type: 'approval_request',
          title: 'Onay bekleyen yüksek indirim talebi',
          message: `Plan #${treatmentPlanId} — ${outcome.transaction.amount} TL`,
          data: { transactionId: outcome.transaction.id, treatmentPlanId },
        });

        return res.status(202).json({
          success: true,
          pending: true,
          transaction: outcome.transaction,
          message: 'İndirim talebi patron onayına gönderildi',
        });
      }

      return res.status(200).json({
        success: true,
        discount: outcome.finalDiscount,
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
    // withTransaction içinde bilerek fırlatılan iş kuralı hataları (400/409)
    // doğrudan geçer — genel 500'e düşürülmemeli.
    if (err instanceof AppError) {
      return next(err);
    }
    logger.error({ err }, 'Failed to apply discount');
    return next(new AppError('Failed to apply discount', 500));
  }
}

/**
 * Process payment
 * Secretary/Patron only
 */
const ALLOWED_PAYMENT_METHODS = ['card', 'cash'];

async function processPayment(req, res, next) {
  try {
    const { patientId, treatmentPlanId, amount, paymentMethod, notes } =
      req.body;

    if (
      !patientId ||
      amount === undefined ||
      amount === null ||
      !paymentMethod
    ) {
      return next(
        new AppError(
          'Patient ID, amount, and payment method are required',
          400,
        ),
      );
    }

    // Tutar sayısal, sonlu ve sıfırdan büyük olmalı — aksi halde negatif bir
    // tutar hastanın ödenen miktarını sessizce azaltıp borç hesabını bozar
    // (bkz. aşağıdaki patient_debts güncellemesi).
    const numericAmount =
      typeof amount === 'number' ? amount : parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return next(new AppError('Amount must be a positive number', 400));
    }

    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      return next(
        new AppError(
          `Invalid payment method. Allowed: ${ALLOWED_PAYMENT_METHODS.join(', ')}`,
          400,
        ),
      );
    }

    // Ödeme kaydı + hasta borcu güncellemesi tek transaction'da yapılır:
    // ikinci sorgu başarısız olursa ödeme de kaydedilmemiş olmalı (aksi halde
    // para alınmış görünüp borç düşmemiş bir tutarsızlık oluşur).
    const payment = await withTransaction(async (client) => {
      // Get treatment plan if provided
      let dentistId = null;
      let dentistCommission = null;

      if (treatmentPlanId) {
        const planResult = await client.query(
          'SELECT patient_id, dentist_id, total_estimated_cost FROM treatment_plans WHERE id = $1',
          [treatmentPlanId],
        );

        if (planResult.rows.length === 0) {
          throw new AppError('Treatment plan not found', 404);
        }

        const plan = planResult.rows[0];

        // Ödemenin gönderildiği plan gerçekten bu hastaya mı ait? Önceden
        // hiç kontrol edilmiyordu — bir istemci hatası ya da kötü niyetli
        // istek, ödemeyi yanlış hastanın borcuna/doktor komisyonuna
        // yazdırabilirdi.
        if (Number(plan.patient_id) !== Number(patientId)) {
          await logDataEvent({
            eventType: AuditEventType.UNAUTHORIZED_ACCESS,
            userId: req.user.sub,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || '',
            resourceType: 'payment',
            resourceId: treatmentPlanId,
            changes: {
              reason: 'treatment_plan_patient_mismatch',
              attemptedPatientId: patientId,
              actualPatientId: plan.patient_id,
            },
          });
          throw new AppError(
            'Treatment plan does not belong to the specified patient',
            400,
          );
        }

        dentistId = plan.dentist_id;

        // Calculate dentist commission if dentist has commission_rate
        if (dentistId) {
          const dentistResult = await client.query(
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
            dentistCommission = (numericAmount * commissionRate) / 100;
          }
        }
      }

      // Create payment record
      const paymentResult = await client.query(
        `INSERT INTO payments (
                patient_id, treatment_plan_id, amount, payment_method,
                dentist_commission, dentist_id, notes, created_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            RETURNING *`,
        [
          patientId,
          treatmentPlanId || null,
          numericAmount,
          paymentMethod,
          dentistCommission,
          dentistId,
          notes || null,
          req.user.sub,
        ],
      );

      // Update patient debt - properly calculate remaining debt after adding new payment
      await client.query(
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
        [patientId, numericAmount],
      );

      const payment = paymentResult.rows[0];

      await insertFinancialTransaction(client, {
        patientId,
        transactionType: 'payment',
        amount: numericAmount,
        treatmentPlanId: treatmentPlanId || null,
        paymentId: payment.id,
        status: 'completed',
        createdBy: req.user.sub,
      });

      return payment;
    });

    const dentistId = payment.dentist_id;

    await logDataEvent({
      eventType: AuditEventType.DATA_CREATED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'payment',
      resourceId: payment.id,
      changes: { patientId, amount: numericAmount, paymentMethod },
    });

    // Bildirimler (fire-and-forget; notify* kendi hatasını yakalar)
    const paymentNotification = {
      type: 'payment',
      title: 'Ödeme alındı',
      message: `Tutar: ${amount}`,
      data: {
        paymentId: payment.id,
        patientId,
        action: 'processed',
      },
    };
    notifyRole('admin', paymentNotification);
    if (dentistId && dentistId !== req.user.sub) {
      notifyUser(dentistId, paymentNotification);
    }

    return res.status(201).json({
      success: true,
      payment,
      message: 'Payment processed successfully',
    });
  } catch (err) {
    // withTransaction içinde bilerek fırlatılan iş kuralı hataları (404 plan
    // yok, 400 hasta-plan uyuşmazlığı) doğrudan geçer — genel 500'e düşürülmemeli.
    if (err instanceof AppError) {
      return next(err);
    }
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
                u.email as dentist_email,
                NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') as dentist_name
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
 * Bir tedavi planının hastasının bağlı olduğu (aktif) kurum anlaşmasının genel
 * ve kategori bazlı indirim oranlarını getirir. Anlaşma yoksa ya da pasifse
 * her ikisi de boş/sıfır döner — bu durumda aşağıdaki hesaplama fiyatı hiç
 * değiştirmez (list_price = discounted_cost), yani kurumsuz hastalar için
 * davranış birebir eskisiyle aynı kalır.
 */
async function getInstitutionDiscountForPlan(client, planId) {
  const agreementResult = await client.query(
    `SELECT ia.id, ia.discount_percentage
     FROM treatment_plans tp
     JOIN patients p ON p.id = tp.patient_id
     JOIN institution_agreements ia
       ON ia.id = p.institution_agreement_id AND ia.is_active = true
     WHERE tp.id = $1`,
    [planId],
  );

  if (agreementResult.rows.length === 0) {
    return { generalDiscount: 0, categoryDiscounts: {} };
  }

  const generalDiscount =
    parseFloat(agreementResult.rows[0].discount_percentage) || 0;

  const categoryResult = await client.query(
    `SELECT category_name, discount_percentage
     FROM institution_agreement_category_discounts
     WHERE institution_agreement_id = $1`,
    [agreementResult.rows[0].id],
  );

  const categoryDiscounts = categoryResult.rows.reduce((acc, row) => {
    acc[row.category_name.trim().toLowerCase()] =
      parseFloat(row.discount_percentage) || 0;
    return acc;
  }, {});

  return { generalDiscount, categoryDiscounts };
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

    // Onay + borç ekleme tek transaction'da ve İDEMPOTENT şekilde yapılır:
    // UPDATE ... WHERE status = 'pending' sayesinde plan zaten
    // onaylanmış/reddedilmişse hiçbir satır güncellenmez, dolayısıyla borç
    // ikinci kez eklenemez (çift tıklama veya tekrarlanan istek koruması).
    const outcome = await withTransaction(async (client) => {
      const itemsResult = await client.query(
        'SELECT id, treatment_type, cost FROM treatment_plan_items WHERE treatment_plan_id = $1',
        [planId],
      );

      // Kurum/kategori indirimi burada, tek merkezi noktada hesaplanır —
      // önceden bu hiç yapılmıyor, hasta anlaşmalı olsa bile borç tam liste
      // fiyatından yazılıyordu (bkz. denetim raporu, Kritik #1).
      const { generalDiscount, categoryDiscounts } =
        await getInstitutionDiscountForPlan(client, planId);

      const pricedItems = itemsResult.rows.map((item) => {
        const cost = parseFloat(item.cost) || 0;
        const categoryKey = (item.treatment_type || '').trim().toLowerCase();
        const discountPercentage = Object.prototype.hasOwnProperty.call(
          categoryDiscounts,
          categoryKey,
        )
          ? categoryDiscounts[categoryKey]
          : generalDiscount;
        const discountedCost =
          Math.round(cost * (1 - discountPercentage / 100) * 100) / 100;
        return { id: item.id, discountPercentage, discountedCost };
      });

      const totalCost =
        Math.round(
          pricedItems.reduce((sum, item) => sum + item.discountedCost, 0) * 100,
        ) / 100;

      const updateResult = await client.query(
        `UPDATE treatment_plans
            SET status = $1,
                total_estimated_cost = $2,
                updated_at = NOW()
            WHERE id = $3 AND status = 'pending'
            RETURNING *`,
        [approved ? 'approved' : 'cancelled', totalCost, planId],
      );

      if (updateResult.rows.length === 0) {
        // Ya plan yok ya da zaten pending dışında bir durumda — hangisi
        // olduğunu ayırt etmek için ayrı bir kontrol yapıyoruz.
        const existing = await client.query(
          'SELECT status FROM treatment_plans WHERE id = $1',
          [planId],
        );
        return {
          conflict: true,
          notFound: existing.rows.length === 0,
          currentStatus: existing.rows[0]?.status,
        };
      }

      // Plan durumu başarıyla değiştiği için indirim anlık görüntüsü
      // (snapshot) her kaleme yazılır — sonradan tarife/anlaşma değişse bile
      // bu planın onaylandığı andaki fiyat sabit kalır.
      for (const item of pricedItems) {
        await client.query(
          `UPDATE treatment_plan_items
              SET discount_percentage = $1, discounted_cost = $2, updated_at = NOW()
              WHERE id = $3`,
          [item.discountPercentage, item.discountedCost, item.id],
        );
      }

      const plan = updateResult.rows[0];

      if (approved && totalCost > 0) {
        await client.query(
          `INSERT INTO patient_debts (patient_id, total_debt, paid_amount, remaining_debt, updated_at)
                VALUES ($1, $2, 0, $2, NOW())
                ON CONFLICT (patient_id) DO UPDATE SET
                    total_debt = patient_debts.total_debt + $2,
                    remaining_debt = patient_debts.remaining_debt + $2,
                    updated_at = NOW()`,
          [plan.patient_id, totalCost],
        );

        // Hareket defterine 'charge' (tahakkuk) kaydı — patient_debts özet
        // tablosunun yanında, bu tahakkukun ne zaman/kim tarafından/hangi
        // plandan geldiğini kalıcı olarak saklar.
        await insertFinancialTransaction(client, {
          patientId: plan.patient_id,
          transactionType: 'charge',
          amount: totalCost,
          treatmentPlanId: planId,
          status: 'completed',
          createdBy: req.user.sub,
        });
      }

      return { conflict: false, plan };
    });

    if (outcome.conflict) {
      if (outcome.notFound) {
        return next(new AppError('Treatment plan not found', 404));
      }
      return next(
        new AppError(`Treatment plan is already ${outcome.currentStatus}`, 409),
      );
    }

    const { plan } = outcome;

    await logDataEvent({
      eventType: AuditEventType.DATA_MODIFIED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'treatment_plan',
      resourceId: planId,
      changes: { status: approved ? 'approved' : 'cancelled' },
    });

    // Planın dişhekimine sonucu bildir (fire-and-forget)
    if (plan.dentist_id && plan.dentist_id !== req.user.sub) {
      notifyUser(plan.dentist_id, {
        type: 'treatment_plan',
        title: approved ? 'Tedavi planı onaylandı' : 'Tedavi planı reddedildi',
        message: plan.title || `Plan #${planId}`,
        data: {
          treatmentPlanId: planId,
          action: approved ? 'approved' : 'cancelled',
        },
      });
    }

    return res.status(200).json({
      success: true,
      plan,
      message: `Treatment plan ${approved ? 'approved' : 'cancelled'}`,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to approve treatment plan');
    return next(new AppError('Failed to approve treatment plan', 500));
  }
}

/**
 * Onaylanmış (ve dolayısıyla borçlandırılmış) bir tedavi planını iptal eder.
 * `approveTreatmentPlan`'dan farklı olarak: bu, henüz hiç borç yazılmamış
 * 'pending' bir planı reddetmek değil, ZATEN tahakkuk etmiş bir planı geri
 * almaktır — bu yüzden borcu ters bir 'reversal' hareketiyle düşürmesi
 * gerekir (D8 — "hayalet borç": önceden bu iptal işlemi hiç yoktu, dolayısıyla
 * borç asla geri düşürülemiyordu).
 *
 * Zaten yapılmış ödemelere dokunulmaz — hasta bu plan için ödeme yapmışsa ve
 * plan iptal edilirse, o ödeme tutarı kadar bir "fazla ödeme" durumu oluşur;
 * remaining_debt sıfırın altına düşürülmez (GREATEST(0, ...)) ama bu fazlalık
 * ayrı bir kredi bakiyesi olarak izlenmez (D6 — ayrı, daha kapsamlı bir iş,
 * bu turun kapsamı dışında).
 */
async function cancelApprovedTreatmentPlan(req, res, next) {
  try {
    const planId = parseInt(req.params.id, 10);
    const { reason } = req.body || {};

    if (!reason || !String(reason).trim()) {
      return next(new AppError('Cancellation reason is required', 400));
    }

    const outcome = await withTransaction(async (client) => {
      const planResult = await client.query(
        'SELECT * FROM treatment_plans WHERE id = $1 FOR UPDATE',
        [planId],
      );
      if (planResult.rows.length === 0) {
        return { notFound: true };
      }

      const plan = planResult.rows[0];
      if (plan.status !== 'approved') {
        return { conflict: true, currentStatus: plan.status };
      }

      const totalCost = parseFloat(plan.total_estimated_cost) || 0;

      const updateResult = await client.query(
        `UPDATE treatment_plans
         SET status = 'cancelled',
             cancellation_reason = $1,
             cancelled_by = $2,
             cancelled_at = NOW(),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [String(reason).trim(), req.user.sub, planId],
      );

      if (totalCost > 0) {
        // Bu planın en son tamamlanmış tahakkuk (charge) kaydı — iade
        // hareketini ona referansla bağlamak için (denetim izi).
        const chargeResult = await client.query(
          `SELECT id FROM financial_transactions
           WHERE treatment_plan_id = $1 AND transaction_type = 'charge' AND status = 'completed'
           ORDER BY created_at DESC LIMIT 1`,
          [planId],
        );
        const referenceTransactionId = chargeResult.rows[0]?.id ?? null;

        // Borcu ters kayıtla düş — total_debt bu planın tutarı kadar azalır,
        // remaining_debt yeni total_debt'ten paid_amount düşülerek yeniden
        // hesaplanır (sıfırın altına inmez).
        await client.query(
          `UPDATE patient_debts
           SET total_debt = GREATEST(0, total_debt - $2),
               remaining_debt = GREATEST(0, (total_debt - $2) - paid_amount),
               updated_at = NOW()
           WHERE patient_id = $1`,
          [plan.patient_id, totalCost],
        );

        await insertFinancialTransaction(client, {
          patientId: plan.patient_id,
          transactionType: 'reversal',
          amount: totalCost,
          treatmentPlanId: planId,
          referenceTransactionId,
          status: 'completed',
          reason: String(reason).trim(),
          createdBy: req.user.sub,
        });
      }

      return { notFound: false, conflict: false, plan: updateResult.rows[0] };
    });

    if (outcome.notFound) {
      return next(new AppError('Treatment plan not found', 404));
    }
    if (outcome.conflict) {
      return next(
        new AppError(
          `Only an approved plan can be cancelled this way (current status: ${outcome.currentStatus})`,
          409,
        ),
      );
    }

    const { plan } = outcome;

    await logDataEvent({
      eventType: AuditEventType.DATA_MODIFIED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'treatment_plan',
      resourceId: planId,
      changes: { status: 'cancelled', reason },
    });

    if (plan.dentist_id && plan.dentist_id !== req.user.sub) {
      notifyUser(plan.dentist_id, {
        type: 'treatment_plan',
        title: 'Tedavi planı iptal edildi',
        message: plan.title || `Plan #${planId}`,
        data: { treatmentPlanId: planId, action: 'cancelled' },
      });
    }

    return res.status(200).json({
      success: true,
      plan,
      message: 'Treatment plan cancelled and debt reversed',
    });
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    logger.error({ err }, 'Failed to cancel treatment plan');
    return next(new AppError('Failed to cancel treatment plan', 500));
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

/**
 * Get total receivables (sum of all remaining_debt)
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
 * Get total income (sum of all payments)
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
 * Get patient payment history
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

/**
 * Bir ödemeyi iade eder ya da iade talebi oluşturur.
 * - Patron (admin): iade hemen uygulanır (status='completed').
 * - Sekreter: iade patron onayı bekleyen bir talep olarak oluşturulur
 *   (status='pending_approval') — hiçbir bakiye etkisi hemen uygulanmaz.
 *
 * Ödeme kaydı hiçbir zaman silinmez/değiştirilmez; iade ayrı, orijinal
 * ödemeye referans veren ters bir hareket olarak eklenir (bkz. D7).
 * Aynı ödeme için birden fazla kısmi iade desteklenir, toplamı ödeme
 * tutarını aşamaz (zaten tamamlanmış + onay bekleyen iadeler dahil).
 */
async function refundPayment(req, res, next) {
  try {
    const paymentId = parseInt(req.params.id, 10);
    const { amount, reason } = req.body || {};

    if (!reason || !String(reason).trim()) {
      return next(new AppError('Refund reason is required', 400));
    }

    const outcome = await withTransaction(async (client) => {
      // FOR UPDATE: aynı ödeme için eşzamanlı iki iade isteği gelirse
      // ikincisi birincisi bitene kadar bekler — toplam iade tutarının
      // ödeme tutarını aşmasını önler (yarış durumu koruması).
      const paymentResult = await client.query(
        'SELECT * FROM payments WHERE id = $1 FOR UPDATE',
        [paymentId],
      );
      if (paymentResult.rows.length === 0) {
        return { notFound: true };
      }
      const payment = paymentResult.rows[0];

      const refundedResult = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM financial_transactions
         WHERE payment_id = $1 AND transaction_type = 'refund'
         AND status IN ('completed', 'pending_approval')`,
        [paymentId],
      );
      const alreadyReserved = parseFloat(refundedResult.rows[0].total) || 0;
      const remainingRefundable =
        Math.round((parseFloat(payment.amount) - alreadyReserved) * 100) / 100;

      const requestedAmount =
        amount !== undefined && amount !== null
          ? Number(amount)
          : remainingRefundable;

      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        throw new AppError('Refund amount must be a positive number', 400);
      }
      if (requestedAmount > remainingRefundable + 0.01) {
        throw new AppError(
          `Refund amount exceeds refundable balance (${remainingRefundable.toFixed(2)})`,
          400,
        );
      }

      const admin = isAdmin(req);
      const tx = await insertFinancialTransaction(client, {
        patientId: payment.patient_id,
        transactionType: 'refund',
        amount: requestedAmount,
        paymentId,
        status: admin ? 'completed' : 'pending_approval',
        reason: String(reason).trim(),
        createdBy: req.user.sub,
        approvedBy: admin ? req.user.sub : null,
      });

      if (admin) {
        await executeRefundBalanceEffect(client, tx);
      }

      return { notFound: false, tx };
    });

    if (outcome.notFound) {
      return next(new AppError('Payment not found', 404));
    }

    const { tx } = outcome;

    await logDataEvent({
      eventType: AuditEventType.DATA_MODIFIED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'payment_refund',
      resourceId: paymentId,
      changes: { amount: tx.amount, status: tx.status, reason: tx.reason },
    });

    notifyRole('admin', {
      type: tx.status === 'completed' ? 'refund' : 'approval_request',
      title:
        tx.status === 'completed'
          ? 'Ödeme iade edildi'
          : 'Onay bekleyen iade talebi',
      message: `Ödeme #${paymentId} — ${tx.amount} TL`,
      data: { paymentId, transactionId: tx.id },
    });

    return res.status(tx.status === 'completed' ? 200 : 202).json({
      success: true,
      pending: tx.status === 'pending_approval',
      transaction: tx,
      message:
        tx.status === 'completed'
          ? 'Refund processed'
          : 'İade talebi patron onayına gönderildi',
    });
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    logger.error({ err }, 'Failed to process refund');
    return next(new AppError('Failed to process refund', 500));
  }
}

/**
 * Patron onayı bekleyen indirim/iade taleplerini listeler.
 */
async function getPendingApprovals(req, res, next) {
  try {
    const result = await query(
      `SELECT ft.*,
              p.first_name || ' ' || p.last_name as patient_name,
              u.email as created_by_email,
              NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') as created_by_name
       FROM financial_transactions ft
       LEFT JOIN patients p ON p.id = ft.patient_id
       LEFT JOIN users u ON u.id = ft.created_by
       WHERE ft.status = 'pending_approval'
       ORDER BY ft.created_at ASC`,
    );
    return res.status(200).json({ approvals: result.rows });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch pending approvals');
    return next(new AppError('Failed to fetch pending approvals', 500));
  }
}

/**
 * Bekleyen bir indirim ya da iade talebini onaylar — asıl bakiye/plan
 * etkisi burada, onay anında uygulanır (istek anında değil).
 * Sadece patron (admin).
 */
async function approveFinancialTransaction(req, res, next) {
  try {
    const transactionId = parseInt(req.params.id, 10);

    const outcome = await withTransaction(async (client) => {
      const txResult = await client.query(
        "SELECT * FROM financial_transactions WHERE id = $1 AND status = 'pending_approval' FOR UPDATE",
        [transactionId],
      );
      if (txResult.rows.length === 0) {
        return { notFound: true };
      }
      const tx = txResult.rows[0];

      if (tx.transaction_type === 'discount') {
        // Planın GÜNCEL toplamı üzerinden yeniden uygula — talep
        // oluşturulduğundan beri değişmiş olabilir (ör. yeni kalem eklendi).
        const planResult = await client.query(
          'SELECT status, total_estimated_cost FROM treatment_plans WHERE id = $1 FOR UPDATE',
          [tx.treatment_plan_id],
        );
        if (planResult.rows.length === 0) {
          throw new AppError('Treatment plan not found', 404);
        }
        const currentTotal =
          parseFloat(planResult.rows[0].total_estimated_cost) || 0;
        const appliedAmount = Math.min(parseFloat(tx.amount), currentTotal);

        await client.query(
          `UPDATE treatment_plans
           SET total_estimated_cost = total_estimated_cost - $1, updated_at = NOW()
           WHERE id = $2`,
          [appliedAmount, tx.treatment_plan_id],
        );

        // Plan zaten onaylanmış (borç tahakkuk etmiş) olduğu için asıl
        // bakiye de aynı miktarda düşürülmeli — applyDiscount'un anlık
        // uygulama yolundakiyle aynı düzeltme (bkz. yukarıdaki yorum).
        if (planResult.rows[0].status === 'approved') {
          await client.query(
            `UPDATE patient_debts
             SET total_debt = GREATEST(0, total_debt - $2),
                 remaining_debt = GREATEST(0, (total_debt - $2) - paid_amount),
                 updated_at = NOW()
             WHERE patient_id = $1`,
            [tx.patient_id, appliedAmount],
          );
        }

        await client.query(
          `UPDATE financial_transactions
           SET status = 'completed', amount = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW()
           WHERE id = $3`,
          [appliedAmount, req.user.sub, transactionId],
        );
      } else if (tx.transaction_type === 'refund') {
        await executeRefundBalanceEffect(client, tx);

        await client.query(
          `UPDATE financial_transactions
           SET status = 'completed', approved_by = $1, approved_at = NOW(), updated_at = NOW()
           WHERE id = $2`,
          [req.user.sub, transactionId],
        );
      } else {
        throw new AppError(
          `Cannot approve transaction of type ${tx.transaction_type}`,
          400,
        );
      }

      return { notFound: false, tx };
    });

    if (outcome.notFound) {
      return next(new AppError('Pending approval not found', 404));
    }

    await logDataEvent({
      eventType: AuditEventType.DATA_MODIFIED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'financial_transaction',
      resourceId: transactionId,
      changes: { status: 'completed' },
    });

    return res.status(200).json({ success: true, message: 'Approved' });
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    logger.error({ err }, 'Failed to approve financial transaction');
    return next(new AppError('Failed to approve financial transaction', 500));
  }
}

/**
 * Bekleyen bir indirim ya da iade talebini reddeder — hiçbir bakiye/plan
 * etkisi olmaz. Sadece patron (admin).
 */
async function rejectFinancialTransaction(req, res, next) {
  try {
    const transactionId = parseInt(req.params.id, 10);
    const { reason } = req.body || {};

    const result = await query(
      `UPDATE financial_transactions
       SET status = 'rejected', approved_by = $1, approved_at = NOW(),
           reason = COALESCE($2, reason), updated_at = NOW()
       WHERE id = $3 AND status = 'pending_approval'
       RETURNING *`,
      [req.user.sub, reason ? String(reason).trim() : null, transactionId],
    );

    if (result.rows.length === 0) {
      return next(new AppError('Pending approval not found', 404));
    }

    await logDataEvent({
      eventType: AuditEventType.DATA_MODIFIED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'financial_transaction',
      resourceId: transactionId,
      changes: { status: 'rejected', reason },
    });

    return res.status(200).json({ success: true, transaction: result.rows[0] });
  } catch (err) {
    logger.error({ err }, 'Failed to reject financial transaction');
    return next(new AppError('Failed to reject financial transaction', 500));
  }
}

module.exports = {
  applyDiscount,
  processPayment,
  getPendingTreatmentPlans,
  approveTreatmentPlan,
  cancelApprovedTreatmentPlan,
  getPatientDebt,
  getTotalReceivables,
  getTotalIncome,
  getPatientPayments,
  refundPayment,
  getPendingApprovals,
  approveFinancialTransaction,
  rejectFinancialTransaction,
};
