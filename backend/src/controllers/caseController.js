const { run, get, all } = require('../config/dbHelper');

function checkCaseAccess(caseRecord, user) {
  if (!user || user.railwayScope === 'All') return true;
  return caseRecord.railway === user.railwayScope;
}

// GET /api/cases - List all cases, with optional search filter
const getCases = async (req, res) => {
  try {
    const { search, status, case_type, railway } = req.query;
    let query = `
      SELECT c.*,
             CASE
               WHEN c.next_hearing_date IS NOT NULL AND lh.last_hearing_date IS NOT NULL
                 THEN MAX(c.next_hearing_date, lh.last_hearing_date)
               ELSE COALESCE(c.next_hearing_date, lh.last_hearing_date)
             END AS next_hearing_date,
             lh.last_hearing_date AS last_hearing_date,
             lh.last_hearing_order AS last_hearing_order,
             lh.last_hearing_uploaded AS last_hearing_order_uploaded,
             CASE
               WHEN COALESCE(c.present_status, 'Pending') = 'Disposed' THEN 0
               WHEN lh.last_hearing_date IS NULL THEN 0
               WHEN lh.last_hearing_date >= DATE('now') THEN 0
               WHEN lh.last_hearing_date < DATE('now', '-30 days') THEN 0
               WHEN COALESCE(lh.last_hearing_uploaded, 0) = 1 THEN 0
               WHEN COALESCE(lh.last_hearing_order, '') = '' THEN 1
               ELSE 0
             END AS has_pending_order_upload
      FROM cases c
      LEFT JOIN (
        SELECT h1.case_id, h1.hearing_date AS last_hearing_date, h1.order_raw_text AS last_hearing_order, h1.order_uploaded AS last_hearing_uploaded
        FROM hearing_history h1
        JOIN (
          SELECT case_id, MAX(hearing_date) AS max_date FROM hearing_history GROUP BY case_id
        ) h2 ON h1.case_id = h2.case_id AND h1.hearing_date = h2.max_date
      ) lh ON lh.case_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (req._railwayScope) {
      query += ' AND c.railway = ?';
      params.push(req._railwayScope);
    } else if (railway) {
      query += ' AND c.railway = ?';
      params.push(railway);
    }

    if (search) {
      query += ' AND (c.case_ref_no LIKE ? OR c.applicant LIKE ? OR c.respondent LIKE ? OR c.synopsis LIKE ? OR c.file_no LIKE ?)';
      const searchWildcard = `%${search}%`;
      params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard);
    }

    if (status) {
      query += ' AND c.present_status = ?';
      params.push(status);
    }

    if (case_type) {
      query += ' AND c.case_type = ?';
      params.push(case_type);
    }

    query += ' ORDER BY c.updated_at DESC, c.id DESC';

    const cases = all(query, params);
    res.json(cases);
  } catch (err) {
    console.error('Error fetching cases:', err);
    res.status(500).json({ error: 'Failed to retrieve cases.' });
  }
};

// GET /api/cases/:id
const getCaseById = async (req, res) => {
  try {
    const caseRecord = get('SELECT * FROM cases WHERE id = ?', [req.params.id]);
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found.' });
    }
    if (!checkCaseAccess(caseRecord, req.user)) {
      return res.status(403).json({ error: 'Access denied to this case.' });
    }
    res.json(caseRecord);
  } catch (err) {
    console.error('Error fetching case by ID:', err);
    res.status(500).json({ error: 'Failed to retrieve case details.' });
  }
};

// POST /api/cases - Create a new case
const createCase = async (req, res) => {
  try {
    const body = req.body;
    if (!body.case_ref_no) {
      return res.status(400).json({ error: 'case_ref_no is required.' });
    }

    const sql = `
      INSERT INTO cases (
        case_ref_no, railway, applicant, respondent, employee_designation,
        case_type, case_number, case_year, forum, synopsis, file_no, link_file_no,
        last_date_reply, date_filing_reply, present_status, last_date_appeal_implementation,
        nodal_officer_name, nodal_officer_contact, advocate_name, advocate_contact,
        original_oa_no, original_oa_forum, original_oa_date_disposal, original_oa_status,
        court_link,
        charge_sheet_issued_date, charge_sheet_issued_notes,
        reply_to_charges_date, reply_to_charges_notes,
        inquiry_commenced_date, inquiry_commenced_notes,
        io_report_submitted_date, io_report_submitted_notes,
        da_notice_date, da_notice_notes,
        reply_to_da_notice_date, reply_to_da_notice_notes,
        da_penalty_order_date, da_penalty_order_notes,
        upsc_advice_date, upsc_advice_notes,
        appeal_oa_filed_date, appeal_oa_filed_notes,
        counter_affidavit_filed_date, counter_affidavit_filed_notes,
        cat_court_order_date, cat_court_order_notes,
        writ_petition_filed_date, writ_petition_filed_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      body.case_ref_no, body.railway || null, body.applicant || null,
      body.respondent || null, body.employee_designation || null,
      body.case_type || null, body.case_number || null,
      body.case_year && !isNaN(Number(body.case_year)) ? parseInt(body.case_year) : null,
      body.forum || null, body.synopsis || null,
      body.file_no || null, body.link_file_no || null,
      body.last_date_reply || null, body.date_filing_reply || null,
      body.present_status || 'Pending',
      body.last_date_appeal_implementation || null,
      body.nodal_officer_name || null, body.nodal_officer_contact || null,
      body.advocate_name || null, body.advocate_contact || null,
      body.original_oa_no || null, body.original_oa_forum || null,
      body.original_oa_date_disposal || null, body.original_oa_status || null,
      body.court_link || null,
      body.charge_sheet_issued_date || null, body.charge_sheet_issued_notes || null,
      body.reply_to_charges_date || null, body.reply_to_charges_notes || null,
      body.inquiry_commenced_date || null, body.inquiry_commenced_notes || null,
      body.io_report_submitted_date || null, body.io_report_submitted_notes || null,
      body.da_notice_date || null, body.da_notice_notes || null,
      body.reply_to_da_notice_date || null, body.reply_to_da_notice_notes || null,
      body.da_penalty_order_date || null, body.da_penalty_order_notes || null,
      body.upsc_advice_date || null, body.upsc_advice_notes || null,
      body.appeal_oa_filed_date || null, body.appeal_oa_filed_notes || null,
      body.counter_affidavit_filed_date || null, body.counter_affidavit_filed_notes || null,
      body.cat_court_order_date || null, body.cat_court_order_notes || null,
      body.writ_petition_filed_date || null, body.writ_petition_filed_notes || null
    ];

    const result = run(sql, params);
    const newCase = get('SELECT * FROM cases WHERE id = ?', [result.id]);
    res.status(201).json(newCase);
  } catch (err) {
    console.error('Error creating case:', err);
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A case with this Case Reference Number already exists.' });
    }
    res.status(500).json({ error: 'Failed to create case.' });
  }
};

// PUT /api/cases/:id
const updateCase = async (req, res) => {
  try {
    const caseId = req.params.id;
    const existingCase = get('SELECT * FROM cases WHERE id = ?', [caseId]);
    if (!existingCase) {
      return res.status(404).json({ error: 'Case not found.' });
    }
    if (!checkCaseAccess(existingCase, req.user)) {
      return res.status(403).json({ error: 'Access denied to modify this case.' });
    }

    const body = req.body;
    if (!body.case_ref_no) {
      return res.status(400).json({ error: 'case_ref_no is required.' });
    }

    const val = (key, fallback = null) => body[key] !== undefined ? body[key] : fallback;

    const sql = `
      UPDATE cases
      SET case_ref_no = ?, railway = ?, applicant = ?, respondent = ?,
          employee_designation = ?, case_type = ?, case_number = ?,
          case_year = ?, forum = ?, synopsis = ?, file_no = ?,
          link_file_no = ?, last_date_reply = ?, date_filing_reply = ?,
          present_status = ?, last_date_appeal_implementation = ?,
          nodal_officer_name = ?, nodal_officer_contact = ?,
          advocate_name = ?, advocate_contact = ?,
          original_oa_no = ?, original_oa_forum = ?,
          original_oa_date_disposal = ?, original_oa_status = ?,
          court_link = ?,
          charge_sheet_issued_date = ?, charge_sheet_issued_notes = ?,
          reply_to_charges_date = ?, reply_to_charges_notes = ?,
          inquiry_commenced_date = ?, inquiry_commenced_notes = ?,
          io_report_submitted_date = ?, io_report_submitted_notes = ?,
          da_notice_date = ?, da_notice_notes = ?,
          reply_to_da_notice_date = ?, reply_to_da_notice_notes = ?,
          da_penalty_order_date = ?, da_penalty_order_notes = ?,
          upsc_advice_date = ?, upsc_advice_notes = ?,
          appeal_oa_filed_date = ?, appeal_oa_filed_notes = ?,
          counter_affidavit_filed_date = ?, counter_affidavit_filed_notes = ?,
          cat_court_order_date = ?, cat_court_order_notes = ?,
          writ_petition_filed_date = ?, writ_petition_filed_notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const params = [
      body.case_ref_no, val('railway'), val('applicant'), val('respondent'),
      val('employee_designation'), val('case_type'), val('case_number'),
      val('case_year') && !isNaN(Number(val('case_year'))) ? parseInt(val('case_year')) : null,
      val('forum'), val('synopsis'), val('file_no'),
      val('link_file_no'), val('last_date_reply'), val('date_filing_reply'),
      val('present_status', 'Pending'), val('last_date_appeal_implementation'),
      val('nodal_officer_name'), val('nodal_officer_contact'),
      val('advocate_name'), val('advocate_contact'),
      val('original_oa_no'), val('original_oa_forum'),
      val('original_oa_date_disposal'), val('original_oa_status'),
      val('court_link'),
      val('charge_sheet_issued_date'), val('charge_sheet_issued_notes'),
      val('reply_to_charges_date'), val('reply_to_charges_notes'),
      val('inquiry_commenced_date'), val('inquiry_commenced_notes'),
      val('io_report_submitted_date'), val('io_report_submitted_notes'),
      val('da_notice_date'), val('da_notice_notes'),
      val('reply_to_da_notice_date'), val('reply_to_da_notice_notes'),
      val('da_penalty_order_date'), val('da_penalty_order_notes'),
      val('upsc_advice_date'), val('upsc_advice_notes'),
      val('appeal_oa_filed_date'), val('appeal_oa_filed_notes'),
      val('counter_affidavit_filed_date'), val('counter_affidavit_filed_notes'),
      val('cat_court_order_date'), val('cat_court_order_notes'),
      val('writ_petition_filed_date'), val('writ_petition_filed_notes'),
      caseId
    ];

    run(sql, params);
    const updatedCase = get('SELECT * FROM cases WHERE id = ?', [caseId]);
    res.json(updatedCase);
  } catch (err) {
    console.error('Error updating case:', err);
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A case with this Case Reference Number already exists.' });
    }
    res.status(500).json({ error: 'Failed to update case.' });
  }
};

// DELETE /api/cases/:id
const deleteCase = async (req, res) => {
  try {
    const existingCase = get('SELECT * FROM cases WHERE id = ?', [req.params.id]);
    if (!existingCase) {
      return res.status(404).json({ error: 'Case not found.' });
    }
    if (!checkCaseAccess(existingCase, req.user)) {
      return res.status(403).json({ error: 'Access denied to delete this case.' });
    }
    run('DELETE FROM cases WHERE id = ?', [req.params.id]);
    res.json({ message: 'Case successfully deleted.' });
  } catch (err) {
    console.error('Error deleting case:', err);
    res.status(500).json({ error: 'Failed to delete case.' });
  }
};

const { parseCaseFile } = require('../services/caseParser');
const pdfParse = require('pdf-parse');

// POST /api/cases/parse-file
const parseCase = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text content is required for parsing.' });
    }
    const yamlOutput = await parseCaseFile(text, req.headers);
    res.json({ yaml: yamlOutput });
  } catch (err) {
    console.error('Error parsing case file:', err);
    res.status(500).json({ error: 'Failed to parse case file.' });
  }
};

// POST /api/cases/parse-pdf
const parsePdfCaseFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Failed to extract text from PDF. The document might be blank or scanned as an image.' });
    }
    const yamlOutput = await parseCaseFile(text, req.headers);
    res.json({ yaml: yamlOutput, text: text.substring(0, 1000) });
  } catch (err) {
    console.error('Error parsing PDF case file:', err);
    res.status(500).json({ error: 'Failed to extract case metadata from the uploaded PDF document.' });
  }
};

// POST /api/extract-pdf
const extractPdfText = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }
    const pdfData = await pdfParse(req.file.buffer);
    res.json({ text: pdfData.text });
  } catch (err) {
    console.error('Error extracting PDF text:', err);
    res.status(500).json({ error: 'Failed to extract text from PDF.' });
  }
};

const updateCaseStatus = async (req, res) => {
  try {
    const caseId = req.params.id;
    const { status } = req.body;
    if (!status || !status.trim()) {
      return res.status(400).json({ error: 'Status is required' });
    }
    const existingCase = get('SELECT * FROM cases WHERE id = ?', [caseId]);
    if (!existingCase) {
      return res.status(404).json({ error: 'Case not found' });
    }
    if (!checkCaseAccess(existingCase, req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    run('UPDATE cases SET present_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status.trim(), caseId]);
    res.json({ success: true, caseId: parseInt(caseId), newStatus: status.trim() });
  } catch (err) {
    console.error('Error updating case status:', err);
    res.status(500).json({ error: 'Failed to update case status' });
  }
};

const updateCaseNextHearing = async (req, res) => {
  try {
    const caseId = req.params.id;
    const { nextHearingDate } = req.body;
    if (!nextHearingDate || !nextHearingDate.trim()) {
      return res.status(400).json({ error: 'nextHearingDate is required (YYYY-MM-DD)' });
    }
    const existingCase = get('SELECT * FROM cases WHERE id = ?', [caseId]);
    if (!existingCase) {
      return res.status(404).json({ error: 'Case not found' });
    }
    if (!checkCaseAccess(existingCase, req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    run('UPDATE cases SET next_hearing_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextHearingDate.trim(), caseId]);
    res.json({ success: true, caseId: parseInt(caseId), nextHearingDate: nextHearingDate.trim() });
  } catch (err) {
    console.error('Error updating hearing date:', err);
    res.status(500).json({ error: 'Failed to update hearing date' });
  }
};

// GET /api/cases/check-duplicate
const checkDuplicate = (req, res) => {
  try {
    const { case_ref_no, forum, case_type, case_number, case_year } = req.query;
    if (!case_ref_no && !forum && !case_number && !case_year) {
      return res.status(400).json({ error: 'At least one search parameter is required.' });
    }

    const scopeFilter = req._railwayScope ? ' AND railway = ?' : '';
    const scopeParams = req._railwayScope ? [req._railwayScope] : [];

    // Exact match on case_ref_no
    let exactMatch = null;
    if (case_ref_no) {
      exactMatch = get(
        `SELECT id, case_ref_no, applicant, respondent, forum, railway, present_status, next_hearing_date FROM cases WHERE case_ref_no = ? ${scopeFilter}`,
        [case_ref_no, ...scopeParams]
      );
    }

    // Logical match on forum + case_type + case_number + case_year (all four must be non-null and match)
    let logicalMatches = [];
    if (forum && case_type && case_number && case_year) {
      logicalMatches = all(
        `SELECT id, case_ref_no, applicant, respondent, forum, railway, present_status, next_hearing_date
         FROM cases
         WHERE forum = ? AND case_type = ? AND case_number = ? AND case_year = ?
           AND forum IS NOT NULL AND case_type IS NOT NULL AND case_number IS NOT NULL AND case_year IS NOT NULL
           ${scopeFilter}
         ORDER BY updated_at DESC LIMIT 10`,
        [forum, case_type, case_number, case_year, ...scopeParams]
      );
    }

    // Filter out the exact match from logical matches to avoid double-counting
    if (exactMatch) {
      logicalMatches = logicalMatches.filter(m => m.id !== exactMatch.id);
    }

    res.json({
      exactMatch,
      logicalMatches,
      count: (exactMatch ? 1 : 0) + logicalMatches.length,
    });
  } catch (err) {
    console.error('Duplicate check error:', err);
    res.status(500).json({ error: 'Failed to check for duplicates.' });
  }
};

module.exports = {
  getCases, getCaseById, createCase, updateCase, deleteCase,
  updateCaseStatus, updateCaseNextHearing,
  parseCase, parsePdfCaseFile, extractPdfText,
  checkDuplicate,
};
