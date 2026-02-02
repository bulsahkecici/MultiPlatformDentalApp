const express = require('express');
const { applyDiscount, processPayment } = require('../controllers/paymentController');
const { requireAuth, requireAnyRole } = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

// Payment operations (admin and secretary only)
router.post('/api/payments/discount', requireAuth, requireAnyRole('admin', 'secretary'), mutateLimiter, applyDiscount);
router.post('/api/payments/process', requireAuth, requireAnyRole('admin', 'secretary'), mutateLimiter, processPayment);

module.exports = router;
