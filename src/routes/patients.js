const express = require('express');
const {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  getAnamnesisHistory,
  deletePatient,
} = require('../controllers/patientController');
const {
  requireAuth,
  requireRole,
  requireAnyRole,
} = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

// All patient routes require authentication
router.get('/api/patients', requireAuth, getPatients);
router.post('/api/patients', requireAuth, mutateLimiter, createPatient);
router.get('/api/patients/:id', requireAuth, getPatientById);
router.put('/api/patients/:id', requireAuth, mutateLimiter, updatePatient);
router.get(
  '/api/patients/:id/anamnesis-history',
  requireAuth,
  requireAnyRole('dentist'),
  getAnamnesisHistory,
);
router.delete(
  '/api/patients/:id',
  requireAuth,
  requireRole('admin'),
  mutateLimiter,
  deletePatient,
);

module.exports = router;
