const path = require('path');
const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');
const {
  storeEncryptedDocument,
  readEncryptedDocument,
  deleteEncryptedDocument,
} = require('../services/encryptedDocumentStorage');

const DOCUMENT_CATEGORIES = new Set([
  'radiograph',
  'photo',
  'consent',
  'report',
  'identity',
  'other',
]);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/dicom',
  'application/octet-stream',
]);

function hasRole(req, role) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes(role);
}

function requirePatientRecordAccess(req) {
  if (!hasRole(req, 'dentist') && !hasRole(req, 'admin')) {
    throw new AppError('Patient clinical record access is forbidden', 403);
  }
}

function requiredText(value, fieldName, maxLength = 10000) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${fieldName} is required`, 400);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new AppError(`${fieldName} is too long`, 400);
  }
  return text;
}

function safeDownloadName(value) {
  return String(value || 'document')
    .replace(/[\r\n"\\/]/g, '_')
    .slice(0, 180);
}

function validateFileSignature(file) {
  const buffer = file.buffer;
  const signatures = {
    'application/pdf': buffer.subarray(0, 5).equals(Buffer.from('%PDF-')),
    'image/jpeg':
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
    'image/png': buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/webp':
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  };
  if (Object.hasOwn(signatures, file.mimetype) && !signatures[file.mimetype]) {
    throw new AppError(
      'Document content does not match its declared type',
      415,
    );
  }
}

async function ensurePatientExists(patientId) {
  const patient = await query(
    `SELECT id, protocol_number, first_name, last_name
     FROM patients WHERE id = $1 AND deleted_at IS NULL`,
    [patientId],
  );
  if (patient.rows.length === 0) throw new AppError('Patient not found', 404);
  return patient.rows[0];
}

async function uploadDocument(req, res, next) {
  let stored;
  try {
    requirePatientRecordAccess(req);
    const patientId = parseInt(req.params.id, 10);
    await ensurePatientExists(patientId);
    if (!req.file) throw new AppError('Document file is required', 400);

    const category = requiredText(
      req.body?.category,
      'category',
      30,
    ).toLowerCase();
    if (!DOCUMENT_CATEGORIES.has(category)) {
      throw new AppError('Invalid document category', 400);
    }
    if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
      throw new AppError('Unsupported document type', 415);
    }
    if (
      req.file.mimetype === 'application/octet-stream' &&
      category !== 'radiograph'
    ) {
      throw new AppError('Binary files are accepted only as radiographs', 415);
    }
    validateFileSignature(req.file);
    const title = requiredText(
      req.body?.title || path.parse(req.file.originalname).name,
      'title',
      200,
    );

    stored = await storeEncryptedDocument(req.file.buffer);
    const result = await query(
      `INSERT INTO patient_documents
         (patient_id, category, title, original_name, mime_type, size_bytes,
          storage_key, sha256, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, patient_id, category, title, original_name, mime_type,
                 size_bytes, sha256, uploaded_by, created_at`,
      [
        patientId,
        category,
        title,
        safeDownloadName(req.file.originalname),
        req.file.mimetype,
        req.file.size,
        stored.storageKey,
        stored.sha256,
        req.user.sub,
      ],
    );

    await logDataEvent({
      eventType: AuditEventType.DATA_CREATED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'patient_document',
      resourceId: result.rows[0].id,
      changes: { patientId, category, sha256: stored.sha256 },
    });
    return res.status(201).json({ document: result.rows[0] });
  } catch (err) {
    if (stored?.storageKey) {
      await deleteEncryptedDocument(stored.storageKey).catch(() => {});
    }
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to upload patient document', 500));
  }
}

async function listDocuments(req, res, next) {
  try {
    requirePatientRecordAccess(req);
    const patientId = parseInt(req.params.id, 10);
    await ensurePatientExists(patientId);
    const result = await query(
      `SELECT id, patient_id, category, title, original_name, mime_type,
              size_bytes, sha256, uploaded_by, created_at
       FROM patient_documents
       WHERE patient_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [patientId],
    );
    return res.status(200).json({ documents: result.rows });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to list patient documents', 500));
  }
}

async function downloadDocument(req, res, next) {
  try {
    requirePatientRecordAccess(req);
    const patientId = parseInt(req.params.id, 10);
    const documentId = parseInt(req.params.documentId, 10);
    const result = await query(
      `SELECT * FROM patient_documents
       WHERE id = $1 AND patient_id = $2 AND deleted_at IS NULL`,
      [documentId, patientId],
    );
    if (result.rows.length === 0) {
      throw new AppError('Document not found', 404);
    }
    const document = result.rows[0];
    const buffer = await readEncryptedDocument(
      document.storage_key,
      document.sha256,
    );
    res.setHeader('Content-Type', document.mime_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeDownloadName(document.original_name)}"`,
    );
    res.setHeader('X-Content-SHA256', document.sha256);
    return res.status(200).send(buffer);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to download patient document', 500));
  }
}

async function deleteDocument(req, res, next) {
  try {
    requirePatientRecordAccess(req);
    const patientId = parseInt(req.params.id, 10);
    const documentId = parseInt(req.params.documentId, 10);
    const inUse = await query(
      `SELECT 1 FROM patient_consents
       WHERE signed_document_id = $1 AND status = 'signed' LIMIT 1`,
      [documentId],
    );
    if (inUse.rows.length > 0) {
      throw new AppError('Signed consent documents cannot be deleted', 409);
    }
    const result = await query(
      `UPDATE patient_documents
       SET deleted_at = NOW(), deleted_by = $1
       WHERE id = $2 AND patient_id = $3 AND deleted_at IS NULL
       RETURNING id`,
      [req.user.sub, documentId, patientId],
    );
    if (result.rows.length === 0) throw new AppError('Document not found', 404);
    await logDataEvent({
      eventType: AuditEventType.DATA_MODIFIED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'patient_document',
      resourceId: documentId,
      changes: { softDeleted: true },
    });
    return res.status(200).json({ message: 'Document archived' });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to archive patient document', 500));
  }
}

async function createConsent(req, res, next) {
  try {
    if (!hasRole(req, 'dentist')) {
      throw new AppError('Only dentists can record clinical consent', 403);
    }
    const patientId = parseInt(req.params.id, 10);
    await ensurePatientExists(patientId);
    const body = req.body || {};
    const signedDocumentId = Number(body.signedDocumentId);
    if (!Number.isInteger(signedDocumentId) || signedDocumentId <= 0) {
      throw new AppError('A signed consent document is required', 400);
    }
    const signedDocument = await query(
      `SELECT id, sha256 FROM patient_documents
       WHERE id = $1 AND patient_id = $2 AND category = 'consent'
         AND deleted_at IS NULL`,
      [signedDocumentId, patientId],
    );
    if (signedDocument.rows.length === 0) {
      throw new AppError('Signed consent document not found', 404);
    }

    const treatmentId = body.treatmentId ? Number(body.treatmentId) : null;
    if (treatmentId) {
      const treatment = await query(
        `SELECT id FROM treatments
         WHERE id = $1 AND patient_id = $2 AND dentist_id = $3
           AND deleted_at IS NULL`,
        [treatmentId, patientId, req.user.sub],
      );
      if (treatment.rows.length === 0) {
        throw new AppError(
          'Treatment does not match patient and clinician',
          409,
        );
      }
    }

    const signedAt = body.signedAt ? new Date(body.signedAt) : new Date();
    if (
      Number.isNaN(signedAt.getTime()) ||
      signedAt > new Date(Date.now() + 300000)
    ) {
      throw new AppError('Invalid consent signature date', 400);
    }

    const result = await query(
      `INSERT INTO patient_consents (
         patient_id, treatment_id, consent_type, procedure_name, form_version,
         information_text, risks, alternatives, patient_or_representative_name,
         representative_relationship, clinician_id, signed_document_id,
         signed_document_sha256, signed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        patientId,
        treatmentId,
        requiredText(body.consentType, 'consentType', 80),
        requiredText(body.procedureName, 'procedureName', 200),
        requiredText(body.formVersion, 'formVersion', 40),
        requiredText(body.informationText, 'informationText'),
        requiredText(body.risks, 'risks'),
        requiredText(body.alternatives, 'alternatives'),
        requiredText(
          body.patientOrRepresentativeName,
          'patientOrRepresentativeName',
          200,
        ),
        body.representativeRelationship
          ? requiredText(
              body.representativeRelationship,
              'representativeRelationship',
              100,
            )
          : null,
        req.user.sub,
        signedDocumentId,
        signedDocument.rows[0].sha256,
        signedAt,
      ],
    );

    await logDataEvent({
      eventType: AuditEventType.DATA_CREATED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'patient_consent',
      resourceId: result.rows[0].id,
      changes: { patientId, signedDocumentId, formVersion: body.formVersion },
    });
    return res.status(201).json({ consent: result.rows[0] });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to record patient consent', 500));
  }
}

async function listConsents(req, res, next) {
  try {
    requirePatientRecordAccess(req);
    const patientId = parseInt(req.params.id, 10);
    await ensurePatientExists(patientId);
    const result = await query(
      `SELECT pc.*, u.first_name AS clinician_first_name,
              u.last_name AS clinician_last_name
       FROM patient_consents pc
       LEFT JOIN users u ON u.id = pc.clinician_id
       WHERE pc.patient_id = $1
       ORDER BY pc.signed_at DESC`,
      [patientId],
    );
    return res.status(200).json({ consents: result.rows });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to list patient consents', 500));
  }
}

async function revokeConsent(req, res, next) {
  try {
    requirePatientRecordAccess(req);
    const patientId = parseInt(req.params.id, 10);
    const consentId = parseInt(req.params.consentId, 10);
    const reason = requiredText(req.body?.reason, 'reason', 2000);
    const result = await query(
      `UPDATE patient_consents
       SET status = 'revoked', revoked_at = NOW(), revoked_by = $1,
           revocation_reason = $2
       WHERE id = $3 AND patient_id = $4 AND status = 'signed'
       RETURNING *`,
      [req.user.sub, reason, consentId, patientId],
    );
    if (result.rows.length === 0) {
      throw new AppError('Active consent not found', 404);
    }
    await logDataEvent({
      eventType: AuditEventType.DATA_MODIFIED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'patient_consent',
      resourceId: consentId,
      changes: { status: 'revoked', reason },
    });
    return res.status(200).json({ consent: result.rows[0] });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to revoke patient consent', 500));
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function tableHtml(title, rows, columns) {
  const header = columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeHtml(row[column.key])}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  return `<h2>${escapeHtml(title)}</h2><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

async function exportPatientRecord(req, res, next) {
  try {
    requirePatientRecordAccess(req);
    const patientId = parseInt(req.params.id, 10);
    const patientResult = await query(
      'SELECT * FROM patients WHERE id = $1 AND deleted_at IS NULL',
      [patientId],
    );
    if (patientResult.rows.length === 0)
      throw new AppError('Patient not found', 404);
    const [appointments, treatments, consents, documents, anamnesisHistory] =
      await Promise.all([
        query(
          'SELECT * FROM appointments WHERE patient_id = $1 ORDER BY appointment_date',
          [patientId],
        ),
        query(
          `SELECT * FROM treatments WHERE patient_id = $1
           ORDER BY treatment_date`,
          [patientId],
        ),
        query(
          `SELECT * FROM patient_consents WHERE patient_id = $1
           ORDER BY signed_at`,
          [patientId],
        ),
        query(
          `SELECT id, category, title, original_name, mime_type, size_bytes,
                  sha256, created_at
           FROM patient_documents WHERE patient_id = $1 AND deleted_at IS NULL
           ORDER BY created_at`,
          [patientId],
        ),
        query(
          `SELECT previous_values, new_values, reason, created_by, created_at
           FROM patient_anamnesis_revisions WHERE patient_id = $1
           ORDER BY created_at`,
          [patientId],
        ),
      ]);
    const record = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.sub,
      patient: patientResult.rows[0],
      appointments: appointments.rows,
      treatments: treatments.rows,
      consents: consents.rows,
      documents: documents.rows,
      anamnesisHistory: anamnesisHistory.rows,
    };

    await logDataEvent({
      eventType: AuditEventType.PATIENT_EXPORTED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'patient',
      resourceId: patientId,
      changes: { format: req.query.format || 'html' },
    });

    const protocol = safeDownloadName(record.patient.protocol_number);
    if (req.query.format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${protocol}.json"`,
      );
      return res.status(200).send(JSON.stringify(record, null, 2));
    }

    const p = record.patient;
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
      <title>Hasta Dosyası ${escapeHtml(p.protocol_number)}</title>
      <style>body{font-family:Arial,sans-serif;margin:32px;color:#172554}h1,h2{color:#134e4a}table{border-collapse:collapse;width:100%;margin-bottom:24px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left;vertical-align:top}.alert{border:2px solid #dc2626;background:#fef2f2;padding:12px;color:#991b1b}small{color:#64748b}</style>
      </head><body><h1>Hasta Dosyası</h1><p><b>Protokol:</b> ${escapeHtml(p.protocol_number)}<br><b>Hasta:</b> ${escapeHtml(`${p.first_name} ${p.last_name}`)}<br><b>Doğum tarihi:</b> ${escapeHtml(p.date_of_birth)}<br><b>Kimlik:</b> ${escapeHtml(`${p.identity_type || ''} ${p.identity_number || ''}`)}</p>
      <div class="alert"><b>Kritik uyarılar:</b> ${escapeHtml(p.critical_alerts)}<br><b>Alerjiler:</b> ${escapeHtml(p.allergies)}<br><b>Tıbbi durumlar:</b> ${escapeHtml(p.medical_conditions)}<br><b>Mevcut ilaçlar:</b> ${escapeHtml(p.current_medications)}</div>
      ${tableHtml('Randevular', record.appointments, [
        { key: 'appointment_date', label: 'Tarih' },
        { key: 'start_time', label: 'Saat' },
        { key: 'appointment_type', label: 'Tür' },
        { key: 'status', label: 'Durum' },
      ])}
      ${tableHtml('Tedaviler', record.treatments, [
        { key: 'treatment_date', label: 'Tarih' },
        { key: 'tooth_number', label: 'Diş' },
        { key: 'treatment_type', label: 'İşlem' },
        { key: 'diagnosis', label: 'Tanı' },
        { key: 'procedure_notes', label: 'İşlem notu' },
        { key: 'status', label: 'Durum' },
      ])}
      ${tableHtml('Onamlar', record.consents, [
        { key: 'procedure_name', label: 'İşlem' },
        { key: 'form_version', label: 'Form sürümü' },
        { key: 'signed_at', label: 'İmza tarihi' },
        { key: 'status', label: 'Durum' },
      ])}
      ${tableHtml('Belgeler', record.documents, [
        { key: 'category', label: 'Kategori' },
        { key: 'title', label: 'Başlık' },
        { key: 'original_name', label: 'Dosya' },
        { key: 'sha256', label: 'SHA-256' },
      ])}
      <small>Dışa aktarım: ${escapeHtml(record.exportedAt)} · Kullanıcı #${escapeHtml(record.exportedBy)}</small></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${protocol}.html"`,
    );
    return res.status(200).send(html);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Failed to export patient record', 500));
  }
}

module.exports = {
  uploadDocument,
  listDocuments,
  downloadDocument,
  deleteDocument,
  createConsent,
  listConsents,
  revokeConsent,
  exportPatientRecord,
};
