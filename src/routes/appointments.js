const express = require('express');
const {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
  reopenAppointment,
} = require('../controllers/appointmentController');
const { requireAuth } = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

router.get('/api/appointments', requireAuth, getAppointments);
router.post('/api/appointments', requireAuth, mutateLimiter, createAppointment);
router.get('/api/appointments/:id', requireAuth, getAppointmentById);
router.put(
  '/api/appointments/:id',
  requireAuth,
  mutateLimiter,
  updateAppointment,
);
// Cancel: PUT (web istemcisi, body ile sebep taşır) + DELETE (desktop istemcisi) — ikisi de aynı handler
router.put(
  '/api/appointments/:id/cancel',
  requireAuth,
  mutateLimiter,
  cancelAppointment,
);
router.delete(
  '/api/appointments/:id',
  requireAuth,
  mutateLimiter,
  cancelAppointment,
);
// İptal edilmiş bir randevuyu yeniden açar — çakışma kontrolü koşulsuz çalışır
// (bkz. appointmentController.reopenAppointment).
router.post(
  '/api/appointments/:id/reopen',
  requireAuth,
  mutateLimiter,
  reopenAppointment,
);

module.exports = router;
