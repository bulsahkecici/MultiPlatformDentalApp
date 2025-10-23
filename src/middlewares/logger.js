const morgan = require('morgan');
const logger = require('../utils/logger');

// Morgan stream to pino
const stream = {
  write: (message) => logger.info(message.trim()),
};

function httpLogger() {
  return morgan('combined', { stream });
}

module.exports = httpLogger;
