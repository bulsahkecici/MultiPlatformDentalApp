const path = require('path');
const express = require('express');
const http = require('http');
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
const { initializeSocketIO } = require('./services/notificationHub');

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const usersRouter = require('./routes/users');
const patientsRouter = require('./routes/patients');
const appointmentsRouter = require('./routes/appointments');
const treatmentsRouter = require('./routes/treatments');
const notificationsRouter = require('./routes/notifications');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initializeSocketIO(server);

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
app.use('/', authRouter);
app.use('/', adminRouter);
app.use('/', usersRouter);
app.use('/', patientsRouter);
app.use('/', appointmentsRouter);
app.use('/', treatmentsRouter);
app.use('/', notificationsRouter);

// 404 and error handlers
app.use(notFoundHandler);
app.use(logErrors);
app.use(errorResponder);

function start() {
  const port = config.port;
  server.listen(port, () => {
    logger.info({ port }, `Server listening on port ${port} with Socket.IO`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, server, start };
