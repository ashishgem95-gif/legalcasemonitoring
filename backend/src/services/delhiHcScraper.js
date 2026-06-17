/**
 * Delhi High Court Scraper
 *
 * Uses Playwright + cheerio to fetch case details from delhihighcourt.nic.in.
 *
 * Status: PLACEHOLDER SELECTORS — M2 of the HC scraper plan.
 * Live test pending. After running the test command below and sharing the
 * output, selectors will be tightened to match the actual HTML.
 *
 * Return shape (matches smartSync.checkCase):
 * {
 *   status: 'success' | 'not_found' | 'error',
 *   partyNames: 'X vs Y' | null,
 *   caseStatus: 'Pending' | 'Disposed' | 'Other',
 *   nextHearingDate: 'YYYY-MM-DD' | null,
 *   latestOrderLink: 'https://...' | null,
 *   historyLink: 'https://...' | null,
 *   hearings: [{ date, orderText, orderLink }],
 *   error: 'message' | null,
 *   source: 'live'
 * }
 */

const { chromium } = require('playwright');
const cheerio = require('cheerio');
const { logger } = require('../config/logger');

const DELHI_HC_BASE = 'https://delhihighcourt.nic.in';
const PAGE_TIMEOUT = 30000;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (legal-monitoring/1.0; +https://railways.gov.in)';

const DISPOSED_STATUSES = ['DISPOSED', 'DISMISSED', 'DECIDED', 'CLOSED', 'WITHDRAWN', 'SETTLED'];

function normalizeStatus(rawText) {
  if (!rawText) return null;
  const t = String(rawText).trim().toUpperCase();
  if (!t) return null; // whitespace-only input is treated as no input
  if (DISPOSED_STATUSES.includes(t) || t.includes('DISPOSE') || t.includes('DECIDED')) return 'Disposed';
  if (t.includes('PENDING') || t.includes('ADJOURNED') || t.includes('HEARING')) return 'Pending';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function parseDateLoose(str) {
  if (!str) return null;
  const cleaned = String(str).trim();
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY — anchored so we don't match "25-03-15" inside "2025-03-15"
  let m = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  // YYYY-MM-DD (must be 4-digit year first)
  m = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return cleaned;
  return null;
}

/**
 * Launch a single Playwright page and try to look up the case.
 * We use a fresh browser per call (M1 of the plan) but can switch to a
 * shared browser pool once patterns are proven.
 */
async function scrape({ courtCode, caseType, caseNumber, caseYear }) {
  const result = {
    status: 'error',
    partyNames: null,
    caseStatus: null,
    nextHearingDate: null,
    latestOrderLink: null,
    historyLink: null,
    hearings: [],
    error: null,
    source: 'live',
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT);
    page.setDefaultNavigationTimeout(PAGE_TIMEOUT);

    // ---------------------------------------------------------------
    // PLACEHOLDER — adjust after live test
    // Known Delhi HC endpoints (from Reddit thread and common patterns):
    //   1. https://delhihighcourt.nic.in/case_status.asp  (search form)
    //   2. /app/online-cause-history/<base64-payload>  (result page)
    //   3. /app/show-doc/<order-id>  (individual order PDF)
    //
    // Test cases (one of these, depending on which form field works):
    //   WP / 13907 / 2022
    //   WP / 16590 / 2023
    //   WP© / 3696 / 2024
    // ---------------------------------------------------------------
    const searchUrl = `${DELHI_HC_BASE}/case_status.asp`;
    logger.info({ searchUrl, courtCode, caseType, caseNumber, caseYear }, 'Delhi HC: opening search page');

    // Step 1: load search page
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

    // Step 2: fill the form
    // PLACEHOLDER selectors — adjust after live test
    // The form may have fields like: #case_type, #case_no, #case_year
    // OR name="case_type" etc. We'll try a few common patterns.
    // Note: page.evaluate only accepts a single argument. Pass an object.
    const formFilled = await page.evaluate(({ type, number, year }) => {
      const trySelectors = (selectors, value) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            el.value = value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      };
      const typeFilled = trySelectors(
        ['select[name="case_type"]', '#case_type', 'select[name="ctype"]', '#ctype', 'select[id*="type"]'],
        type
      );
      const numberFilled = trySelectors(
        ['input[name="case_no"]', '#case_no', 'input[name="cno"]', '#cno', 'input[id*="number"]', 'input[id*="no"]'],
        String(number)
      );
      const yearFilled = trySelectors(
        ['input[name="case_year"]', '#case_year', 'input[name="cyear"]', '#cyear', 'input[id*="year"]'],
        String(year)
      );
      return { typeFilled, numberFilled, yearFilled };
    }, { type: caseType, number: caseNumber, year: caseYear });

    if (!formFilled.typeFilled || !formFilled.numberFilled || !formFilled.yearFilled) {
      result.error = `Delhi HC: form fields not found (type=${formFilled.typeFilled}, number=${formFilled.numberFilled}, year=${formFilled.yearFilled}). Inspect selectors.`;
      logger.warn({ formFilled, result }, 'Delhi HC: form not fillable');
      return result;
    }

    // Step 3: submit the form
    // PLACEHOLDER — adjust if the submit button selector differs
    const submitClicked = await page.evaluate(() => {
      const btn = document.querySelector('input[type="submit"], button[type="submit"], input[value*="Search"], input[value*="Submit"]');
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (!submitClicked) {
      result.error = 'Delhi HC: submit button not found. Inspect form.';
      return result;
    }

    // Step 4: wait for the results to load
    try {
      await page.waitForLoadState('networkidle', { timeout: PAGE_TIMEOUT });
    } catch (_) {
      // Some pages never reach networkidle; proceed with whatever HTML we have
    }

    // Step 5: extract structured data with cheerio
    const html = await page.content();
    const $ = cheerio.load(html);

    // PLACEHOLDER selectors — adjust after live test
    // These are educated guesses; the live test will confirm
    const partyText = $('table.parties td, .party-name, [class*="party"]').first().text().trim() || null;
    const statusText = $('.case-status, [class*="status"], .status').first().text().trim() || null;
    const hearingDateText = $('table.hearings tr:nth-child(2) td, [class*="hearing-date"]').first().text().trim() || null;
    const orderLink = $('a[href*="order"], a[href*="doc"], a[href*="pdf"]').first().attr('href') || null;
    const historyLink = $('a[href*="history"], a[href*="cause-list"]').first().attr('href') || null;

    result.partyNames = partyText || null;
    result.caseStatus = normalizeStatus(statusText);
    result.nextHearingDate = parseDateLoose(hearingDateText);
    result.latestOrderLink = orderLink ? (orderLink.startsWith('http') ? orderLink : `${DELHI_HC_BASE}${orderLink}`) : null;
    result.historyLink = historyLink ? (historyLink.startsWith('http') ? historyLink : `${DELHI_HC_BASE}${historyLink}`) : null;

    // Try to extract hearing history rows
    const hearingRows = [];
    $('table.hearings tbody tr, table.history tr, [class*="history"] tr').each((i, el) => {
      const cells = $(el).find('td');
      if (cells.length >= 2) {
        const date = parseDateLoose($(cells[0]).text().trim());
        const orderText = $(cells[1]).text().trim();
        const link = $(cells[1]).find('a').attr('href') || null;
        if (date && orderText) {
          hearingRows.push({
            date,
            orderText,
            orderLink: link ? (link.startsWith('http') ? link : `${DELHI_HC_BASE}${link}`) : null,
          });
        }
      }
    });
    result.hearings = hearingRows;

    // Status logic
    if (!result.partyNames && !result.caseStatus) {
      result.status = 'not_found';
      result.error = 'Delhi HC: no case data found. Case may not exist, or selectors need adjustment.';
    } else {
      result.status = 'success';
    }

    logger.info({ result, case: `${caseType}/${caseNumber}/${caseYear}` }, 'Delhi HC: scrape result');
    return result;
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'Delhi HC: scrape failed');
    result.error = `Delhi HC scrape error: ${err.message}`;
    return result;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}

module.exports = { scrape, normalizeStatus, parseDateLoose };
