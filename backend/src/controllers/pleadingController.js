const { run, get, all } = require('../config/dbHelper');

const PLEADING_TYPES = ['oa_copy', 'our_reply', 'rejoinder', 'reply_to_rejoinder'];

// GET /api/cases/:id/pleadings
exports.getPleadings = (req, res) => {
  try {
    const rows = all('SELECT * FROM case_pleadings WHERE case_id = ? ORDER BY filing_date DESC', [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/cases/:id/pleadings
exports.addPleading = (req, res) => {
  try {
    const { type, filing_date, document_url, notes } = req.body;
    if (!type || !PLEADING_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid pleading type' });
    const result = run(
      'INSERT INTO case_pleadings (case_id, type, filing_date, document_url, notes) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, type, filing_date || null, document_url || '', notes || '']
    );
    const row = get('SELECT * FROM case_pleadings WHERE id = ?', [result.id]);
    res.status(201).json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PUT /api/pleadings/:id
exports.updatePleading = (req, res) => {
  try {
    const { filing_date, document_url, notes } = req.body;
    run('UPDATE case_pleadings SET filing_date = ?, document_url = ?, notes = ? WHERE id = ?',
      [filing_date, document_url || '', notes || '', req.params.id]);
    res.json(get('SELECT * FROM case_pleadings WHERE id = ?', [req.params.id]));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /api/pleadings/:id
exports.deletePleading = (req, res) => {
  try {
    run('DELETE FROM case_pleadings WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
