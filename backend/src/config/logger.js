const pino = require('pino');
const { v4: uuidv4 } = require('uuid');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  mixin() {
    return {};
  }
});

function requestLogger(req, res, next) {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.requestId);
  req.log = logger.child({ requestId: req.requestId, method: req.method, url: req.url });
  next();
}

function auditLog(db) {
  return {
    log: (userId, action, targetType, targetId, details = {}) => {
      try {
        db.prepare(
          `INSERT INTO audit_log (user_id, action, target_type, target_id, details, ip_address)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(userId, action, targetType, targetId, JSON.stringify(details), '');
      } catch (err) {
        logger.error({ err }, 'Failed to write audit log');
      }
    }
  };
}

module.exports = { logger, requestLogger, auditLog };
