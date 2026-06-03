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

// GET /api/cases/:id/affidavits - Get all affidavits for a case
const getAffidavitsForCase = async (req, res) => {
  try {
    const caseId = req.params.id;

    // Check if case exists first
    const caseRecord = await dbGet('SELECT id FROM cases WHERE id = ?', [caseId]);
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    const affidavits = await dbAll(
      'SELECT * FROM case_affidavits WHERE case_id = ? ORDER BY filing_date DESC, id DESC',
      [caseId]
    );

    res.json(affidavits);
  } catch (err) {
    console.error('Error fetching affidavits:', err);
    res.status(500).json({ error: 'Failed to retrieve affidavits.' });
  }
};

// POST /api/cases/:id/affidavits - Add a new affidavit to a case
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

    // Check if case exists first
    const caseRecord = await dbGet('SELECT id FROM cases WHERE id = ?', [caseId]);
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    const sql = `
      INSERT INTO case_affidavits (case_id, filing_date, filed_by, affidavit_type, notes)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await dbRun(sql, [caseId, filing_date, filed_by, affidavit_type, notes || '']);
    const newAffidavit = await dbGet('SELECT * FROM case_affidavits WHERE id = ?', [result.id]);

    res.status(201).json(newAffidavit);
  } catch (err) {
    console.error('Error adding affidavit:', err);
    res.status(500).json({ error: 'Failed to add affidavit record.' });
  }
};

// DELETE /api/affidavits/:id - Delete an affidavit record
const deleteAffidavit = async (req, res) => {
  try {
    const affidavitId = req.params.id;

    // Check if it exists
    const existing = await dbGet('SELECT id FROM case_affidavits WHERE id = ?', [affidavitId]);
    if (!existing) {
      return res.status(404).json({ error: 'Affidavit record not found.' });
    }

    await dbRun('DELETE FROM case_affidavits WHERE id = ?', [affidavitId]);
    res.json({ message: 'Affidavit record successfully deleted.' });
  } catch (err) {
    console.error('Error deleting affidavit:', err);
    res.status(500).json({ error: 'Failed to delete affidavit record.' });
  }
};

module.exports = {
  getAffidavitsForCase,
  addAffidavitToCase,
  deleteAffidavit
};
