const path = require('path');
const express = require('express');
const compression = require('compression');
const cors = require('cors');

const config = require('./config');
const logger = require('./utils/logger');
const httpLogger = require('./middlewares/logger');
const securityMiddleware = require('./middlewares/security');
const {
  notFoundHandler,
  logErrors,
  errorResponder,
} = require('./middlewares/error');
const { generalLimiter } = require('./middlewares/rateLimit');

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');

const app = express();

// Logging
app.use(httpLogger());

// Security headers & CSP
app.use(securityMiddleware());

// CORS - narrowly allow configured origins only
const allowedOrigins = new Set(config.cors.origins);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow same-origin and curl
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: false,
  }),
);

// Body parsing & compression
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Rate limiting - applied globally; mutating routes use per-route limiter
app.use(generalLimiter);

// Static files
app.use(
  express.static(path.join(__dirname, '..', 'public'), { fallthrough: true }),
);

// Routes
app.use('/', healthRouter);
app.use('/', authRouter); // provides /api/login
app.use('/', adminRouter); // provides /admin/*

// 404 and error handlers
app.use(notFoundHandler);
app.use(logErrors);
app.use(errorResponder);

function start() {
  const port = config.port;
  app.listen(port, () => {
    logger.info({ port }, `Server listening on port ${port}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
