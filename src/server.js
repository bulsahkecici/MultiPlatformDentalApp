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
const { cleanupExpiredTokens } = require('./utils/tokenManager');

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const usersRouter = require('./routes/users');
const patientsRouter = require('./routes/patients');
const appointmentsRouter = require('./routes/appointments');
const treatmentsRouter = require('./routes/treatments');
const notificationsRouter = require('./routes/notifications');
const dentistRouter = require('./routes/dentist');
const paymentsRouter = require('./routes/payments');
const institutionAgreementsRouter = require('./routes/institutionAgreements');
const patientRecordsRouter = require('./routes/patientRecords');

const app = express();
const server = http.createServer(app);

// Yalnızca yapılandırılmış proxy kaynaklarından gelen X-Forwarded-* başlıklarına
// güven. Production varsayılanı "loopback" olduğundan internete açık backend
// portuna doğrudan gelen istemci IP/rate-limit anahtarını taklit edemez.
app.set('trust proxy', config.trustProxy);

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

// Routes
app.use('/', healthRouter);
app.use('/', authRouter);
app.use('/', adminRouter);
app.use('/', usersRouter);
app.use('/', patientsRouter);
app.use('/', appointmentsRouter);
app.use('/', treatmentsRouter);
app.use('/', notificationsRouter);
app.use('/', dentistRouter);
app.use('/', paymentsRouter);
app.use('/', institutionAgreementsRouter);
app.use('/', patientRecordsRouter);

// 404 and error handlers
app.use(notFoundHandler);
app.use(logErrors);
app.use(errorResponder);

function start() {
  const port = config.port;
  server.listen(port, () => {
    logger.info({ port }, `Server listening on port ${port} with Socket.IO`);
  });

  // Süresi geçmiş refresh token'ları günde bir temizle (tablo sınırsız büyümesin)
  setInterval(
    () => {
      cleanupExpiredTokens()
        .then((count) => {
          if (count > 0) {
            logger.info({ count }, 'Expired refresh tokens cleaned up');
          }
        })
        .catch((err) =>
          logger.error({ err }, 'Failed to clean up expired tokens'),
        );
    },
    24 * 60 * 60 * 1000,
  ).unref();
}

if (require.main === module) {
  start();
}

module.exports = { app, server, start };
