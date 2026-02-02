const express = require('express');
const {
    getInstitutionAgreements,
    createInstitutionAgreement,
    updateInstitutionAgreement,
    getDiscountReasons,
} = require('../controllers/institutionAgreementController');
const { requireAuth, requireAnyRole } = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

// Institution agreements (admin and secretary only)
router.get('/api/institution-agreements', requireAuth, requireAnyRole('admin', 'secretary'), getInstitutionAgreements);
router.post('/api/institution-agreements', requireAuth, requireAnyRole('admin', 'secretary'), mutateLimiter, createInstitutionAgreement);
router.put('/api/institution-agreements/:id', requireAuth, requireAnyRole('admin', 'secretary'), mutateLimiter, updateInstitutionAgreement);

// Discount reasons (read-only for admin and secretary)
router.get('/api/discount-reasons', requireAuth, requireAnyRole('admin', 'secretary'), getDiscountReasons);

module.exports = router;
