const express = require('express');
const {
  createTreatment,
  getTreatments,
  getTreatmentById,
  updateTreatment,
  deleteTreatment,
  getPendingVoidRequests,
  decideTreatmentVoid,
  amendTreatment,
  getTreatmentRevisions,
  createTreatmentPlan,
  getTreatmentPlans,
} = require('../controllers/treatmentController');
const { requireAuth, requireAnyRole } = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

router.get('/api/treatments', requireAuth, getTreatments);
router.post('/api/treatments', requireAuth, mutateLimiter, createTreatment);

// Patron onayı bekleyen void talepleri — spesifik path, /:id'den önce tanımlanmalı.
router.get(
  '/api/treatments/void-requests/pending',
  requireAuth,
  requireAnyRole('admin'),
  getPendingVoidRequests,
);

router.get('/api/treatments/:id', requireAuth, getTreatmentById);
router.put('/api/treatments/:id', requireAuth, mutateLimiter, updateTreatment);
// Artık asla anında bir hard delete değil: admin için anında void, sekreter/
// dişhekimi için onay bekleyen bir void talebi (bkz. treatmentController.deleteTreatment).
router.delete('/api/treatments/:id', requireAuth, mutateLimiter, deleteTreatment);

router.post(
  '/api/treatments/:id/void-decision',
  requireAuth,
  requireAnyRole('admin'),
  mutateLimiter,
  decideTreatmentVoid,
);

router.post(
  '/api/treatments/:id/amend',
  requireAuth,
  mutateLimiter,
  amendTreatment,
);
router.get('/api/treatments/:id/revisions', requireAuth, getTreatmentRevisions);

// Treatment plans
router.get('/api/treatment-plans', requireAuth, getTreatmentPlans);
router.post(
  '/api/treatment-plans',
  requireAuth,
  mutateLimiter,
  createTreatmentPlan,
);

module.exports = router;
