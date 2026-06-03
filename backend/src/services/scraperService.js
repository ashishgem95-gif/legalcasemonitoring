const crypto = require('crypto');
const db = require('../config/database');

// Helper for db queries
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows);
  });
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) return reject(err);
    resolve({ id: this.lastID, changes: this.changes });
  });
});

/**
 * Strips HTML tags from input string to obtain raw text content
 */
function stripHtmlTags(html) {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // remove scripts
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')   // remove styles
    .replace(/<[^>]+>/g, ' ')                          // strip tags
    .replace(/\s+/g, ' ')                               // collapse spaces
    .trim();
}

/**
 * Calculates SHA-256 hash of a string
 */
function calculateHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Fetches the URL content with standard browser user-agent headers
 */
async function fetchPageText(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP status error ${response.status}`);
    }

    const html = await response.text();
    return stripHtmlTags(html);
  } catch (err) {
    console.error(`Error fetching case url: ${url}`, err.message);
    throw err;
  }
}

/**
 * Scrapes all cases with an updates link and detects changes
 */
async function checkCaseLinks() {
  console.log('[Scraper] Starting daily court link crawler update cycle...');
  let checkedCount = 0;
  let newAlertsCount = 0;

  try {
    const casesToCheck = await dbAll('SELECT id, case_ref_no, applicant, court_link, last_fetched_hash FROM cases WHERE court_link IS NOT NULL AND court_link != ""');
    
    for (const c of casesToCheck) {
      try {
        console.log(`[Scraper] Checking link for Case: ${c.case_ref_no} (${c.court_link})...`);
        const text = await fetchPageText(c.court_link);
        const hash = calculateHash(text);
        checkedCount++;

        if (!c.last_fetched_hash) {
          // Initial baseline fetch: save hash and timestamp without alerting
          await dbRun(
            'UPDATE cases SET last_fetched_hash = ?, last_fetched_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hash, c.id]
          );
          console.log(`[Scraper] Baseline hash recorded for ${c.case_ref_no}`);
        } else if (c.last_fetched_hash !== hash) {
          // Detected update change!
          await dbRun(
            'UPDATE cases SET last_fetched_hash = ?, last_fetched_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hash, c.id]
          );
          
          const alertMsg = `New updates/orders detected on court date updates source page for case reference ${c.case_ref_no} - ${c.applicant || 'Petitioner'}.`;
          await dbRun(
            'INSERT INTO case_alerts (case_id, message) VALUES (?, ?)',
            [c.id, alertMsg]
          );
          newAlertsCount++;
          console.log(`[Scraper] 🚨 Alert triggered: changes detected on ${c.case_ref_no}`);
        } else {
          console.log(`[Scraper] No changes detected for ${c.case_ref_no}`);
        }
      } catch (caseErr) {
        console.error(`[Scraper] Failed checking link for case ID ${c.id}:`, caseErr.message);
      }
    }
  } catch (err) {
    console.error('[Scraper] Global scraper process error:', err);
  }

  console.log(`[Scraper] Scan cycle complete. Checked: ${checkedCount}, Alerts generated: ${newAlertsCount}`);
  return { checkedCount, newAlertsCount };
}

let schedulerTimer = null;

/**
 * Initializes zero-dependency scheduler (on startup and daily at 10 AM)
 */
function initScheduler() {
  console.log('[Scraper] Initializing zero-dependency daily updates scheduler...');
  
  // 1. Run a crawl in the background shortly after server starts up
  setTimeout(() => {
    checkCaseLinks().catch(err => console.error('[Scraper] Startup link check failed:', err));
  }, 5000);

  // 2. Schedule daily recurring scan at 10:00 AM local time
  const scheduleNextTenAM = () => {
    const now = new Date();
    const tenAM = new Date();
    tenAM.setHours(10, 0, 0, 0);

    // If it is already past 10 AM, schedule for tomorrow's 10 AM
    if (now > tenAM) {
      tenAM.setDate(tenAM.getDate() + 1);
    }

    const timeDiff = tenAM.getTime() - now.getTime();
    console.log(`[Scraper] Next automatic update scan scheduled in ${(timeDiff / (1000 * 60 * 60)).toFixed(2)} hours (at exactly 10:00 AM).`);

    schedulerTimer = setTimeout(() => {
      checkCaseLinks()
        .catch(err => console.error('[Scraper] Daily scheduled crawl failed:', err))
        .finally(() => {
          // Re-schedule for next day
          scheduleNextTenAM();
        });
    }, timeDiff);
  };

  scheduleNextTenAM();
}

module.exports = {
  checkCaseLinks,
  initScheduler
};
