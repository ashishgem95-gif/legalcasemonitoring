const { run, get, all } = require('../config/dbHelper');
const { summarizeOrder } = require('../services/summarizer');

function checkCaseAccess(caseRecord, user) {
  if (!user || user.railwayScope === 'All') return true;
  return caseRecord.railway === user.railwayScope;
}

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
    const { hearing_date, order_raw_text, order_uploaded } = req.body;

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

    const uploaded = order_uploaded === true ? 1 : 0;

    const result = run(
      'INSERT INTO hearing_history (case_id, hearing_date, order_raw_text, order_summary, order_uploaded) VALUES (?, ?, ?, ?, ?)',
      [caseId, hearing_date, order_raw_text || '', order_summary, uploaded]
    );
    const newHearing = get('SELECT * FROM hearing_history WHERE id = ?', [result.id]);
    res.status(201).json(newHearing);
  } catch (err) {
    console.error('Error adding hearing:', err);
    res.status(500).json({ error: 'Failed to add hearing record.' });
  }
};

// PATCH /api/cases/:caseId/hearings/:hearingId/order-uploaded
const setHearingOrderUploaded = async (req, res) => {
  try {
    const { caseId, hearingId } = req.params;
    const { order_uploaded } = req.body;
    if (typeof order_uploaded !== 'boolean') {
      return res.status(400).json({ error: 'order_uploaded must be a boolean' });
    }

    const caseRecord = get('SELECT id, railway FROM cases WHERE id = ?', [caseId]);
    if (!caseRecord) return res.status(404).json({ error: 'Case not found.' });

    if (!checkCaseAccess(caseRecord, req.user)) {
      return res.status(403).json({ error: 'Access denied for this case.' });
    }

    const hearing = get('SELECT id, case_id FROM hearing_history WHERE id = ?', [hearingId]);
    if (!hearing || hearing.case_id !== Number(caseId)) {
      return res.status(404).json({ error: 'Hearing not found for this case.' });
    }

    run('UPDATE hearing_history SET order_uploaded = ? WHERE id = ?',
      [order_uploaded ? 1 : 0, hearingId]);

    res.json({ success: true, hearing_id: Number(hearingId), order_uploaded });
  } catch (err) {
    console.error('Error setting order_uploaded:', err);
    res.status(500).json({ error: 'Failed to update order_uploaded.' });
  }
};

module.exports = { getHearingsForCase, addHearingToCase, setHearingOrderUploaded };
