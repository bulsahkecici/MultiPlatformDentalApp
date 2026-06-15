const express = require('express');
const {
  getInstitutionAgreements,
  createInstitutionAgreement,
  updateInstitutionAgreement,
  deleteInstitutionAgreement,
  getDiscountReasons,
} = require('../controllers/institutionAgreementController');
const { requireAuth, requireAnyRole } = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

// Kurum anlaşmaları (yalnızca admin ve sekreter)
router.get(
  '/api/institution-agreements',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  getInstitutionAgreements,
);
router.post(
  '/api/institution-agreements',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  mutateLimiter,
  createInstitutionAgreement,
);
router.put(
  '/api/institution-agreements/:id',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  mutateLimiter,
  updateInstitutionAgreement,
);
router.delete(
  '/api/institution-agreements/:id',
  requireAuth,
  requireAnyRole('admin'),
  mutateLimiter,
  deleteInstitutionAgreement,
);

// İndirim nedenleri (admin ve sekreter için salt-okunur)
router.get(
  '/api/discount-reasons',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  getDiscountReasons,
);

module.exports = router;
