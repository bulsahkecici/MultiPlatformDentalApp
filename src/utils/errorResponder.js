class AppError extends Error {
  constructor(message, statusCode = 500, details) {
    super(message || 'Internal Server Error');
    this.name = 'AppError';
    this.statusCode = statusCode;
    if (details) {
      this.details = details;
    }
    Error.captureStackTrace?.(this, this.constructor);
  }
}

function errorResponder(err, req, res, next) {
  const status =
    err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const response = {
    error: {
      message:
        status >= 500
          ? (isDevelopment ? (err.message || 'An unexpected error occurred.') : 'An unexpected error occurred.')
          : err.message || 'Request failed.',
    },
  };

  if (isDevelopment) {
    if (err.details) {
      response.error.details = err.details;
    }
    if (err.stack) {
      response.error.stack = err.stack;
    }
  }

  res.status(status).json(response);
}

module.exports = { AppError, errorResponder };
