const { run, get, all } = require('../config/dbHelper');

// GET /api/view-presets
exports.getPresets = (req, res) => {
  try {
    const userId = req.user.id;
    const presets = all(
      'SELECT id, name, config, created_at, updated_at FROM view_presets WHERE user_id = ? ORDER BY name',
      [userId]
    );
    res.json(presets.map(p => {
      let config = {};
      try { config = JSON.parse(p.config); } catch (e) { config = {}; }
      return { ...p, config };
    }));
  } catch (err) {
    console.error('Error fetching presets:', err);
    res.status(500).json({ error: 'Failed to retrieve view presets' });
  }
};

// POST /api/view-presets
exports.createPreset = (req, res) => {
  try {
    const { name, columns, filters } = req.body;
    if (!name) return res.status(400).json({ error: 'Preset name is required' });

    const config = JSON.stringify({ columns, filters });
    const result = run(
      'INSERT INTO view_presets (user_id, name, config) VALUES (?, ?, ?)',
      [req.user.id, name, config]
    );
    res.status(201).json({ id: result.id, name, config: { columns, filters } });
  } catch (err) {
    console.error('Error creating preset:', err);
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'A preset with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create view preset' });
  }
};

// DELETE /api/view-presets/:id
exports.deletePreset = (req, res) => {
  try {
    run('DELETE FROM view_presets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Preset deleted' });
  } catch (err) {
    console.error('Error deleting preset:', err);
    res.status(500).json({ error: 'Failed to delete view preset' });
  }
};
