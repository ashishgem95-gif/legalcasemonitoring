const { all } = require('../config/dbHelper');

// GET /api/audit-log
exports.getAuditLog = (req, res) => {
  try {
    const { user_id, target_type, target_id, limit } = req.query;
    let query = `SELECT a.*, u.name as user_name
      FROM audit_log a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1`;
    const params = [];

    if (user_id) { query += ' AND a.user_id = ?'; params.push(user_id); }
    if (target_type) { query += ' AND a.target_type = ?'; params.push(target_type); }
    if (target_id) { query += ' AND a.target_id = ?'; params.push(parseInt(target_id)); }

    query += ' ORDER BY a.created_at DESC LIMIT ?';
    params.push(parseInt(limit) || 100);

    res.json(all(query, params));
  } catch (err) {
    console.error('Error fetching audit log:', err);
    res.status(500).json({ error: 'Failed to retrieve audit log' });
  }
};
