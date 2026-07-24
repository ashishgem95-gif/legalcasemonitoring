const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { get, all, run } = require('../config/dbHelper');
const { db } = require('../config/database');
const { logger } = require('../config/logger');

const DEFAULT_HC_EXCEL_PATH = path.resolve(__dirname, '..', '..', '..', 'root', 'hc_legal_cases.xlsx');

function getHcExcelPath() {
  return process.env.HC_EXCEL_IMPORT_PATH || DEFAULT_HC_EXCEL_PATH;
}

function getFileInfo() {
  const filePath = getHcExcelPath();
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
  return null;
}

function isHcOrSc(forum) {
  if (!forum) return false;
  const f = forum.trim();
  return f.startsWith('HC/') || f === 'SC' || f === 'Supreme Court';
}

async function readAndImportHcExcel(triggeredBy = 'manual') {
  const fileInfo = getFileInfo();
  if (!fileInfo.found) {
    return { error: `HC/SC Excel file not found at: ${fileInfo.path}`, newCases: 0, updatedCases: 0, skippedCases: 0, errors: 0, totalRows: 0, details: [] };
  }

  const filePath = fileInfo.path;
  logger.info({ path: filePath, triggeredBy }, 'HC/SC Excel import: starting');

  const result = {
    newCases: 0,
    updatedCases: 0,
    skippedCases: 0,
    errors: 0,
    totalRows: 0,
    details: [],
    fileModifiedAt: fileInfo.modifiedAt,
    scope: 'HC/SC only',
  };

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
        const caseRefNo = cleanCellValue(row.getCell(1).value);
        const hearingDate = cleanCellValue(row.getCell(2).value);
        const status = cleanCellValue(row.getCell(3).value);
        const notes = cleanCellValue(row.getCell(4).value);

        if (!caseRefNo) {
          result.skippedCases++;
          result.details.push({ row: r, caseRefNo: '', action: 'skipped', message: 'Missing case_ref_no' });
          continue;
        }

        const existing = get('SELECT * FROM cases WHERE case_ref_no = ?', [caseRefNo]);
        if (!existing) {
          result.errors++;
          result.details.push({ row: r, caseRefNo, action: 'error', message: 'Case not found in database' });
          continue;
        }

        if (!isHcOrSc(existing.forum)) {
          result.skippedCases++;
          result.details.push({ row: r, caseRefNo, action: 'skipped', message: `Not HC/SC (forum: ${existing.forum || 'none'})` });
          continue;
        }

        const updates = [];
        const params = [];
        const changedFields = [];

        const parsedDate = parseDate(hearingDate);
        if (parsedDate && existing.next_hearing_date !== parsedDate) {
          updates.push('next_hearing_date = ?');
          params.push(parsedDate);
          changedFields.push(`next_hearing_date → ${parsedDate}`);

          const existingHearing = get(
            'SELECT id FROM hearing_history WHERE case_id = ? AND hearing_date = ?',
            [existing.id, parsedDate]
          );
          if (!existingHearing) {
            run(
              'INSERT OR IGNORE INTO hearing_history (case_id, hearing_date, order_summary, order_raw_text) VALUES (?, ?, ?, ?)',
              [existing.id, parsedDate, notes || 'Hearing date updated from HC/SC Excel.', 'HC/SC Excel import']
            );
          }
        }

        if (status && status !== 'nan' && existing.present_status !== status) {
          updates.push('present_status = ?');
          params.push(status);
          changedFields.push(`present_status → ${status.substring(0, 30)}`);
        }

        if (updates.length > 0) {
          updates.push('updated_at = CURRENT_TIMESTAMP');
          params.push(existing.id);
          run(`UPDATE cases SET ${updates.join(', ')} WHERE id = ?`, params);
          result.updatedCases++;
          result.details.push({
            row: r, caseRefNo, action: 'updated',
            message: changedFields.join(', '),
          });
        } else {
          result.skippedCases++;
          result.details.push({
            row: r, caseRefNo, action: 'skipped',
            message: 'No changes needed',
          });
        }
      } catch (err) {
        result.errors++;
        result.details.push({ row: r, caseRefNo: '', action: 'error', message: err.message });
        logger.error({ row: r, error: err.message }, 'HC/SC Excel import: row error');
      }
    }

    run(
      `INSERT INTO excel_import_log (triggered_by, new_cases, updated_cases, skipped_cases, errors, total_rows, details, file_name, file_modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [triggeredBy + '_hc', result.newCases, result.updatedCases, result.skippedCases, result.errors, result.totalRows, JSON.stringify(result.details), fileInfo.fileName, fileInfo.modifiedAt]
    );

    logger.info({
      updatedCases: result.updatedCases, skippedCases: result.skippedCases, errors: result.errors, totalRows: result.totalRows,
    }, 'HC/SC Excel import complete');
  } catch (err) {
    logger.error({ err: err.message }, 'HC/SC Excel import failed');
    result.errors++;
    result.details.push({ row: 0, caseRefNo: '', action: 'error', message: `Failed to read Excel: ${err.message}` });
    return result;
  }

  return result;
}

module.exports = { readAndImportHcExcel, getFileInfo };
