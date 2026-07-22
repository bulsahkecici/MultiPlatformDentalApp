const { query, withTransaction } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');
const { isDentist, isAdmin, canViewPrices } = require('../middlewares/auth');
const { resolveEffectiveDentistId } = require('../utils/authorizationHelpers');
const { parsePagePagination } = require('../utils/inputValidation');
const { sanitizeAuditChanges } = require('../utils/auditSanitizer');
const logger = require('../utils/logger');
const { notifyUser, notifyRole } = require('../services/notificationHub');

// Tamamlanmış bir tedavinin bu alanları artık PUT ile doğrudan değiştirilemez —
// değişiklik ancak amendTreatment (revizyon) akışından geçebilir (bkz. D3).
// cost/currency kasıtlı olarak dışarıda bırakıldı: fiyat/finansal alanlar
// klinik revizyondan bağımsız, kendi yetki kontrolüne (canViewPrices) tabidir.
const CLINICAL_FIELDS = [
  'treatment_date',
  'treatment_type',
  'tooth_number',
  'description',
  'diagnosis',
  'procedure_notes',
  'status',
];
const DENTIST_ONLY_FIELDS = ['diagnosis', 'procedure_notes'];

function toSnakeCase(key) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

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

    if (
      (diagnosis || procedureNotes || status === 'completed') &&
      !isDentist(req)
    ) {
      return next(
        new AppError(
          'Only dentists can enter diagnosis, procedure notes, or complete a treatment',
          403,
        ),
      );
    }

    // Diş hekimi fiyatı göremez (canViewPrices), dolayısıyla API üzerinden
    // de belirleyemez — arayüzde gizli bir alanın ham istekle set edilebilmesi
    // yalnızca UI kontrolüne güvenmek anlamına gelirdi. Aynı yetki kontrolü
    // currency için de geçerli: fiyatı göremeyen biri para birimini de
    // değiştirememeli (aksi halde cost gizli kalsa da currency ile dolaylı
    // fiyat bilgisi sızdırılabilir/bozulabilir).
    if (
      ((cost !== undefined && cost !== null) ||
        (currency !== undefined && currency !== null && currency !== 'TRY')) &&
      !canViewPrices(req)
    ) {
      return next(
        new AppError(
          'Only admin/secretary can set treatment cost or currency',
          403,
        ),
      );
    }

    // Diş hekimi başka bir doktor adına tedavi kaydı oluşturamaz; sekreter/admin
    // seçtiği dentistId'nin gerçekten aktif bir dişhekimi olduğu doğrulanır.
    const effectiveDentistId = await resolveEffectiveDentistId(
      req,
      query,
      dentistId,
    );

    if (status === 'completed' && (!diagnosis || !procedureNotes)) {
      return next(
        new AppError(
          'Completed treatments require diagnosis and procedure notes',
          400,
        ),
      );
    }

    // Bir tedavi bir randevuya bağlanıyorsa hasta ve hekim bağlamı aynı
    // olmalıdır; aksi halde klinik kayıt yanlış hastanın dosyasına bağlanabilir.
    if (appointmentId) {
      const appointmentResult = await query(
        `SELECT patient_id, dentist_id, status
         FROM appointments WHERE id = $1`,
        [appointmentId],
      );
      if (appointmentResult.rows.length === 0) {
        return next(new AppError('Appointment not found', 404));
      }
      const appointment = appointmentResult.rows[0];
      if (
        Number(appointment.patient_id) !== Number(patientId) ||
        Number(appointment.dentist_id) !== Number(effectiveDentistId)
      ) {
        return next(
          new AppError(
            'Appointment, patient and dentist must belong to the same clinical encounter',
            409,
          ),
        );
      }
      if (['cancelled', 'no_show'].includes(appointment.status)) {
        return next(
          new AppError(
            'Cannot attach treatment to a cancelled/no-show appointment',
            409,
          ),
        );
      }
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
        effectiveDentistId,
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
      changes: sanitizeAuditChanges('treatment', {
        patientId,
        treatmentType,
        cost,
        dentistId: effectiveDentistId,
      }),
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
    if (err instanceof AppError) {
      return next(err);
    }
    return next(new AppError('Failed to create treatment', 500));
  }
}

/**
 * Get treatments with filtering
 */
async function getTreatments(req, res, next) {
  try {
    const { patientId, dentistId, startDate, endDate } = req.query;
    const { page, limit, offset } = parsePagePagination(req.query);
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

    params.push(limit, offset);
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
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);
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

    // Mevcut kaydı her zaman çekiyoruz: dişhekimi IDOR kontrolü, "tamamlanmış
    // tedavi klinik olarak salt okunur" kuralı VE currency'nin gerçekten
    // değişip değişmediğini görmek için gerekli.
    const current = await query(
      `SELECT dentist_id, status, currency, diagnosis, procedure_notes
       FROM treatments WHERE id = $1 AND deleted_at IS NULL`,
      [treatmentId],
    );
    if (current.rows.length === 0) {
      return next(new AppError('Treatment not found', 404));
    }
    const existingTreatment = current.rows[0];

    // Diş hekimi sadece kendi tedavisini güncelleyebilir (IDOR koruması)
    if (
      isDentist(req) &&
      !isAdmin(req) &&
      existingTreatment.dentist_id !== req.user.sub
    ) {
      return next(new AppError('Forbidden', 403));
    }

    // Diş hekimi fiyatı göremez (canViewPrices), dolayısıyla API üzerinden
    // de değiştiremez — arayüzde "cost" alanı hiç gösterilmese de PUT ile
    // ham istek gönderilirse önceden sessizce kabul ediliyordu. Yalnızca
    // gerçek (dolu) bir cost değeri engellenir — istemciler klinik notu
    // güncellerken cost'u null/tanımsız bırakıp yine de sabit bir currency
    // (ör. "TRY") gönderebiliyor; bu tek başına bir fiyat değişikliği değil.
    // currency de aynı yetki kontrolüne tabidir (bkz. createTreatment yorumu) —
    // ama yalnızca kaydın MEVCUT para biriminden GERÇEKTEN farklı bir değere
    // değiştirilmeye çalışılması engellenir; istemcinin zaten aynı olan
    // değeri (ör. "TRY") tekrar göndermesi klinik not güncellemesini bloke etmez.
    const changingCost =
      updates.cost !== undefined &&
      updates.cost !== null &&
      updates.cost !== '';
    const changingCurrency =
      updates.currency !== undefined &&
      updates.currency !== null &&
      updates.currency !== '' &&
      updates.currency !== existingTreatment.currency;
    if ((changingCost || changingCurrency) && !canViewPrices(req)) {
      return next(
        new AppError(
          'Only admin/secretary can change treatment cost or currency',
          403,
        ),
      );
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
    const touchedClinicalFields = [];
    const touchedDentistOnlyFields = [];

    Object.keys(updates).forEach((key) => {
      const snakeKey = toSnakeCase(key);
      if (allowedFields.includes(snakeKey)) {
        if (
          DENTIST_ONLY_FIELDS.includes(snakeKey) &&
          !isDentist(req) &&
          (updates[key] === null || updates[key] === '')
        ) {
          return;
        }
        if (CLINICAL_FIELDS.includes(snakeKey)) {
          touchedClinicalFields.push(snakeKey);
        }
        if (DENTIST_ONLY_FIELDS.includes(snakeKey)) {
          touchedDentistOnlyFields.push(snakeKey);
        }
        setClauses.push(`${snakeKey} = $${paramIndex++}`);
        params.push(updates[key]);
      }
    });

    const isCompleting =
      updates.status === 'completed' &&
      existingTreatment.status !== 'completed';
    if (
      (touchedDentistOnlyFields.length > 0 || isCompleting) &&
      !isDentist(req)
    ) {
      return next(
        new AppError('Only dentists can change clinical treatment fields', 403),
      );
    }
    if (
      (touchedDentistOnlyFields.length > 0 || isCompleting) &&
      existingTreatment.dentist_id !== req.user.sub
    ) {
      return next(
        new AppError(
          'Only the treating dentist can change clinical treatment fields',
          403,
        ),
      );
    }

    const resultingStatus = updates.status ?? existingTreatment.status;
    const resultingDiagnosis = updates.diagnosis ?? existingTreatment.diagnosis;
    const resultingProcedureNotes =
      updates.procedureNotes ??
      updates.procedure_notes ??
      existingTreatment.procedure_notes;
    if (
      resultingStatus === 'completed' &&
      (isCompleting || touchedDentistOnlyFields.length > 0) &&
      (!resultingDiagnosis || !resultingProcedureNotes)
    ) {
      return next(
        new AppError(
          'Completed treatments require diagnosis and procedure notes',
          400,
        ),
      );
    }

    // Tamamlanmış bir tedavinin klinik alanları artık doğrudan PUT ile
    // değiştirilemez — sekreter ya da hekim, tanı/prosedür notu/diş no/
    // tedavi türü/tarih/durumu değiştirmek istiyorsa POST /amend akışını
    // (gerekçe zorunlu, revizyon geçmişi saklanır) kullanmalı (bkz. D3).
    if (
      existingTreatment.status === 'completed' &&
      touchedClinicalFields.length > 0
    ) {
      return next(
        new AppError(
          'Completed treatments are read-only for clinical fields. Use POST /api/treatments/:id/amend with a reason to record a revision.',
          409,
          { touchedClinicalFields },
        ),
      );
    }

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
      changes: sanitizeAuditChanges('treatment', updates),
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
    if (err instanceof AppError) {
      return next(err);
    }
    return next(new AppError('Failed to update treatment', 500));
  }
}

/**
 * "Delete" a treatment record — in reality a soft VOID request/approval
 * workflow, never a hard DELETE and never an unreviewed void.
 *
 * Yetki matrisi (D2):
 * - Admin/patron: void'u anında uygular (acil/gerekçeli durumlar için).
 * - Diş hekimi: yalnızca KENDİ tedavisi için bir void TALEBİ açabilir;
 *   talep patron onayına düşer, tedavi bu sırada aktif kalır.
 * - Sekreter: hiçbir tedaviyi doğrudan void edemez; her zaman bir talep açar.
 *
 * Gerekçe (reason) her koşulda zorunludur. Onaylanan bir talep, kaydı
 * `deleted_at` ile işaretler (asla hard delete); reddedilen bir talep hiçbir
 * bakiye/klinik etkisi olmadan kapanır ve tedavi normal şekilde kullanılabilir
 * kalır.
 */
async function deleteTreatment(req, res, next) {
  try {
    const treatmentId = parseInt(req.params.id, 10);
    const voidReason =
      typeof req.body?.reason === 'string' && req.body.reason.trim()
        ? req.body.reason.trim()
        : null;

    if (!voidReason) {
      return next(new AppError('Void reason is required', 400));
    }

    const current = await query(
      'SELECT dentist_id, void_status FROM treatments WHERE id = $1 AND deleted_at IS NULL',
      [treatmentId],
    );
    if (current.rows.length === 0) {
      return next(new AppError('Treatment not found', 404));
    }
    const existingTreatment = current.rows[0];

    // Diş hekimi sadece kendi tedavisi için talep açabilir (IDOR koruması)
    if (
      isDentist(req) &&
      !isAdmin(req) &&
      existingTreatment.dentist_id !== req.user.sub
    ) {
      return next(new AppError('Forbidden', 403));
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    if (isAdmin(req)) {
      const result = await query(
        `UPDATE treatments
         SET deleted_at = NOW(),
             void_reason = $1,
             voided_by = $2,
             status = 'cancelled',
             void_status = 'approved',
             void_approved_by = $2,
             void_approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $3 AND deleted_at IS NULL
         RETURNING id`,
        [voidReason, req.user.sub, treatmentId],
      );

      if (result.rows.length === 0) {
        return next(new AppError('Treatment not found', 404));
      }

      await logDataEvent({
        eventType: AuditEventType.TREATMENT_DELETED,
        userId: req.user.sub,
        ipAddress,
        userAgent,
        resourceType: 'treatment',
        resourceId: treatmentId,
        changes: sanitizeAuditChanges('treatment', {
          voidReason,
          direct: true,
        }),
      });

      return res.status(204).send();
    }

    // Dişhekimi veya sekreter: doğrudan void yok, patron onayına talep oluşturulur.
    if (existingTreatment.void_status === 'pending') {
      return next(
        new AppError('This treatment already has a pending void request', 409),
      );
    }

    const requested = await query(
      `UPDATE treatments
       SET void_status = 'pending',
           void_requested_at = NOW(),
           void_requested_by = $1,
           void_request_reason = $2,
           void_approved_at = NULL,
           void_approved_by = NULL,
           void_rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING id`,
      [req.user.sub, voidReason, treatmentId],
    );

    if (requested.rows.length === 0) {
      return next(new AppError('Treatment not found', 404));
    }

    await logDataEvent({
      eventType: AuditEventType.TREATMENT_UPDATED,
      userId: req.user.sub,
      ipAddress,
      userAgent,
      resourceType: 'treatment',
      resourceId: treatmentId,
      changes: sanitizeAuditChanges('treatment', {
        voidReason,
        requestedVoid: true,
      }),
    });

    notifyRole('admin', {
      type: 'approval_request',
      title: 'Onay bekleyen tedavi void talebi',
      message: `Tedavi #${treatmentId}`,
      data: { treatmentId, action: 'void_requested' },
    });

    return res.status(202).json({
      success: true,
      pending: true,
      message: 'Void talebi patron onayına gönderildi',
    });
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    return next(new AppError('Failed to delete treatment', 500));
  }
}

/**
 * Onay bekleyen void taleplerini listeler (sadece patron/admin).
 */
async function getPendingVoidRequests(req, res, next) {
  try {
    const result = await query(
      `SELECT t.id, t.treatment_type, t.treatment_date, t.status,
              t.void_requested_at, t.void_request_reason,
              t.dentist_id, t.patient_id,
              p.first_name || ' ' || p.last_name as patient_name,
              u.email as requested_by_email
       FROM treatments t
       LEFT JOIN patients p ON p.id = t.patient_id
       LEFT JOIN users u ON u.id = t.void_requested_by
       WHERE t.void_status = 'pending' AND t.deleted_at IS NULL
       ORDER BY t.void_requested_at ASC`,
    );
    return res.status(200).json({ requests: result.rows });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch pending void requests');
    return next(new AppError('Failed to fetch pending void requests', 500));
  }
}

/**
 * Bekleyen bir void talebini onaylar (tedaviyi gerçekten void eder) ya da
 * reddeder (tedavi olduğu gibi kalır). Sadece patron/admin.
 */
async function decideTreatmentVoid(req, res, next) {
  try {
    const treatmentId = parseInt(req.params.id, 10);
    const { approved, rejectionReason } = req.body || {};

    if (approved === undefined) {
      return next(new AppError('approved (true/false) is required', 400));
    }
    if (!approved && (!rejectionReason || !String(rejectionReason).trim())) {
      return next(
        new AppError('Rejection reason is required when rejecting', 400),
      );
    }

    const outcome = await withTransaction(async (client) => {
      const current = await client.query(
        "SELECT * FROM treatments WHERE id = $1 AND void_status = 'pending' AND deleted_at IS NULL FOR UPDATE",
        [treatmentId],
      );
      if (current.rows.length === 0) {
        return { notFound: true };
      }
      const treatment = current.rows[0];

      if (approved) {
        const result = await client.query(
          `UPDATE treatments
           SET deleted_at = NOW(),
               status = 'cancelled',
               void_reason = void_request_reason,
               voided_by = $1,
               void_status = 'approved',
               void_approved_by = $1,
               void_approved_at = NOW(),
               updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [req.user.sub, treatmentId],
        );
        return { notFound: false, treatment: result.rows[0] };
      }

      const result = await client.query(
        `UPDATE treatments
         SET void_status = 'rejected',
             void_approved_by = $1,
             void_approved_at = NOW(),
             void_rejection_reason = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [req.user.sub, String(rejectionReason).trim(), treatmentId],
      );
      return { notFound: false, treatment: result.rows[0] };
    });

    if (outcome.notFound) {
      return next(new AppError('Pending void request not found', 404));
    }

    await logDataEvent({
      eventType: AuditEventType.TREATMENT_UPDATED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'treatment',
      resourceId: treatmentId,
      changes: sanitizeAuditChanges('treatment', {
        voidDecision: approved ? 'approved' : 'rejected',
      }),
    });

    const { treatment } = outcome;
    if (
      treatment.void_requested_by &&
      treatment.void_requested_by !== req.user.sub
    ) {
      notifyUser(treatment.void_requested_by, {
        type: 'treatment',
        title: approved ? 'Void talebi onaylandı' : 'Void talebi reddedildi',
        message: `Tedavi #${treatmentId}`,
        data: {
          treatmentId,
          action: approved ? 'void_approved' : 'void_rejected',
        },
      });
    }

    return res.status(200).json({ success: true, treatment });
  } catch (err) {
    logger.error({ err }, 'Failed to decide treatment void request');
    return next(new AppError('Failed to decide treatment void request', 500));
  }
}

/**
 * Tamamlanmış bir tedavinin klinik alanlarında değişiklik yapar — doğrudan
 * PUT'un aksine, önceki değerleri kaybetmeden bir revizyon (treatment_revisions)
 * kaydı oluşturur (D3). Yalnızca kaydın sahibi dişhekimi ya da patron/admin
 * kullanabilir — sekreter tamamlanmış klinik içeriği hiçbir şekilde değiştiremez.
 * `status` alanı (ör. tekrar 'planned' yapmak) yalnızca admin tarafından
 * değiştirilebilir; hekim kendi kaydını bile doğrudan yeniden açamaz.
 */
async function amendTreatment(req, res, next) {
  try {
    const treatmentId = parseInt(req.params.id, 10);
    const { changes, reason } = req.body || {};

    if (!reason || !String(reason).trim()) {
      return next(new AppError('Amendment reason is required', 400));
    }
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      return next(new AppError('changes object is required', 400));
    }

    const admin = isAdmin(req);
    const dentist = isDentist(req);

    if (!admin && !dentist) {
      return next(
        new AppError(
          'Only the treating dentist or an admin can amend a completed treatment',
          403,
        ),
      );
    }

    const AMENDABLE_FIELDS = [
      'treatment_date',
      'treatment_type',
      'tooth_number',
      'description',
      'diagnosis',
      'procedure_notes',
    ];

    const requestedKeys = Object.keys(changes);
    const invalidKeys = requestedKeys.filter((key) => {
      const snake = toSnakeCase(key);
      if (snake === 'status') {
        return !admin; // yalnızca admin status'u revizyonla değiştirebilir
      }
      return !AMENDABLE_FIELDS.includes(snake);
    });
    if (invalidKeys.length > 0) {
      return next(
        new AppError(`Field(s) not amendable: ${invalidKeys.join(', ')}`, 400),
      );
    }

    const outcome = await withTransaction(async (client) => {
      const current = await client.query(
        'SELECT * FROM treatments WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [treatmentId],
      );
      if (current.rows.length === 0) {
        return { notFound: true };
      }
      const treatment = current.rows[0];

      if (treatment.status !== 'completed') {
        return { notCompleted: true };
      }
      if (!admin && treatment.dentist_id !== req.user.sub) {
        return { forbidden: true };
      }

      const previousValues = {};
      const newValues = {};
      const changedFields = [];
      const setClauses = [];
      const params = [];
      let paramIndex = 1;

      for (const key of requestedKeys) {
        const snake = toSnakeCase(key);
        const newValue = changes[key];
        const oldValue = treatment[snake];
        if (String(oldValue ?? '') === String(newValue ?? '')) {
          continue; // no-op alan — revizyona dahil etme
        }
        previousValues[snake] = oldValue;
        newValues[snake] = newValue;
        changedFields.push(snake);
        setClauses.push(`${snake} = $${paramIndex++}`);
        params.push(newValue);
      }

      if (changedFields.length === 0) {
        return { noChanges: true };
      }

      const revisionNumberResult = await client.query(
        'SELECT COALESCE(MAX(revision_number), 0) + 1 as next FROM treatment_revisions WHERE treatment_id = $1',
        [treatmentId],
      );
      const revisionNumber = revisionNumberResult.rows[0].next;

      await client.query(
        `INSERT INTO treatment_revisions (
           treatment_id, revision_number, changed_fields, previous_values,
           new_values, reason, created_by, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          treatmentId,
          revisionNumber,
          changedFields.join(','),
          JSON.stringify(previousValues),
          JSON.stringify(newValues),
          String(reason).trim(),
          req.user.sub,
        ],
      );

      setClauses.push(`updated_by = $${paramIndex++}`);
      params.push(req.user.sub);
      setClauses.push('updated_at = NOW()');
      params.push(treatmentId);

      const updated = await client.query(
        `UPDATE treatments SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params,
      );

      return { treatment: updated.rows[0], revisionNumber };
    });

    if (outcome.notFound) {
      return next(new AppError('Treatment not found', 404));
    }
    if (outcome.notCompleted) {
      return next(
        new AppError(
          'Amendment is only for completed treatments; use PUT for non-completed ones',
          400,
        ),
      );
    }
    if (outcome.forbidden) {
      return next(new AppError('Forbidden', 403));
    }
    if (outcome.noChanges) {
      return next(new AppError('No actual changes to amend', 400));
    }

    await logDataEvent({
      eventType: AuditEventType.TREATMENT_UPDATED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'treatment',
      resourceId: treatmentId,
      changes: sanitizeAuditChanges('treatment', {
        amended: true,
        revisionNumber: outcome.revisionNumber,
      }),
    });

    return res.status(200).json({
      success: true,
      treatment: outcome.treatment,
      revisionNumber: outcome.revisionNumber,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to amend treatment');
    return next(new AppError('Failed to amend treatment', 500));
  }
}

/**
 * Bir tedavinin tüm revizyon geçmişini döner (D3 — "değişiklik geçmişi
 * kullanıcıya gösterilir").
 */
async function getTreatmentRevisions(req, res, next) {
  try {
    const treatmentId = parseInt(req.params.id, 10);

    if (isDentist(req) && !isAdmin(req)) {
      const ownership = await query(
        'SELECT dentist_id FROM treatments WHERE id = $1',
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
      `SELECT r.*, u.email as created_by_email
       FROM treatment_revisions r
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.treatment_id = $1
       ORDER BY r.revision_number ASC`,
      [treatmentId],
    );

    return res.status(200).json({ revisions: result.rows });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch treatment revisions');
    return next(new AppError('Failed to fetch treatment revisions', 500));
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

    const containsPrice = items.some((item) => Number(item?.cost) > 0);
    if (containsPrice && !canViewPrices(req)) {
      return next(
        new AppError('Only admin/secretary can set treatment plan prices', 403),
      );
    }

    // Diş hekimi başka bir doktor adına tedavi planı oluşturamaz; sekreter/admin
    // seçtiği dentistId'nin gerçekten aktif bir dişhekimi olduğu doğrulanır.
    const effectiveDentistId = await resolveEffectiveDentistId(
      req,
      query,
      dentistId,
    );

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
            effectiveDentistId,
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

        // Ham kalem toplamı (henüz hiçbir indirim uygulanmadan) burada
        // yazılır — aksi halde total_estimated_cost onaya kadar NULL kalır
        // ve pending bir plana manuel indirim uygulamak (yüzde/limit
        // hesapları currentTotal=0 üzerinden yapıldığı için) hiçbir zaman
        // mümkün olmazdı. Kurum/kategori indirimi hâlâ yalnızca onay
        // anında (approveTreatmentPlan) uygulanır; bu sadece onay öncesi
        // bir önizleme/temel tutardır.
        const rawTotal =
          Math.round(
            itemsResult.rows.reduce(
              (sum, item) => sum + (parseFloat(item.cost) || 0),
              0,
            ) * 100,
          ) / 100;

        const totalUpdateResult = await client.query(
          `UPDATE treatment_plans SET total_estimated_cost = $1, currency = $2, updated_at = NOW()
           WHERE id = $3 RETURNING *`,
          [rawTotal, itemsResult.rows[0]?.currency || 'TRY', createdPlan.id],
        );

        return { plan: totalUpdateResult.rows[0], items: itemsResult.rows };
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
      changes: sanitizeAuditChanges('treatment', {
        patientId,
        title,
        itemCount: items.length,
        dentistId: effectiveDentistId,
      }),
    });

    return res.status(201).json({
      plan: {
        ...plan,
        items: insertedItems,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
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
  getPendingVoidRequests,
  decideTreatmentVoid,
  amendTreatment,
  getTreatmentRevisions,
  createTreatmentPlan,
  getTreatmentPlans,
};
