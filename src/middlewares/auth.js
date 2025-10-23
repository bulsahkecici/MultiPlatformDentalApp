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

module.exports = { requireAuth, requireRole };
