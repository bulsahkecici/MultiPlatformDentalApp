const rateLimit = require('express-rate-limit');

/**
 * Get client IP address from request.
 * req.ip, server.js'teki `trust proxy` ayarını dikkate alır (proxy arkasında doğru IP).
 * @param {Object} req - Express request
 * @returns {string} IP address
 */
function getClientIp(req) {
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * General rate limiter for all endpoints
 * 300 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  // Varsayılan keyGenerator kullanılıyor: req.ip tabanlı, IPv6-güvenli (trust proxy ayarlı)
  handler: (req, res) => {
    res.status(429).json({
      error: {
        message: 'Too many requests, please try again later.',
      },
    });
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * 10 requests per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Varsayılan keyGenerator kullanılıyor: req.ip tabanlı, IPv6-güvenli (trust proxy ayarlı)
  skipSuccessfulRequests: false, // Count all requests
  handler: (req, res) => {
    res.status(429).json({
      error: {
        message: 'Too many authentication attempts, please try again later.',
      },
    });
  },
});

/**
 * Rate limiter for mutation endpoints (create, update, delete)
 * 60 requests per 15 minutes per IP
 */
const mutateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  // Varsayılan keyGenerator kullanılıyor: req.ip tabanlı, IPv6-güvenli (trust proxy ayarlı)
  handler: (req, res) => {
    res.status(429).json({
      error: {
        message: 'Too many requests, please slow down.',
      },
    });
  },
});

/**
 * Strict limiter for password reset requests
 * 3 requests per hour per IP
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  // Varsayılan keyGenerator kullanılıyor: req.ip tabanlı, IPv6-güvenli (trust proxy ayarlı)
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        message: 'Too many password reset requests, please try again later.',
      },
    });
  },
});

/**
 * Limiter for email verification requests
 * 5 requests per hour per IP
 */
const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // Varsayılan keyGenerator kullanılıyor: req.ip tabanlı, IPv6-güvenli (trust proxy ayarlı)
  handler: (req, res) => {
    res.status(429).json({
      error: {
        message: 'Too many verification requests, please try again later.',
      },
    });
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  mutateLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  getClientIp,
};
