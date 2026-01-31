const { query } = require('../db');
const logger = require('../utils/logger');

/**
 * Audit event types
 */
const AuditEventType = {
    // Authentication events
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

    // User management events
    USER_CREATED: 'user_created',
    USER_UPDATED: 'user_updated',
    USER_DELETED: 'user_deleted',
    USER_ROLE_CHANGED: 'user_role_changed',

    // Data access events
    PATIENT_CREATED: 'patient_created',
    PATIENT_UPDATED: 'patient_updated',
    PATIENT_DELETED: 'patient_deleted',
    PATIENT_VIEWED: 'patient_viewed',

    APPOINTMENT_CREATED: 'appointment_created',
    APPOINTMENT_UPDATED: 'appointment_updated',
    APPOINTMENT_CANCELLED: 'appointment_cancelled',

    TREATMENT_CREATED: 'treatment_created',
    TREATMENT_UPDATED: 'treatment_updated',

    // Security events
    UNAUTHORIZED_ACCESS: 'unauthorized_access',
    RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
};

/**
 * Log an audit event
 * @param {Object} params - Audit event parameters
 * @param {string} params.eventType - Type of event (from AuditEventType)
 * @param {number} params.userId - User ID (null for anonymous events)
 * @param {string} params.ipAddress - IP address
 * @param {string} params.userAgent - User agent string
 * @param {Object} params.metadata - Additional event metadata
 * @param {string} params.resourceType - Type of resource affected (e.g., 'user', 'patient')
 * @param {number} params.resourceId - ID of affected resource
 * @param {boolean} params.success - Whether the action was successful
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

        // Also log to application logger for immediate visibility
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
        // Don't let audit logging failures break the application
        logger.error({ err }, 'Failed to log audit event');
    }
}

/**
 * Log authentication event
 * @param {Object} params - Auth event parameters
 */
async function logAuthEvent({ eventType, userId, email, ipAddress, userAgent, success, reason }) {
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
 * Log data modification event
 * @param {Object} params - Data event parameters
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
 * Get audit logs with filtering
 * @param {Object} filters - Filter parameters
 * @param {number} filters.userId - Filter by user ID
 * @param {string} filters.eventType - Filter by event type
 * @param {string} filters.resourceType - Filter by resource type
 * @param {number} filters.resourceId - Filter by resource ID
 * @param {Date} filters.startDate - Filter by start date
 * @param {Date} filters.endDate - Filter by end date
 * @param {number} filters.limit - Limit results (default 100)
 * @param {number} filters.offset - Offset for pagination
 * @returns {Promise<Array>} Audit log entries
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
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
