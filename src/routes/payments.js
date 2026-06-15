const express = require('express');
const {
  applyDiscount,
  processPayment,
  getPendingTreatmentPlans,
  approveTreatmentPlan,
  getPatientDebt,
  getTotalReceivables,
  getTotalIncome,
  getPatientPayments,
} = require('../controllers/paymentController');
const { requireAuth, requireAnyRole } = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

// Ödeme işlemleri (yalnızca admin ve sekreter)
router.post(
  '/api/payments/discount',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  mutateLimiter,
  applyDiscount,
);
router.post(
  '/api/payments/process',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  mutateLimiter,
  processPayment,
);

// Tedavi planı onayı (yalnızca admin ve sekreter)
router.get(
  '/api/payments/pending-plans',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  getPendingTreatmentPlans,
);
router.post(
  '/api/payments/approve-plan/:id',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  mutateLimiter,
  approveTreatmentPlan,
);

// Hasta borcu (yalnızca admin ve sekreter)
router.get(
  '/api/payments/patient-debt/:patientId',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  getPatientDebt,
);

// Gelir/Gider (yalnızca admin ve sekreter)
router.get(
  '/api/payments/total-receivables',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  getTotalReceivables,
);
router.get(
  '/api/payments/total-income',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  getTotalIncome,
);
router.get(
  '/api/payments/patient-payments/:patientId',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  getPatientPayments,
);

module.exports = router;
