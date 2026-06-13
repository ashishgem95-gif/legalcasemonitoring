const { run, all, get } = require('../config/dbHelper');

// POST /api/bulk/update
exports.bulkUpdate = (req, res) => {
  try {
    const { ids, action, value } = req.body;
    if (!ids || !ids.length) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    if (req.user && req.user.railwayScope !== 'All') {
      const placeholders = ids.map(() => '?').join(',');
      const cases = all(`SELECT id, railway FROM cases WHERE id IN (${placeholders})`, ids);
      const unauthorized = cases.filter(c => c.railway !== req.user.railwayScope);
      if (unauthorized.length > 0) {
        return res.status(403).json({ error: `Access denied to ${unauthorized.length} case(s) outside your zone.` });
      }
    }

    const placeholders = ids.map(() => '?').join(',');
    let result;
    let sql;

    if (action === 'update_status') {
      sql = `UPDATE cases SET present_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
      result = run(sql, [value || 'Pending', ...ids]);
    } else if (action === 'update_railway') {
      sql = `UPDATE cases SET railway = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
      result = run(sql, [value, ...ids]);
    } else if (action === 'delete') {
      sql = `DELETE FROM cases WHERE id IN (${placeholders})`;
      result = run(sql, ids);
    } else {
      return res.status(400).json({ error: 'Invalid action. Use: update_status, update_railway, or delete' });
    }

    res.json({ message: `Successfully ${action}d ${result.changes} cases`, affected: result.changes });
  } catch (err) {
    console.error('Bulk operation error:', err);
    res.status(500).json({ error: 'Failed to execute bulk operation' });
  }
};
