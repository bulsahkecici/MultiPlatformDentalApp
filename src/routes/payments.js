const express = require('express');
const { 
    applyDiscount, 
    processPayment, 
    getPendingTreatmentPlans,
    approveTreatmentPlan,
    getPatientDebt
} = require('../controllers/paymentController');
const { requireAuth, requireAnyRole } = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

// Payment operations (admin and secretary only)
router.post('/api/payments/discount', requireAuth, requireAnyRole('admin', 'secretary'), mutateLimiter, applyDiscount);
router.post('/api/payments/process', requireAuth, requireAnyRole('admin', 'secretary'), mutateLimiter, processPayment);

// Treatment plan approval (admin and secretary only)
router.get('/api/payments/pending-plans', requireAuth, requireAnyRole('admin', 'secretary'), getPendingTreatmentPlans);
router.post('/api/payments/approve-plan/:id', requireAuth, requireAnyRole('admin', 'secretary'), mutateLimiter, approveTreatmentPlan);

// Patient debt (admin and secretary only)
router.get('/api/payments/patient-debt/:patientId', requireAuth, requireAnyRole('admin', 'secretary'), getPatientDebt);

module.exports = router;
