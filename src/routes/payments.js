const express = require('express');
const {
  applyDiscount,
  processPayment,
  getPendingTreatmentPlans,
  approveTreatmentPlan,
  cancelApprovedTreatmentPlan,
  getPatientDebt,
  getTotalReceivables,
  getTotalIncome,
  getPatientPayments,
  refundPayment,
  getPendingApprovals,
  approveFinancialTransaction,
  rejectFinancialTransaction,
} = require('../controllers/paymentController');
const { requireAuth, requireAnyRole } = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

// Payment operations (admin and secretary only)
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

// Treatment plan approval (admin and secretary only)
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

// Zaten onaylanmış (borçlandırılmış) bir planı iptal eder — borç ters
// kayıtla düşer (D8). approveTreatmentPlan'dan ayrı: o yalnızca 'pending'
// planlarla çalışır ve reddetmede hiç borç yazılmadığı için ters kayda
// ihtiyaç duymaz.
router.post(
  '/api/payments/plans/:id/cancel',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  mutateLimiter,
  cancelApprovedTreatmentPlan,
);

// Patient debt (admin and secretary only)
router.get(
  '/api/payments/patient-debt/:patientId',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  getPatientDebt,
);

// Income/Expense (admin and secretary only)
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

// Ödeme iadesi (admin: hemen uygular, sekreter: onay bekleyen talep oluşturur)
router.post(
  '/api/payments/:id/refund',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  mutateLimiter,
  refundPayment,
);

// Yüksek indirim / iade onay kuyruğu — görüntüleme admin+sekreter,
// onaylama/reddetme sadece patron.
router.get(
  '/api/payments/approvals/pending',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  getPendingApprovals,
);
router.post(
  '/api/payments/approvals/:id/approve',
  requireAuth,
  requireAnyRole('admin'),
  mutateLimiter,
  approveFinancialTransaction,
);
router.post(
  '/api/payments/approvals/:id/reject',
  requireAuth,
  requireAnyRole('admin'),
  mutateLimiter,
  rejectFinancialTransaction,
);

module.exports = router;
