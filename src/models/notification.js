const { query } = require('../db');

/**
 * Create a notification
 */
async function createNotification({ userId, type, title, message, data = null }) {
    const result = await query(
        `INSERT INTO notifications (user_id, type, title, message, data, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING *`,
        [userId, type, title, message, data ? JSON.stringify(data) : null],
    );
    return result.rows[0];
}

/**
 * Get user notifications
 */
async function getUserNotifications(userId, limit = 50, offset = 0) {
    const result = await query(
        `SELECT * FROM notifications 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
    );
    return result.rows;
}

/**
 * Get unread notification count
 */
async function getUnreadCount(userId) {
    const result = await query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
        [userId],
    );
    return parseInt(result.rows[0].count, 10);
}

/**
 * Mark notification as read
 */
async function markAsRead(notificationId, userId) {
    const result = await query(
        'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
        [notificationId, userId],
    );
    return result.rows[0];
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(userId) {
    await query(
        'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
        [userId],
    );
}

/**
 * Delete notification
 */
async function deleteNotification(notificationId, userId) {
    await query(
        'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
        [notificationId, userId],
    );
}

module.exports = {
    createNotification,
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
};
