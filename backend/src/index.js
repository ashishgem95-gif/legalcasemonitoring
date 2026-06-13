require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./routes/api');
const { requestLogger, logger } = require('./config/logger');

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Promise Rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception - shutting down');
  process.exit(1);
});

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// ── Security ──
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// ── Rate Limiting ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
});

// ── Logging ──
app.use(requestLogger);

// ── Body Parsing ──
app.use(express.json({ limit: '10mb' }));

// ── API Routes ──
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/login')) {
    return authLimiter(req, res, next);
  }
  generalLimiter(req, res, next);
}, apiRoutes);

// ── Health Check ──
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Legal Case Monitoring System API is active.',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── Error Handler ──
app.use((err, req, res, _next) => {
  logger.error({ err, requestId: req.requestId }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ──
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Backend server started');

  const { run } = require('./config/dbHelper');
  const cleanupSessions = () => {
    try {
      run("DELETE FROM user_sessions WHERE expires_at < datetime('now')");
    } catch (e) { logger.error({ err: e }, 'Failed to cleanup expired sessions'); }
  };
  cleanupSessions();
  setInterval(cleanupSessions, 6 * 60 * 60 * 1000);

  // Initialize scheduler services
  try {
    const scraperService = require('./services/scraperService');
    scraperService.initScheduler();
  } catch (e) { logger.error({ err: e }, 'Failed to init scraper'); }

  try {
    const backupService = require('./services/backupService');
    backupService.initBackupScheduler();
  } catch (e) { logger.error({ err: e }, 'Failed to init backup scheduler'); }

  // Check hearing reminders every 4 hours
  try {
    const emailService = require('./services/emailService');
    const checkReminders = () => {
      emailService.checkAndQueueReminders().then(() => emailService.processEmailQueue());
    };
    checkReminders();
    setInterval(checkReminders, 4 * 60 * 60 * 1000);
  } catch (e) { logger.error({ err: e }, 'Failed to init email scheduler'); }
});

server.on('error', (err) => {
  logger.fatal({ err }, 'Server failed to start');
  process.exit(1);
});

// ── Graceful Shutdown ──
const { db } = require('./config/database');
const scraperService = require('./services/scraperService');

process.on('SIGINT', () => {
  logger.info('Shutting down server...');
  if (typeof scraperService.stopScheduler === 'function') {
    scraperService.stopScheduler();
  }
  server.close(() => {
    try { db.close(); } catch (e) { /* ignore */ }
    logger.info('Server process terminated.');
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn('Forced shutdown after 10s');
    process.exit(1);
  }, 10000).unref();
});

module.exports = app;
