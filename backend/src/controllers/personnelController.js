const { run, all } = require('../config/dbHelper');

// GET /api/personnel
exports.getPersonnel = (req, res) => {
  try {
    res.json(all('SELECT * FROM personnel ORDER BY name ASC'));
  } catch (err) {
    console.error('Error fetching personnel:', err.message);
    res.status(500).json({ error: 'Failed to retrieve personnel' });
  }
};

// POST /api/personnel
exports.createPersonnel = (req, res) => {
  try {
    const { name, designation, department, contact_no, email } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is a required field' });
    }
    const result = run(
      'INSERT INTO personnel (name, designation, department, contact_no, email) VALUES (?, ?, ?, ?, ?)',
      [name, designation || '', department || '', contact_no || '', email || '']
    );
    res.status(201).json({ id: result.id, name, designation, department, contact_no, email });
  } catch (err) {
    console.error('Error creating personnel:', err.message);
    res.status(500).json({ error: 'Failed to add personnel' });
  }
};

// PUT /api/personnel/:id
exports.updatePersonnel = (req, res) => {
  try {
    const { name, designation, department, contact_no, email } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is a required field' });
    }
    run(
      'UPDATE personnel SET name = ?, designation = ?, department = ?, contact_no = ?, email = ? WHERE id = ?',
      [name, designation || '', department || '', contact_no || '', email || '', req.params.id]
    );
    res.json({ id: parseInt(req.params.id), name, designation, department, contact_no, email });
  } catch (err) {
    console.error('Error updating personnel:', err.message);
    res.status(500).json({ error: 'Failed to update personnel' });
  }
};

// DELETE /api/personnel/:id
exports.deletePersonnel = (req, res) => {
  try {
    run('DELETE FROM personnel WHERE id = ?', [req.params.id]);
    res.json({ message: 'Personnel deleted successfully' });
  } catch (err) {
    console.error('Error deleting personnel:', err.message);
    res.status(500).json({ error: 'Failed to delete personnel' });
  }
};
