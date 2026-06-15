const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const { createNotification } = require('../models/notification');

let io = null;

/**
 * Socket.IO sunucusunu başlatır
 */
function initializeSocketIO(server) {
  io = socketIO(server, {
    cors: {
      origin: config.cors.origins.length > 0 ? config.cors.origins : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io/',
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, config.security.jwtSecret);
      socket.userId = decoded.sub;
      socket.userEmail = decoded.email;
      socket.userRoles = decoded.roles || [];

      logger.info(
        { userId: socket.userId, socketId: socket.id },
        'Socket authenticated',
      );
      next();
    } catch (err) {
      logger.error({ error: err.message }, 'Socket authentication failed');
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Bağlantı yöneticisi
  io.on('connection', (socket) => {
    logger.info(
      {
        userId: socket.userId,
        socketId: socket.id,
        userAgent: socket.handshake.headers['user-agent'],
      },
      'Client connected',
    );

    // Kullanıcıya özel odaya katıl
    socket.join(`user:${socket.userId}`);

    // Role özel odalara katıl
    socket.userRoles.forEach((role) => {
      socket.join(`role:${role}`);
    });

    // Bağlantı başarısını gönder
    socket.emit('connected', {
      message: 'Connected to notification hub',
      userId: socket.userId,
    });

    // İstemci olaylarını işle
    socket.on('subscribe', (data) => {
      const { channel } = data;
      if (channel) {
        socket.join(channel);
        logger.info(
          { userId: socket.userId, channel },
          'Subscribed to channel',
        );
      }
    });

    socket.on('unsubscribe', (data) => {
      const { channel } = data;
      if (channel) {
        socket.leave(channel);
        logger.info(
          { userId: socket.userId, channel },
          'Unsubscribed from channel',
        );
      }
    });

    // Bağlantı kesme yöneticisi
    socket.on('disconnect', (reason) => {
      logger.info(
        {
          userId: socket.userId,
          socketId: socket.id,
          reason,
        },
        'Client disconnected',
      );
    });

    // Hata yöneticisi
    socket.on('error', (error) => {
      logger.error(
        {
          userId: socket.userId,
          socketId: socket.id,
          error: error.message,
        },
        'Socket error',
      );
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

/**
 * Socket.IO örneğini getirir
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

/**
 * Belirli bir kullanıcıya bildirim gönderir
 */
async function notifyUser(userId, notification) {
  try {
    const io = getIO();

    // Veritabanında sakla
    await createNotification({
      userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
    });

    // Kullanıcının odasına gönder
    io.to(`user:${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      { userId, type: notification.type },
      'Notification sent to user',
    );
  } catch (err) {
    logger.error({ userId, error: err.message }, 'Failed to send notification');
  }
}

/**
 * Belirli role sahip kullanıcılara bildirim gönderir
 */
async function notifyRole(role, notification) {
  try {
    const io = getIO();

    io.to(`role:${role}`).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });

    logger.info({ role, type: notification.type }, 'Notification sent to role');
  } catch (err) {
    logger.error(
      { role, error: err.message },
      'Failed to send notification to role',
    );
  }
}

/**
 * Bağlı tüm istemcilere bildirim gönderir
 */
async function notifyAll(notification) {
  try {
    const io = getIO();

    io.emit('notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });

    logger.info({ type: notification.type }, 'Notification sent to all');
  } catch (err) {
    logger.error({ error: err.message }, 'Failed to send notification to all');
  }
}

/**
 * Randevu bildirimi gönderir
 */
async function notifyAppointment(action, appointment, userIds = []) {
  const notification = {
    type: 'appointment',
    title: `Appointment ${action}`,
    message: `Appointment on ${appointment.appointmentDate} at ${appointment.startTime}`,
    data: { appointmentId: appointment.id, action },
  };

  for (const userId of userIds) {
    await notifyUser(userId, notification);
  }
}

/**
 * Hasta bildirimi gönderir
 */
async function notifyPatient(action, patient, userIds = []) {
  const notification = {
    type: 'patient',
    title: `Patient ${action}`,
    message: `${patient.firstName} ${patient.lastName}`,
    data: { patientId: patient.id, action },
  };

  for (const userId of userIds) {
    await notifyUser(userId, notification);
  }
}

/**
 * Tedavi bildirimi gönderir
 */
async function notifyTreatment(action, treatment, userIds = []) {
  const notification = {
    type: 'treatment',
    title: `Treatment ${action}`,
    message: `Treatment: ${treatment.treatmentType}`,
    data: { treatmentId: treatment.id, action },
  };

  for (const userId of userIds) {
    await notifyUser(userId, notification);
  }
}

module.exports = {
  initializeSocketIO,
  getIO,
  notifyUser,
  notifyRole,
  notifyAll,
  notifyAppointment,
  notifyPatient,
  notifyTreatment,
};
