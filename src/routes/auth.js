const express = require('express');
const {
  login,
  refreshToken,
  logout,
  getMe,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerification,
} = require('../controllers/authController');
const {
  authLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  mutateLimiter,
} = require('../middlewares/rateLimit');
const { requireAuth } = require('../middlewares/auth');
const {
  getMfaStatus,
  setupMfa,
  enableMfa,
  disableMfa,
} = require('../controllers/mfaController');

const router = express.Router();

// Authentication endpoints
router.post('/api/auth/login', authLimiter, login);
router.post('/api/auth/refresh', authLimiter, refreshToken);
router.post('/api/auth/logout', requireAuth, logout);
router.get('/api/auth/me', requireAuth, getMe);
router.get('/api/auth/mfa/status', requireAuth, getMfaStatus);
router.post('/api/auth/mfa/setup', requireAuth, mutateLimiter, setupMfa);
router.post('/api/auth/mfa/enable', requireAuth, mutateLimiter, enableMfa);
router.post('/api/auth/mfa/disable', requireAuth, mutateLimiter, disableMfa);

// Password reset
router.post(
  '/api/auth/request-reset',
  passwordResetLimiter,
  requestPasswordReset,
);
router.post('/api/auth/reset-password', passwordResetLimiter, resetPassword);

// Email verification
router.get(
  '/api/auth/verify-email/:token',
  emailVerificationLimiter,
  verifyEmail,
);
router.post(
  '/api/auth/resend-verification',
  emailVerificationLimiter,
  resendVerification,
);

module.exports = router;
