const { run, all } = require('../config/dbHelper');

// POST /api/bulk/update
exports.bulkUpdate = (req, res) => {
  try {
    const { ids, action, value } = req.body;
    if (!ids || !ids.length) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const placeholders = ids.map(() => '?').join(',');

    let sql;
    if (action === 'update_status') {
      sql = `UPDATE cases SET present_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
      run(sql, [value || 'Pending', ...ids]);
    } else if (action === 'update_railway') {
      sql = `UPDATE cases SET railway = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
      run(sql, [value, ...ids]);
    } else if (action === 'delete') {
      sql = `DELETE FROM cases WHERE id IN (${placeholders})`;
      run(sql, ids);
    } else {
      return res.status(400).json({ error: 'Invalid action. Use: update_status, update_railway, or delete' });
    }

    res.json({ message: `Successfully ${action}d ${ids.length} cases`, affected: ids.length });
  } catch (err) {
    console.error('Bulk operation error:', err);
    res.status(500).json({ error: 'Failed to execute bulk operation' });
  }
};
