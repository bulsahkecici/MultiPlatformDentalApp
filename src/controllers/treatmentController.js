const { query, withTransaction } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');
const { isDentist, canViewPrices } = require('../middlewares/auth');
const logger = require('../utils/logger');
const { notifyUser } = require('../services/notificationHub');

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
      currency = 'TRY',
      status = 'planned',
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

    // Diş hekimi fiyatı göremez (canViewPrices), dolayısıyla API üzerinden
    // de belirleyemez — arayüzde gizli bir alanın ham istekle set edilebilmesi
    // yalnızca UI kontrolüne güvenmek anlamına gelirdi.
    if (cost !== undefined && cost !== null && !canViewPrices(req)) {
      return next(
        new AppError('Only admin/secretary can set treatment cost', 403),
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

    // İlgili dişhekimine kalıcı bildirim (fire-and-forget; notify* kendi hatasını yakalar)
    if (treatment.dentist_id && treatment.dentist_id !== req.user.sub) {
      notifyUser(treatment.dentist_id, {
        type: 'treatment',
        title: 'Yeni tedavi kaydı',
        message: `Tedavi: ${treatment.treatment_type || ''}`.trim(),
        data: { treatmentId: treatment.id, action: 'created' },
      });
    }

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
    // Voided (soft-deleted) kayıtlar varsayılan listeden gizlenir — patients
    // tablosuyla aynı konvansiyon (bkz. patientController.js).
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    // Diş hekimi sadece kendi tedavilerini görebilir
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
      conditions.push(`treatment_date >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`treatment_date <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause =
      conditions.length > 0 ? conditions.join(' AND ') : '1=1';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM treatments WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get treatments with patient and dentist info
    // Fiyat görme kontrolü: Diş hekimi fiyat göremez
    const canViewPrice = canViewPrices(req);
    const costField = canViewPrice ? 't.cost' : 'NULL as cost';

    params.push(parseInt(limit, 10), offset);
    const result = await query(
      `SELECT 
        t.id, t.patient_id, t.appointment_id, t.dentist_id,
        t.treatment_date, t.treatment_type, t.tooth_number,
        t.description, t.diagnosis, t.procedure_notes,
        ${costField},
        t.currency, t.status, t.created_at, t.updated_at,
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
    logger.error({ err }, 'Failed to fetch treatments');
    return next(new AppError('Failed to fetch treatments', 500));
  }
}

/**
 * Get single treatment by ID
 */
async function getTreatmentById(req, res, next) {
  try {
    const treatmentId = parseInt(req.params.id, 10);

    // Fiyat görme kontrolü
    const canViewPrice = canViewPrices(req);
    const costField = canViewPrice ? 't.cost' : 'NULL as cost';

    const result = await query(
      `SELECT 
        t.id, t.patient_id, t.appointment_id, t.dentist_id,
        t.treatment_date, t.treatment_type, t.tooth_number,
        t.description, t.diagnosis, t.procedure_notes,
        ${costField},
        t.currency, t.status, t.created_at, t.updated_at,
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

    // Diş hekimi sadece kendi tedavilerini görebilir
    if (isDentist(req) && result.rows[0].dentist_id !== req.user.sub) {
      return next(new AppError('Forbidden', 403));
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

    // Diş hekimi fiyatı göremez (canViewPrices), dolayısıyla API üzerinden
    // de değiştiremez — arayüzde "cost" alanı hiç gösterilmese de PUT ile
    // ham istek gönderilirse önceden sessizce kabul ediliyordu. Yalnızca
    // gerçek (dolu) bir cost değeri engellenir — istemciler klinik notu
    // güncellerken cost'u null/tanımsız bırakıp yine de sabit bir currency
    // (ör. "TRY") gönderebiliyor; bu tek başına bir fiyat değişikliği değil.
    if (
      updates.cost !== undefined &&
      updates.cost !== null &&
      updates.cost !== '' &&
      !canViewPrices(req)
    ) {
      return next(
        new AppError('Only admin/secretary can change treatment cost', 403),
      );
    }

    // Diş hekimi sadece kendi tedavisini güncelleyebilir (IDOR koruması)
    if (isDentist(req)) {
      const ownership = await query(
        'SELECT dentist_id FROM treatments WHERE id = $1 AND deleted_at IS NULL',
        [treatmentId],
      );
      if (ownership.rows.length === 0) {
        return next(new AppError('Treatment not found', 404));
      }
      if (ownership.rows[0].dentist_id !== req.user.sub) {
        return next(new AppError('Forbidden', 403));
      }
    }

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
      const snakeKey = key.replace(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`,
      );
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
    setClauses.push('updated_at = NOW()');

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

    // Tedavi tamamlandığında ilgili dişhekimine bildir
    const updatedTreatment = result.rows[0];
    if (
      updatedTreatment.status === 'completed' &&
      updatedTreatment.dentist_id &&
      updatedTreatment.dentist_id !== req.user.sub
    ) {
      notifyUser(updatedTreatment.dentist_id, {
        type: 'treatment',
        title: 'Tedavi tamamlandı',
        message: `Tedavi: ${updatedTreatment.treatment_type || ''}`.trim(),
        data: { treatmentId: updatedTreatment.id, action: 'completed' },
      });
    }

    return res.status(200).json({ treatment: result.rows[0] });
  } catch (err) {
    return next(new AppError('Failed to update treatment', 500));
  }
}

/**
 * "Delete" a treatment record — in reality a soft VOID, never a hard DELETE.
 * Tedaviler faturalanmış/klinik kayıtlardır; kalıcı silme hem denetlenebilirliği
 * hem de daha önce bu kayda bağlanmış ödeme/borç geçmişini geri dönülemez
 * şekilde bozar. Kayıt `deleted_at` ile işaretlenir, kim/ne zaman/neden
 * void ettiği saklanır; veritabanından asla kaldırılmaz.
 */
async function deleteTreatment(req, res, next) {
  try {
    const treatmentId = parseInt(req.params.id, 10);
    const voidReason =
      typeof req.body?.reason === 'string' && req.body.reason.trim()
        ? req.body.reason.trim()
        : null;

    // Diş hekimi sadece kendi tedavisini void edebilir (IDOR koruması)
    if (isDentist(req)) {
      const ownership = await query(
        'SELECT dentist_id FROM treatments WHERE id = $1 AND deleted_at IS NULL',
        [treatmentId],
      );
      if (ownership.rows.length === 0) {
        return next(new AppError('Treatment not found', 404));
      }
      if (ownership.rows[0].dentist_id !== req.user.sub) {
        return next(new AppError('Forbidden', 403));
      }
    }

    const result = await query(
      `UPDATE treatments
       SET deleted_at = NOW(),
           void_reason = $1,
           voided_by = $2,
           status = 'cancelled',
           updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING id`,
      [voidReason, req.user.sub, treatmentId],
    );

    if (result.rows.length === 0) {
      return next(new AppError('Treatment not found', 404));
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    await logDataEvent({
      eventType: AuditEventType.TREATMENT_DELETED,
      userId: req.user.sub,
      ipAddress,
      userAgent,
      resourceType: 'treatment',
      resourceId: treatmentId,
      changes: { voidReason },
    });

    return res.status(204).send();
  } catch (err) {
    return next(new AppError('Failed to delete treatment', 500));
  }
}

/**
 * Create treatment plan with multiple teeth and procedures
 */
async function createTreatmentPlan(req, res, next) {
  try {
    const {
      patientId,
      dentistId,
      title,
      description,
      items, // Array of { toothNumber, treatmentType, cost, notes }
    } = req.body || {};

    if (
      !patientId ||
      !title ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return next(
        new AppError('Patient ID, title, and items are required', 400),
      );
    }

    // Plan + kalemleri tek transaction'da oluştur — bir kalem eklemesi
    // başarısız olursa yarım kalmış (kalemsiz) bir plan oluşmasın.
    const { plan, items: insertedItems } = await withTransaction(
      async (client) => {
        const planResult = await client.query(
          `INSERT INTO treatment_plans (
                patient_id, dentist_id, title, description, status,
                created_by, updated_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, 'pending', $5, $5, NOW(), NOW())
            RETURNING *`,
          [
            patientId,
            dentistId || req.user.sub,
            title,
            description || null,
            req.user.sub,
          ],
        );

        const createdPlan = planResult.rows[0];

        // Aynı client üzerinde sırayla çalıştır (pg Client eşzamanlı sorguyu
        // desteklemez); herhangi biri başarısız olursa transaction geri alınır.
        for (const item of items) {
          await client.query(
            `INSERT INTO treatment_plan_items (
                    treatment_plan_id, tooth_number, treatment_type, cost, currency, notes, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [
              createdPlan.id,
              item.toothNumber,
              item.treatmentType,
              item.cost || 0,
              item.currency || 'TRY',
              item.notes || null,
            ],
          );
        }

        const itemsResult = await client.query(
          'SELECT * FROM treatment_plan_items WHERE treatment_plan_id = $1',
          [createdPlan.id],
        );

        return { plan: createdPlan, items: itemsResult.rows };
      },
    );

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    await logDataEvent({
      eventType: AuditEventType.TREATMENT_CREATED,
      userId: req.user.sub,
      ipAddress,
      userAgent,
      resourceType: 'treatment_plan',
      resourceId: plan.id,
      changes: { patientId, title, itemCount: items.length },
    });

    return res.status(201).json({
      plan: {
        ...plan,
        items: insertedItems,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to create treatment plan');
    return next(new AppError('Failed to create treatment plan', 500));
  }
}

/**
 * Get treatment plans
 */
async function getTreatmentPlans(req, res, next) {
  try {
    const { patientId, dentistId, status } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (patientId) {
      conditions.push(`tp.patient_id = $${paramIndex++}`);
      params.push(parseInt(patientId, 10));
    }

    if (dentistId) {
      conditions.push(`tp.dentist_id = $${paramIndex++}`);
      params.push(parseInt(dentistId, 10));
    } else if (isDentist(req)) {
      conditions.push(`tp.dentist_id = $${paramIndex++}`);
      params.push(req.user.sub);
    }

    if (status) {
      conditions.push(`tp.status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause =
      conditions.length > 0 ? conditions.join(' AND ') : '1=1';

    const result = await query(
      `SELECT tp.*, 
                p.first_name || ' ' || p.last_name as patient_name,
                u.email as dentist_email
            FROM treatment_plans tp
            LEFT JOIN patients p ON tp.patient_id = p.id
            LEFT JOIN users u ON tp.dentist_id = u.id
            WHERE ${whereClause}
            ORDER BY tp.created_at DESC`,
      params,
    );

    // Get items for each plan
    const plans = await Promise.all(
      result.rows.map(async (plan) => {
        const itemsResult = await query(
          'SELECT * FROM treatment_plan_items WHERE treatment_plan_id = $1',
          [plan.id],
        );

        // Hide cost if dentist
        const canViewPrice = canViewPrices(req);
        const items = itemsResult.rows.map((item) => ({
          ...item,
          cost: canViewPrice ? item.cost : null,
        }));

        return {
          ...plan,
          total_estimated_cost: canViewPrice ? plan.total_estimated_cost : null,
          items,
        };
      }),
    );

    return res.status(200).json({ plans });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch treatment plans');
    return next(new AppError('Failed to fetch treatment plans', 500));
  }
}

module.exports = {
  createTreatment,
  getTreatments,
  getTreatmentById,
  updateTreatment,
  deleteTreatment,
  createTreatmentPlan,
  getTreatmentPlans,
};
