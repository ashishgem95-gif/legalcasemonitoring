const { chromium } = require('playwright');
const { run, get, all } = require('../config/dbHelper');
const { logger } = require('../config/logger');
const { buildCourtUrls } = require('./courtUrlBuilder');
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.resolve(__dirname, '..', '..', '..', 'document_archive');
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

const CONCURRENCY = 12;
const PAGE_TIMEOUT = 20000;

function parseDate(str) {
  if (!str) return null;
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  let y = parseInt(m[3]);
  if (y < 100) y += 2000;
  return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

async function scrapeCaseDetail(page, caseRecord) {
  const urls = buildCourtUrls(caseRecord);
  if (!urls.length || !urls[0].url) {
    return { error: 'No URL generated', hearings: [], pdfs: [], caseStatus: null };
  }

  const result = { hearings: [], pdfs: [], caseStatus: null, metadata: {} };

  try {
    // Step 1: Get case metadata from partyDetail.php
    const partyUrl = urls[0].url;
    logger.info({ url: partyUrl, case: caseRecord.case_ref_no }, 'Fetching CAT case');

    await page.goto(partyUrl, { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT });

    // Extract case metadata from the table
    const metadata = await page.evaluate(() => {
      const tds = Array.from(document.querySelectorAll('td'));
      const data = {
        diaryNo: tds[0]?.textContent?.trim() || null,
        location: tds[1]?.textContent?.trim() || null,
        caseNo: tds[3]?.textContent?.trim() || null,
        filingDate: tds[4]?.textContent?.trim() || null,
        applicant: tds[5]?.textContent?.trim() || null,
        respondent: tds[6]?.textContent?.trim() || null,
      };
      // Get the "More Detail" link param
      const detailLink = document.querySelector('a[href*="popsurety_detailreport"]');
      const hrefMatch = detailLink?.getAttribute('href')?.match(/popsurety_detailreport\('([^']+)'\)/);
      data.detailParam = hrefMatch ? hrefMatch[1] : null;
      return data;
    });
    result.metadata = metadata;

    // Step 2: Open the case detail page (Misdetailreport123.php)
    if (metadata.detailParam) {
      const detailUrl = `https://cis.cgat.gov.in/catlive/Misdetailreport123.php?no=${metadata.detailParam}`;
      logger.info({ url: detailUrl, case: caseRecord.case_ref_no }, 'Opening case detail');

      await page.goto(detailUrl, { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT });
      await page.waitForTimeout(2000); // Wait for AJAX to load

      // Extract hearing history from the loaded content
      const detailData = await page.evaluate(() => {
        const hearings = [];
        // Find all table rows in the main content area
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
          const rows = table.querySelectorAll('tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
              const texts = Array.from(cells).map(c => c.textContent.trim()).filter(Boolean);
              if (texts.length >= 2) {
                hearings.push({
                  date: texts[0] || '',
                  purpose: texts[1] || '',
                  coram: texts[2] || '',
                  raw: texts.join(' | '),
                });
              }
            }
          });
        });

        // Find all links to PDFs or orders
        const pdfs = [];
        const links = document.querySelectorAll('a[href*="pdf"], a[href*="order"], a[href*="view_daily"]');
        links.forEach(link => {
          const href = link.getAttribute('href');
          const text = link.textContent.trim();
          if (href) pdfs.push({ url: href, label: text });
        });

        // Case status
        const statusEl = document.querySelector('font[color]');
        const status = statusEl?.textContent?.trim() || null;

        return { hearings, pdfs, status };
      });

      result.hearings = detailData.hearings;
      result.pdfs = detailData.pdfs;
      result.caseStatus = detailData.status || metadata.caseStatus;
    }

    // Step 3: Try to get daily orders via additional_mis.php
    if (metadata.diaryNo) {
      try {
        const diaryParam = metadata.detailParam?.split('/').slice(0, 2).join('/');
        if (diaryParam) {
          const dailyUrl = `https://cis.cgat.gov.in/catlive/additional_mis.php?diary_no=${diaryParam}`;
          await page.goto(dailyUrl, { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT });
          await page.waitForTimeout(2000);

          const dailyData = await page.evaluate(() => {
            const orders = [];
            const rows = document.querySelectorAll('table tr');
            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              const texts = Array.from(cells).map(c => c.textContent.trim()).filter(Boolean);
              if (texts.length >= 3) {
                orders.push({ date: texts[0], description: texts[1], raw: texts.join(' | ') });
              }
            });

            const pdfs = [];
            document.querySelectorAll('a[href*="pdf"], a[href*="order"]').forEach(link => {
              const href = link.getAttribute('href');
              if (href) pdfs.push(href);
            });

            return { orders, pdfs };
          });

          // Add daily orders to hearings
          for (const order of dailyData.orders) {
            const date = parseDate(order.date);
            if (date && !result.hearings.find(h => h.date === date)) {
              result.hearings.push({ date, purpose: order.description, raw: order.raw });
            }
          }

          result.pdfs = [...result.pdfs, ...dailyData.pdfs.filter(p => !result.pdfs.find(r => r.url === p))];
        }
      } catch (e) {
        logger.warn({ case: caseRecord.case_ref_no, error: e.message }, 'Daily orders fetch failed');
      }
    }

    // Step 4: Always store at least the CAT case detail URL as a link
    // If partyDetail didn't return a detailParam, store the search URL itself
    if (!metadata.detailParam) {
      const existing = get('SELECT id FROM case_documents WHERE case_id = ? AND storage_path = ?', [caseRecord.id, partyUrl]);
      if (!existing) {
        run(
          `INSERT INTO case_documents (case_id, filename, original_name, mime_type, storage_path, uploaded_by)
           VALUES (?, ?, ?, 'text/html', ?, 'playwright-scraper')`,
          [caseRecord.id, `cat_search_${caseRecord.id}`, `CAT Case Search — ${caseRecord.case_ref_no}`, partyUrl]
        );
      }
    }
    if (metadata.detailParam) {
      const detailUrl = `https://cis.cgat.gov.in/catlive/Misdetailreport123.php?no=${metadata.detailParam}`;
      const existing = get('SELECT id FROM case_documents WHERE case_id = ? AND storage_path = ?', [caseRecord.id, detailUrl]);
      if (!existing) {
        run(
          `INSERT INTO case_documents (case_id, filename, original_name, mime_type, storage_path, uploaded_by)
           VALUES (?, ?, ?, 'text/html', ?, 'playwright-scraper')`,
          [caseRecord.id, `cat_detail_${caseRecord.id}`, `CAT Case Status — ${caseRecord.case_ref_no}`, detailUrl]
        );
      }
    }

    // Step 5: Store any additional PDF/order links found
    const seenUrls = new Set();
    for (const pdf of result.pdfs) {
      try {
        const pdfUrl = pdf.url?.startsWith('http') ? pdf.url :
          pdf.url ? `https://cis.cgat.gov.in/catlive/${pdf.url.replace('./', '')}` : null;
        if (!pdfUrl || seenUrls.has(pdfUrl)) continue;
        seenUrls.add(pdfUrl);

        const label = pdf.label || pdfUrl.split('/').pop() || 'Court Order';
        const existing = get(
          'SELECT id FROM case_documents WHERE case_id = ? AND storage_path = ?',
          [caseRecord.id, pdfUrl]
        );
        if (!existing) {
          run(
            `INSERT INTO case_documents (case_id, filename, original_name, mime_type, storage_path, uploaded_by)
             VALUES (?, ?, ?, 'application/pdf', ?, 'playwright-scraper')`,
            [caseRecord.id, label, `${label} — ${caseRecord.case_ref_no}`, pdfUrl]
          );
          logger.info({ case: caseRecord.case_ref_no, pdf: label }, 'Order link stored');
        }
      } catch (e) {
        logger.warn({ case: caseRecord.case_ref_no, error: e.message }, 'Failed to store order link');
      }
    }

  } catch (err) {
    logger.error({ case: caseRecord.case_ref_no, error: err.message }, 'Scrape failed');
    result.error = err.message;
  }

  return result;
}

async function runPlaywrightSync(options = {}) {
  const { limit = 0, forum = 'CAT' } = options;

  let query = `SELECT c.* FROM cases c
    WHERE c.forum LIKE ?
    AND c.id NOT IN (SELECT DISTINCT case_id FROM case_documents)`;
  const params = [`%${forum}%`];

  query += ' ORDER BY case_year DESC, id ASC';
  if (limit > 0) {
    query += ' LIMIT ?';
    params.push(limit);
  }

  const cases = all(query, params);
  logger.info({ count: cases.length }, 'Starting Playwright sync for CAT cases');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let completed = 0;
  let hearingsTotal = 0;
  let pdfsTotal = 0;

  try {
    for (let i = 0; i < cases.length; i += CONCURRENCY) {
      const batch = cases.slice(i, i + CONCURRENCY);
      const contexts = await Promise.all(batch.map(() => browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      })));

      const batchResults = await Promise.allSettled(
        batch.map(async (c, idx) => {
          const page = await contexts[idx].newPage();
          try {
            const result = await scrapeCaseDetail(page, c);
            completed++;

            // Store hearing records
            for (const h of result.hearings) {
              const date = parseDate(h.date);
              if (!date) continue;

              const existing = get(
                'SELECT id FROM hearing_history WHERE case_id = ? AND hearing_date = ?',
                [c.id, date]
              );
              if (!existing) {
                run(
                  'INSERT INTO hearing_history (case_id, hearing_date, order_summary, order_raw_text) VALUES (?, ?, ?, ?)',
                  [c.id, date, h.purpose || h.description || 'Court proceeding', h.raw || '']
                );
                hearingsTotal++;
              }
            }

            // Update case status
            if (result.caseStatus) {
              run('UPDATE cases SET present_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [result.caseStatus, c.id]);
            }

            // Update applicant/respondent from court data
            if (result.metadata.applicant && (!c.applicant || c.applicant === 'Unknown Petitioner')) {
              run('UPDATE cases SET applicant = ? WHERE id = ?', [result.metadata.applicant, c.id]);
            }
            if (result.metadata.respondent) {
              run('UPDATE cases SET respondent = ? WHERE id = ?', [result.metadata.respondent, c.id]);
            }
            if (result.metadata.filingDate) {
              run('UPDATE cases SET date_filing_reply = ? WHERE id = ?',
                [parseDate(result.metadata.filingDate), c.id]);
            }

            pdfsTotal += result.pdfs.filter(p => !p.url?.includes('view_daily')).length;

            return { case: c.case_ref_no, hearings: result.hearings.length, pdfs: result.pdfs.length, error: result.error };
          } finally {
            await page.close();
          }
        })
      );

      for (const ctx of contexts) await ctx.close();

      if (completed % 10 === 0 || completed === cases.length) {
        logger.info({ completed, total: cases.length, hearingsTotal, pdfsTotal }, 'Playwright sync progress');
      }

      if (i + CONCURRENCY < cases.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  } finally {
    await browser.close();
  }

  logger.info({ completed, hearingsTotal, pdfsTotal }, 'Playwright sync complete');
  return { completed, hearingsTotal, pdfsTotal };
}

module.exports = { runPlaywrightSync };
