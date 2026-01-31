const express = require('express');
const {
    login,
    refreshToken,
    logout,
    requestPasswordReset,
    resetPassword,
    verifyEmail,
    resendVerification,
} = require('../controllers/authController');
const {
    authLimiter,
    passwordResetLimiter,
    emailVerificationLimiter,
} = require('../middlewares/rateLimit');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Authentication endpoints
router.post('/api/auth/login', authLimiter, login);
router.post('/api/auth/refresh', authLimiter, refreshToken);
router.post('/api/auth/logout', requireAuth, logout);

// Password reset
router.post('/api/auth/request-reset', passwordResetLimiter, requestPasswordReset);
router.post('/api/auth/reset-password', passwordResetLimiter, resetPassword);

// Email verification
router.get('/api/auth/verify-email/:token', emailVerificationLimiter, verifyEmail);
router.post('/api/auth/resend-verification', emailVerificationLimiter, resendVerification);

module.exports = router;
