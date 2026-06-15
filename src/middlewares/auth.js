const jwt = require('jsonwebtoken');
const config = require('../config');
const { AppError } = require('../utils/errorResponder');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return next(new AppError('Unauthorized', 401));
  }
  try {
    const payload = jwt.verify(token, config.security.jwtSecret);
    req.user = payload;
    return next();
  } catch (e) {
    return next(new AppError('Unauthorized', 401));
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles || !Array.isArray(req.user.roles)) {
      return next(new AppError('Forbidden', 403));
    }
    if (!req.user.roles.includes(role)) {
      return next(new AppError('Forbidden', 403));
    }
    return next();
  };
}

/**
 * Kullanıcının yalnızca kendi kaynağına erişmesini zorunlu kılar
 */
function requireSelf(req, res, next) {
  if (!req.user) {
    return next(new AppError('Unauthorized', 401));
  }

  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId) || req.user.sub !== userId) {
    return next(new AppError('Forbidden', 403));
  }

  return next();
}

/**
 * Kullanıcının yalnızca kendi kaynağına erişmesini VEYA admin olmasını zorunlu kılar
 */
function requireSelfOrAdmin(req, res, next) {
  if (!req.user) {
    return next(new AppError('Unauthorized', 401));
  }

  const userId = parseInt(req.params.id, 10);
  const isAdmin = req.user.roles && req.user.roles.includes('admin');
  const isSelf = req.user.sub === userId;

  if (!isSelf && !isAdmin) {
    return next(new AppError('Forbidden', 403));
  }

  return next();
}

/**
 * Belirtilen rollerden herhangi birine sahip olmayı zorunlu kılar
 */
function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles || !Array.isArray(req.user.roles)) {
      return next(new AppError('Forbidden', 403));
    }
    const hasRole = roles.some((role) => req.user.roles.includes(role));
    if (!hasRole) {
      return next(new AppError('Forbidden', 403));
    }
    return next();
  };
}

/**
 * Kullanıcının fiyatları görme yetkisi olup olmadığını kontrol eder
 * Yalnızca admin ve sekreter fiyatları görebilir
 */
function canViewPrices(req) {
  if (!req.user || !req.user.roles || !Array.isArray(req.user.roles)) {
    return false;
  }
  return (
    req.user.roles.includes('admin') || req.user.roles.includes('secretary')
  );
}

/**
 * Kullanıcının hekim olup olmadığını kontrol eder (yalnızca kendi randevularını görebilir)
 */
function isDentist(req) {
  if (!req.user || !req.user.roles || !Array.isArray(req.user.roles)) {
    return false;
  }
  return req.user.roles.includes('dentist');
}

module.exports = {
  requireAuth,
  requireRole,
  requireSelf,
  requireSelfOrAdmin,
  requireAnyRole,
  canViewPrices,
  isDentist,
};
