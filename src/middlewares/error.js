const logger = require('../utils/logger');
const { errorResponder, AppError } = require('../utils/errorResponder');

function notFoundHandler(req, res, next) {
  next(new AppError('Not Found', 404));
}

function logErrors(err, req, res, next) {
  const safeMessage = err && err.message ? err.message : 'Unknown error';
  // Log full error server-side; keep responses generic per security rules
  logger.error({ err }, safeMessage);
  next(err);
}

module.exports = { notFoundHandler, logErrors, errorResponder };
