const crypto = require('crypto');
const { run, get, all } = require('../config/dbHelper');
const { db } = require('../config/database');
const { callLLM } = require('./llmRouter');
const { VALID_STAGES, STAGE_COLUMN_MAP } = require('../config/constants');

let syncInProgress = false;

function isSyncInProgress() {
  return syncInProgress;
}

function setSyncLock(locked) {
  syncInProgress = locked;
}

function stripHtmlTags(html) {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function fetchPageText(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

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
    return { text: stripHtmlTags(html), html };
  } catch (err) {
    console.error(`Error fetching case url: ${url}`, err.message);
    throw err;
  }
}

function extractPdfLinksWithNearbyDates(html, baseUrl) {
  if (!html) return [];
  const pdfs = [];
  const datePattern = /\b(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})\b/;
  const linkRegex = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href) continue;
    if (!/\.pdf(?:$|[?#])|qrpdfview|pdf\.php|view_daily_order/i.test(href)) continue;
    const label = stripHtmlTags(match[2]).trim() || 'Court Order';
    const start = Math.max(0, match.index - 200);
    const end = Math.min(html.length, match.index + match[0].length + 200);
    const context = html.substring(start, end);
    let date = null;
    const dateMatch = context.match(datePattern);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      const year = dateMatch[3];
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    let resolvedUrl = href;
    if (baseUrl && !/^https?:\/\//i.test(href)) {
      try { resolvedUrl = new URL(href, baseUrl).toString(); } catch (e) {}
    }
    pdfs.push({ url: resolvedUrl, date, label });
  }
  return pdfs;
}

function parseDateString(dateStr) {
  if (!dateStr) return null;
  try {
    const cleaned = dateStr.replace(/[\.\/]/g, '-').trim();
    const parts = cleaned.split('-');
    if (parts.length === 3) {
      let day, month, year;
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
      }
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }

    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) return new Date(parsed).toISOString().split('T')[0];
  } catch (e) {
    console.error('Error parsing date string:', dateStr, e.message);
  }
  return null;
}

function fallbackParseCourtUpdate(caseRecord, text) {
  console.log(`[Scraper] Using regex fallback parser for Case: ${caseRecord.case_ref_no}`);
  const cleanText = text.replace(/\s+/g, ' ').trim();

  let case_status = null;
  if (/disposed|allowed|dismissed/i.test(cleanText)) case_status = 'Disposed';
  else if (/stay\s+granted/i.test(cleanText)) case_status = 'Stay Granted';
  else if (/sine\s+die/i.test(cleanText)) case_status = 'Sine Die';

  let next_hearing_date = null;
  const nextHearingPatterns = [
    /(?:next\s+hearing|next\s+listing|listed\s+on|adjourned\s+to|next\s+date)\s*(?:is|on|of|for)?\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:next\s+hearing|next\s+listing|listed\s+on|adjourned\s+to|next\s+date)\s*(?:is|on|of|for)?\s*[:\-]?\s*(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,
    /(?:next\s+hearing|next\s+listing|listed\s+on|adjourned\s+to|next\s+date)\s*(?:is|on|of|for)?\s*[:\-]?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i
  ];
  for (const pattern of nextHearingPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const parsedDate = parseDateString(match[1]);
      if (parsedDate) { next_hearing_date = parsedDate; break; }
    }
  }

  let order_date = new Date().toISOString().split('T')[0];
  const orderDatePatterns = [
    /order\s+dated\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /passed\s+on\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /judgment\s+dated\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
  ];
  for (const pattern of orderDatePatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const parsedDate = parseDateString(match[1]);
      if (parsedDate) { order_date = parsedDate; break; }
    }
  }

  let progression_stage = null;
  if (/counter\s+affidavit|counter_affidavit|written\s+statement/i.test(cleanText)) progression_stage = 'counter_affidavit_filed';
  else if (/reply\s+to\s+charges|reply_to_charges|reply\s+statement/i.test(cleanText)) progression_stage = 'reply_to_charges';
  else if (/charge\s+sheet|charge_sheet/i.test(cleanText)) progression_stage = 'charge_sheet_issued';
  else if (/inquiry\s+commenced|inquiry_commenced/i.test(cleanText)) progression_stage = 'inquiry_commenced';
  else if (/io\s+report|io_report/i.test(cleanText)) progression_stage = 'io_report_submitted';
  else if (/da\s+notice|da_notice/i.test(cleanText)) progression_stage = 'da_notice';
  else if (/reply\s+to\s+da|reply_to_da/i.test(cleanText)) progression_stage = 'reply_to_da_notice';
  else if (/penalty\s+order|penalty_order|da_penalty/i.test(cleanText)) progression_stage = 'da_penalty_order';
  else if (/upsc|upsc_advice/i.test(cleanText)) progression_stage = 'upsc_advice';
  else if (/appeal\s+filed|oa\s+filed|appeal_oa_filed/i.test(cleanText)) progression_stage = 'appeal_oa_filed';
  else if (/cat\s+order|court\s+order|cat_court_order/i.test(cleanText)) progression_stage = 'cat_court_order';
  else if (/writ\s+petition|writ_petition/i.test(cleanText)) progression_stage = 'writ_petition_filed';

  return {
    order_found: true,
    order_date,
    order_summary: "Automated alert: updates detected on court link page.",
    order_raw_text: cleanText.substring(0, 500) + '...',
    next_hearing_date,
    progression_stage,
    case_status
  };
}

async function parseCourtPage(caseRecord, text, headers = {}) {
  const provider = headers['x-ai-provider'] || 'gemini';
  const model = headers['x-ai-model'] || '';
  const apiKey = headers['x-ai-api-key'] || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'undefined') {
    return fallbackParseCourtUpdate(caseRecord, text);
  }

  try {
    const prompt = `Analyze the following court webpage text for case reference "${caseRecord.case_ref_no}" (Applicant: "${caseRecord.applicant}", Respondent: "${caseRecord.respondent}").
Identify if there is a new court order, judgment, hearing update, or proceeding status change.

Current Date: ${new Date().toISOString().split('T')[0]}

Extract details and return strictly in JSON format matching this structure:
{
  "order_found": true,
  "order_date": "YYYY-MM-DD",
  "order_summary": "Brief 1-2 sentence summary",
  "order_raw_text": "Key snippet of raw text",
  "next_hearing_date": "YYYY-MM-DD",
  "progression_stage": "one of: reply_to_charges, inquiry_commenced, io_report_submitted, da_notice, reply_to_da_notice, da_penalty_order, upsc_advice, appeal_oa_filed, counter_affidavit_filed, cat_court_order, writ_petition_filed, or null",
  "case_status": "Pending, Stay Granted, Sine Die, Disposed, or null"
}

Webpage Text:
${text.substring(0, 15000)}`;

    const responseText = await callLLM({ provider, model, apiKey, prompt });
    let cleanedOutput = responseText.trim();
    if (cleanedOutput.startsWith('```')) {
      cleanedOutput = cleanedOutput.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
    }
    return JSON.parse(cleanedOutput);
  } catch (err) {
    console.error('[Scraper] LLM parsing failed, falling back to regex. Error:', err.message);
    return fallbackParseCourtUpdate(caseRecord, text);
  }
}

const CONCURRENCY_LIMIT = 5;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000; // ms

async function withRetry(fn, caseId, attempt = 0) {
  try {
    return await fn();
  } catch (err) {
    if (attempt >= MAX_RETRIES - 1) throw err;
    const delay = RETRY_BASE_DELAY * Math.pow(2, attempt) + Math.random() * 1000;
    console.log(`[Scraper] Retry ${attempt + 1}/${MAX_RETRIES} for case ${caseId} in ${Math.round(delay)}ms...`);
    await new Promise(r => setTimeout(r, delay));
    return withRetry(fn, caseId, attempt + 1);
  }
}

async function checkCaseLinks(headers = {}, dueOnly = false) {
  if (syncInProgress) {
    console.log('[Scraper] Sync already in progress, skipping.');
    return { checkedCount: 0, newAlertsCount: 0, skipped: true };
  }

  syncInProgress = true;
  console.log(`[Scraper] Starting court link crawler update cycle. dueOnly: ${dueOnly}`);
  let checkedCount = 0;
  let newAlertsCount = 0;

  try {
    let query = `
      SELECT c.id, c.case_ref_no, c.applicant, c.respondent, c.court_link, c.last_fetched_hash, c.present_status
      FROM cases c
      WHERE c.court_link IS NOT NULL AND c.court_link != ''
        AND (c.present_status IS NULL OR c.present_status != 'Disposed')
    `;

    if (dueOnly) {
      query += `
        AND (
          (SELECT MAX(hearing_date) FROM hearing_history WHERE case_id = c.id) <= DATE('now', 'localtime')
          OR NOT EXISTS (SELECT 1 FROM hearing_history WHERE case_id = c.id)
        )
      `;
    }

    const casesToCheck = all(query);
    console.log(`[Scraper] Found ${casesToCheck.length} cases to scan.`);

    async function processCase(c) {
      try {
        console.log(`[Scraper] Checking link for Case: ${c.case_ref_no} (${c.court_link})...`);
        const { text, html } = await withRetry(() => fetchPageText(c.court_link), c.id);
        const hash = calculateHash(text);

        if (!c.last_fetched_hash) {
          run('UPDATE cases SET last_fetched_hash = ?, last_fetched_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, c.id]);
          console.log(`[Scraper] Baseline hash recorded for ${c.case_ref_no}`);
          return { checked: true, alert: false };
        }

        if (c.last_fetched_hash === hash) {
          console.log(`[Scraper] No changes detected for ${c.case_ref_no}`);
          return { checked: true, alert: false };
        }

        console.log(`[Scraper] Changes detected on page for ${c.case_ref_no}. Running parser...`);
        const parsed = await parseCourtPage(c, text, headers);
        const pdfs = extractPdfLinksWithNearbyDates(html, c.court_link);

        const updateTransaction = db.transaction(() => {
          db.prepare('UPDATE cases SET last_fetched_hash = ?, last_fetched_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, c.id);

          if (!parsed || !parsed.order_found) {
            return { checked: true, alert: false };
          }

          if (parsed.order_date) {
            const stmt = db.prepare('INSERT OR IGNORE INTO hearing_history (case_id, hearing_date, order_summary, order_raw_text) VALUES (?, ?, ?, ?)');
            const info = stmt.run(c.id, parsed.order_date, parsed.order_summary, parsed.order_raw_text);
            if (info.changes === 0) {
              db.prepare(`UPDATE hearing_history SET order_summary = ?, order_raw_text = ?
                WHERE case_id = ? AND hearing_date = ?
                AND (order_summary = '' OR order_summary LIKE 'System-generated%' OR order_summary IS NULL)`)
                .run(parsed.order_summary, parsed.order_raw_text, c.id, parsed.order_date);
            }
          }

          if (parsed.next_hearing_date) {
            db.prepare('INSERT OR IGNORE INTO hearing_history (case_id, hearing_date, order_summary, order_raw_text) VALUES (?, ?, ?, ?)')
              .run(c.id, parsed.next_hearing_date, 'Future scheduled hearing date extracted from court website.', 'System-generated reminder.');
          }

          if (parsed.case_status) {
            db.prepare('UPDATE cases SET present_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(parsed.case_status, c.id);
          }

          if (parsed.progression_stage && STAGE_COLUMN_MAP[parsed.progression_stage]) {
            const cols = STAGE_COLUMN_MAP[parsed.progression_stage];
            const stageDate = parsed.order_date || new Date().toISOString().split('T')[0];
            db.prepare(`UPDATE cases SET ${cols.dateCol} = ?, ${cols.notesCol} = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND ${cols.dateCol} IS NULL`)
              .run(stageDate, parsed.order_summary, c.id);
          }

          const alertMsg = `New order/updates detected: ${parsed.order_summary || 'New hearing/judgment details generated.'}`;
          db.prepare('INSERT INTO case_alerts (case_id, message) VALUES (?, ?)').run(c.id, alertMsg);

          const seenPdfs = new Set();
          for (const pdf of pdfs) {
            if (!pdf.url || seenPdfs.has(pdf.url)) continue;
            seenPdfs.add(pdf.url);
            const existing = db.prepare('SELECT id FROM case_documents WHERE case_id = ? AND storage_path = ?').get(c.id, pdf.url);
            if (existing) continue;
            const fname = pdf.date ? `order_${pdf.date}.pdf` : `order_${Date.now()}.pdf`;
            const origName = pdf.date ? `${pdf.label} dated ${pdf.date} — ${c.case_ref_no}` : `${pdf.label} — ${c.case_ref_no}`;
            db.prepare(`INSERT INTO case_documents (case_id, filename, original_name, mime_type, storage_path, uploaded_by) VALUES (?, ?, ?, 'application/pdf', ?, 'scraper-service')`)
              .run(c.id, fname, origName, pdf.url);
          }

          return { checked: true, alert: true };
        });

        const result = updateTransaction();
        if (result.alert) {
          console.log(`[Scraper] 🚨 Alert triggered for ${c.case_ref_no}`);
        }
        return result;
      } catch (caseErr) {
        console.error(`[Scraper] Failed checking link for case ID ${c.id}:`, caseErr.message);
        return { checked: false, alert: false };
      }
    }

    // Process cases with limited concurrency
    for (let i = 0; i < casesToCheck.length; i += CONCURRENCY_LIMIT) {
      const batch = casesToCheck.slice(i, i + CONCURRENCY_LIMIT);
      const results = await Promise.allSettled(batch.map(processCase));
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          if (r.value.checked) checkedCount++;
          if (r.value.alert) newAlertsCount++;
        }
      });
    }
  } catch (err) {
    console.error('[Scraper] Global scraper process error:', err);
  } finally {
    syncInProgress = false;
  }

  console.log(`[Scraper] Scan cycle complete. Checked: ${checkedCount}, Alerts generated: ${newAlertsCount}`);
  return { checkedCount, newAlertsCount };
}

let schedulerInterval = null;

function initScheduler() {
  if (process.env.AUTO_CRAWL_ON_START !== 'true') {
    console.log('[Scraper] Auto-crawl on start disabled. Set AUTO_CRAWL_ON_START=true to enable.');
    return;
  }
  console.log('[Scraper] Initializing startup updates scan scheduler...');
  setTimeout(() => {
    checkCaseLinks().catch(err => console.error('[Scraper] Startup link check failed:', err));
  }, 5000);
  schedulerInterval = setInterval(() => {
    checkCaseLinks().catch(err => console.error('[Scraper] Scheduled link check failed:', err));
  }, 6 * 60 * 60 * 1000);
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

module.exports = { checkCaseLinks, initScheduler, isSyncInProgress, setSyncLock, stopScheduler };
