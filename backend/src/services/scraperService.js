const crypto = require('crypto');
const db = require('../config/database');
const { callLLM } = require('./llmRouter');

// Helper for db queries
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows);
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row);
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
 * Helper to parse DD/MM/YYYY or word dates into YYYY-MM-DD
 */
function parseDateString(dateStr) {
  if (!dateStr) return null;
  try {
    const cleaned = dateStr.replace(/[\.\/]/g, '-').trim();
    const parts = cleaned.split('-');
    if (parts.length === 3) {
      let day, month, year;
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        // DD-MM-YYYY or DD-MM-YY
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
      }
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
    
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().split('T')[0];
    }
  } catch (e) {
    console.error('Error parsing date string:', dateStr, e.message);
  }
  return null;
}

/**
 * Regex-based heuristics fallback to parse court updates when AI is not configured
 */
function fallbackParseCourtUpdate(caseRecord, text) {
  console.log(`[Scraper] Using regex fallback parser for Case: ${caseRecord.case_ref_no}`);
  const cleanText = text.replace(/\s+/g, ' ').trim();
  
  let case_status = null;
  if (/disposed|allowed|dismissed/i.test(cleanText)) {
    case_status = 'Disposed';
  } else if (/stay\s+granted/i.test(cleanText)) {
    case_status = 'Stay Granted';
  } else if (/sine\s+die/i.test(cleanText)) {
    case_status = 'Sine Die';
  }

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
      if (parsedDate) {
        next_hearing_date = parsedDate;
        break;
      }
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
      if (parsedDate) {
        order_date = parsedDate;
        break;
      }
    }
  }

  let progression_stage = null;
  if (/counter\s+affidavit|counter_affidavit|written\s+statement/i.test(cleanText)) {
    progression_stage = 'counter_affidavit_filed';
  } else if (/reply\s+to\s+charges|reply_to_charges|reply\s+statement/i.test(cleanText)) {
    progression_stage = 'reply_to_charges';
  } else if (/charge\s+sheet|charge_sheet/i.test(cleanText)) {
    progression_stage = 'charge_sheet_issued';
  } else if (/inquiry\s+commenced|inquiry_commenced/i.test(cleanText)) {
    progression_stage = 'inquiry_commenced';
  } else if (/io\s+report|io_report/i.test(cleanText)) {
    progression_stage = 'io_report_submitted';
  } else if (/da\s+notice|da_notice/i.test(cleanText)) {
    progression_stage = 'da_notice';
  } else if (/reply\s+to\s+da|reply_to_da/i.test(cleanText)) {
    progression_stage = 'reply_to_da_notice';
  } else if (/penalty\s+order|penalty_order|da_penalty/i.test(cleanText)) {
    progression_stage = 'da_penalty_order';
  } else if (/upsc|upsc_advice/i.test(cleanText)) {
    progression_stage = 'upsc_advice';
  } else if (/appeal\s+filed|oa\s+filed|appeal_oa_filed/i.test(cleanText)) {
    progression_stage = 'appeal_oa_filed';
  } else if (/cat\s+order|court\s+order|cat_court_order/i.test(cleanText)) {
    progression_stage = 'cat_court_order';
  } else if (/writ\s+petition|writ_petition/i.test(cleanText)) {
    progression_stage = 'writ_petition_filed';
  }

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

/**
 * Parses court page text using Gemini/LLM or regex fallback
 */
async function parseCourtPage(caseRecord, text, headers = {}) {
  const provider = headers['x-ai-provider'] || 'gemini';
  const model = headers['x-ai-model'] || '';
  const apiKey = headers['x-ai-api-key'] || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'undefined') {
    return fallbackParseCourtUpdate(caseRecord, text);
  }

  try {
    const prompt = `Analyze the following court webpage text for case reference "${caseRecord.case_ref_no}" (Applicant: "${caseRecord.applicant}", Respondent: "${caseRecord.respondent}").
Identify if there is a new court order, judgment, hearing update, or proceeding status change that occurred after the last known check.

Current Date: ${new Date().toISOString().split('T')[0]}

Extract the following details and return them strictly in JSON format. Do not wrap the JSON in markdown code blocks or quotes.
Return ONLY the JSON object matching this structure:
{
  "order_found": true,
  "order_date": "YYYY-MM-DD" (the date when this order/update was passed, or null),
  "order_summary": "A brief 1-2 sentence summary of what the order says or what happened during the hearing",
  "order_raw_text": "A key snippet or excerpt of the raw text containing the order/update details",
  "next_hearing_date": "YYYY-MM-DD" (if next listing or hearing date is scheduled, otherwise null),
  "progression_stage": "one of the following stages if this update matches a milestone: reply_to_charges, inquiry_commenced, io_report_submitted, da_notice, reply_to_da_notice, da_penalty_order, upsc_advice, appeal_oa_filed, counter_affidavit_filed, cat_court_order, writ_petition_filed, or null if it doesn't fit any milestone",
  "case_status": "the updated case status matching this order, e.g. Pending, Stay Granted, Sine Die, Disposed, or null to keep current status"
}

Webpage Text:
${text.substring(0, 15000)}`;

    const responseText = await callLLM({ provider, model, apiKey, prompt });
    let cleanedOutput = responseText.trim();
    if (cleanedOutput.startsWith('```')) {
      cleanedOutput = cleanedOutput.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
    }

    const parsed = JSON.parse(cleanedOutput);
    return parsed;
  } catch (err) {
    console.error('[Scraper] LLM parsing failed, falling back to regex. Error:', err.message);
    return fallbackParseCourtUpdate(caseRecord, text);
  }
}

/**
 * Scrapes cases with updates links and automatically updates database
 */
async function checkCaseLinks(headers = {}, dueOnly = false) {
  console.log(`[Scraper] Starting court link crawler update cycle. dueOnly: ${dueOnly}`);
  let checkedCount = 0;
  let newAlertsCount = 0;

  try {
    let query = `
      SELECT c.id, c.case_ref_no, c.applicant, c.respondent, c.court_link, c.last_fetched_hash, c.present_status
      FROM cases c
      WHERE c.court_link IS NOT NULL AND c.court_link != ""
        AND (c.present_status IS NULL OR c.present_status != 'Disposed')
    `;

    if (dueOnly) {
      // Filter to cases where the latest hearing date is today or in the past, or no hearings exist
      query += `
        AND (
          (SELECT MAX(hearing_date) FROM hearing_history WHERE case_id = c.id) <= DATE('now', 'localtime')
          OR NOT EXISTS (SELECT 1 FROM hearing_history WHERE case_id = c.id)
        )
      `;
    }

    const casesToCheck = await dbAll(query);
    console.log(`[Scraper] Found ${casesToCheck.length} cases to scan.`);
    
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
          // Detected update change! Let's parse it.
          console.log(`[Scraper] Changes detected on page for ${c.case_ref_no}. Running parser...`);
          const parsed = await parseCourtPage(c, text, headers);

          // Update hash to prevent repeating parse on the same version
          await dbRun(
            'UPDATE cases SET last_fetched_hash = ?, last_fetched_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hash, c.id]
          );

          if (parsed && parsed.order_found) {
            // 1. Process standard Order Date
            if (parsed.order_date) {
              const existingHearing = await dbGet('SELECT id FROM hearing_history WHERE case_id = ? AND hearing_date = ?', [c.id, parsed.order_date]);
              if (!existingHearing) {
                await dbRun(
                  'INSERT INTO hearing_history (case_id, hearing_date, order_summary, order_raw_text) VALUES (?, ?, ?, ?)',
                  [c.id, parsed.order_date, parsed.order_summary, parsed.order_raw_text]
                );
                console.log(`[Scraper] Inserted new hearing record for date: ${parsed.order_date}`);
              } else {
                await dbRun(
                  'UPDATE hearing_history SET order_summary = ?, order_raw_text = ? WHERE id = ?',
                  [parsed.order_summary, parsed.order_raw_text, existingHearing.id]
                );
                console.log(`[Scraper] Updated existing hearing record for date: ${parsed.order_date}`);
              }
            }

            // 2. Process Next Hearing Date
            if (parsed.next_hearing_date) {
              const existingFutureHearing = await dbGet('SELECT id FROM hearing_history WHERE case_id = ? AND hearing_date = ?', [c.id, parsed.next_hearing_date]);
              if (!existingFutureHearing) {
                await dbRun(
                  'INSERT INTO hearing_history (case_id, hearing_date, order_summary, order_raw_text) VALUES (?, ?, ?, ?)',
                  [c.id, parsed.next_hearing_date, 'Future scheduled hearing date extracted from court website.', 'System-generated reminder based on crawled court page update.']
                );
                console.log(`[Scraper] Inserted future placeholder hearing for date: ${parsed.next_hearing_date}`);
              }
            }

            // 3. Update case status if provided
            if (parsed.case_status) {
              await dbRun(
                'UPDATE cases SET present_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [parsed.case_status, c.id]
              );
              console.log(`[Scraper] Updated present_status of case ${c.case_ref_no} to ${parsed.case_status}`);
            }

            // 4. Update case timeline progression stage if matched
            const VALID_STAGES = [
              'charge_sheet_issued',
              'reply_to_charges',
              'inquiry_commenced',
              'io_report_submitted',
              'da_notice',
              'reply_to_da_notice',
              'da_penalty_order',
              'upsc_advice',
              'appeal_oa_filed',
              'counter_affidavit_filed',
              'cat_court_order',
              'writ_petition_filed'
            ];
            if (parsed.progression_stage && VALID_STAGES.includes(parsed.progression_stage)) {
              const dateCol = `${parsed.progression_stage}_date`;
              const notesCol = `${parsed.progression_stage}_notes`;
              const stageDate = parsed.order_date || new Date().toISOString().split('T')[0];
              await dbRun(
                `UPDATE cases SET ${dateCol} = ?, ${notesCol} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [stageDate, parsed.order_summary, c.id]
              );
              console.log(`[Scraper] Updated progression stage [${parsed.progression_stage}] in case details.`);
            }

            // 5. Insert alert notification
            const alertMsg = `New order/updates detected: ${parsed.order_summary || 'New hearing/judgment details generated.'}`;
            await dbRun(
              'INSERT INTO case_alerts (case_id, message) VALUES (?, ?)',
              [c.id, alertMsg]
            );
            newAlertsCount++;
            console.log(`[Scraper] 🚨 Alert triggered for ${c.case_ref_no}`);
          } else {
            console.log(`[Scraper] No specific court order or judgment found in page update for ${c.case_ref_no}`);
          }
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
 * Initializes zero-dependency scheduler (runs shortly after startup)
 */
function initScheduler() {
  console.log('[Scraper] Initializing startup updates scan scheduler...');
  
  // 1. Run a crawl in the background shortly after server starts up
  setTimeout(() => {
    checkCaseLinks().catch(err => console.error('[Scraper] Startup link check failed:', err));
  }, 5000);
}

module.exports = {
  checkCaseLinks,
  initScheduler
};
