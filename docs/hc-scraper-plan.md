# High Court Scraper Plan

> Status: Ready to execute | Estimated total time: ~60-70 min coding + ~15 min live testing

---

## Architecture Decision

**Option B: Node.js extension** — Scraper lives inside the existing `backend/` Express service, reusing the SQLite database, sync controller, scheduler, auth middleware, and frontend resync button. Single deploy, single stack.

Already available in the project:
- `playwright` (installed in `backend/package.json`)
- Sync controller + routes (`controllers/syncController.js`, `routes/api.js:134-138`)
- Smart sync engine with concurrency, date parsing, HTML parsing (`services/smartSync.js`)
- Scheduler init pattern (`index.js:94-113`)
- `DISPOSED_STATUSES` constant (`config/constants.js`)
- `courtUrlBuilder.js` with HC forum codes (13 courts already mapped)
- Frontend resync button (`CaseDetail.jsx:202`, `CaseCard.jsx:46`, `CalendarTab.jsx:64`)

---

## Dependencies to Add

```bash
npm install --prefix backend cheerio@^1.0.0-rc.12 node-cron@^3.0.3
```

| Package | Purpose | Size |
|---|---|---|
| `cheerio` | jQuery-like HTML parser (Node equivalent of BeautifulSoup4) | ~3MB |
| `node-cron` | Cron scheduler with timezone support (2 AM IST) | ~500KB |

---

## Database: `hc_case_cache` Table

Add to `backend/src/config/database.js` after the `ai_settings` table block (line ~434):

```sql
CREATE TABLE IF NOT EXISTS hc_case_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  court_code VARCHAR NOT NULL,
  case_type VARCHAR NOT NULL,
  case_number VARCHAR NOT NULL,
  case_year INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  party_names TEXT,
  case_status VARCHAR,
  next_hearing_date DATE,
  latest_order_link VARCHAR,
  history_link VARCHAR,
  source VARCHAR DEFAULT 'live',
  is_stale INTEGER DEFAULT 0,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(court_code, case_type, case_number, case_year)
);
CREATE INDEX IF NOT EXISTS idx_hc_cache_expiry ON hc_case_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_hc_cache_lookup ON hc_case_cache(court_code, case_type, case_number, case_year);
```

**Rules:**
- 24-hour TTL: `expires_at = fetched_at + 24 hours`
- On cache hit AND not expired → skip Playwright, return cached
- On cache miss OR expired → scrape fresh, write cache, update `cases.last_checked_at`
- Both `hc_case_cache.expires_at` and `cases.last_checked_at` coexist (following `smartSync.js:189` pattern)

---

## Files to Create (5 new)

### 1. `backend/src/services/delhiHcScraper.js`

**Purpose:** Playwright-based Delhi High Court scraper for `delhihighcourt.nic.in`.

**Pattern:** Follow `smartSync.js:checkCase()` — return `{ status, partyNames, caseStatus, nextHearingDate, latestOrderLink, historyLink, hearings, error }`.

**Flow:**
```
1. Open Playwright browser (headless, no-sandbox)
2. Navigate to Delhi HC case status page
3. Fill search form: case_type, case_number, case_year
4. Submit and wait for results page
5. Parse HTML with cheerio:
   - party_names: applicant vs respondent cells
   - case_status: status/pending/disposed indicator
   - next_hearing_date: hearing table first row date
   - latest_order_link: first PDF link in results
   - history_link: link to full order history
6. If hearing history table exists, parse all rows → hearings[]
7. Close browser, return structured data
```

**WARNING:** The exact HTML selectors are unknown until tested against the live site. The Reddit post proves the endpoint exists (`/app/online-cause-history/<base64-payload>`) but the payload format and response structure need one round of live testing.

**Rate limiting:** Use concurrency 5 (conservative), 2s delay between batches, polite User-Agent.

### 2. `backend/src/services/hcLookupService.js`

**Purpose:** Unified interface for all High Courts. Registry pattern — add new HCs by registering a `{name, scrape}` pair.

**Interface:**
```js
// Register a scraper for a court
function registerHcScraper(courtCode, scraperFn) { ... }

// Look up a case (uses cache if available + fresh)
async function lookupHcCase(courtCode, caseType, caseNumber, caseYear) {
  // 1. Check hc_case_cache for unexpired entry
  // 2. If cache hit AND expires_at > NOW → return cached payload_json
  // 3. Else → call registered scraper function
  // 4. Store result in hc_case_cache with 24h expiry
  // 5. Update cases.last_checked_at
  // 6. Return structured data
}

// Refresh all HC cases due for check (for nightly scheduler)
async function refreshDueHcCases() {
  // SELECT cases WHERE forum LIKE 'HC/%' AND next_hearing_date <= DATE('now', '+7 days')
  // Call lookupHcCase for each, respecting concurrency
}
```

**Hearing history storage:**
- After scraping, insert each hearing row into `hearing_history` (idempotent: `INSERT OR IGNORE`)
- Update `cases.next_hearing_date` if scraper found a newer date
- Update `cases.present_status` if scraper detected disposal

### 3. `backend/src/services/hcScheduler.js`

**Purpose:** Nightly refresh at 2:00 AM IST of HC cases with hearings within 7 days.

**Pattern:** Follow existing `scraperService.js:377-391` scheduler pattern but use `node-cron` for precise IST timezone scheduling.

```js
const cron = require('node-cron');
const { logger } = require('../config/logger');
const { refreshDueHcCases } = require('./hcLookupService');

let job = null;

function initHcScheduler() {
  // Run at 02:00 IST daily
  job = cron.schedule('0 2 * * *', async () => {
    logger.info('Starting HC nightly refresh (02:00 IST)');
    try {
      const result = await refreshDueHcCases();
      logger.info(result, 'HC nightly refresh complete');
    } catch (err) {
      logger.error({ err }, 'HC nightly refresh failed');
    }
  }, { timezone: 'Asia/Kolkata' });

  logger.info('HC nightly scheduler initialized (02:00 IST daily)');
}
```

Add to `backend/src/index.js` after the existing scraper init (line ~98):
```js
try {
  const hcScheduler = require('./services/hcScheduler');
  hcScheduler.initHcScheduler();
} catch (e) { logger.error({ err: e }, 'Failed to init HC scheduler'); }
```

### 4. `backend/src/controllers/hcController.js`

**Purpose:** REST API for manual HC case lookup.

```js
// GET /api/hc/lookup?court=HC/Delhi&type=WP(C)&number=1815&year=2026
exports.lookupCase = async (req, res) => {
  const { court, type, number, year } = req.query;
  if (!court || !type || !number || !year) {
    return res.status(400).json({ error: 'court, type, number, year are required' });
  }
  const data = await lookupHcCase(court, type, number, year);
  res.json(data);
};

// POST /api/hc/refresh-all — triggers manual full refresh
exports.refreshAll = async (req, res) => {
  // Check syncState lock (reuse existing pattern)
  const result = await refreshDueHcCases();
  res.json({ status: 'complete', ...result });
};
```

### 5. No new frontend files needed

The existing `CaseDetail.jsx:202` button calls `api.resyncCase(caseId)` → `POST /sync/case/:id`. Modify the backend `resyncSingleCase` to detect forum:

```js
// In syncController.js:138 (resyncSingleCase)
if (caseRecord.forum && caseRecord.forum.startsWith('HC/')) {
  // Route to HC lookup service
  const data = await lookupHcCase(
    caseRecord.forum,
    caseRecord.case_type,
    caseRecord.case_number,
    caseRecord.case_year
  );
  res.json({ status: 'success', source: 'hc-scraper', ...data });
} else {
  // Existing CAT / eCourtsIndia flow (unchanged)
  const result = await runSmartSyncForCase(caseId);
  res.json({ status: 'success', ...result });
}
```

---

## Files to Modify (4)

| File | Change |
|---|---|
| `backend/src/config/database.js` | Add `hc_case_cache` table + 2 indexes (after `ai_settings`, ~line 434) |
| `backend/src/routes/api.js` | Wire `GET /api/hc/lookup`, `POST /api/hc/refresh-all` |
| `backend/src/controllers/syncController.js` | Extend `resyncSingleCase` — if `forum.startsWith('HC/')` → call `hcLookupService` |
| `backend/src/index.js` | Init `hcScheduler` in the scheduler startup block |

---

## Milestone Execution Order

### M1: DB + Dependencies + Cache Skeleton (~5 min)
1. Add `hc_case_cache` table to `database.js`
2. Run `npm install --prefix backend cheerio node-cron`
3. Create `hcLookupService.js` (cache logic only, empty registry)

### M2: Delhi HC Scraper — Discovery Phase (~25 min)
1. Create `delhiHcScraper.js` with Playwright launch + navigation
2. Write placeholder cheerio selectors (will need adjustment)
3. **Test against real Delhi HC site**: Run `node -e "require('./delhiHcScraper').testScrape()"` with a known case number
4. Adjust selectors based on actual HTML (expect 1-2 iterations)

### M3: API + Sync Integration (~10 min)
1. Create `hcController.js` with `lookupCase` and `refreshAll`
2. Wire routes in `routes/api.js`
3. Extend `syncController.js:resyncSingleCase` for HC detection
4. Verify: frontend resync button on a HC case calls the new path

### M4: HC Registry Pattern (~5 min)
1. In `hcLookupService.js`, implement `registerHcScraper(courtCode, fn)` 
2. Auto-register Delhi HC on startup
3. Stub out entries for the other 12 HCs (empty scraper that returns "not yet implemented")

### M5: Nightly Scheduler (~5 min)
1. Create `hcScheduler.js` with `node-cron` at 2:00 AM IST
2. Init in `index.js`
3. Test: manually call `refreshDueHcCases()` to verify it picks up the right cases

---

## Fallback Strategy

When HC scraper fails (timeout, CAPTCHA, 429 rate limit):
1. Log the error via `logger.warn`
2. Do NOT update the cache (old cache remains usable if < 7 days old)
3. Fall back to the existing `eCourtsIndia` search link generated by `courtUrlBuilder.js`
4. The user can still click the eCourtsIndia link manually on the CaseDetail page

---

## Expanding to Other 12 High Courts

When ready to add a new HC (e.g., Bombay HC), follow this per-court checklist:

1. **Research**: Navigate the HC's case status portal in browser DevTools
2. **Capture**: Record the network request when searching for a case (URL, method, form data, cookies)
3. **Write scraper**: Create `backend/src/services/bombayHcScraper.js` following the `delhiHcScraper.js` pattern
4. **Register**: In `backend/src/index.js`, call `registerHcScraper('HC/Mumbai', require('./services/bombayHcScraper').scrape)`
5. **Test**: Run a sanity check with a known case number

Each new HC adds ~30-45 min (15 min research + 15 min coding + 10 min testing).

---

## Risk Log

| Risk | Likelihood | Mitigation |
|---|---|---|
| Delhi HC rate-limits or blocks | Medium | Delay between requests (2s), rotate User-Agent, fall back to eCourtsIndia |
| HC site changes HTML structure | Medium | Alerts on scrape failure prompt manual selector update |
| Some HCs require CAPTCHA | High for eCourtsIndia v6 | Skip those HCs until CAPTCHA solving is added; use eCourtsIndia link as fallback |
| Reddit post format is outdated | Low | Discovery phase (M2) validates the endpoint before writing selectors |
| Playwright memory growth on long sync | Medium | Follow existing pattern: launch ONE browser, reuse contexts, close after batch |
| Timezone mismatch (server in UTC, scheduler set to IST) | Low | `node-cron` timezone option handles this natively |

---

## Related Existing Code (for reference during implementation)

| Pattern to copy | Source file | Line |
|---|---|---|
| `checkCase()` return shape | `backend/src/services/smartSync.js` | 115-193 |
| Playwright launch + batch | `backend/src/services/playwrightScraper.js` | 212-313 |
| HTML regex parsing | `backend/src/services/orderScraper.js` | 39-107 |
| `syncState.running` lock | `backend/src/controllers/syncController.js` | 7-14 |
| Scheduler init in `index.js` | `backend/src/index.js` | 94-113 |
| `DISPOSED_STATUSES` constant | `backend/src/config/constants.js` | 1-9 |
| `hc_case_cache` table pattern | `backend/src/config/database.js` (follow `email_queue`, `ai_settings`) | 376-434 |
| `courtUrlBuilder.buildCourtUrls()` | `backend/src/services/courtUrlBuilder.js` | 81-166 |
| eCourtsIndia fallback URLs | `backend/src/services/courtUrlBuilder.js` | 124-158 |
