const db = require('../config/database');

/**
 * Get all personnel
 */
exports.getPersonnel = (req, res) => {
  const query = 'SELECT * FROM personnel ORDER BY name ASC';
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching personnel:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve personnel' });
    }
    res.json(rows);
  });
};

/**
 * Add a new personnel member
 */
exports.createPersonnel = (req, res) => {
  const { name, designation, department, contact_no, email } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is a required field' });
  }

  const query = 'INSERT INTO personnel (name, designation, department, contact_no, email) VALUES (?, ?, ?, ?, ?)';
  db.run(query, [name, designation || '', department || '', contact_no || '', email || ''], function(err) {
    if (err) {
      console.error('Error creating personnel:', err.message);
      return res.status(500).json({ error: 'Failed to add personnel' });
    }
    
    res.status(201).json({
      id: this.lastID,
      name,
      designation,
      department,
      contact_no,
      email
    });
  });
};

/**
 * Update personnel details
 */
exports.updatePersonnel = (req, res) => {
  const { id } = req.params;
  const { name, designation, department, contact_no, email } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is a required field' });
  }

  const query = 'UPDATE personnel SET name = ?, designation = ?, department = ?, contact_no = ?, email = ? WHERE id = ?';
  db.run(query, [name, designation || '', department || '', contact_no || '', email || '', id], function(err) {
    if (err) {
      console.error('Error updating personnel:', err.message);
      return res.status(500).json({ error: 'Failed to update personnel' });
    }
    
    res.json({
      id: parseInt(id),
      name,
      designation,
      department,
      contact_no,
      email
    });
  });
};

/**
 * Delete a personnel member
 */
exports.deletePersonnel = (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM personnel WHERE id = ?';
  db.run(query, [id], function(err) {
    if (err) {
      console.error('Error deleting personnel:', err.message);
      return res.status(500).json({ error: 'Failed to delete personnel' });
    }
    res.json({ message: 'Personnel deleted successfully' });
  });
};
