const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

/**
 * İstekten istemci IP adresini alır (proxy başlıklarına güvenir)
 * @param {Object} req - Express isteği
 * @returns {string} IP adresi
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Tüm uç noktalar için genel hız sınırlayıcı
 * IP başına 15 dakikada 300 istek
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        message: 'Too many requests, please try again later.',
      },
    });
  },
});

/**
 * Kimlik doğrulama uç noktaları için katı hız sınırlayıcı
 * IP başına 15 dakikada 10 istek
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  skipSuccessfulRequests: false, // Tüm istekleri say
  handler: (req, res) => {
    res.status(429).json({
      error: {
        message: 'Too many authentication attempts, please try again later.',
      },
    });
  },
});

/**
 * Veri değiştiren uç noktalar için hız sınırlayıcı (oluşturma, güncelleme, silme)
 * IP başına 15 dakikada 60 istek
 */
const mutateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        message: 'Too many requests, please slow down.',
      },
    });
  },
});

/**
 * Tekrarlanan istekler için kademeli yavaşlatma
 * 1 dakikada 5 istekten sonra yanıtları yavaşlatır
 */
const speedLimiter = slowDown({
  windowMs: 60 * 1000, // 1 dakika
  delayAfter: 5, // Dakikada 5 isteğe tam hızda izin ver
  delayMs: (hits) => hits * 100, // delayAfter sonrası her istek için 100ms gecikme ekle
  maxDelayMs: 2000, // Maksimum 2 saniye gecikme
  keyGenerator: getClientIp,
});

/**
 * Parola sıfırlama istekleri için katı sınırlayıcı
 * IP başına saatte 3 istek
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
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
 * E-posta doğrulama istekleri için sınırlayıcı
 * IP başına saatte 5 istek
 */
const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
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
  speedLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  getClientIp,
};
