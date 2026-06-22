const { chromium } = require('playwright');
const { run, get, all } = require('../config/dbHelper');
const { db } = require('../config/database');
const { logger } = require('../config/logger');
const { FROZEN_STATUSES, istToday } = require('../config/constants');

const PAGE_TIMEOUT = 25000;
const CONCURRENCY = 3;
const DELAY_BETWEEN_CASES = 2000;

function parseDate(str) {
  if (!str) return null;
  const m = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m) {
    let y = parseInt(m[3]); if (y < 100) y += 2000;
    const d = parseInt(m[1]); const mo = parseInt(m[2]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
  const tm = str.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (tm) {
    const mo = months[tm[2].toLowerCase().substring(0, 3)];
    if (mo) return `${tm[3]}-${String(mo).padStart(2, '0')}-${String(parseInt(tm[1])).padStart(2, '0')}`;
  }
  return null;
}

// ── HC website configurations ──
// Each entry maps our forum code to the HC website's case status search page.
// "searchType": "caseNumber" means the form has case_type + case_number + case_year fields.
// "hasCaptcha": true means we can't auto-scrape — cases will be flagged for manual update.
const HC_CONFIGS = {
  'HC/Delhi': {
    name: 'Delhi High Court',
    statusUrl: 'https://delhihighcourt.nic.in/app/get-case-type-status',
    searchType: 'caseType',
    hasCaptcha: false,
    caseTypeMap: {
      'WP': 'WP(C)(IPD)',
      'WP(C)': 'WP(C)(IPD)',
      'SCA': 'WP(C)(IPD)',
      'SLP': 'WP(C)(IPD)',
    },
    fields: { typeSelect: '#case_type', yearSelect: '#case_year', numberInput: '#case_number', submitBtn: '#search' },
  },
  'HC/LKO': {
    name: 'Allahabad HC — Lucknow Bench',
    statusUrl: 'https://hclko.allahabadhighcourt.in/status/index.php/case-number',
    searchType: 'caseNumber',
    hasCaptcha: true,
    caseTypeMap: { 'WP': '12', 'WP(C)': '12', 'SCA': '12' },
    fields: { typeSelect: '#case_type', yearInput: '#case_year', numberInput: '#case_no', captchaInput: '#captchacode' },
  },
  'HC/ALD': {
    name: 'Allahabad HC — Allahabad Bench',
    statusUrl: 'https://www.allahabadhighcourt.in/apps/status_ccms/',
    searchType: 'caseNumber',
    hasCaptcha: true,
    caseTypeMap: { 'WP': '12', 'WP(C)': '12' },
  },
  'HC/BB': {
    name: 'Bombay High Court',
    statusUrl: 'https://bombayhighcourt.nic.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/Mumbai': {
    name: 'Bombay High Court',
    statusUrl: 'https://bombayhighcourt.nic.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/Kolkata': {
    name: 'Calcutta High Court',
    statusUrl: 'https://www.calcuttahighcourt.gov.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/JP': {
    name: 'Rajasthan HC — Jaipur',
    statusUrl: 'https://hcraj.nic.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/JBL': {
    name: 'MP High Court — Jabalpur',
    statusUrl: 'http://mphc.gov.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/Guj': {
    name: 'Gujarat High Court',
    statusUrl: 'https://gujarathighcourt.nic.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/ADI': {
    name: 'Gujarat High Court — Ahmedabad',
    statusUrl: 'https://gujarathighcourt.nic.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/Banglore': {
    name: 'Karnataka High Court',
    statusUrl: 'https://karnatakajudiciary.kar.nic.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/Bangluru': {
    name: 'Karnataka High Court',
    statusUrl: 'https://karnatakajudiciary.kar.nic.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/HYD': {
    name: 'Telangana High Court',
    statusUrl: 'https://tshc.gov.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/TS': {
    name: 'Telangana High Court',
    statusUrl: 'https://tshc.gov.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/Chennai': {
    name: 'Madras High Court',
    statusUrl: 'https://www.hcmadras.ac.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/Patna': {
    name: 'Patna High Court',
    statusUrl: 'https://patnahighcourt.gov.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/GHY': {
    name: 'Gauhati High Court',
    statusUrl: 'https://ghconline.gov.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/CGH': {
    name: 'Chhattisgarh High Court',
    statusUrl: 'https://highcourt.cg.gov.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/CTC': {
    name: 'Orissa High Court',
    statusUrl: 'https://orissahighcourt.nic.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/KNK': {
    name: 'Karnataka HC — Dharwad Bench',
    statusUrl: 'https://karnatakajudiciary.kar.nic.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
  'HC/Ernakulam': {
    name: 'Kerala High Court',
    statusUrl: 'https://highcourt.kerala.gov.in/',
    searchType: 'caseNumber',
    hasCaptcha: true,
  },
};

const SC_CONFIG = {
  name: 'Supreme Court of India',
  statusUrl: 'https://supremecourtofindia.nic.in/case-status/',
  hasCaptcha: true,
};

function getHcConfig(forum) {
  const clean = (forum || '').trim().replace(/\.$/, '').replace(/\s+/g, ' ').trim();
  if (HC_CONFIGS[clean]) return HC_CONFIGS[clean];
  for (const key of Object.keys(HC_CONFIGS)) {
    if (clean.includes(key) || key.includes(clean)) return HC_CONFIGS[key];
  }
  return null;
}

function getCaseTypeForHc(caseType, config) {
  const raw = (caseType || '').trim().toUpperCase().split('/')[0].replace(/\.$/, '');
  return config.caseTypeMap?.[raw] || config.caseTypeMap?.[caseType?.trim()] || raw;
}

function extractHearingDatesFromHtml(htmlText) {
  const today = istToday();
  const results = { nextHearingDate: null, caseStatus: null, hearings: [] };

  const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/g;
  const dates = [];
  let m;
  while ((m = datePattern.exec(htmlText)) !== null) {
    const parsed = parseDate(m[1]);
    if (parsed) dates.push(parsed);
  }

  const nextPatterns = [
    /(?:next\s+hearing|next\s+date|next\s+listing|listed\s+on|adjourned\s+to|next\s+date\s+of\s+hearing)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:next\s+hearing|next\s+date|next\s+listing|listed\s+on|adjourned\s+to)\s*[:\-]?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
  ];
  for (const p of nextPatterns) {
    const match = htmlText.match(p);
    if (match) {
      const d = parseDate(match[1]);
      if (d) { results.nextHearingDate = d; break; }
    }
  }

  if (!results.nextHearingDate) {
    const future = dates.filter(d => d >= today);
    if (future.length > 0) {
      results.nextHearingDate = future.sort()[0];
    }
  }

  if (/disposed|allowed|dismissed/i.test(htmlText)) results.caseStatus = 'Disposed';
  else if (/stay\s+granted/i.test(htmlText)) results.caseStatus = 'Stay Granted';
  else if (/sine\s+die/i.test(htmlText)) results.caseStatus = 'Sine Die';

  return results;
}

async function scrapeHcCase(page, caseRecord, config) {
  const result = {
    caseId: caseRecord.id,
    caseRefNo: caseRecord.case_ref_no,
    forum: caseRecord.forum,
    status: 'pending',
    nextHearingDate: null,
    caseStatus: null,
    error: null,
  };

  if (config.hasCaptcha) {
    result.status = 'captcha';
    result.error = `${config.name} requires CAPTCHA — manual update needed`;
    return result;
  }

  try {
    logger.info({ case: caseRecord.case_ref_no, url: config.statusUrl }, 'HC scrape: navigating');
    await page.goto(config.statusUrl, { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT });
    await page.waitForTimeout(2000);

    if (config.fields?.typeSelect) {
      const hcType = getCaseTypeForHc(caseRecord.case_type, config);
      try {
        await page.selectOption(config.fields.typeSelect, hcType);
      } catch {
        const available = await page.evaluate((sel) => {
          return Array.from(document.querySelectorAll(sel + ' option')).map(o => o.text + '=' + o.value).slice(0, 20);
        }, config.fields.typeSelect);
        result.status = 'error';
        result.error = `Case type "${hcType}" not found. Available: ${available.join(', ').substring(0, 200)}`;
        return result;
      }
    }

    if (config.fields?.yearSelect) {
      await page.selectOption(config.fields.yearSelect, String(caseRecord.case_year));
    } else if (config.fields?.yearInput) {
      await page.fill(config.fields.yearInput, String(caseRecord.case_year));
    }

    if (config.fields?.numberInput) {
      const caseNum = String(caseRecord.case_number || '').trim().split(/[/,\s]/)[0];
      await page.fill(config.fields.numberInput, caseNum);
    }

    if (config.fields?.submitBtn) {
      await page.click(config.fields.submitBtn);
    } else {
      const submit = await page.$('button[type=submit], input[type=submit]');
      if (submit) await submit.click();
    }

    await page.waitForTimeout(4000);

    const pageText = await page.evaluate(() => document.body.innerText);
    const extracted = extractHearingDatesFromHtml(pageText);

    if (extracted.nextHearingDate) {
      result.nextHearingDate = extracted.nextHearingDate;
      result.status = 'updated';
    }

    if (extracted.caseStatus) {
      result.caseStatus = extracted.caseStatus;
    }

    if (!result.nextHearingDate && !result.caseStatus) {
      if (/no\s+data|not\s+found|no\s+record|no\s+case/i.test(pageText)) {
        result.status = 'not_found';
        result.error = 'Case not found on HC website';
      } else {
        result.status = 'no_data';
        result.error = 'Could not extract hearing date from page';
      }
    }

    logger.info({ case: caseRecord.case_ref_no, status: result.status, nextDate: result.nextHearingDate }, 'HC scrape result');
  } catch (err) {
    result.status = 'error';
    result.error = err.message;
    logger.error({ case: caseRecord.case_ref_no, error: err.message }, 'HC scrape failed');
  }

  return result;
}

async function runHcSync(options = {}) {
  const { limit = 0, forum = null } = options;

  let query = `
    SELECT c.* FROM cases c
    WHERE (c.forum LIKE 'HC/%' OR c.forum = 'SC' OR c.forum = 'Supreme Court')
      AND (COALESCE(c.present_status, 'Pending') != 'Disposed')
  `;
  const params = [];

  if (forum) {
    query += ' AND c.forum = ?';
    params.push(forum);
  }

  query += ' ORDER BY c.forum, c.id';
  if (limit > 0) {
    query += ' LIMIT ?';
    params.push(limit);
  }

  const cases = all(query, params);
  logger.info({ count: cases.length }, 'HC sync: cases to process');

  const results = {
    total: cases.length,
    updated: 0,
    captcha: 0,
    notFound: 0,
    errors: 0,
    noData: 0,
    details: [],
  };

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (let i = 0; i < cases.length; i += CONCURRENCY) {
      const batch = cases.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(batch.map(async (c) => {
        const config = getHcConfig(c.forum) || (c.forum === 'SC' || c.forum === 'Supreme Court' ? SC_CONFIG : null);
        if (!config) {
          return { caseId: c.id, caseRefNo: c.case_ref_no, status: 'no_config', error: `No scraper config for forum: ${c.forum}` };
        }

        const page = await browser.newPage();
        try {
          const result = await scrapeHcCase(page, c, config);

          if (result.status === 'updated' || result.caseStatus) {
            const tx = db.transaction(() => {
              if (result.nextHearingDate) {
                const cur = get('SELECT next_hearing_date FROM cases WHERE id = ?', [c.id]);
                if (!cur?.next_hearing_date || cur.next_hearing_date !== result.nextHearingDate) {
                  db.prepare('UPDATE cases SET next_hearing_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                    .run(result.nextHearingDate, c.id);
                  logger.info({ case: c.case_ref_no, from: cur?.next_hearing_date, to: result.nextHearingDate }, 'HC: updated next_hearing_date');
                }
              }

              if (result.caseStatus === 'Disposed' || FROZEN_STATUSES.includes(result.caseStatus)) {
                db.prepare("UPDATE cases SET present_status = ?, next_hearing_date = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                  .run(result.caseStatus, c.id);
              }

              db.prepare("UPDATE cases SET last_checked_at = CURRENT_TIMESTAMP, sync_status = ?, last_sync_at = CURRENT_TIMESTAMP, last_sync_error = ? WHERE id = ?")
                .run(result.status === 'updated' ? 'synced' : result.status, result.error || null, c.id);
            });
            tx();
          } else {
            db.prepare("UPDATE cases SET last_checked_at = CURRENT_TIMESTAMP, sync_status = ?, last_sync_at = CURRENT_TIMESTAMP, last_sync_error = ? WHERE id = ?")
              .run(result.status, result.error || null, c.id);
          }

          return result;
        } finally {
          await page.close();
        }
      }));

      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          const res = r.value;
          results.details.push(res);
          if (res.status === 'updated') results.updated++;
          else if (res.status === 'captcha') results.captcha++;
          else if (res.status === 'not_found') results.notFound++;
          else if (res.status === 'no_data') results.noData++;
          else if (res.status === 'error' || res.status === 'no_config') results.errors++;
        } else {
          results.errors++;
          results.details.push({ error: 'Promise rejected' });
        }
      }

      logger.info({
        processed: Math.min(i + CONCURRENCY, cases.length),
        total: cases.length,
        updated: results.updated,
        captcha: results.captcha,
        errors: results.errors,
      }, 'HC sync progress');

      if (i + CONCURRENCY < cases.length) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_CASES));
      }
    }
  } finally {
    await browser.close();
  }

  logger.info(results, 'HC sync complete');
  return results;
}

module.exports = { runHcSync, getHcConfig };
