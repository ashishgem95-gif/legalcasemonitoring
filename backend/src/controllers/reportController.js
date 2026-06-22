const { get, all } = require('../config/dbHelper');
const ExcelJS = require('exceljs');

// ─────────────────────────────────────────────────────────────────────────────
// Column catalog for zone reports
// Maps DB column name -> { label, group, type } where type is 'text' | 'date' | 'datetime'
// Whitelist: only these columns are exportable (prevents SQL injection via column names)
// ─────────────────────────────────────────────────────────────────────────────
const COLUMN_CATALOG = [
  // Core Case Info
  { col: 'case_ref_no', label: 'Case Ref No', group: 'Core Case Info', type: 'text' },
  { col: 'railway', label: 'Zone', group: 'Core Case Info', type: 'text' },
  { col: 'case_type', label: 'Case Type', group: 'Core Case Info', type: 'text' },
  { col: 'case_number', label: 'Case Number', group: 'Core Case Info', type: 'text' },
  { col: 'case_year', label: 'Case Year', group: 'Core Case Info', type: 'text' },
  { col: 'forum', label: 'Forum', group: 'Core Case Info', type: 'text' },
  { col: 'present_status', label: 'Present Status', group: 'Core Case Info', type: 'text' },
  { col: 'synopsis', label: 'Synopsis / Issue', group: 'Core Case Info', type: 'text' },
  { col: 'file_no', label: 'File No', group: 'Core Case Info', type: 'text' },
  { col: 'link_file_no', label: 'Link File No', group: 'Core Case Info', type: 'text' },
  { col: 'court_link', label: 'Court Link', group: 'Core Case Info', type: 'text' },
  { col: 'tags', label: 'Tags', group: 'Core Case Info', type: 'text' },

  // Parties
  { col: 'applicant', label: 'Applicant', group: 'Parties', type: 'text' },
  { col: 'respondent', label: 'Respondent', group: 'Parties', type: 'text' },
  { col: 'employee_designation', label: 'Employee Designation', group: 'Parties', type: 'text' },

  // Key Dates
  { col: 'next_hearing_date', label: 'Next Hearing Date', group: 'Key Dates', type: 'date' },
  { col: 'disposal_date', label: 'Disposal Date', group: 'Key Dates', type: 'date' },
  { col: 'last_date_reply', label: 'Last Date of Reply', group: 'Key Dates', type: 'date' },
  { col: 'date_filing_reply', label: 'Date of Filing Reply', group: 'Key Dates', type: 'date' },
  { col: 'last_date_appeal_implementation', label: 'Last Date Appeal Implementation', group: 'Key Dates', type: 'date' },
  { col: 'created_at', label: 'Created At', group: 'Key Dates', type: 'datetime' },
  { col: 'updated_at', label: 'Updated At', group: 'Key Dates', type: 'datetime' },

  // Personnel
  { col: 'nodal_officer_name', label: 'Nodal Officer', group: 'Personnel', type: 'text' },
  { col: 'nodal_officer_contact', label: 'Nodal Officer Contact', group: 'Personnel', type: 'text' },
  { col: 'advocate_name', label: 'Advocate', group: 'Personnel', type: 'text' },
  { col: 'advocate_contact', label: 'Advocate Contact', group: 'Personnel', type: 'text' },

  // Original OA
  { col: 'original_oa_no', label: 'Original OA No', group: 'Original OA', type: 'text' },
  { col: 'original_oa_forum', label: 'Original OA Forum', group: 'Original OA', type: 'text' },
  { col: 'original_oa_date_disposal', label: 'Original OA Date of Disposal', group: 'Original OA', type: 'date' },
  { col: 'original_oa_status', label: 'Original OA Status', group: 'Original OA', type: 'text' },

  // Disciplinary Proceedings — Dates
  { col: 'charge_sheet_issued_date', label: 'Charge Sheet Issued Date', group: 'Disciplinary Proceedings', type: 'date' },
  { col: 'reply_to_charges_date', label: 'Reply to Charges Date', group: 'Disciplinary Proceedings', type: 'date' },
  { col: 'inquiry_commenced_date', label: 'Inquiry Commenced Date', group: 'Disciplinary Proceedings', type: 'date' },
  { col: 'io_report_submitted_date', label: 'IO Report Submitted Date', group: 'Disciplinary Proceedings', type: 'date' },
  { col: 'da_notice_date', label: 'DA Notice Date', group: 'Disciplinary Proceedings', type: 'date' },
  { col: 'reply_to_da_notice_date', label: 'Reply to DA Notice Date', group: 'Disciplinary Proceedings', type: 'date' },
  { col: 'da_penalty_order_date', label: 'DA Penalty Order Date', group: 'Disciplinary Proceedings', type: 'date' },
  { col: 'upsc_advice_date', label: 'UPSC Advice Date', group: 'Disciplinary Proceedings', type: 'date' },
  { col: 'appeal_oa_filed_date', label: 'Appeal OA Filed Date', group: 'Disciplinary Proceedings', type: 'date' },
  { col: 'counter_affidavit_filed_date', label: 'Counter Affidavit Filed Date', group: 'Disciplinary Proceedings', type: 'date' },
  { col: 'cat_court_order_date', label: 'CAT/Court Order Date', group: 'Disciplinary Proceedings', type: 'date' },
  { col: 'writ_petition_filed_date', label: 'Writ Petition Filed Date', group: 'Disciplinary Proceedings', type: 'date' },

  // Disciplinary Proceedings — Notes
  { col: 'charge_sheet_issued_notes', label: 'Charge Sheet Notes', group: 'Disciplinary Proceedings', type: 'text' },
  { col: 'reply_to_charges_notes', label: 'Reply to Charges Notes', group: 'Disciplinary Proceedings', type: 'text' },
  { col: 'inquiry_commenced_notes', label: 'Inquiry Commenced Notes', group: 'Disciplinary Proceedings', type: 'text' },
  { col: 'io_report_submitted_notes', label: 'IO Report Notes', group: 'Disciplinary Proceedings', type: 'text' },
  { col: 'da_notice_notes', label: 'DA Notice Notes', group: 'Disciplinary Proceedings', type: 'text' },
  { col: 'reply_to_da_notice_notes', label: 'Reply to DA Notice Notes', group: 'Disciplinary Proceedings', type: 'text' },
  { col: 'da_penalty_order_notes', label: 'DA Penalty Order Notes', group: 'Disciplinary Proceedings', type: 'text' },
  { col: 'upsc_advice_notes', label: 'UPSC Advice Notes', group: 'Disciplinary Proceedings', type: 'text' },
  { col: 'appeal_oa_filed_notes', label: 'Appeal OA Notes', group: 'Disciplinary Proceedings', type: 'text' },
  { col: 'counter_affidavit_filed_notes', label: 'Counter Affidavit Notes', group: 'Disciplinary Proceedings', type: 'text' },
  { col: 'cat_court_order_notes', label: 'CAT/Court Order Notes', group: 'Disciplinary Proceedings', type: 'text' },
  { col: 'writ_petition_filed_notes', label: 'Writ Petition Notes', group: 'Disciplinary Proceedings', type: 'text' },

  // Sync / Metadata
  { col: 'id', label: 'Case ID', group: 'Sync / Metadata', type: 'text' },
  { col: 'sync_status', label: 'Sync Status', group: 'Sync / Metadata', type: 'text' },
  { col: 'last_sync_at', label: 'Last Sync At', group: 'Sync / Metadata', type: 'datetime' },
  { col: 'last_sync_error', label: 'Last Sync Error', group: 'Sync / Metadata', type: 'text' },
  { col: 'last_checked_at', label: 'Last Checked At', group: 'Sync / Metadata', type: 'datetime' },
  { col: 'last_fetched_at', label: 'Last Fetched At', group: 'Sync / Metadata', type: 'datetime' },
];

const COLUMN_BY_KEY = Object.fromEntries(COLUMN_CATALOG.map(c => [c.col, c]));

const PRESETS = {
  summary: [
    'case_ref_no', 'railway', 'case_type', 'forum', 'present_status',
    'applicant', 'next_hearing_date', 'nodal_officer_name',
  ],
  fullDetail: COLUMN_CATALOG.filter(c => c.group !== 'Sync / Metadata').map(c => c.col),
  disciplinary: [
    'case_ref_no', 'railway', 'forum', 'present_status',
    'charge_sheet_issued_date', 'charge_sheet_issued_notes',
    'reply_to_charges_date', 'reply_to_charges_notes',
    'inquiry_commenced_date', 'inquiry_commenced_notes',
    'io_report_submitted_date', 'io_report_submitted_notes',
    'da_notice_date', 'da_notice_notes',
    'reply_to_da_notice_date', 'reply_to_da_notice_notes',
    'da_penalty_order_date', 'da_penalty_order_notes',
    'upsc_advice_date', 'upsc_advice_notes',
    'appeal_oa_filed_date', 'appeal_oa_filed_notes',
    'counter_affidavit_filed_date', 'counter_affidavit_filed_notes',
    'cat_court_order_date', 'cat_court_order_notes',
    'writ_petition_filed_date', 'writ_petition_filed_notes',
  ],
};

const DATE_FIELD_MAP = {
  created_at: 'created_at',
  disposal_date: 'disposal_date',
  next_hearing: 'next_hearing_date',
};

function sanitizeColumns(cols) {
  if (!Array.isArray(cols)) return PRESETS.summary;
  const clean = cols.filter(c => typeof c === 'string' && COLUMN_BY_KEY[c]);
  return clean.length > 0 ? clean : PRESETS.summary;
}

function sanitizeZones(zones, scope) {
  if (scope) return [scope];
  if (!Array.isArray(zones)) return [];
  return zones.filter(z => typeof z === 'string' && z.trim()).map(z => z.trim());
}

function buildWhereClause({ zones, filters, scope }) {
  const clauses = [];
  const params = [];

  if (scope) {
    clauses.push('railway = ?');
    params.push(scope);
  } else if (zones && zones.length > 0) {
    const placeholders = zones.map(() => '?').join(', ');
    clauses.push(`railway IN (${placeholders})`);
    params.push(...zones);
  }

  if (filters) {
    const { status, case_type, forum, dateField, fromDate, toDate } = filters;
    if (status && status !== 'all') {
      if (status === 'pending') {
        clauses.push("(present_status IS NULL OR present_status = 'Pending')");
      } else if (status === 'disposed') {
        clauses.push("present_status = 'Disposed'");
      } else {
        clauses.push('present_status = ?');
        params.push(status);
      }
    }
    if (case_type && case_type !== 'all') {
      clauses.push('case_type = ?');
      params.push(case_type);
    }
    if (forum && forum !== 'all') {
      clauses.push('forum = ?');
      params.push(forum);
    }
    const dateCol = DATE_FIELD_MAP[dateField];
    if (dateCol) {
      if (fromDate) { clauses.push(`${dateCol} >= ?`); params.push(fromDate); }
      if (toDate) { clauses.push(`${dateCol} <= ?`); params.push(toDate); }
    }
  }

  return { clause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

function fmtDate(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch { return null; }
}

// GET /api/reports/column-catalog
exports.getColumnCatalog = (req, res) => {
  res.json({
    columns: COLUMN_CATALOG,
    presets: PRESETS,
    dateFields: Object.keys(DATE_FIELD_MAP),
  });
};

// GET /api/reports/filter-options
exports.getFilterOptions = (req, res) => {
  try {
    const scope = req._railwayScope || null;
    const scopeClause = scope ? 'WHERE railway = ?' : '';
    const scopeParams = scope ? [scope] : [];

    const zones = all(
      `SELECT railway, COUNT(*) as count FROM cases ${scopeClause} GROUP BY railway ORDER BY count DESC`,
      scopeParams
    ).map(z => ({ zone: z.railway || 'Unknown', count: z.count }));

    const caseTypes = all(
      `SELECT case_type, COUNT(*) as count FROM cases ${scopeClause} GROUP BY case_type ORDER BY count DESC`,
      scopeParams
    ).map(t => ({ value: t.case_type || '(none)', count: t.count }));

    const forums = all(
      `SELECT forum, COUNT(*) as count FROM cases ${scopeClause} GROUP BY forum ORDER BY count DESC`,
      scopeParams
    ).map(f => ({ value: f.forum || '(none)', count: f.count }));

    const statuses = all(
      `SELECT COALESCE(present_status, 'Pending') as status, COUNT(*) as count FROM cases ${scopeClause} GROUP BY COALESCE(present_status, 'Pending') ORDER BY count DESC`,
      scopeParams
    ).map(s => ({ value: s.status, count: s.count }));

    res.json({ scope, zones, caseTypes, forums, statuses });
  } catch (err) {
    console.error('Filter options error:', err);
    res.status(500).json({ error: 'Failed to load filter options' });
  }
};

// POST /api/reports/zone-excel  -> returns .xlsx file
exports.generateZoneExcel = async (req, res) => {
  try {
    const scope = req._railwayScope || null;
    const { zones: rawZones, columns: rawCols, filters: rawFilters } = req.body || {};
    const zones = sanitizeZones(rawZones, scope);
    const columns = sanitizeColumns(rawCols);
    const filters = rawFilters && typeof rawFilters === 'object' ? rawFilters : {};

    const { clause, params } = buildWhereClause({ zones, filters, scope });

    // If admin (no scope) selects no zones, return an empty report rather than dumping all cases
    const colList = columns.map(c => `\`${c}\``).join(', ');
    const query = scope || zones.length > 0
      ? `SELECT ${colList} FROM cases ${clause} ORDER BY railway, case_ref_no`
      : `SELECT ${colList} FROM cases WHERE 1=0`;
    const rows = all(query, params);

    // Build workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Legal Case Monitoring System';
    workbook.created = new Date();

    // Sheet 1: Cases
    const sheet = workbook.addWorksheet('Cases', { views: [{ state: 'frozen', ySplit: 1 }] });
    const colMeta = columns.map(c => COLUMN_BY_KEY[c]);
    sheet.columns = colMeta.map(m => ({
      header: m.label,
      key: m.col,
      width: m.type === 'date' ? 14 : (m.type === 'datetime' ? 18 : 22),
    }));

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2C59' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    headerRow.height = 22;
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: colMeta.length },
    };

    // Data rows
    rows.forEach(r => {
      const row = sheet.addRow(r);
      colMeta.forEach((m, i) => {
        const cell = row.getCell(i + 1);
        if (m.type === 'date') {
          const d = fmtDate(r[m.col]);
          if (d) {
            cell.value = d;
            cell.numFmt = 'dd mmm yyyy';
          } else {
            cell.value = r[m.col] ?? '';
          }
        } else if (m.type === 'datetime') {
          const d = fmtDate(r[m.col]);
          if (d) {
            cell.value = d;
            cell.numFmt = 'dd mmm yyyy hh:mm';
          } else {
            cell.value = r[m.col] ?? '';
          }
        } else {
          cell.value = r[m.col] ?? '';
        }
        cell.alignment = { vertical: 'top', wrapText: false };
      });
    });

    // Sheet 2: Summary
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Zone', key: 'zone', width: 16 },
      { header: 'Total Cases', key: 'total', width: 14 },
      { header: 'Pending', key: 'pending', width: 12 },
      { header: 'Disposed', key: 'disposed', width: 12 },
      { header: 'Other', key: 'other', width: 12 },
      { header: 'Disposal %', key: 'disposalPct', width: 14 },
    ];
    const sumHeader = summarySheet.getRow(1);
    sumHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    sumHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2C59' } };
    sumHeader.alignment = { vertical: 'middle', horizontal: 'left' };
    summarySheet.views = [{ state: 'frozen', ySplit: 1 }];

    const zoneGroups = {};
    rows.forEach(r => {
      const z = r.railway || 'Unknown';
      if (!zoneGroups[z]) zoneGroups[z] = { total: 0, pending: 0, disposed: 0, other: 0 };
      zoneGroups[z].total += 1;
      const st = r.present_status;
      if (st === 'Disposed') zoneGroups[z].disposed += 1;
      else if (!st || st === 'Pending') zoneGroups[z].pending += 1;
      else zoneGroups[z].other += 1;
    });

    const sortedZones = Object.keys(zoneGroups).sort();
    let grandTotal = 0, grandPending = 0, grandDisposed = 0, grandOther = 0;
    sortedZones.forEach(z => {
      const g = zoneGroups[z];
      const pct = g.total > 0 ? Math.round((g.disposed / g.total) * 100) : 0;
      summarySheet.addRow({
        zone: z, total: g.total, pending: g.pending, disposed: g.disposed,
        other: g.other, disposalPct: `${pct}%`,
      });
      grandTotal += g.total; grandPending += g.pending; grandDisposed += g.disposed; grandOther += g.other;
    });

    const grandPct = grandTotal > 0 ? Math.round((grandDisposed / grandTotal) * 100) : 0;
    const grandRow = summarySheet.addRow({
      zone: 'GRAND TOTAL', total: grandTotal, pending: grandPending,
      disposed: grandDisposed, other: grandOther, disposalPct: `${grandPct}%`,
    });
    grandRow.font = { bold: true };
    grandRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

    // Send
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `zone_report_${timestamp}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const buffer = await workbook.xlsx.writeBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Zone Excel generation error:', err);
    res.status(500).json({ error: 'Failed to generate Excel report' });
  }
};

// GET /api/reports/case-summary
exports.getCaseSummary = (req, res) => {
  try {
    const { railway, from_date, to_date } = req.query;
    let query = `SELECT c.*, h.next_hearing
      FROM cases c
      LEFT JOIN (SELECT case_id, MAX(hearing_date) as next_hearing FROM hearing_history GROUP BY case_id) h
        ON c.id = h.case_id
      WHERE 1=1`;
    const params = [];

    if (req._railwayScope) {
      query += ' AND c.railway = ?';
      params.push(req._railwayScope);
    } else if (railway) {
      query += ' AND c.railway = ?';
      params.push(railway);
    }
    if (from_date) { query += ' AND c.created_at >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND c.created_at <= ?'; params.push(to_date); }

    query += ' ORDER BY c.updated_at DESC';

    res.json(all(query, params));
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

// GET /api/reports/hearing-calendar
exports.getHearingCalendar = (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const from = from_date || new Date().toISOString().split('T')[0];
    const to = to_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let hearingQuery = `SELECT h.*, c.case_ref_no, c.applicant, c.respondent, c.forum, c.railway
       FROM hearing_history h
       JOIN cases c ON h.case_id = c.id
       WHERE h.hearing_date BETWEEN ? AND ?`;
    const hearingParams = [from, to];
    if (req._railwayScope) {
      hearingQuery += ' AND c.railway = ?';
      hearingParams.push(req._railwayScope);
    }
    hearingQuery += ' ORDER BY h.hearing_date ASC';
    const hearings = all(hearingQuery, hearingParams);

    res.json(hearings);
  } catch (err) {
    console.error('Calendar error:', err);
    res.status(500).json({ error: 'Failed to generate hearing calendar' });
  }
};

// GET /api/reports/zone-distribution
exports.getZoneDistribution = (req, res) => {
  try {
    let zonesQuery = `SELECT railway, COUNT(*) as total,
        SUM(CASE WHEN present_status = 'Disposed' THEN 1 ELSE 0 END) as disposed,
        SUM(CASE WHEN present_status = 'Pending' OR present_status IS NULL THEN 1 ELSE 0 END) as pending
       FROM cases`;
    const zonesParams = [];
    if (req._railwayScope) {
      zonesQuery += ' WHERE railway = ?';
      zonesParams.push(req._railwayScope);
    }
    zonesQuery += ' GROUP BY railway ORDER BY total DESC';
    const zones = all(zonesQuery, zonesParams);
    res.json(zones);
  } catch (err) {
    console.error('Zone distribution error:', err);
    res.status(500).json({ error: 'Failed to generate zone distribution' });
  }
};

// GET /api/reports/export
exports.exportCases = (req, res) => {
  try {
    const { railway, format } = req.query;
    let query = `SELECT case_ref_no, railway, applicant, respondent, case_type, case_number, case_year,
      forum, present_status, last_date_reply, date_filing_reply, nodal_officer_name
      FROM cases WHERE 1=1`;
    const params = [];
    if (req._railwayScope) { query += ' AND railway = ?'; params.push(req._railwayScope); }
    else if (railway) { query += ' AND railway = ?'; params.push(railway); }
    query += ' ORDER BY case_ref_no';

    const rows = all(query, params);

    if (format === 'csv') {
      const headers = Object.keys(rows[0] || {}).join(',');
      const csvRows = rows.map(r => Object.values(r).map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=cases_export.csv');
      return res.send([headers, ...csvRows].join('\n'));
    }

    res.json(rows);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export cases' });
  }
};
