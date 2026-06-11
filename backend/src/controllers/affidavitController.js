const { run, get, all } = require('../config/dbHelper');

// GET /api/cases/:id/affidavits
const getAffidavitsForCase = async (req, res) => {
  try {
    const caseRecord = get('SELECT id FROM cases WHERE id = ?', [req.params.id]);
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found.' });
    }
    const affidavits = all(
      'SELECT * FROM case_affidavits WHERE case_id = ? ORDER BY filing_date DESC, id DESC',
      [req.params.id]
    );
    res.json(affidavits);
  } catch (err) {
    console.error('Error fetching affidavits:', err);
    res.status(500).json({ error: 'Failed to retrieve affidavits.' });
  }
};

// POST /api/cases/:id/affidavits
const addAffidavitToCase = async (req, res) => {
  try {
    const caseId = req.params.id;
    const { filing_date, filed_by, affidavit_type, notes } = req.body;

    if (!filing_date || !filed_by || !affidavit_type) {
      return res.status(400).json({ error: 'Filing date, filed by, and affidavit type are required fields.' });
    }

    if (filed_by !== 'Petitioner' && filed_by !== 'Respondent') {
      return res.status(400).json({ error: 'filed_by must be either "Petitioner" or "Respondent".' });
    }

    const caseRecord = get('SELECT id FROM cases WHERE id = ?', [caseId]);
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    const result = run(
      'INSERT INTO case_affidavits (case_id, filing_date, filed_by, affidavit_type, notes) VALUES (?, ?, ?, ?, ?)',
      [caseId, filing_date, filed_by, affidavit_type, notes || '']
    );
    const newAffidavit = get('SELECT * FROM case_affidavits WHERE id = ?', [result.id]);
    res.status(201).json(newAffidavit);
  } catch (err) {
    console.error('Error adding affidavit:', err);
    res.status(500).json({ error: 'Failed to add affidavit record.' });
  }
};

// DELETE /api/affidavits/:id
const deleteAffidavit = async (req, res) => {
  try {
    const existing = get('SELECT id FROM case_affidavits WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Affidavit record not found.' });
    }
    run('DELETE FROM case_affidavits WHERE id = ?', [req.params.id]);
    res.json({ message: 'Affidavit record successfully deleted.' });
  } catch (err) {
    console.error('Error deleting affidavit:', err);
    res.status(500).json({ error: 'Failed to delete affidavit record.' });
  }
};

module.exports = { getAffidavitsForCase, addAffidavitToCase, deleteAffidavit };
