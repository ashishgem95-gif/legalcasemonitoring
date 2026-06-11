const path = require('path');
const fs = require('fs');
const { logger } = require('../config/logger');

const BACKUP_DIR = path.resolve(__dirname, '..', '..', '..', 'backups');

function initBackupScheduler() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Run backup every 6 hours
  const INTERVAL_MS = 6 * 60 * 60 * 1000;

  async function runBackup() {
    try {
      const { db } = require('../config/database');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(BACKUP_DIR, `legal_tracker_${timestamp}.db`);

      await db.backup(backupPath);
      logger.info({ backupPath }, 'Database backup created');

      // Keep only last 14 backups
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('legal_tracker_') && f.endsWith('.db'))
        .sort()
        .reverse();

      files.slice(14).forEach(f => {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
        logger.info({ file: f }, 'Removed old backup');
      });
    } catch (err) {
      logger.error({ err }, 'Database backup failed');
    }
  }

  // Run first backup after 30 seconds, then on interval
  setTimeout(() => {
    runBackup();
    setInterval(runBackup, INTERVAL_MS);
    logger.info({ intervalMs: INTERVAL_MS, backupDir: BACKUP_DIR }, 'Backup scheduler initialized');
  }, 30000);
}

module.exports = { initBackupScheduler };
