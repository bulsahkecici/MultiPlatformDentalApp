const { query } = require('../db');
const logger = require('../utils/logger');

/**
 * Denetim (audit) olay türleri
 */
const AuditEventType = {
  // Kimlik doğrulama olayları
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  TOKEN_REFRESH: 'token_refresh',
  PASSWORD_CHANGE: 'password_change',
  PASSWORD_RESET_REQUEST: 'password_reset_request',
  PASSWORD_RESET_COMPLETE: 'password_reset_complete',
  EMAIL_VERIFICATION: 'email_verification',
  ACCOUNT_LOCKED: 'account_locked',
  ACCOUNT_UNLOCKED: 'account_unlocked',

  // Kullanıcı yönetimi olayları
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  USER_ROLE_CHANGED: 'user_role_changed',

  // Veri erişim olayları
  PATIENT_CREATED: 'patient_created',
  PATIENT_UPDATED: 'patient_updated',
  PATIENT_DELETED: 'patient_deleted',
  PATIENT_VIEWED: 'patient_viewed',

  APPOINTMENT_CREATED: 'appointment_created',
  APPOINTMENT_UPDATED: 'appointment_updated',
  APPOINTMENT_CANCELLED: 'appointment_cancelled',

  TREATMENT_CREATED: 'treatment_created',
  TREATMENT_UPDATED: 'treatment_updated',

  // Genel veri olayları (institution_agreement, payment, vb.)
  DATA_CREATED: 'data_created',
  DATA_MODIFIED: 'data_modified',

  // Güvenlik olayları
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
};

/**
 * Bir denetim olayını günlüğe yazar
 * @param {Object} params - Denetim olayı parametreleri
 * @param {string} params.eventType - Olay türü (AuditEventType'tan)
 * @param {number} params.userId - Kullanıcı ID'si (anonim olaylarda null)
 * @param {string} params.ipAddress - IP adresi
 * @param {string} params.userAgent - Kullanıcı aracısı (user agent) dizesi
 * @param {Object} params.metadata - Ek olay meta verisi
 * @param {string} params.resourceType - Etkilenen kaynağın türü (örn. 'user', 'patient')
 * @param {number} params.resourceId - Etkilenen kaynağın ID'si
 * @param {boolean} params.success - İşlemin başarılı olup olmadığı
 * @returns {Promise<void>}
 */
async function logAuditEvent({
  eventType,
  userId = null,
  ipAddress = null,
  userAgent = null,
  metadata = {},
  resourceType = null,
  resourceId = null,
  success = true,
}) {
  try {
    await query(
      `INSERT INTO audit_logs 
       (event_type, user_id, ip_address, user_agent, metadata, resource_type, resource_id, success, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        eventType,
        userId,
        ipAddress,
        userAgent,
        JSON.stringify(metadata),
        resourceType,
        resourceId,
        success,
      ],
    );

    // Anında görünürlük için uygulama günlükleyicisine de yaz
    logger.info(
      {
        audit: true,
        eventType,
        userId,
        ipAddress,
        resourceType,
        resourceId,
        success,
      },
      `Audit: ${eventType}`,
    );
  } catch (err) {
    // Denetim günlüğü hatalarının uygulamayı bozmasına izin verme
    logger.error({ err }, 'Failed to log audit event');
  }
}

/**
 * Kimlik doğrulama olayını günlüğe yazar
 * @param {Object} params - Kimlik doğrulama olayı parametreleri
 */
async function logAuthEvent({
  eventType,
  userId,
  email,
  ipAddress,
  userAgent,
  success,
  reason,
}) {
  await logAuditEvent({
    eventType,
    userId,
    ipAddress,
    userAgent,
    metadata: { email, reason },
    success,
  });
}

/**
 * Veri değişikliği olayını günlüğe yazar
 * @param {Object} params - Veri olayı parametreleri
 */
async function logDataEvent({
  eventType,
  userId,
  ipAddress,
  userAgent,
  resourceType,
  resourceId,
  changes = {},
}) {
  await logAuditEvent({
    eventType,
    userId,
    ipAddress,
    userAgent,
    resourceType,
    resourceId,
    metadata: { changes },
    success: true,
  });
}

/**
 * Filtreleyerek denetim günlüklerini getirir
 * @param {Object} filters - Filtre parametreleri
 * @param {number} filters.userId - Kullanıcı ID'sine göre filtrele
 * @param {string} filters.eventType - Olay türüne göre filtrele
 * @param {string} filters.resourceType - Kaynak türüne göre filtrele
 * @param {number} filters.resourceId - Kaynak ID'sine göre filtrele
 * @param {Date} filters.startDate - Başlangıç tarihine göre filtrele
 * @param {Date} filters.endDate - Bitiş tarihine göre filtrele
 * @param {number} filters.limit - Sonuçları sınırla (varsayılan 100)
 * @param {number} filters.offset - Sayfalama için ofset
 * @returns {Promise<Array>} Denetim günlüğü kayıtları
 */
async function getAuditLogs(filters = {}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filters.userId);
  }

  if (filters.eventType) {
    conditions.push(`event_type = $${paramIndex++}`);
    params.push(filters.eventType);
  }

  if (filters.resourceType) {
    conditions.push(`resource_type = $${paramIndex++}`);
    params.push(filters.resourceType);
  }

  if (filters.resourceId) {
    conditions.push(`resource_id = $${paramIndex++}`);
    params.push(filters.resourceId);
  }

  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  const sql = `
    SELECT al.*, u.email as user_email
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  params.push(limit, offset);

  const result = await query(sql, params);
  return result.rows;
}

module.exports = {
  AuditEventType,
  logAuditEvent,
  logAuthEvent,
  logDataEvent,
  getAuditLogs,
};
