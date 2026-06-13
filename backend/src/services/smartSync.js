const { run, get, all } = require('../config/dbHelper');
const { db } = require('../config/database');
const { logger } = require('../config/logger');
const { DISPOSED_STATUSES } = require('../config/constants');

const CONCURRENCY = 20;
const FETCH_TIMEOUT = 15000;
const today = new Date().toISOString().split('T')[0];

function parseDate(str) {
  if (!str) return null;
  str = str.trim();
  
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1]);
    const m = parseInt(dmyMatch[2]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${dmyMatch[3]}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  
  const mdyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (mdyMatch) {
    let y = parseInt(mdyMatch[3]);
    y += 2000;
    const d = parseInt(mdyMatch[1]);
    const m = parseInt(mdyMatch[2]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  
  const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
  const textMatch = str.match(/^(\d{1,2})\s+([a-zA-Z]{3,9})\s+(\d{4})$/);
  if (textMatch) {
    const m = months[textMatch[2].toLowerCase().substring(0, 3)];
    if (m) {
      return `${textMatch[3]}-${String(m).padStart(2, '0')}-${String(parseInt(textMatch[1])).padStart(2, '0')}`;
    }
  }
  
  return null;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) { clearTimeout(timeout); throw e; }
}

function parseDailyOrders(html) {
  const result = { hearings: [], pdfs: [], caseStatus: null };
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  let inOrderSection = false;

  for (const row of rows) {
    const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]/gi) || [];
    const texts = cells.map(c => c.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()).filter(Boolean);

    if (texts.some(t => t.includes('Final Order') || t.includes('Daily Orders'))) {
      inOrderSection = true; continue;
    }
    if (!inOrderSection && texts.length >= 4 && /^\d+$/.test(texts[0])) {
      const date = parseDate(texts[1]);
      if (date) {
        result.hearings.push({
          date, purpose: texts[2] || 'HEARING',
          nextDate: parseDate(texts[3]), status: texts[4] || null, nature: texts[5] || texts[2] || 'PROCEEDING',
        });
      }
    }
    if (texts.some(t => t.includes('DISMISSED') || t.includes('DISPOSED'))) result.caseStatus = 'Disposed';
  }

  // Extract PDF links
  const pdfRegex = /href="([^"]*(?:qrpdfview|pdf\.php|view_daily_order)[^"]*)"/gi;
  let m;
  while ((m = pdfRegex.exec(html)) !== null) {
    let url = m[1];
    if (url.startsWith('/')) url = 'https://cis.cgat.gov.in' + url;
    else if (!url.startsWith('http')) url = 'https://cis.cgat.gov.in/catlive/' + url;
    result.pdfs.push(url);
  }

  // Also find dates near PDF links
  const dateRegex = /(\d{2}\/\d{2}\/\d{4})/g;
  let dm; const orderDates = [];
  while ((dm = dateRegex.exec(html)) !== null) {
    const d = parseDate(dm[1]);
    if (d) orderDates.push(d);
  }
  for (let i = 0; i < Math.min(result.pdfs.length, orderDates.length); i++) {
    result.pdfs[i] = { url: result.pdfs[i], date: orderDates[i] };
  }

  return result;
}

async function checkCase(c) {
  const result = { caseId: c.id, caseRefNo: c.case_ref_no, petitioner: c.applicant || 'Unknown', status: 'pending', hearingsAdded: 0, pdfsAdded: 0, newNextDate: null, error: null };

  try {
    const doc = get(
      `SELECT storage_path FROM case_documents WHERE case_id = ? AND storage_path LIKE '%Misdetailreport123.php%' LIMIT 1`,
      [c.id]
    );
    if (!doc) {
      result.status = 'skipped';
      result.error = 'No CAT detail link found';
      return result;
    }

    const url = new URL(doc.storage_path);
    const detailParam = url.searchParams.get('no');
    if (!detailParam) { result.status = 'skipped'; result.error = 'No detail param'; return result; }

    const decoded = Buffer.from(detailParam, 'base64').toString('utf-8');
    const parts = decoded.split('/');
    if (parts.length < 2) { result.status = 'skipped'; result.error = 'Invalid detail format'; return result; }

    const diaryParam = Buffer.from(parts.slice(0, 2).join('/')).toString('base64');
    const dailyUrl = `https://cis.cgat.gov.in/catlive/additional_mis.php?diary_no=${diaryParam}`;

    const html = await fetchWithTimeout(dailyUrl);
    const orders = parseDailyOrders(html);

    const syncTransaction = db.transaction(() => {
      for (const h of orders.hearings) {
        const stmt = db.prepare('INSERT OR IGNORE INTO hearing_history (case_id, hearing_date, order_summary, order_raw_text) VALUES (?, ?, ?, ?)');
        const info = stmt.run(c.id, h.date, `${h.purpose} — ${h.nature}${h.nextDate ? ' | Next: ' + h.nextDate : ''}`, `Purpose: ${h.purpose} | Nature: ${h.nature}`);
        if (info.changes > 0) result.hearingsAdded++;
      }

      for (const pdf of orders.pdfs) {
        const pdfUrl = typeof pdf === 'string' ? pdf : pdf.url;
        const pdfDate = typeof pdf === 'string' ? null : pdf.date;
        const existing = get('SELECT id FROM case_documents WHERE case_id = ? AND storage_path = ?', [c.id, pdfUrl]);
        if (!existing) {
          const label = pdfDate ? `Order dated ${pdfDate}` : 'Court Order';
          db.prepare(`INSERT INTO case_documents (case_id, filename, original_name, mime_type, storage_path, uploaded_by) VALUES (?, ?, ?, 'application/pdf', ?, 'smart-sync')`)
            .run(c.id, `order_${pdfDate || Date.now()}.pdf`, `${label} — ${c.case_ref_no}`, pdfUrl);
          result.pdfsAdded++;
        }
      }

      if (orders.hearings.length > 0) {
        const latestWithNext = orders.hearings.find(h => h.nextDate);
        if (latestWithNext?.nextDate) {
          db.prepare('UPDATE cases SET next_hearing_date = ? WHERE id = ?').run(latestWithNext.nextDate, c.id);
          result.newNextDate = latestWithNext.nextDate;
        }
      }

      if (orders.caseStatus === 'Disposed') {
        db.prepare("UPDATE cases SET present_status = 'Disposed', next_hearing_date = NULL WHERE id = ?").run(c.id);
        result.caseStatus = 'Disposed';
      }

      db.prepare('UPDATE cases SET last_checked_at = CURRENT_TIMESTAMP WHERE id = ?').run(c.id);
    });

    syncTransaction();

    result.status = result.hearingsAdded > 0 || result.pdfsAdded > 0 ? 'updated' : 'no_change';
  } catch (err) {
    result.status = 'error';
    result.error = err.message;
    try { db.prepare('UPDATE cases SET last_checked_at = CURRENT_TIMESTAMP WHERE id = ?').run(c.id); } catch {}
  }

  return result;
}

async function runSmartSync() {
  const today = new Date().toISOString().split('T')[0];
  const placeholders = DISPOSED_STATUSES.map(() => '?').join(',');
  const cases = all(`
    SELECT c.* FROM cases c
    WHERE c.next_hearing_date IS NOT NULL
    AND c.next_hearing_date < ?
    AND c.present_status NOT IN (${placeholders})
    AND (c.last_checked_at IS NULL OR c.last_checked_at < ?)
    ORDER BY c.next_hearing_date ASC
  `, [today, ...DISPOSED_STATUSES, today]);

  logger.info({ count: cases.length }, 'Smart sync - past-due cases to check');

  const results = { updated: [], unchanged: [], errors: [], pending: [], total: cases.length };

  for (let i = 0; i < cases.length; i += CONCURRENCY) {
    const batch = cases.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(checkCase));

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        const res = r.value;
        if (res.status === 'updated') results.updated.push(res);
        else if (res.status === 'no_change') results.pending.push(res);
        else results.errors.push(res);
      } else {
        results.errors.push({ error: 'Promise rejected' });
      }
    }

    if (i + CONCURRENCY < cases.length) await new Promise(r => setTimeout(r, 300));
  }

  logger.info({ updated: results.updated.length, unchanged: results.pending.length, errors: results.errors.length }, 'Smart sync complete');
  return results;
}

module.exports = { runSmartSync };
