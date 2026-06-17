/**
 * High Court controller
 *
 * REST API for the HC lookup service:
 *   - GET  /api/hc/lookup?court=HC/<name>&type=<type>&number=<n>&year=<y>
 *     Manual lookup of a single HC case. Uses cache if available, scrapes if not.
 *   - POST /api/hc/refresh-all
 *     Triggers a manual full refresh of all HC cases due for check.
 *
 * Used by:
 *   - Frontend (future: a "Lookup on HC site" button in CaseDetail)
 *   - Nightly scheduler (M5)
 *   - Manual debugging via curl
 */

const { lookupHcCase, refreshDueHcCases, getRegisteredScrapers } = require('../services/hcLookupService');
const { logger } = require('../config/logger');

// GET /api/hc/lookup?court=HC/<name>&type=<type>&number=<n>&year=<y>
exports.lookupCase = async (req, res) => {
  const { court, type, number, year } = req.query;

  if (!court || !type || !number || !year) {
    return res.status(400).json({
      error: 'court, type, number, year are all required query params',
      example: '/api/hc/lookup?court=HC/Delhi&type=WP&number=13907&year=2022',
    });
  }

  if (!String(court).startsWith('HC/')) {
    return res.status(400).json({ error: 'court must start with "HC/" (e.g. HC/Delhi, HC/Mumbai)' });
  }

  try {
    const data = await lookupHcCase(court, String(type), String(number), String(year));
    res.json(data);
  } catch (err) {
    if (err.status === 501) {
      // No scraper registered for this court — return 501 with helpful message
      return res.status(501).json({
        error: err.message,
        code: err.code,
        registeredScrapers: getRegisteredScrapers(),
      });
    }
    logger.error({ err: err.message, court, type, number, year }, 'HC lookup failed');
    res.status(500).json({ error: 'HC lookup failed: ' + err.message });
  }
};

// POST /api/hc/refresh-all
// Triggers a manual full refresh. In the future, this can be wrapped with the
// same syncState lock pattern as syncController if multiple admins click at once.
exports.refreshAll = async (req, res) => {
  try {
    logger.info('HC manual refresh triggered by user');
    const result = await refreshDueHcCases();
    res.json({ status: 'complete', ...result });
  } catch (err) {
    logger.error({ err: err.message }, 'HC refresh-all failed');
    res.status(500).json({ error: 'HC refresh failed: ' + err.message });
  }
};

// GET /api/hc/scrapers — list of registered scrapers (for admin UI / debugging)
exports.listScrapers = (req, res) => {
  res.json({ registered: getRegisteredScrapers() });
};
