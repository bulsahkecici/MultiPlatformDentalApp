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
const dentistRouter = require('./routes/dentist');
const paymentsRouter = require('./routes/payments');
const institutionAgreementsRouter = require('./routes/institutionAgreements');
const invoicesRouter = require('./routes/invoices');
const discountsRouter = require('./routes/discounts');

const app = express();
const server = http.createServer(app);

// Socket.IO'yu başlat
initializeSocketIO(server);

// Günlükleme
app.use(httpLogger());

// Güvenlik başlıkları & CSP
app.use(securityMiddleware());

// CORS - yalnızca yapılandırılmış kaynaklara sınırlı izin ver
const allowedOrigins = new Set(config.cors.origins);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // aynı kaynağa ve curl'e izin ver
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: false,
  }),
);

// Gövde ayrıştırma & sıkıştırma
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Hız sınırlama - global uygulanır; veri değiştiren rotalar rota bazlı sınırlayıcı kullanır
app.use(generalLimiter);

// Statik dosyalar
app.use(
  express.static(path.join(__dirname, '..', 'public'), { fallthrough: true }),
);

// Rotalar
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
app.use('/', invoicesRouter);
app.use('/', discountsRouter);

// 404 ve hata yöneticileri
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
