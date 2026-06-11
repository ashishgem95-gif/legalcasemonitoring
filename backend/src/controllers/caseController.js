const { run, get, all } = require('../config/dbHelper');

// GET /api/cases - List all cases, with optional search filter
const getCases = async (req, res) => {
  try {
    const { search, status, case_type, railway } = req.query;
    let query = `
      SELECT c.*,
             COALESCE(c.next_hearing_date, (SELECT MAX(hearing_date) FROM hearing_history WHERE case_id = c.id)) AS next_hearing_date
      FROM cases c
      WHERE 1=1
    `;
    const params = [];

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

    if (railway) {
      query += ' AND c.railway = ?';
      params.push(railway);
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
      body.case_year ? parseInt(body.case_year) : null,
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
    const existingCase = get('SELECT id FROM cases WHERE id = ?', [caseId]);
    if (!existingCase) {
      return res.status(404).json({ error: 'Case not found.' });
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
      val('case_year') !== '' ? parseInt(val('case_year')) : null,
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
    const existingCase = get('SELECT id FROM cases WHERE id = ?', [req.params.id]);
    if (!existingCase) {
      return res.status(404).json({ error: 'Case not found.' });
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

module.exports = {
  getCases, getCaseById, createCase, updateCase, deleteCase,
  parseCase, parsePdfCaseFile, extractPdfText
};
