const { runBatchSync } = require('../services/batchSyncService');
const { runPlaywrightSync } = require('../services/playwrightScraper');
const { logger } = require('../config/logger');

let syncState = {
  running: false,
  type: null,
  startedAt: null,
  completedAt: null,
  summary: null,
  progress: null,
};

// POST /api/sync/start — basic fetch-based sync
exports.triggerBatchSync = async (req, res) => {
  if (syncState.running) {
    return res.status(409).json({
      error: 'A sync is already running',
      type: syncState.type,
      startedAt: syncState.startedAt,
    });
  }

  res.json({ status: 'started', message: 'Batch sync initiated.', startedAt: new Date().toISOString() });
  // ... rest is same, runs in background
  syncState = { running: true, type: 'fetch', startedAt: new Date().toISOString(), completedAt: null, summary: null, progress: null };
  try {
    const result = await runBatchSync(req.body || {});
    syncState.running = false;
    syncState.completedAt = new Date().toISOString();
    syncState.summary = result;
  } catch (err) {
    syncState.running = false;
    syncState.summary = { error: err.message };
  }
};

// POST /api/sync/playwright — Playwright browser-based scraper for CAT cases
exports.triggerPlaywrightSync = async (req, res) => {
  if (syncState.running) {
    return res.status(409).json({
      error: 'A sync is already running',
      type: syncState.type,
      startedAt: syncState.startedAt,
    });
  }

  const { limit = 0 } = req.body || {};

  syncState = {
    running: true,
    type: 'playwright',
    startedAt: new Date().toISOString(),
    completedAt: null,
    summary: null,
    progress: null,
  };

  res.json({
    status: 'started',
    message: `Playwright sync initiated. Will scrape CAT case detail pages with headless browser. ${limit ? 'Limit: ' + limit : 'All CAT cases.'}`,
    startedAt: syncState.startedAt,
  });

  try {
    const result = await runPlaywrightSync({ limit });
    syncState.running = false;
    syncState.completedAt = new Date().toISOString();
    syncState.summary = result;
    logger.info(result, 'Playwright sync completed');
  } catch (err) {
    syncState.running = false;
    syncState.summary = { error: err.message };
    logger.error({ err }, 'Playwright sync failed');
  }
};

// GET /api/sync/status
exports.getSyncStatus = (req, res) => {
  res.json(syncState);
};
