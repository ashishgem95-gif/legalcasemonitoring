const { run, get, all } = require('../config/dbHelper');
const { logger } = require('../config/logger');

const CONCURRENCY = 30;
const FETCH_TIMEOUT = 15000;

function parseDate(str) {
  if (!str) return null;
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  let y = parseInt(m[3]); if (y < 100) y += 2000;
  return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
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
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

function extractDetailParam(storagePath) {
  try {
    const url = new URL(storagePath);
    return url.searchParams.get('no');
  } catch { return null; }
}

function parseDailyOrders(html) {
  const result = { hearings: [], pdfs: [], caseStatus: null };

  // Extract hearing rows from table
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowRegex) || [];

  let inOrderSection = false;
  for (const row of rows) {
    const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
    const texts = cells.map(c => c.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()).filter(Boolean);

    // Detect when we're past hearing rows and into Final Orders / Daily Orders
    if (texts.some(t => t.includes('Final Order') || t.includes('Daily Orders'))) {
      inOrderSection = true;
      continue;
    }

    if (!inOrderSection && texts.length >= 4 && /^\d+$/.test(texts[0])) {
      // Hearing row: S.No, Hearing Date, Purpose, Next Listing Date, Status, Nature
      const date = parseDate(texts[1]);
      if (date) {
        result.hearings.push({
          date,
          purpose: texts[2] || 'HEARING',
          nextDate: parseDate(texts[3]),
          status: texts[4] || null,
          nature: texts[5] || texts[2] || 'PROCEEDING',
        });
      }
    }

    // Mark disposed cases
    if (texts.some(t => t.includes('DISMISSED') || t.includes('DISPOSED'))) {
      result.caseStatus = 'Disposed';
    }
  }

  // Extract PDF links
  const pdfRegex = /href="([^"]*(?:qrpdfview|pdf\.php|view_daily_order)[^"]*)"/gi;
  let pdfMatch;
  while ((pdfMatch = pdfRegex.exec(html)) !== null) {
    let url = pdfMatch[1];
    if (url.startsWith('/')) url = 'https://cis.cgat.gov.in' + url;
    else if (!url.startsWith('http')) url = 'https://cis.cgat.gov.in/catlive/' + url;
    result.pdfs.push(url);
  }

  // Also find order date labels near PDF links
  const orderDates = [];
  const dateRegex = /(\d{2}\/\d{2}\/\d{4})/g;
  let dateMatch;
  while ((dateMatch = dateRegex.exec(html)) !== null) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) orderDates.push(parsed);
  }

  // Associate PDFs with order dates (PDFs are usually in reverse chronological order)
  for (let i = 0; i < Math.min(result.pdfs.length, orderDates.length); i++) {
    result.pdfs[i] = { url: result.pdfs[i], date: orderDates[i] };
  }

  // For remaining PDFs without dates, use hearing dates
  for (let i = orderDates.length; i < result.pdfs.length && i < result.hearings.length; i++) {
    result.pdfs[i] = { url: result.pdfs[i], date: result.hearings[i]?.date };
  }

  return result;
}

async function scrapeCaseOrders(detailStoragePath, caseId, caseRefNo) {
  const detailParam = extractDetailParam(detailStoragePath);
  if (!detailParam) return { error: 'No detail param in URL', hearings: 0, pdfs: 0 };

  try {
    const decoded = Buffer.from(detailParam, 'base64').toString('utf-8');
    const parts = decoded.split('/');
    if (parts.length < 2) return { error: 'Invalid detail param format', hearings: 0, pdfs: 0 };

    const diaryNo = parts.slice(0, 2).join('/');
    const diaryParam = Buffer.from(diaryNo).toString('base64');
    const dailyUrl = `https://cis.cgat.gov.in/catlive/additional_mis.php?diary_no=${diaryParam}`;

    const html = await fetchWithTimeout(dailyUrl);
    const orders = parseDailyOrders(html);

    let hearingsAdded = 0;
    let pdfsStored = 0;

    // Store hearing records
    for (const h of orders.hearings) {
      const existing = get(
        'SELECT id FROM hearing_history WHERE case_id = ? AND hearing_date = ?',
        [caseId, h.date]
      );
      if (!existing) {
        run(
          'INSERT INTO hearing_history (case_id, hearing_date, order_summary, order_raw_text) VALUES (?, ?, ?, ?)',
          [caseId, h.date, `${h.purpose} — ${h.nature}${h.nextDate ? ' | Next: ' + h.nextDate : ''}`,
           `Purpose: ${h.purpose} | Status: ${h.status || 'N/A'} | Nature: ${h.nature}`]
        );
        hearingsAdded++;
      }
    }

    // Update case status if disposed
    if (orders.caseStatus === 'Disposed') {
      run('UPDATE cases SET present_status = ? WHERE id = ? AND present_status != ?',
        ['Disposed', caseId, 'Disposed']);
    }

    // Store PDF links as documents
    for (const pdf of orders.pdfs) {
      const pdfUrl = typeof pdf === 'string' ? pdf : pdf.url;
      const pdfDate = typeof pdf === 'string' ? null : pdf.date;
      const existing = get(
        'SELECT id FROM case_documents WHERE case_id = ? AND storage_path = ?',
        [caseId, pdfUrl]
      );
      if (!existing) {
        const label = pdfDate ? `Order dated ${pdfDate}` : 'Court Order';
        run(
          `INSERT INTO case_documents (case_id, filename, original_name, mime_type, storage_path, uploaded_by)
           VALUES (?, ?, ?, 'application/pdf', ?, 'order-scraper')`,
          [caseId, `order_${pdfDate || Date.now()}.pdf`, `${label} — ${caseRefNo}`, pdfUrl]
        );
        pdfsStored++;
      }
    }

    return { hearings: hearingsAdded, pdfs: pdfsStored, url: dailyUrl, totalOrders: orders.hearings.length };
  } catch (err) {
    return { error: err.message, hearings: 0, pdfs: 0 };
  }
}

async function runOrderSync(options = {}) {
  // Get all cases with Misdetailreport123.php document links
  const docs = all(`SELECT d.id as doc_id, d.storage_path, d.case_id, c.case_ref_no
    FROM case_documents d JOIN cases c ON d.case_id = c.id
    WHERE d.storage_path LIKE '%Misdetailreport123.php%'
    ORDER BY c.id`);

  logger.info({ count: docs.length }, 'Starting order scraper');

  let totalHearings = 0;
  let totalPdfs = 0;
  let completed = 0;
  let errors = 0;

  const seen = new Set(); // One scrape per case
  const cases = [];
  for (const d of docs) {
    if (!seen.has(d.case_id)) {
      seen.add(d.case_id);
      cases.push(d);
    }
  }

  logger.info({ uniqueCases: cases.length }, 'Unique cases to scrape');

  for (let i = 0; i < cases.length; i += CONCURRENCY) {
    const batch = cases.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(c => scrapeCaseOrders(c.storage_path, c.case_id, c.case_ref_no))
    );

    for (const r of results) {
      completed++;
      if (r.status === 'fulfilled') {
        if (r.value.error) {
          errors++;
        } else {
          totalHearings += r.value.hearings;
          totalPdfs += r.value.pdfs;
        }
      } else {
        errors++;
      }
    }

    if (completed % 50 === 0 || completed === cases.length) {
      logger.info({ completed, total: cases.length, totalHearings, totalPdfs, errors }, 'Order sync progress');
    }

    // Small delay between batches
    if (i + CONCURRENCY < cases.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const summary = { cases: cases.length, completed, totalHearings, totalPdfs, errors };
  logger.info(summary, 'Order sync complete');
  return summary;
}

module.exports = { runOrderSync };
