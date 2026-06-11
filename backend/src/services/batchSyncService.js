const crypto = require('crypto');
const { run, get, all } = require('../config/dbHelper');
const { logger } = require('../config/logger');
const { buildCourtUrls } = require('./courtUrlBuilder');

const CONCURRENCY = 5;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const REQUEST_TIMEOUT = 15000;

function calculateHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function parseDate(str) {
  if (!str) return null;
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  let y = parseInt(m[3]);
  if (y < 100) y += 2000;
  return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

function parseCatResponse(html) {
  // Extract from partyDetail.php table
  const result = {
    diaryNo: null,
    caseNo: null,
    filingDate: null,
    applicant: null,
    respondent: null,
    location: null,
    detailParam: null,
  };

  const tdMatch = html.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
  if (!tdMatch) return result;

  const tds = tdMatch.map(t => t.replace(/<[^>]+>/g, '').trim()).filter(Boolean);

  if (tds.length >= 1) result.diaryNo = tds[0];
  if (tds.length >= 2) result.location = tds[1];
  if (tds.length >= 3) result.caseNo = tds[3]; // Case No. is 4th td
  if (tds.length >= 5) result.filingDate = parseDate(tds[4]);
  if (tds.length >= 6) result.applicant = tds[5];
  if (tds.length >= 7) result.respondent = tds[6];

  // Extract the base64 detail param
  const detailMatch = html.match(/popsurety_detailreport\('([^']+)'\)/);
  if (detailMatch) result.detailParam = detailMatch[1];

  return result;
}

function parseEcourtsResults(html) {
  // Extract case entries from eCourtsIndia search results
  const results = [];
  const caseCards = html.match(/<div[^>]*class="[^"]*case[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];

  // Also try to find dates from the text
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const dates = text.match(/(\d{2}\/\d{2}\/\d{4})/g) || [];
  const uniqueDates = [...new Set(dates)].map(parseDate).filter(Boolean).sort();

  // Extract case status indicators
  let status = null;
  if (/Disposed|Dismissed|Allowed|Disposed/i.test(text)) status = 'Disposed';
  else if (/Pending|Hearing/i.test(text)) status = 'Pending';

  return { count: caseCards.length, dates: uniqueDates, status, snippet: text.substring(0, 500) };
}

async function fetchWithRetry(url, attempt = 0) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    return { html, finalUrl: response.url };
  } catch (err) {
    if (attempt < MAX_RETRIES - 1) {
      const delay = RETRY_DELAY * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, attempt + 1);
    }
    throw err;
  }
}

async function processCase(c) {
  const result = {
    caseId: c.id,
    caseRefNo: c.case_ref_no,
    urlTried: null,
    success: false,
    error: null,
    metadata: {},
  };

  try {
    const urlInfos = buildCourtUrls(c);
    if (!urlInfos.length || !urlInfos[0].url) {
      result.error = 'No URL generated';
      return result;
    }

    const urlInfo = urlInfos[0];
    result.urlTried = urlInfo.url;

    const { html, finalUrl } = await fetchWithRetry(urlInfo.url);

    // Save court link to case
    run('UPDATE cases SET court_link = ?, last_fetched_hash = ?, last_fetched_at = CURRENT_TIMESTAMP WHERE id = ?',
      [urlInfo.url, calculateHash(html), c.id]);

    // Parse response based on source
    if (urlInfo.url.includes('cgat.gov.in')) {
      const cat = parseCatResponse(html);
      result.metadata = cat;

      // Update applicant/respondent if missing
      if (cat.applicant && (!c.applicant || c.applicant === 'Unknown Petitioner')) {
        run('UPDATE cases SET applicant = ? WHERE id = ?', [cat.applicant, c.id]);
      }
      if (cat.respondent && (!c.respondent || c.respondent === 'Union of India (UOI) & Ors.')) {
        run('UPDATE cases SET respondent = ? WHERE id = ?', [cat.respondent, c.id]);
      }
      if (cat.filingDate) {
        run('UPDATE cases SET date_filing_reply = ? WHERE id = ?', [cat.filingDate, c.id]);
      }

      // Store CAT detail link for PDFs
      if (cat.detailParam) {
        const detailUrl = `https://cis.cgat.gov.in/catlive/Misdetailreport123.php?no=${cat.detailParam}`;
        const existingDoc = get(
          'SELECT id FROM case_documents WHERE case_id = ? AND storage_path = ?',
          [c.id, detailUrl]
        );
        if (!existingDoc) {
          run(
            `INSERT INTO case_documents (case_id, filename, original_name, mime_type, storage_path, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [c.id, `cat_detail_${c.id}.html`, `CAT Case Detail — ${c.case_ref_no}`, 'text/html', detailUrl, 'batch-sync']
          );
        }
      }

      result.success = true;
    } else if (urlInfo.url.includes('ecourtsindia.com')) {
      const ec = parseEcourtsResults(html);
      result.metadata = ec;

      // Store any found dates as hearings
      for (const date of ec.dates) {
        const existing = get(
          'SELECT id FROM hearing_history WHERE case_id = ? AND hearing_date = ?',
          [c.id, date]
        );
        if (!existing) {
          run(
            'INSERT INTO hearing_history (case_id, hearing_date, order_summary) VALUES (?, ?, ?)',
            [c.id, date, 'Found via eCourtsIndia search']
          );
        }
      }

      if (ec.status) {
        run('UPDATE cases SET present_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [ec.status, c.id]);
      }

      result.success = true;
    } else {
      result.success = true; // URL saved, but limited data
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

async function runBatchSync(options = {}) {
  const { limit = 0, forum = null } = options;

  let query = `SELECT * FROM cases WHERE 1=1`;
  const params = [];

  if (forum) {
    query += ' AND forum = ?';
    params.push(forum);
  }
  query += ' ORDER BY case_year DESC, id ASC';
  if (limit > 0) {
    query += ' LIMIT ?';
    params.push(limit);
  }

  const cases = all(query, params);
  logger.info({ count: cases.length, forum }, 'Starting batch sync');

  let completed = 0;
  let successCount = 0;
  let failCount = 0;
  let catsFound = 0;
  let ecourtsFound = 0;

  for (let i = 0; i < cases.length; i += CONCURRENCY) {
    const batch = cases.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(processCase));

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        const res = r.value;
        completed++;
        if (res.success) {
          successCount++;
          if (res.urlTried?.includes('cgat.gov.in')) catsFound++;
          if (res.urlTried?.includes('ecourtsindia')) ecourtsFound++;
        } else {
          failCount++;
        }
      }
    }

    if (completed % 20 === 0 || completed === cases.length) {
      logger.info({ completed, total: cases.length, successCount, failCount }, 'Sync progress');
    }

    if (i + CONCURRENCY < cases.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const summary = { total: cases.length, completed, successCount, failCount, catsFound, ecourtsFound };
  logger.info(summary, 'Batch sync complete');
  return summary;
}

module.exports = { runBatchSync, processCase };
