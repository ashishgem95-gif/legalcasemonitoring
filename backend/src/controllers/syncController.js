const { runBatchSync } = require('../services/batchSyncService');
const { runPlaywrightSync } = require('../services/playwrightScraper');
const { runOrderSync } = require('../services/orderScraper');
const { runSmartSync } = require('../services/smartSync');
const { runHcSync } = require('../services/hcScraperService');
const { logger } = require('../config/logger');
const syncLock = require('../services/syncLock');

let syncState = {
  running: false,
  type: null,
  startedAt: null,
  completedAt: null,
  summary: null,
  progress: null,
};

// Acquire the shared lock. Returns 409 details if another sync holds it.
function acquire(type, res, startedMessage) {
  if (syncLock.isLocked()) {
    const held = syncLock.getState();
    return res.status(409).json({
      error: 'A sync is already running',
      type: held?.type,
      startedAt: held?.startedAt,
    });
  }
  syncLock.tryAcquire(type);
  syncState = { running: true, type, startedAt: new Date().toISOString(), completedAt: null, summary: null, progress: null };
  res.json({ status: 'started', message: startedMessage, startedAt: syncState.startedAt });
}

// POST /api/sync/start — basic fetch-based sync
exports.triggerBatchSync = async (req, res) => {
  if (syncLock.isLocked()) {
    const held = syncLock.getState();
    return res.status(409).json({ error: 'A sync is already running', type: held?.type, startedAt: held?.startedAt });
  }

  syncLock.tryAcquire('fetch');
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
  } finally {
    syncLock.release();
  }
};

// POST /api/sync/playwright — Playwright browser-based scraper for CAT cases
exports.triggerPlaywrightSync = async (req, res) => {
  if (syncLock.isLocked()) {
    const held = syncLock.getState();
    return res.status(409).json({ error: 'A sync is already running', type: held?.type, startedAt: held?.startedAt });
  }

  const { limit = 0 } = req.body || {};

  syncLock.tryAcquire('playwright');
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
  } finally {
    syncLock.release();
  }
};

// POST /api/sync/orders — scrape daily order details and PDFs for all CAT cases
exports.triggerOrderSync = async (req, res) => {
  if (syncLock.isLocked()) {
    const held = syncLock.getState();
    return res.status(409).json({ error: 'A sync is already running', type: held?.type, startedAt: held?.startedAt });
  }

  syncLock.tryAcquire('orders');
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
  } finally {
    syncLock.release();
  }
};

// POST /api/sync/smart — Smart sync for past-due cases (returns results directly)
exports.triggerSmartSync = async (req, res) => {
  if (syncLock.isLocked()) {
    const held = syncLock.getState();
    return res.status(409).json({ error: 'A sync is already running', type: held?.type, startedAt: held?.startedAt });
  }

  syncLock.tryAcquire('smart');
  syncState = { running: true, type: 'smart', startedAt: new Date().toISOString() };

  try {
    const result = await runSmartSync();
    syncState.running = false;
    syncState.completedAt = new Date().toISOString();
    syncState.summary = result;
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
    syncState.summary = { error: err.message };
    res.status(500).json({ error: err.message });
  } finally {
    syncLock.release();
  }
};

exports.getSyncStatus = (req, res) => {
  res.json(syncState);
};

// POST /api/sync/case/:id — Per-case re-sync
exports.resyncSingleCase = async (req, res) => {
  const caseId = parseInt(req.params.id);
  if (!caseId || isNaN(caseId)) {
    return res.status(400).json({ error: 'Valid case ID is required' });
  }

  try {
    const { runSmartSyncForCase } = require('../services/smartSync');
    const { get } = require('../config/dbHelper');

    const caseRecord = get('SELECT id, railway, case_ref_no FROM cases WHERE id = ?', [caseId]);
    if (!caseRecord) {
      return res.status(404).json({ error: `Case ${caseId} not found` });
    }

    if (req.user && req.user.railwayScope !== 'All' && caseRecord.railway !== req.user.railwayScope) {
      return res.status(403).json({ error: 'Access denied to this case.' });
    }

    const result = await runSmartSyncForCase(caseId);
    res.json({ status: 'success', caseId, caseRefNo: caseRecord.case_ref_no, ...result });
  } catch (err) {
    logger.error({ caseId, error: err.message }, 'Re-sync failed');
    res.status(500).json({ error: 'Re-sync failed: ' + err.message });
  }
};

// POST /api/sync/hc — HC/SC Playwright scraper
exports.triggerHcSync = async (req, res) => {
  if (syncLock.isLocked()) {
    const held = syncLock.getState();
    return res.status(409).json({ error: 'A sync is already running', type: held?.type, startedAt: held?.startedAt });
  }

  const { limit = 0, forum = null } = req.body || {};

  syncLock.tryAcquire('hc');
  syncState = { running: true, type: 'hc', startedAt: new Date().toISOString(), completedAt: null, summary: null };

  res.json({
    status: 'started',
    message: 'HC/SC Playwright sync initiated. Scraping High Court and Supreme Court case status pages.',
    startedAt: syncState.startedAt,
  });

  try {
    const result = await runHcSync({ limit, forum });
    syncState.running = false;
    syncState.completedAt = new Date().toISOString();
    syncState.summary = result;
    logger.info(result, 'HC sync completed');
  } catch (err) {
    syncState.running = false;
    syncState.summary = { error: err.message };
    logger.error({ err }, 'HC sync failed');
  } finally {
    syncLock.release();
  }
};

// POST /api/sync/full — Run CAT smart sync + HC Playwright sync in sequence
exports.triggerFullSync = async (req, res) => {
  if (syncLock.isLocked()) {
    const held = syncLock.getState();
    return res.status(409).json({ error: 'A sync is already running', type: held?.type, startedAt: held?.startedAt });
  }

  syncLock.tryAcquire('full');
  syncState = { running: true, type: 'full', startedAt: new Date().toISOString(), completedAt: null, summary: null, progress: { phase: 'cat', detail: null } };

  res.json({
    status: 'started',
    message: 'Full sync initiated. Phase 1: CAT smart sync. Phase 2: HC/SC Playwright sync.',
    startedAt: syncState.startedAt,
  });

  try {
    const catResult = await runSmartSync();
    syncState.progress = { phase: 'hc', detail: { catUpdated: catResult.updated.length, catErrors: catResult.errors.length } };

    const hcResult = await runHcSync({});

    syncState.running = false;
    syncState.completedAt = new Date().toISOString();
    syncState.summary = {
      cat: {
        updated: catResult.updated.length,
        unchanged: catResult.pending.length,
        errors: catResult.errors.length,
        total: catResult.total,
      },
      hc: {
        updated: hcResult.updated,
        captcha: hcResult.captcha,
        notFound: hcResult.notFound,
        noData: hcResult.noData,
        errors: hcResult.errors,
        total: hcResult.total,
      },
    };
    logger.info(syncState.summary, 'Full sync completed');
  } catch (err) {
    syncState.running = false;
    syncState.summary = { error: err.message };
    logger.error({ err }, 'Full sync failed');
  } finally {
    syncLock.release();
  }
};
