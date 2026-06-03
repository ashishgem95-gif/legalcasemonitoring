const db = require('../config/database');

/**
 * Get citations with category and keyword search filters
 */
exports.getCitations = (req, res) => {
  const { category, search } = req.query;
  let query = 'SELECT * FROM citations WHERE 1=1';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ? OR where_to_cite LIKE ?)';
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching citations:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve citations' });
    }
    res.json(rows);
  });
};

/**
 * Add a new legal citation
 */
exports.createCitation = (req, res) => {
  const { category, title, description, where_to_cite } = req.body;

  if (!category || !title) {
    return res.status(400).json({ error: 'Category and Title are required fields' });
  }

  const query = 'INSERT INTO citations (category, title, description, where_to_cite) VALUES (?, ?, ?, ?)';
  db.run(query, [category, title, description || '', where_to_cite || ''], function(err) {
    if (err) {
      console.error('Error creating citation:', err.message);
      return res.status(500).json({ error: 'Failed to add citation' });
    }
    
    res.status(201).json({
      id: this.lastID,
      category,
      title,
      description,
      where_to_cite
    });
  });
};

/**
 * Update an existing legal citation
 */
exports.updateCitation = (req, res) => {
  const { id } = req.params;
  const { category, title, description, where_to_cite } = req.body;

  if (!category || !title) {
    return res.status(400).json({ error: 'Category and Title are required fields' });
  }

  const query = 'UPDATE citations SET category = ?, title = ?, description = ?, where_to_cite = ? WHERE id = ?';
  db.run(query, [category, title, description || '', where_to_cite || '', id], function(err) {
    if (err) {
      console.error('Error updating citation:', err.message);
      return res.status(500).json({ error: 'Failed to update citation' });
    }
    
    res.json({
      id: parseInt(id),
      category,
      title,
      description,
      where_to_cite
    });
  });
};

/**
 * Delete an existing legal citation
 */
exports.deleteCitation = (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM citations WHERE id = ?';
  db.run(query, [id], function(err) {
    if (err) {
      console.error('Error deleting citation:', err.message);
      return res.status(500).json({ error: 'Failed to delete citation' });
    }
    
    res.json({ message: 'Citation deleted successfully' });
  });
};
