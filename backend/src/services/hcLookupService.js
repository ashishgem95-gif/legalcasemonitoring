/**
 * HC Lookup Service — Unified interface for High Court case lookups.
 *
 * Registry pattern: register a scraper for a court code, then call lookupHcCase().
 * Checks the hc_case_cache first (24h TTL); on miss/expired, calls the registered
 * scraper and writes the result back to the cache.
 *
 * Used by:
 * - POST /api/sync/case/:id (auto-routes HC cases to this service)
 * - GET /api/hc/lookup?court=HC/<name>&type=<type>&number=<n>&year=<y> (manual)
 * - Nightly scheduler (refreshDueHcCases) at 02:00 IST
 */

const { run, get, all } = require('../config/dbHelper');
const { logger } = require('../config/logger');

const CACHE_TTL_HOURS = 24;
const SCRAPE_CONCURRENCY = 5;
const BATCH_DELAY_MS = 2000;

const scrapers = {};

function registerHcScraper(courtCode, scraperFn) {
  if (!courtCode || typeof courtCode !== 'string') {
    throw new Error('registerHcScraper: courtCode must be a non-empty string');
  }
  if (typeof scraperFn !== 'function') {
    throw new Error('registerHcScraper: scraperFn must be a function');
  }
  scrapers[courtCode] = scraperFn;
  logger.info({ courtCode }, 'HC scraper registered');
}

function getRegisteredScrapers() {
  return Object.keys(scrapers);
}

/**
 * Look up a High Court case. Returns cached result if available + not expired,
 * otherwise calls the registered scraper and caches the result.
 */
async function lookupHcCase(courtCode, caseType, caseNumber, caseYear) {
  if (!courtCode || !caseType || !caseNumber || !caseYear) {
    throw new Error('lookupHcCase: courtCode, caseType, caseNumber, caseYear are all required');
  }

  // 1. Check cache
  const cached = get(
    `SELECT * FROM hc_case_cache
     WHERE court_code = ? AND case_type = ? AND case_number = ? AND case_year = ?
     AND expires_at > CURRENT_TIMESTAMP
     AND is_stale = 0
     LIMIT 1`,
    [courtCode, caseType, String(caseNumber), Number(caseYear)]
  );

  if (cached) {
    logger.info({ courtCode, caseType, caseNumber, caseYear }, 'HC cache hit');
    return {
      ...JSON.parse(cached.payload_json),
      source: 'cache',
      fetchedAt: cached.fetched_at,
    };
  }

  // 2. Cache miss — find a registered scraper
  const scraper = scrapers[courtCode];
  if (!scraper) {
    const known = Object.keys(scrapers);
    throw Object.assign(
      new Error(`No scraper registered for ${courtCode}. Known scrapers: ${known.join(', ') || '(none)'}`),
      { status: 501, code: 'NOT_IMPLEMENTED' }
    );
  }

  // 3. Call the scraper
  logger.info({ courtCode, caseType, caseNumber, caseYear }, 'HC cache miss — calling scraper');
  const result = await scraper({ courtCode, caseType, caseNumber, caseYear });
  const payloadJson = JSON.stringify(result);

  // 4. Write to cache (UPSERT)
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
  run(
    `INSERT INTO hc_case_cache
       (court_code, case_type, case_number, case_year, payload_json, party_names, case_status,
        next_hearing_date, latest_order_link, history_link, source, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(court_code, case_type, case_number, case_year) DO UPDATE SET
       payload_json = excluded.payload_json,
       party_names = excluded.party_names,
       case_status = excluded.case_status,
       next_hearing_date = excluded.next_hearing_date,
       latest_order_link = excluded.latest_order_link,
       history_link = excluded.history_link,
       source = excluded.source,
       fetched_at = CURRENT_TIMESTAMP,
       expires_at = excluded.expires_at,
       is_stale = 0`,
    [
      courtCode, caseType, String(caseNumber), Number(caseYear),
      payloadJson,
      result.partyNames || null,
      result.caseStatus || null,
      result.nextHearingDate || null,
      result.latestOrderLink || null,
      result.historyLink || null,
      result.source || 'live',
      expiresAt,
    ]
  );

  return { ...result, source: result.source || 'live' };
}

/**
 * Refresh all HC cases that are due for a check (next hearing within 7 days).
 * Used by the nightly scheduler.
 */
async function refreshDueHcCases() {
  const due = all(
    `SELECT c.id, c.case_ref_no, c.forum, c.case_type, c.case_number, c.case_year
     FROM cases c
     WHERE c.forum LIKE 'HC/%'
       AND c.forum IN (${Object.keys(scrapers).map(() => '?').join(',') || "''"})
       AND c.next_hearing_date IS NOT NULL
       AND c.next_hearing_date <= DATE('now', '+7 days')
       AND c.present_status != 'Disposed'
     ORDER BY c.next_hearing_date ASC`,
    Object.keys(scrapers)
  ).filter(Boolean);

  if (due.length === 0) {
    return { checkedCount: 0, errorCount: 0, skipped: 'no registered scrapers' };
  }

  let checkedCount = 0;
  let errorCount = 0;

  // Batched parallel execution
  for (let i = 0; i < due.length; i += SCRAPE_CONCURRENCY) {
    const batch = due.slice(i, i + SCRAPE_CONCURRENCY);
    await Promise.all(batch.map(async (c) => {
      try {
        await lookupHcCase(c.forum, c.case_type, c.case_number, c.case_year);
        checkedCount++;
      } catch (err) {
        errorCount++;
        logger.warn({ caseId: c.id, caseRefNo: c.case_ref_no, error: err.message }, 'HC nightly refresh: scrape failed');
      }
    }));
    if (i + SCRAPE_CONCURRENCY < due.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return { checkedCount, errorCount, total: due.length };
}

module.exports = {
  registerHcScraper,
  getRegisteredScrapers,
  lookupHcCase,
  refreshDueHcCases,
  CACHE_TTL_HOURS,
};
