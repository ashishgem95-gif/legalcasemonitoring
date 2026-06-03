const db = require('../config/database');

// Promise-based wrappers for sqlite3
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows);
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row);
  });
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) return reject(err);
    resolve({ id: this.lastID, changes: this.changes });
  });
});

// GET /api/cases - List all cases, with optional search filter
const getCases = async (req, res) => {
  try {
    const { search, status, case_type, railway } = req.query;
    let query = `
      SELECT c.*, 
             (SELECT MAX(hearing_date) FROM hearing_history WHERE case_id = c.id) AS next_hearing_date
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

    // Order by recently updated or created
    query += ' ORDER BY c.updated_at DESC, c.id DESC';

    const cases = await dbAll(query, params);
    res.json(cases);
  } catch (err) {
    console.error('Error fetching cases:', err);
    res.status(500).json({ error: 'Failed to retrieve cases.' });
  }
};

// GET /api/cases/:id - Retrieve a single case by ID
const getCaseById = async (req, res) => {
  try {
    const caseId = req.params.id;
    const caseRecord = await dbGet('SELECT * FROM cases WHERE id = ?', [caseId]);

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
    const {
      case_ref_no,
      railway,
      applicant,
      respondent,
      employee_designation,
      case_type,
      case_number,
      case_year,
      forum,
      synopsis,
      file_no,
      link_file_no,
      last_date_reply,
      date_filing_reply,
      present_status,
      last_date_appeal_implementation,
      nodal_officer_name,
      nodal_officer_contact,
      advocate_name,
      advocate_contact,
      original_oa_no,
      original_oa_forum,
      original_oa_date_disposal,
      original_oa_status,
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
    } = req.body;

    if (!case_ref_no) {
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
      case_ref_no,
      railway || null,
      applicant || null,
      respondent || null,
      employee_designation || null,
      case_type || null,
      case_number || null,
      case_year ? parseInt(case_year) : null,
      forum || null,
      synopsis || null,
      file_no || null,
      link_file_no || null,
      last_date_reply || null,
      date_filing_reply || null,
      present_status || 'Pending',
      last_date_appeal_implementation || null,
      nodal_officer_name || null,
      nodal_officer_contact || null,
      advocate_name || null,
      advocate_contact || null,
      original_oa_no || null,
      original_oa_forum || null,
      original_oa_date_disposal || null,
      original_oa_status || null,
      court_link || null,
      charge_sheet_issued_date || null,
      charge_sheet_issued_notes || null,
      reply_to_charges_date || null,
      reply_to_charges_notes || null,
      inquiry_commenced_date || null,
      inquiry_commenced_notes || null,
      io_report_submitted_date || null,
      io_report_submitted_notes || null,
      da_notice_date || null,
      da_notice_notes || null,
      reply_to_da_notice_date || null,
      reply_to_da_notice_notes || null,
      da_penalty_order_date || null,
      da_penalty_order_notes || null,
      upsc_advice_date || null,
      upsc_advice_notes || null,
      appeal_oa_filed_date || null,
      appeal_oa_filed_notes || null,
      counter_affidavit_filed_date || null,
      counter_affidavit_filed_notes || null,
      cat_court_order_date || null,
      cat_court_order_notes || null,
      writ_petition_filed_date || null,
      writ_petition_filed_notes || null
    ];

    const result = await dbRun(sql, params);
    const newCase = await dbGet('SELECT * FROM cases WHERE id = ?', [result.id]);
    res.status(201).json(newCase);
  } catch (err) {
    console.error('Error creating case:', err);
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A case with this Case Reference Number already exists.' });
    }
    res.status(500).json({ error: 'Failed to create case.' });
  }
};

// PUT /api/cases/:id - Update an existing case
const updateCase = async (req, res) => {
  try {
    const caseId = req.params.id;

    // First check if the case exists
    const existingCase = await dbGet('SELECT id FROM cases WHERE id = ?', [caseId]);
    if (!existingCase) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    const {
      case_ref_no,
      railway,
      applicant,
      respondent,
      employee_designation,
      case_type,
      case_number,
      case_year,
      forum,
      synopsis,
      file_no,
      link_file_no,
      last_date_reply,
      date_filing_reply,
      present_status,
      last_date_appeal_implementation,
      nodal_officer_name,
      nodal_officer_contact,
      advocate_name,
      advocate_contact,
      original_oa_no,
      original_oa_forum,
      original_oa_date_disposal,
      original_oa_status,
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
    } = req.body;

    if (!case_ref_no) {
      return res.status(400).json({ error: 'case_ref_no is required.' });
    }

    const sql = `
      UPDATE cases
      SET case_ref_no = ?,
          railway = ?,
          applicant = ?,
          respondent = ?,
          employee_designation = ?,
          case_type = ?,
          case_number = ?,
          case_year = ?,
          forum = ?,
          synopsis = ?,
          file_no = ?,
          link_file_no = ?,
          last_date_reply = ?,
          date_filing_reply = ?,
          present_status = ?,
          last_date_appeal_implementation = ?,
          nodal_officer_name = ?,
          nodal_officer_contact = ?,
          advocate_name = ?,
          advocate_contact = ?,
          original_oa_no = ?,
          original_oa_forum = ?,
          original_oa_date_disposal = ?,
          original_oa_status = ?,
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
      case_ref_no,
      railway !== undefined ? railway : null,
      applicant !== undefined ? applicant : null,
      respondent !== undefined ? respondent : null,
      employee_designation !== undefined ? employee_designation : null,
      case_type !== undefined ? case_type : null,
      case_number !== undefined ? case_number : null,
      case_year !== undefined && case_year !== '' ? parseInt(case_year) : null,
      forum !== undefined ? forum : null,
      synopsis !== undefined ? synopsis : null,
      file_no !== undefined ? file_no : null,
      link_file_no !== undefined ? link_file_no : null,
      last_date_reply !== undefined ? last_date_reply : null,
      date_filing_reply !== undefined ? date_filing_reply : null,
      present_status !== undefined ? present_status : 'Pending',
      last_date_appeal_implementation !== undefined ? last_date_appeal_implementation : null,
      nodal_officer_name !== undefined ? nodal_officer_name : null,
      nodal_officer_contact !== undefined ? nodal_officer_contact : null,
      advocate_name !== undefined ? advocate_name : null,
      advocate_contact !== undefined ? advocate_contact : null,
      original_oa_no !== undefined ? original_oa_no : null,
      original_oa_forum !== undefined ? original_oa_forum : null,
      original_oa_date_disposal !== undefined ? original_oa_date_disposal : null,
      original_oa_status !== undefined ? original_oa_status : null,
      court_link !== undefined ? court_link : null,
      charge_sheet_issued_date !== undefined ? charge_sheet_issued_date : null,
      charge_sheet_issued_notes !== undefined ? charge_sheet_issued_notes : null,
      reply_to_charges_date !== undefined ? reply_to_charges_date : null,
      reply_to_charges_notes !== undefined ? reply_to_charges_notes : null,
      inquiry_commenced_date !== undefined ? inquiry_commenced_date : null,
      inquiry_commenced_notes !== undefined ? inquiry_commenced_notes : null,
      io_report_submitted_date !== undefined ? io_report_submitted_date : null,
      io_report_submitted_notes !== undefined ? io_report_submitted_notes : null,
      da_notice_date !== undefined ? da_notice_date : null,
      da_notice_notes !== undefined ? da_notice_notes : null,
      reply_to_da_notice_date !== undefined ? reply_to_da_notice_date : null,
      reply_to_da_notice_notes !== undefined ? reply_to_da_notice_notes : null,
      da_penalty_order_date !== undefined ? da_penalty_order_date : null,
      da_penalty_order_notes !== undefined ? da_penalty_order_notes : null,
      upsc_advice_date !== undefined ? upsc_advice_date : null,
      upsc_advice_notes !== undefined ? upsc_advice_notes : null,
      appeal_oa_filed_date !== undefined ? appeal_oa_filed_date : null,
      appeal_oa_filed_notes !== undefined ? appeal_oa_filed_notes : null,
      counter_affidavit_filed_date !== undefined ? counter_affidavit_filed_date : null,
      counter_affidavit_filed_notes !== undefined ? counter_affidavit_filed_notes : null,
      cat_court_order_date !== undefined ? cat_court_order_date : null,
      cat_court_order_notes !== undefined ? cat_court_order_notes : null,
      writ_petition_filed_date !== undefined ? writ_petition_filed_date : null,
      writ_petition_filed_notes !== undefined ? writ_petition_filed_notes : null,
      caseId
    ];

    await dbRun(sql, params);
    const updatedCase = await dbGet('SELECT * FROM cases WHERE id = ?', [caseId]);
    res.json(updatedCase);
  } catch (err) {
    console.error('Error updating case:', err);
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A case with this Case Reference Number already exists.' });
    }
    res.status(500).json({ error: 'Failed to update case.' });
  }
};

// DELETE /api/cases/:id - Delete a case (and CASCADE deletes its hearings due to foreign keys)
const deleteCase = async (req, res) => {
  try {
    const caseId = req.params.id;

    // Check if the case exists
    const existingCase = await dbGet('SELECT id FROM cases WHERE id = ?', [caseId]);
    if (!existingCase) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    await dbRun('DELETE FROM cases WHERE id = ?', [caseId]);
    res.json({ message: 'Case successfully deleted.' });
  } catch (err) {
    console.error('Error deleting case:', err);
    res.status(500).json({ error: 'Failed to delete case.' });
  }
};

const { parseCaseFile } = require('../services/caseParser');
const pdfParse = require('pdf-parse');

// POST /api/cases/parse-file - Parse raw text of a case file into YAML structure
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

// POST /api/cases/parse-pdf - Parse uploaded PDF file into YAML structure
const parsePdfCaseFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }
    
    // Extract text from the PDF buffer in memory
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Failed to extract text from PDF. The document might be blank or scanned as an image.' });
    }
    
    // Generate YAML from the extracted text using customized provider/model parameters
    const yamlOutput = await parseCaseFile(text, req.headers);
    res.json({ yaml: yamlOutput, text: text.substring(0, 1000) });
  } catch (err) {
    console.error('Error parsing PDF case file:', err);
    res.status(500).json({ error: 'Failed to extract case metadata from the uploaded PDF document.' });
  }
};

// POST /api/extract-pdf - Extract text from uploaded PDF
const extractPdfText = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;
    res.json({ text });
  } catch (err) {
    console.error('Error extracting PDF text:', err);
    res.status(500).json({ error: 'Failed to extract text from PDF.' });
  }
};

module.exports = {
  getCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase,
  parseCase,
  parsePdfCaseFile,
  extractPdfText
};
