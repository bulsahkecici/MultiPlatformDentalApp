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
 * Require user to access their own resource only
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
 * Require user to access their own resource OR be an admin
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
 * Require any of the specified roles
 */
function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles || !Array.isArray(req.user.roles)) {
      return next(new AppError('Forbidden', 403));
    }
    const hasRole = roles.some(role => req.user.roles.includes(role));
    if (!hasRole) {
      return next(new AppError('Forbidden', 403));
    }
    return next();
  };
}

/**
 * Check if user has permission to view prices
 * Only admin and secretary can see prices
 */
function canViewPrices(req) {
  if (!req.user || !req.user.roles || !Array.isArray(req.user.roles)) {
    return false;
  }
  return req.user.roles.includes('admin') || req.user.roles.includes('secretary');
}

/**
 * Check if user is dentist (can only see own appointments)
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
  isDentist
};
