const { run, get, all } = require('../config/dbHelper');
const { summarizeOrder } = require('../services/summarizer');

// GET /api/cases/:id/hearings
const getHearingsForCase = async (req, res) => {
  try {
    const caseRecord = get('SELECT id FROM cases WHERE id = ?', [req.params.id]);
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found.' });
    }
    const hearings = all(
      'SELECT * FROM hearing_history WHERE case_id = ? ORDER BY hearing_date DESC, id DESC',
      [req.params.id]
    );
    res.json(hearings);
  } catch (err) {
    console.error('Error fetching hearings:', err);
    res.status(500).json({ error: 'Failed to retrieve hearing history.' });
  }
};

// POST /api/cases/:id/hearings
const addHearingToCase = async (req, res) => {
  try {
    const caseId = req.params.id;
    const { hearing_date, order_raw_text } = req.body;

    if (!hearing_date) {
      return res.status(400).json({ error: 'hearing_date is required.' });
    }

    const caseRecord = get('SELECT id FROM cases WHERE id = ?', [caseId]);
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    let order_summary = '';
    if (order_raw_text && order_raw_text.trim()) {
      order_summary = await summarizeOrder(order_raw_text, req.headers);
    }

    const result = run(
      'INSERT INTO hearing_history (case_id, hearing_date, order_raw_text, order_summary) VALUES (?, ?, ?, ?)',
      [caseId, hearing_date, order_raw_text || '', order_summary]
    );
    const newHearing = get('SELECT * FROM hearing_history WHERE id = ?', [result.id]);
    res.status(201).json(newHearing);
  } catch (err) {
    console.error('Error adding hearing:', err);
    res.status(500).json({ error: 'Failed to add hearing record.' });
  }
};

module.exports = { getHearingsForCase, addHearingToCase };
