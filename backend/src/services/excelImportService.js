const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { get, all, run } = require('../config/dbHelper');
const { db } = require('../config/database');
const { logger } = require('../config/logger');
const { DISPOSED_STATUSES, FROZEN_STATUSES } = require('../config/constants');

const DEFAULT_EXCEL_PATH = path.resolve(__dirname, '..', '..', '..', 'root', 'clean data - legal cases.xlsx - Sheet1.csv.xlsx');

function getExcelPath() {
  return process.env.EXCEL_IMPORT_PATH || DEFAULT_EXCEL_PATH;
}

function getFileInfo() {
  const filePath = getExcelPath();
  try {
    const stats = fs.statSync(filePath);
    return {
      found: true,
      path: filePath,
      fileName: path.basename(filePath),
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    };
  } catch {
    return { found: false, path: filePath, fileName: path.basename(filePath) };
  }
}

function splitNames(nameStr) {
  if (!nameStr || !String(nameStr).trim()) {
    return { applicant: 'Unknown Petitioner', respondent: 'Union of India (UOI) & Ors.' };
  }
  const s = String(nameStr).trim();
  const parts = s.split(/\s+(?:Vs\.?|VS|vs|v\/s|V\/s)\s+/i);
  if (parts.length >= 2) {
    return { applicant: parts[0].trim(), respondent: parts.slice(1).join(' ').trim() };
  }
  return { applicant: s, respondent: 'Union of India (UOI) & Ors.' };
}

function cleanCellValue(cell) {
  if (cell === null || cell === undefined) return '';
  let v = cell;
  if (typeof v === 'object') {
    if (v.text) v = v.text;
    else if (v.result) v = v.result;
    else if (v instanceof Date) v = v.toISOString().split('T')[0];
    else v = String(v);
  }
  return String(v).trim();
}

function cleanNumber(val) {
  if (!val) return '';
  let s = String(val).trim();
  if (s.endsWith('.0')) s = s.slice(0, -2);
  return s;
}

function parseDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (!s) return null;

  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const ymdMatch = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
  const textMatch = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (textMatch) {
    const m = months[textMatch[2].toLowerCase().substring(0, 3)];
    if (m) return `${textMatch[3]}-${String(m).padStart(2, '0')}-${String(parseInt(textMatch[1])).padStart(2, '0')}`;
  }

  return null;
}

function extractDateFromText(str) {
  if (!str) return null;
  const s = String(str).trim();
  const direct = parseDate(s);
  if (direct) return direct;
  const m = s.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  if (m) return parseDate(m[1]);
  return null;
}

function buildCaseRefNo(caseType, caseNum, year, forum) {
  let ref = `${caseType}/${caseNum}/${year}`;
  if (forum) ref += ` (${forum})`;
  return ref;
}

async function readAndImportExcel(triggeredBy = 'manual') {
  const fileInfo = getFileInfo();
  if (!fileInfo.found) {
    return { error: `Excel file not found at: ${fileInfo.path}`, newCases: 0, updatedCases: 0, skippedCases: 0, errors: 0, totalRows: 0, details: [] };
  }

  const filePath = fileInfo.path;
  logger.info({ path: filePath, triggeredBy }, 'Excel import: starting');

  const result = {
    newCases: 0,
    updatedCases: 0,
    skippedCases: 0,
    errors: 0,
    totalRows: 0,
    details: [],
    fileModifiedAt: fileInfo.modifiedAt,
  };

  const casesToSync = [];

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const ws = workbook.getWorksheet('Sheet1') || workbook.worksheets[0];
    if (!ws) {
      return { ...result, error: 'No worksheets found in Excel file' };
    }

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      result.totalRows++;

      try {
        const railway = cleanCellValue(row.getCell(2).value);
        const name = cleanCellValue(row.getCell(3).value);
        const designation = cleanCellValue(row.getCell(4).value);
        const caseType = cleanCellValue(row.getCell(5).value);
        const caseNumRaw = cleanCellValue(row.getCell(6).value);
        const yearRaw = cleanCellValue(row.getCell(7).value);
        const forum = cleanCellValue(row.getCell(8).value);
        const issue = cleanCellValue(row.getCell(9).value);
        const fileNo = cleanCellValue(row.getCell(10).value);
        const replyFiled = cleanCellValue(row.getCell(11).value);
        const doh = cleanCellValue(row.getCell(12).value);
        const status = cleanCellValue(row.getCell(13).value);
        const linkFileNo = cleanCellValue(row.getCell(14).value);

        const caseNum = cleanNumber(caseNumRaw);
        const year = cleanNumber(yearRaw);

        if (!caseType || caseType === 'nan' || !caseNum || caseNum === 'nan') {
          result.skippedCases++;
          result.details.push({ row: r, caseRefNo: '', action: 'skipped', message: 'Missing case type or case number' });
          continue;
        }

        const caseRefNo = buildCaseRefNo(caseType, caseNum, year, forum);
        const { applicant, respondent } = splitNames(name);
        const presentStatus = (status && status !== 'nan') ? status : 'Pending';
        const dohDate = extractDateFromText(doh);
        const replyDate = parseDate(replyFiled);

        const existing = get('SELECT * FROM cases WHERE case_ref_no = ?', [caseRefNo]);

        if (!existing) {
          const insertResult = db.transaction(() => {
            run(
              `INSERT INTO cases (case_ref_no, railway, applicant, respondent, employee_designation, case_type, case_number, case_year, forum, synopsis, file_no, link_file_no, date_filing_reply, present_status, next_hearing_date, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [caseRefNo, railway || null, applicant, respondent, designation || null, caseType, caseNum, year ? parseInt(year, 10) : null, forum || null, issue || null, fileNo || null, linkFileNo || null, replyDate, presentStatus, dohDate || null]
            );
            const newCase = get('SELECT id FROM cases WHERE case_ref_no = ?', [caseRefNo]);
            if (dohDate && newCase) {
              run(
                'INSERT OR IGNORE INTO hearing_history (case_id, hearing_date, order_summary, order_raw_text) VALUES (?, ?, ?, ?)',
                [newCase.id, dohDate, 'Hearing date imported from Excel.', 'Excel import']
              );
            }
            return newCase?.id;
          })();

          result.newCases++;
          result.details.push({
            row: r, caseRefNo, action: 'new',
            message: dohDate ? `Created with hearing date ${dohDate}` : 'Created (no hearing date)',
          });

          if (dohDate && insertResult) {
            casesToSync.push({ id: insertResult, caseRefNo });
          }
        } else {
          const updates = [];
          const params = [];
          const changedFields = [];

          const fieldMap = {
            railway: railway,
            applicant: applicant,
            respondent: respondent,
            employee_designation: designation,
            synopsis: issue,
            file_no: fileNo,
            link_file_no: linkFileNo,
            date_filing_reply: replyDate,
            present_status: presentStatus !== 'Pending' ? presentStatus : null,
          };

          for (const [field, value] of Object.entries(fieldMap)) {
            if (value && value !== 'nan' && String(value).trim() && String(existing[field] || '').trim() !== String(value).trim()) {
              updates.push(`${field} = ?`);
              params.push(value);
              changedFields.push(field);
            }
          }

          let hearingAdded = false;
          if (dohDate) {
            const existingHearing = get(
              'SELECT id FROM hearing_history WHERE case_id = ? AND hearing_date = ?',
              [existing.id, dohDate]
            );
            if (!existingHearing) {
              run(
                'INSERT OR IGNORE INTO hearing_history (case_id, hearing_date, order_summary, order_raw_text) VALUES (?, ?, ?, ?)',
                [existing.id, dohDate, 'Hearing date updated from Excel.', 'Excel import']
              );
              hearingAdded = true;
              changedFields.push('hearing_date');
            }
          }

          if (dohDate && existing.next_hearing_date !== dohDate) {
            updates.push('next_hearing_date = ?');
            params.push(dohDate);
            changedFields.push('next_hearing_date');
          }

          if (presentStatus !== 'Pending' && existing.present_status !== presentStatus) {
            if (DISPOSED_STATUSES.includes(presentStatus) || FROZEN_STATUSES.includes(presentStatus)) {
              if (existing.next_hearing_date) {
                updates.push('next_hearing_date = NULL');
              }
            }
          }

          if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(existing.id);
            run(`UPDATE cases SET ${updates.join(', ')} WHERE id = ?`, params);
            result.updatedCases++;
            result.details.push({
              row: r, caseRefNo, action: 'updated',
              message: `Updated: ${changedFields.join(', ')}`,
            });
          } else {
            result.skippedCases++;
            result.details.push({
              row: r, caseRefNo, action: 'skipped',
              message: 'No changes (already up to date)',
            });
          }

          if ((hearingAdded || (dohDate && existing.next_hearing_date !== dohDate))) {
            casesToSync.push({ id: existing.id, caseRefNo });
          }
        }
      } catch (err) {
        result.errors++;
        result.details.push({ row: r, caseRefNo: '', action: 'error', message: err.message });
        logger.error({ row: r, error: err.message }, 'Excel import: row error');
      }
    }

    run(
      `INSERT INTO excel_import_log (triggered_by, new_cases, updated_cases, skipped_cases, errors, total_rows, details, file_name, file_modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [triggeredBy, result.newCases, result.updatedCases, result.skippedCases, result.errors, result.totalRows, JSON.stringify(result.details), fileInfo.fileName, fileInfo.modifiedAt]
    );

    logger.info({
      newCases: result.newCases, updatedCases: result.updatedCases, skippedCases: result.skippedCases, errors: result.errors, totalRows: result.totalRows, syncQueued: casesToSync.length,
    }, 'Excel import complete');

    result.syncQueued = casesToSync.length;
    result.syncCases = casesToSync.map(c => c.caseRefNo);
  } catch (err) {
    logger.error({ err: err.message }, 'Excel import failed');
    result.errors++;
    result.details.push({ row: 0, caseRefNo: '', action: 'error', message: `Failed to read Excel: ${err.message}` });
    return result;
  }

  if (casesToSync.length > 0) {
    // Kick off court syncs for the affected cases. We do NOT await here (the
    // import response returns immediately), but we attach a .catch so a failure
    // is logged instead of becoming an unhandled promise rejection that could
    // crash the process.
    runQueuedCourtSyncs(casesToSync).catch(err =>
      logger.error({ err: err.message }, 'Excel import: queued sync batch failed'));
  }

  return result;
}

// Processes the post-import court syncs sequentially. Defined at module scope so
// it is independent of the request lifecycle and won't be orphaned by a local
// reference — failures are caught per-case and logged.
async function runQueuedCourtSyncs(casesToSync) {
  const { runSmartSyncForCase } = require('./smartSync');
  logger.info({ count: casesToSync.length }, 'Excel import: starting queued court syncs');
  for (const c of casesToSync) {
    try {
      logger.info({ caseRefNo: c.caseRefNo }, 'Excel import: triggering court sync');
      await runSmartSyncForCase(c.id);
    } catch (err) {
      logger.error({ caseRefNo: c.caseRefNo, error: err.message }, 'Excel import: sync failed');
    }
    await new Promise(r => setTimeout(r, 500));
  }
  logger.info({ count: casesToSync.length }, 'Excel import: all queued syncs completed');
}

function getImportHistory(limit = 20) {
  const rows = all(
    'SELECT * FROM excel_import_log ORDER BY imported_at DESC LIMIT ?',
    [limit]
  );
  return rows.map(r => ({
    ...r,
    details: r.details ? JSON.parse(r.details) : [],
  }));
}

module.exports = { readAndImportExcel, getFileInfo, getImportHistory };
