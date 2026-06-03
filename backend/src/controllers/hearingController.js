const db = require('../config/database');
const { summarizeOrder } = require('../services/summarizer');

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

// GET /api/cases/:id/hearings - Get hearing history for a case
const getHearingsForCase = async (req, res) => {
  try {
    const caseId = req.params.id;

    // Check if case exists first
    const caseRecord = await dbGet('SELECT id FROM cases WHERE id = ?', [caseId]);
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    const hearings = await dbAll(
      'SELECT * FROM hearing_history WHERE case_id = ? ORDER BY hearing_date DESC, id DESC',
      [caseId]
    );

    res.json(hearings);
  } catch (err) {
    console.error('Error fetching hearings:', err);
    res.status(500).json({ error: 'Failed to retrieve hearing history.' });
  }
};

// POST /api/cases/:id/hearings - Add a new hearing to a case
const addHearingToCase = async (req, res) => {
  try {
    const caseId = req.params.id;
    const { hearing_date, order_raw_text } = req.body;

    if (!hearing_date) {
      return res.status(400).json({ error: 'hearing_date is required.' });
    }

    // Check if case exists first
    const caseRecord = await dbGet('SELECT id FROM cases WHERE id = ?', [caseId]);
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    // Generate summary of order_raw_text
    let order_summary = '';
    if (order_raw_text && order_raw_text.trim()) {
      order_summary = await summarizeOrder(order_raw_text, req.headers);
    }

    const sql = `
      INSERT INTO hearing_history (case_id, hearing_date, order_raw_text, order_summary)
      VALUES (?, ?, ?, ?)
    `;

    const result = await dbRun(sql, [caseId, hearing_date, order_raw_text || '', order_summary]);
    const newHearing = await dbGet('SELECT * FROM hearing_history WHERE id = ?', [result.id]);

    res.status(201).json(newHearing);
  } catch (err) {
    console.error('Error adding hearing:', err);
    res.status(500).json({ error: 'Failed to add hearing record.' });
  }
};

module.exports = {
  getHearingsForCase,
  addHearingToCase
};
