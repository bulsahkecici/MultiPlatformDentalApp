const express = require('express');
const multer = require('multer');
const config = require('../config');
const { requireAuth, requireAnyRole } = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');
const {
  uploadDocument,
  listDocuments,
  downloadDocument,
  deleteDocument,
  createConsent,
  listConsents,
  revokeConsent,
  exportPatientRecord,
} = require('../controllers/patientRecordController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: config.storage.documentMaxBytes },
});
const clinicalRecordAccess = requireAnyRole('admin', 'dentist');

router.get(
  '/api/patients/:id/documents',
  requireAuth,
  clinicalRecordAccess,
  listDocuments,
);
router.post(
  '/api/patients/:id/documents',
  requireAuth,
  clinicalRecordAccess,
  mutateLimiter,
  upload.single('file'),
  uploadDocument,
);
router.get(
  '/api/patients/:id/documents/:documentId/download',
  requireAuth,
  clinicalRecordAccess,
  downloadDocument,
);
router.delete(
  '/api/patients/:id/documents/:documentId',
  requireAuth,
  clinicalRecordAccess,
  mutateLimiter,
  deleteDocument,
);

router.get(
  '/api/patients/:id/consents',
  requireAuth,
  clinicalRecordAccess,
  listConsents,
);
router.post(
  '/api/patients/:id/consents',
  requireAuth,
  requireAnyRole('dentist'),
  mutateLimiter,
  createConsent,
);
router.post(
  '/api/patients/:id/consents/:consentId/revoke',
  requireAuth,
  clinicalRecordAccess,
  mutateLimiter,
  revokeConsent,
);
router.get(
  '/api/patients/:id/export',
  requireAuth,
  clinicalRecordAccess,
  exportPatientRecord,
);

module.exports = router;
