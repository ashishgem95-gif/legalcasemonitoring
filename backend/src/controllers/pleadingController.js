const { run, get, all } = require('../config/dbHelper');

const PLEADING_TYPES = ['oa_copy', 'our_reply', 'rejoinder', 'reply_to_rejoinder'];

function checkCaseAccess(caseRecord, user) {
  if (!user || user.railwayScope === 'All') return true;
  return caseRecord.railway === user.railwayScope;
}

// GET /api/cases/:id/pleadings
exports.getPleadings = (req, res) => {
  try {
    const caseRecord = get('SELECT id, railway FROM cases WHERE id = ?', [req.params.id]);
    if (!caseRecord) return res.status(404).json({ error: 'Case not found.' });
    if (!checkCaseAccess(caseRecord, req.user)) return res.status(403).json({ error: 'Access denied for this case.' });
    const rows = all('SELECT * FROM case_pleadings WHERE case_id = ? ORDER BY filing_date DESC', [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching pleadings:', err);
    res.status(500).json({ error: 'Failed to retrieve pleadings.' });
  }
};

// POST /api/cases/:id/pleadings
exports.addPleading = (req, res) => {
  try {
    const { type, filing_date, document_url, notes } = req.body;
    if (!type || !PLEADING_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid pleading type' });
    const caseRecord = get('SELECT id, railway FROM cases WHERE id = ?', [req.params.id]);
    if (!caseRecord) return res.status(404).json({ error: 'Case not found.' });
    if (!checkCaseAccess(caseRecord, req.user)) return res.status(403).json({ error: 'Access denied for this case.' });
    const result = run(
      'INSERT INTO case_pleadings (case_id, type, filing_date, document_url, notes) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, type, filing_date || null, document_url || '', notes || '']
    );
    const row = get('SELECT * FROM case_pleadings WHERE id = ?', [result.id]);
    res.status(201).json(row);
  } catch (err) {
    console.error('Error adding pleading:', err);
    res.status(500).json({ error: 'Failed to add pleading record.' });
  }
};

// PUT /api/pleadings/:id
exports.updatePleading = (req, res) => {
  try {
    const { filing_date, document_url, notes } = req.body;
    const existing = get('SELECT cp.*, c.railway FROM case_pleadings cp JOIN cases c ON cp.case_id = c.id WHERE cp.id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Pleading not found.' });
    if (!checkCaseAccess(existing, req.user)) return res.status(403).json({ error: 'Access denied for this case.' });
    run('UPDATE case_pleadings SET filing_date = ?, document_url = ?, notes = ? WHERE id = ?',
      [filing_date, document_url || '', notes || '', req.params.id]);
    res.json(get('SELECT * FROM case_pleadings WHERE id = ?', [req.params.id]));
  } catch (err) {
    console.error('Error updating pleading:', err);
    res.status(500).json({ error: 'Failed to update pleading.' });
  }
};

// DELETE /api/pleadings/:id
exports.deletePleading = (req, res) => {
  try {
    const existing = get('SELECT cp.*, c.railway FROM case_pleadings cp JOIN cases c ON cp.case_id = c.id WHERE cp.id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Pleading not found.' });
    if (!checkCaseAccess(existing, req.user)) return res.status(403).json({ error: 'Access denied for this case.' });
    run('DELETE FROM case_pleadings WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Error deleting pleading:', err);
    res.status(500).json({ error: 'Failed to delete pleading.' });
  }
};
