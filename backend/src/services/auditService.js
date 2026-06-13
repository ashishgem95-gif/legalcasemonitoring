const { run } = require('../config/dbHelper');
const { logger } = require('../config/logger');

function logAudit({ userId, action, targetType, targetId, details, ipAddress }) {
  try {
    run(
      `INSERT INTO audit_log (user_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId || 'system', action, targetType, targetId, details ? JSON.stringify(details) : null, ipAddress || null]
    );
  } catch (e) {
    logger.warn({ error: e.message, action, targetType, targetId }, 'Audit log insert failed');
  }
}

module.exports = { logAudit };
