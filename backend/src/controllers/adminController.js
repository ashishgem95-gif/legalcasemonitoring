const { all, run, get } = require('../config/dbHelper');
const { logger } = require('../config/logger');

exports.getFileActivity = (req, res) => {
  try {
    const user = get('SELECT last_seen_alerts_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const since = user.last_seen_alerts_at || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const uploads = all(`
      SELECT 'UPLOAD' as action, d.id, d.case_id, c.case_ref_no,
             d.original_name, d.uploaded_by, d.created_at
      FROM case_documents d
      LEFT JOIN cases c ON c.id = d.case_id
      WHERE d.created_at > ?
      ORDER BY d.created_at DESC LIMIT 50
    `, [since]);
    
    const deletes = all(`
      SELECT 'DELETE' as action, a.target_id as id,
             json_extract(a.details, '$.case_id') as case_id,
             c.case_ref_no, json_extract(a.details, '$.original_name') as original_name,
             a.user_id as uploaded_by, a.created_at
      FROM audit_log a
      LEFT JOIN cases c ON c.id = json_extract(a.details, '$.case_id')
      WHERE a.action = 'DELETE_DOCUMENT' AND a.created_at > ?
      ORDER BY a.created_at DESC LIMIT 50
    `, [since]);

    const combined = [...uploads, ...deletes].sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );

    res.json(combined);
  } catch (err) {
    logger.error({ error: err.message }, 'Get file activity failed');
    res.status(500).json({ error: err.message });
  }
};

exports.markAlertsSeen = (req, res) => {
  try {
    run('UPDATE users SET last_seen_alerts_at = CURRENT_TIMESTAMP WHERE id = ?', [req.user.id]);
    res.json({ success: true, markedAt: new Date().toISOString() });
  } catch (err) {
    logger.error({ error: err.message }, 'Mark alerts seen failed');
    res.status(500).json({ error: err.message });
  }
};
