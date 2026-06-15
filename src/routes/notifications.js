const express = require('express');
const {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../models/notification');
const { requireAuth } = require('../middlewares/auth');
const { AppError } = require('../utils/errorResponder');

const router = express.Router();

/**
 * Kullanıcı bildirimlerini getirir
 */
router.get('/api/notifications', requireAuth, async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const notifications = await getUserNotifications(
      req.user.sub,
      parseInt(limit, 10),
      parseInt(offset, 10),
    );
    const unreadCount = await getUnreadCount(req.user.sub);

    return res.status(200).json({
      notifications,
      unreadCount,
    });
  } catch (err) {
    return next(new AppError('Failed to fetch notifications', 500));
  }
});

/**
 * Okunmamış sayısını getirir
 */
router.get(
  '/api/notifications/unread-count',
  requireAuth,
  async (req, res, next) => {
    try {
      const count = await getUnreadCount(req.user.sub);
      return res.status(200).json({ count });
    } catch (err) {
      return next(new AppError('Failed to fetch unread count', 500));
    }
  },
);

/**
 * Bildirimi okundu olarak işaretler
 */
router.put(
  '/api/notifications/:id/read',
  requireAuth,
  async (req, res, next) => {
    try {
      const notificationId = parseInt(req.params.id, 10);
      const notification = await markAsRead(notificationId, req.user.sub);

      if (!notification) {
        return next(new AppError('Notification not found', 404));
      }

      return res.status(200).json({ notification });
    } catch (err) {
      return next(new AppError('Failed to mark notification as read', 500));
    }
  },
);

/**
 * Tüm bildirimleri okundu olarak işaretler
 */
router.put(
  '/api/notifications/read-all',
  requireAuth,
  async (req, res, next) => {
    try {
      await markAllAsRead(req.user.sub);
      return res
        .status(200)
        .json({ message: 'All notifications marked as read' });
    } catch (err) {
      return next(new AppError('Failed to mark all as read', 500));
    }
  },
);

/**
 * Bildirimi siler
 */
router.delete('/api/notifications/:id', requireAuth, async (req, res, next) => {
  try {
    const notificationId = parseInt(req.params.id, 10);
    await deleteNotification(notificationId, req.user.sub);
    return res.status(200).json({ message: 'Notification deleted' });
  } catch (err) {
    return next(new AppError('Failed to delete notification', 500));
  }
});

module.exports = router;
