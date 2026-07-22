const validator = require('validator');
const { query, withTransaction } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');
const { parsePagePagination } = require('../utils/inputValidation');
const { sanitizeAuditChanges } = require('../utils/auditSanitizer');

const DEMOGRAPHIC_FIELDS = new Set([
  'first_name',
  'last_name',
  'date_of_birth',
  'gender',
  'email',
  'phone',
  'address',
  'city',
  'country',
  'identity_type',
  'identity_number',
  'emergency_contact_name',
  'emergency_contact_phone',
  'insurance_provider',
  'insurance_policy_number',
  'institution_agreement_id',
]);

const CLINICAL_FIELDS = new Set([
  'blood_type',
  'allergies',
  'medical_conditions',
  'current_medications',
  'critical_alerts',
  'notes',
]);

const ANAMNESIS_FIELDS = [
  'blood_type',
  'allergies',
  'medical_conditions',
  'current_medications',
  'critical_alerts',
];

function hasRole(req, role) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes(role);
}

function canManageClinicalData(req) {
  return hasRole(req, 'dentist');
}

function toSnakeCase(key) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function normalizeOptionalText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeIdentity(identityType, identityNumber) {
  const type = normalizeOptionalText(identityType)?.toLowerCase() || null;
  let number = normalizeOptionalText(identityNumber);

  if (!type && !number) return { type: null, number: null };
  if (!type || !number) {
    throw new AppError(
      'Identity type and identity number must be provided together',
      400,
    );
  }
  if (!['tc', 'ykn', 'passport', 'other'].includes(type)) {
    throw new AppError('Invalid identity type', 400);
  }

  number = number.toUpperCase().replace(/\s+/g, '');
  if ((type === 'tc' || type === 'ykn') && !/^\d{11}$/.test(number)) {
    throw new AppError('TC/YKN identity number must contain 11 digits', 400);
  }
  if (type === 'tc') {
    const digits = number.split('').map(Number);
    const tenth =
      ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7 -
        (digits[1] + digits[3] + digits[5] + digits[7])) %
      10;
    const normalizedTenth = (tenth + 10) % 10;
    const eleventh =
      digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;
    if (
      digits[0] === 0 ||
      digits[9] !== normalizedTenth ||
      digits[10] !== eleventh
    ) {
      throw new AppError('Invalid TC identity number checksum', 400);
    }
  }
  if (
    (type === 'passport' || type === 'other') &&
    !/^[A-Z0-9-]{3,50}$/.test(number)
  ) {
    throw new AppError('Invalid identity number format', 400);
  }
  return { type, number };
}

function normalizeDateOfBirth(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new AppError('Date of birth must use YYYY-MM-DD format', 400);
  }
  const date = new Date(`${text}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== text
  ) {
    throw new AppError('Invalid date of birth', 400);
  }
  if (text > new Date().toISOString().slice(0, 10)) {
    throw new AppError('Date of birth cannot be in the future', 400);
  }
  return text;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

async function assertNoDuplicatePatient(
  client,
  { identityType, identityNumber, firstName, lastName, dateOfBirth, phone },
  excludePatientId = null,
) {
  if (identityType && identityNumber) {
    const duplicateIdentity = await client.query(
      `SELECT id, protocol_number
       FROM patients
       WHERE identity_type = $1
         AND UPPER(BTRIM(identity_number)) = $2
         AND deleted_at IS NULL
         AND ($3::INTEGER IS NULL OR id <> $3)`,
      [identityType, identityNumber, excludePatientId],
    );
    if (duplicateIdentity.rows.length > 0) {
      throw new AppError('A patient with this identity already exists', 409, {
        patientId: duplicateIdentity.rows[0].id,
        protocolNumber: duplicateIdentity.rows[0].protocol_number,
      });
    }
  }

  const normalizedPhone = normalizePhone(phone);
  if (!dateOfBirth && !normalizedPhone) return;

  const possibleDuplicate = await client.query(
    `SELECT id, protocol_number
     FROM patients
     WHERE LOWER(BTRIM(first_name)) = LOWER(BTRIM($1))
       AND LOWER(BTRIM(last_name)) = LOWER(BTRIM($2))
       AND deleted_at IS NULL
       AND ($5::INTEGER IS NULL OR id <> $5)
       AND (
         ($3::DATE IS NOT NULL AND date_of_birth = $3::DATE)
         OR ($4 <> '' AND REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') = $4)
       )
     LIMIT 1`,
    [
      firstName,
      lastName,
      dateOfBirth || null,
      normalizedPhone,
      excludePatientId,
    ],
  );
  if (possibleDuplicate.rows.length > 0) {
    throw new AppError(
      'A possible duplicate patient record already exists',
      409,
      {
        patientId: possibleDuplicate.rows[0].id,
        protocolNumber: possibleDuplicate.rows[0].protocol_number,
      },
    );
  }
}

function clinicalSnapshot(patient) {
  return Object.fromEntries(
    ANAMNESIS_FIELDS.map((field) => [field, patient?.[field] ?? null]),
  );
}

function redactClinicalData(patient) {
  for (const field of [
    ...CLINICAL_FIELDS,
    'anamnesis_confirmed_at',
    'anamnesis_confirmed_by',
  ]) {
    patient[field] = null;
  }
  patient.clinical_access = false;
  return patient;
}

async function createPatient(req, res, next) {
  try {
    const body = req.body || {};
    const firstName = normalizeOptionalText(body.firstName);
    const lastName = normalizeOptionalText(body.lastName);
    const email = normalizeOptionalText(body.email)?.toLowerCase() || null;
    const dateOfBirth = normalizeDateOfBirth(body.dateOfBirth) || null;
    const { type: identityType, number: identityNumber } = normalizeIdentity(
      body.identityType,
      body.identityNumber,
    );

    if (!firstName || !lastName) {
      return next(new AppError('First name and last name are required', 400));
    }
    if (email && !validator.isEmail(email)) {
      return next(new AppError('Invalid email format', 400));
    }

    const clinicalValues = {
      blood_type: normalizeOptionalText(body.bloodType),
      allergies: normalizeOptionalText(body.allergies),
      medical_conditions: normalizeOptionalText(body.medicalConditions),
      current_medications: normalizeOptionalText(body.currentMedications),
      critical_alerts: normalizeOptionalText(body.criticalAlerts),
    };
    const notes = normalizeOptionalText(body.notes);
    const containsAnamnesisData = Object.values(clinicalValues).some(Boolean);
    const containsClinicalData = containsAnamnesisData || Boolean(notes);
    if (containsClinicalData && !canManageClinicalData(req)) {
      return next(
        new AppError(
          'Only dentists can create or change clinical anamnesis data',
          403,
        ),
      );
    }

    const patient = await withTransaction(async (client) => {
      await assertNoDuplicatePatient(client, {
        identityType,
        identityNumber,
        firstName,
        lastName,
        dateOfBirth,
        phone: body.phone,
      });

      const result = await client.query(
        `INSERT INTO patients (
          identity_type, identity_number, first_name, last_name, date_of_birth,
          gender, email, phone, address, city, country, blood_type, allergies,
          medical_conditions, current_medications, critical_alerts,
          anamnesis_confirmed_at, anamnesis_confirmed_by,
          emergency_contact_name, emergency_contact_phone, insurance_provider,
          insurance_policy_number, notes, institution_agreement_id,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
          NOW(), NOW()
        ) RETURNING *`,
        [
          identityType,
          identityNumber,
          firstName,
          lastName,
          dateOfBirth,
          normalizeOptionalText(body.gender),
          email,
          normalizeOptionalText(body.phone),
          normalizeOptionalText(body.address),
          normalizeOptionalText(body.city),
          normalizeOptionalText(body.country),
          clinicalValues.blood_type,
          clinicalValues.allergies,
          clinicalValues.medical_conditions,
          clinicalValues.current_medications,
          clinicalValues.critical_alerts,
          containsAnamnesisData ? new Date() : null,
          containsAnamnesisData ? req.user.sub : null,
          normalizeOptionalText(body.emergencyContactName),
          normalizeOptionalText(body.emergencyContactPhone),
          normalizeOptionalText(body.insuranceProvider),
          normalizeOptionalText(body.insurancePolicyNumber),
          notes,
          body.institutionAgreementId || null,
          req.user.sub,
          req.user.sub,
        ],
      );
      const created = result.rows[0];

      if (containsAnamnesisData) {
        await client.query(
          `INSERT INTO patient_anamnesis_revisions
             (patient_id, previous_values, new_values, reason, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            created.id,
            {},
            clinicalSnapshot(created),
            'İlk anamnez kaydı',
            req.user.sub,
          ],
        );
      }

      if (Array.isArray(body.discountReasonIds)) {
        for (const reasonId of body.discountReasonIds) {
          await client.query(
            `INSERT INTO patient_discount_reasons (patient_id, discount_reason_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [created.id, reasonId],
          );
        }
      }
      return created;
    });

    await logDataEvent({
      eventType: AuditEventType.PATIENT_CREATED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'patient',
      resourceId: patient.id,
      changes: sanitizeAuditChanges('patient', {
        firstName,
        lastName,
        email,
        protocolNumber: patient.protocol_number,
      }),
    });

    if (!canManageClinicalData(req)) redactClinicalData(patient);
    return res.status(201).json({ patient });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err.code === '23505') {
      return next(
        new AppError('Duplicate patient identity or protocol number', 409),
      );
    }
    return next(new AppError('Failed to create patient', 500));
  }
}

async function getPatients(req, res, next) {
  try {
    const { search = '' } = req.query;
    const { page, limit, offset } = parsePagePagination(req.query);
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(
        `(first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex}
          OR email ILIKE $${paramIndex} OR phone ILIKE $${paramIndex}
          OR protocol_number ILIKE $${paramIndex} OR identity_number ILIKE $${paramIndex})`,
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const countResult = await query(
      `SELECT COUNT(*) FROM patients WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const result = await query(
      `SELECT id, protocol_number, identity_type, identity_number, first_name,
              last_name, date_of_birth, gender, email, phone, city, created_at
       FROM patients
       WHERE ${whereClause}
       ORDER BY last_name, first_name
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params,
    );

    return res.status(200).json({
      patients: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to fetch patients', 500));
  }
}

async function getPatientById(req, res, next) {
  try {
    const patientId = parseInt(req.params.id, 10);
    const result = await query(
      `SELECT p.*, ia.id AS institution_agreement_id, ia.institution_name,
              ia.discount_percentage
       FROM patients p
       LEFT JOIN institution_agreements ia ON p.institution_agreement_id = ia.id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [patientId],
    );
    if (result.rows.length === 0) {
      return next(new AppError('Patient not found', 404));
    }

    const patient = result.rows[0];
    const discountReasonsResult = await query(
      `SELECT dr.id, dr.name
       FROM discount_reasons dr
       INNER JOIN patient_discount_reasons pdr ON dr.id = pdr.discount_reason_id
       WHERE pdr.patient_id = $1 AND dr.is_active = true`,
      [patientId],
    );
    patient.discount_reasons = discountReasonsResult.rows;
    patient.clinical_access = canManageClinicalData(req);
    if (!patient.clinical_access) redactClinicalData(patient);

    await logDataEvent({
      eventType: AuditEventType.PATIENT_VIEWED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'patient',
      resourceId: patientId,
    });
    return res.status(200).json({ patient });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to fetch patient', 500));
  }
}

async function updatePatient(req, res, next) {
  try {
    const patientId = parseInt(req.params.id, 10);
    const body = req.body || {};
    const updates = new Map();

    for (const [key, value] of Object.entries(body)) {
      const field = toSnakeCase(key);
      if (DEMOGRAPHIC_FIELDS.has(field) || CLINICAL_FIELDS.has(field)) {
        updates.set(field, normalizeOptionalText(value));
      }
    }
    if (updates.size === 0 && body.discountReasonIds === undefined) {
      return next(new AppError('No valid fields to update', 400));
    }

    const changedClinicalFields = [...updates.keys()].filter((field) =>
      CLINICAL_FIELDS.has(field),
    );
    if (changedClinicalFields.length > 0 && !canManageClinicalData(req)) {
      const attemptedClinicalWrite = changedClinicalFields.some(
        (field) => updates.get(field) !== null && updates.get(field) !== '',
      );
      if (attemptedClinicalWrite) {
        return next(
          new AppError(
            'Only dentists can create or change clinical anamnesis data',
            403,
          ),
        );
      }
      // Eski istemciler redakte edilmiş klinik alanları null olarak geri
      // gönderebilir. Bunları yok say; mevcut klinik kaydı asla temizleme.
      for (const field of changedClinicalFields) updates.delete(field);
    }
    const effectiveClinicalFields = [...updates.keys()].filter((field) =>
      CLINICAL_FIELDS.has(field),
    );
    const anamnesisChanged = effectiveClinicalFields.some((field) =>
      ANAMNESIS_FIELDS.includes(field),
    );
    const anamnesisReason = normalizeOptionalText(body.anamnesisReason);
    if (anamnesisChanged && !anamnesisReason) {
      return next(new AppError('Anamnesis change reason is required', 400));
    }

    if (updates.has('email') && updates.get('email')) {
      const email = updates.get('email').toLowerCase();
      if (!validator.isEmail(email)) {
        return next(new AppError('Invalid email format', 400));
      }
      updates.set('email', email);
    }
    if (updates.has('date_of_birth')) {
      updates.set(
        'date_of_birth',
        normalizeDateOfBirth(updates.get('date_of_birth')),
      );
    }

    if (updates.has('identity_type') || updates.has('identity_number')) {
      const currentIdentity = await query(
        'SELECT identity_type, identity_number FROM patients WHERE id = $1 AND deleted_at IS NULL',
        [patientId],
      );
      if (currentIdentity.rows.length === 0) {
        return next(new AppError('Patient not found', 404));
      }
      const normalized = normalizeIdentity(
        updates.has('identity_type')
          ? updates.get('identity_type')
          : currentIdentity.rows[0].identity_type,
        updates.has('identity_number')
          ? updates.get('identity_number')
          : currentIdentity.rows[0].identity_number,
      );
      updates.set('identity_type', normalized.type);
      updates.set('identity_number', normalized.number);
    }

    const updatedPatient = await withTransaction(async (client) => {
      const existingResult = await client.query(
        'SELECT * FROM patients WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [patientId],
      );
      if (existingResult.rows.length === 0) {
        throw new AppError('Patient not found', 404);
      }
      const existing = existingResult.rows[0];

      const proposed = { ...existing, ...Object.fromEntries(updates) };
      if (!proposed.first_name || !proposed.last_name) {
        throw new AppError('First name and last name are required', 400);
      }
      await assertNoDuplicatePatient(
        client,
        {
          identityType: proposed.identity_type,
          identityNumber: proposed.identity_number,
          firstName: proposed.first_name,
          lastName: proposed.last_name,
          dateOfBirth: proposed.date_of_birth,
          phone: proposed.phone,
        },
        patientId,
      );

      const setClauses = [];
      const params = [];
      let paramIndex = 1;
      for (const [field, value] of updates) {
        setClauses.push(`${field} = $${paramIndex++}`);
        params.push(value);
      }
      if (anamnesisChanged) {
        setClauses.push('anamnesis_confirmed_at = NOW()');
        setClauses.push(`anamnesis_confirmed_by = $${paramIndex++}`);
        params.push(req.user.sub);
      }
      setClauses.push(`updated_by = $${paramIndex++}`);
      params.push(req.user.sub);
      setClauses.push('updated_at = NOW()');
      params.push(patientId);

      let updated = existing;
      if (setClauses.length > 2) {
        const updateResult = await client.query(
          `UPDATE patients SET ${setClauses.join(', ')}
           WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
          params,
        );
        updated = updateResult.rows[0];
      }

      if (anamnesisChanged) {
        await client.query(
          `INSERT INTO patient_anamnesis_revisions
             (patient_id, previous_values, new_values, reason, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            patientId,
            clinicalSnapshot(existing),
            clinicalSnapshot(updated),
            anamnesisReason,
            req.user.sub,
          ],
        );
      }

      if (body.discountReasonIds !== undefined) {
        if (!Array.isArray(body.discountReasonIds)) {
          throw new AppError('discountReasonIds must be an array', 400);
        }
        await client.query(
          'DELETE FROM patient_discount_reasons WHERE patient_id = $1',
          [patientId],
        );
        for (const reasonId of body.discountReasonIds) {
          await client.query(
            `INSERT INTO patient_discount_reasons (patient_id, discount_reason_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [patientId, reasonId],
          );
        }
      }
      return updated;
    });

    await logDataEvent({
      eventType: AuditEventType.PATIENT_UPDATED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'patient',
      resourceId: patientId,
      changes: sanitizeAuditChanges('patient', body),
    });

    if (!canManageClinicalData(req)) redactClinicalData(updatedPatient);
    return res.status(200).json({ patient: updatedPatient });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err.code === '23505') {
      return next(
        new AppError('Duplicate patient identity or protocol number', 409),
      );
    }
    return next(new AppError('Failed to update patient', 500));
  }
}

async function getAnamnesisHistory(req, res, next) {
  try {
    if (!canManageClinicalData(req)) {
      return next(
        new AppError('Only dentists can view anamnesis history', 403),
      );
    }
    const patientId = parseInt(req.params.id, 10);
    const result = await query(
      `SELECT par.*, u.first_name, u.last_name
       FROM patient_anamnesis_revisions par
       LEFT JOIN users u ON u.id = par.created_by
       WHERE par.patient_id = $1
       ORDER BY par.created_at DESC`,
      [patientId],
    );
    return res.status(200).json({ revisions: result.rows });
  } catch (err) {
    return next(new AppError('Failed to fetch anamnesis history', 500));
  }
}

async function deletePatient(req, res, next) {
  try {
    const patientId = parseInt(req.params.id, 10);
    const result = await query(
      `UPDATE patients
       SET deleted_at = NOW(), updated_at = NOW(), updated_by = $1
       WHERE id = $2 AND deleted_at IS NULL RETURNING id`,
      [req.user.sub, patientId],
    );
    if (result.rows.length === 0) {
      return next(new AppError('Patient not found', 404));
    }
    await logDataEvent({
      eventType: AuditEventType.PATIENT_DELETED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
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
  getAnamnesisHistory,
  deletePatient,
};
