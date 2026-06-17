/**
 * High Court Nightly Scheduler
 *
 * Refreshes HC cases that are due for a check (next hearing within 7 days)
 * at 02:00 IST every day.
 *
 * Uses node-cron for precise timezone-aware scheduling.
 *
 * The actual scraping is handled by hcLookupService.refreshDueHcCases(),
 * which respects concurrency (5) and delay (2s) between batches.
 */

const cron = require('node-cron');
const { logger } = require('../config/logger');
const { refreshDueHcCases, getRegisteredScrapers } = require('./hcLookupService');

let scheduledTask = null;

/**
 * Initialize the nightly scheduler.
 * Idempotent: safe to call multiple times (stops the previous task first).
 */
function initHcScheduler() {
  // Idempotency: stop any previously scheduled task
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  // Run at 02:00 IST (Asia/Kolkata) every day
  scheduledTask = cron.schedule(
    '0 2 * * *',
    async () => {
      const registered = getRegisteredScrapers();
      if (registered.length === 0) {
        logger.info('HC nightly refresh skipped: no scrapers registered');
        return;
      }
      logger.info({ registered }, 'HC nightly refresh starting (02:00 IST)');
      try {
        const result = await refreshDueHcCases();
        logger.info(result, 'HC nightly refresh complete');
      } catch (err) {
        logger.error({ err: err.message, stack: err.stack }, 'HC nightly refresh failed');
      }
    },
    { timezone: 'Asia/Kolkata' }
  );

  logger.info('HC nightly scheduler initialized (02:00 IST daily)');
}

/**
 * Stop the scheduler. Useful for tests and graceful shutdown.
 */
function stopHcScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('HC nightly scheduler stopped');
  }
}

module.exports = { initHcScheduler, stopHcScheduler };
