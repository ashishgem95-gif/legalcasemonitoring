const { runBatchSync } = require('../services/batchSyncService');
const { runPlaywrightSync } = require('../services/playwrightScraper');
const { runOrderSync } = require('../services/orderScraper');
const { runSmartSync } = require('../services/smartSync');
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

  syncState = { running: true, type: 'fetch', startedAt: new Date().toISOString(), completedAt: null, summary: null, progress: null };

  res.json({ status: 'started', message: 'Batch sync initiated.', startedAt: syncState.startedAt });

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
// POST /api/sync/orders — scrape daily order details and PDFs for all CAT cases
exports.triggerOrderSync = async (req, res) => {
  if (syncState.running) {
    return res.status(409).json({ error: 'A sync is already running', type: syncState.type });
  }

  syncState = { running: true, type: 'orders', startedAt: new Date().toISOString(), completedAt: null, summary: null };

  res.json({ status: 'started', message: 'Order scraper initiated. Extracting hearing dates and PDF links from CAT daily order pages.', startedAt: syncState.startedAt });

  try {
    const result = await runOrderSync();
    syncState.running = false;
    syncState.completedAt = new Date().toISOString();
    syncState.summary = result;
    logger.info(result, 'Order sync completed');
  } catch (err) {
    syncState.running = false;
    syncState.summary = { error: err.message };
    logger.error({ err }, 'Order sync failed');
  }
};

// POST /api/sync/smart — Smart sync for past-due cases (returns results directly)
exports.triggerSmartSync = async (req, res) => {
  if (syncState.running) {
    return res.status(409).json({ error: 'A sync is already running', type: syncState.type });
  }
  syncState = { running: true, type: 'smart', startedAt: new Date().toISOString() };

  try {
    const result = await runSmartSync();
    syncState.running = false;
    res.json({
      status: 'complete',
      updated: result.updated.length,
      unchanged: result.pending.length,
      errors: result.errors.length,
      total: result.total,
      detail: {
        updated: result.updated.map(r => ({ caseId: r.caseId, caseRefNo: r.caseRefNo, petitioner: r.petitioner, hearingsAdded: r.hearingsAdded, pdfsAdded: r.pdfsAdded, newNextDate: r.newNextDate })),
        pending: result.pending.map(r => ({ caseId: r.caseId, caseRefNo: r.caseRefNo, petitioner: r.petitioner })),
        errors: result.errors.map(r => ({ caseId: r.caseId, caseRefNo: r.caseRefNo, petitioner: r.petitioner, error: r.error })),
      }
    });
  } catch (err) {
    syncState.running = false;
    res.status(500).json({ error: err.message });
  }
};

exports.getSyncStatus = (req, res) => {
  res.json(syncState);
};
