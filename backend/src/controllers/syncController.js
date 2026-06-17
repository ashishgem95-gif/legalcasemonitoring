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

// POST /api/sync/case/:id — Per-case re-sync
exports.resyncSingleCase = async (req, res) => {
  const caseId = parseInt(req.params.id);
  if (!caseId || isNaN(caseId)) {
    return res.status(400).json({ error: 'Valid case ID is required' });
  }

  try {
    const { runSmartSyncForCase } = require('../services/smartSync');
    const { get } = require('../config/dbHelper');

    // Fetch the full case record so we can decide which sync engine to use
    const caseRecord = get(
      'SELECT id, railway, case_ref_no, forum, case_type, case_number, case_year FROM cases WHERE id = ?',
      [caseId]
    );
    if (!caseRecord) {
      return res.status(404).json({ error: `Case ${caseId} not found` });
    }

    if (req.user && req.user.railwayScope !== 'All' && caseRecord.railway !== req.user.railwayScope) {
      return res.status(403).json({ error: 'Access denied to this case.' });
    }

    // Route HC cases to the new HC lookup service. Other forums (CAT, etc.)
    // continue to use the existing CAT/eCourtsIndia smart sync engine.
    if (caseRecord.forum && String(caseRecord.forum).startsWith('HC/')) {
      try {
        const { lookupHcCase } = require('../services/hcLookupService');
        const data = await lookupHcCase(
          caseRecord.forum,
          caseRecord.case_type,
          caseRecord.case_number,
          caseRecord.case_year
        );
        logger.info({ caseId, forum: caseRecord.forum, source: data.source }, 'HC resync success');
        return res.json({
          status: 'success',
          caseId,
          caseRefNo: caseRecord.case_ref_no,
          source: 'hc-scraper',
          ...data,
        });
      } catch (err) {
        if (err.status === 501) {
          // No scraper registered for this HC — return 501 with a clear message
          return res.status(501).json({
            status: 'not_implemented',
            error: err.message,
            caseId,
            caseRefNo: caseRecord.case_ref_no,
            forum: caseRecord.forum,
          });
        }
        throw err;
      }
    }

    // Default path: CAT / eCourtsIndia smart sync
    const result = await runSmartSyncForCase(caseId);
    res.json({ status: 'success', caseId, caseRefNo: caseRecord.case_ref_no, ...result });
  } catch (err) {
    logger.error({ caseId, error: err.message }, 'Re-sync failed');
    res.status(500).json({ error: 'Re-sync failed: ' + err.message });
  }
};
