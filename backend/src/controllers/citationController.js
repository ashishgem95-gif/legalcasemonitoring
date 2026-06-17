const { run, get, all } = require('../config/dbHelper');
const pdfParse = require('pdf-parse');
const { parseCitationFromText } = require('../services/citationParser');

// GET /api/citations
exports.getCitations = (req, res) => {
  try {
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
    res.json(all(query, params));
  } catch (err) {
    console.error('Error fetching citations:', err.message);
    res.status(500).json({ error: 'Failed to retrieve citations' });
  }
};

// POST /api/citations
exports.createCitation = (req, res) => {
  try {
    const { category, title, description, where_to_cite } = req.body;
    if (!category || !title) {
      return res.status(400).json({ error: 'Category and Title are required fields' });
    }
    const result = run(
      'INSERT INTO citations (category, title, description, where_to_cite) VALUES (?, ?, ?, ?)',
      [category, title, description || '', where_to_cite || '']
    );
    res.status(201).json({ id: result.id, category, title, description, where_to_cite });
  } catch (err) {
    console.error('Error creating citation:', err.message);
    res.status(500).json({ error: 'Failed to add citation' });
  }
};

// PUT /api/citations/:id
exports.updateCitation = (req, res) => {
  try {
    const { category, title, description, where_to_cite } = req.body;
    if (!category || !title) {
      return res.status(400).json({ error: 'Category and Title are required fields' });
    }
    run(
      'UPDATE citations SET category = ?, title = ?, description = ?, where_to_cite = ? WHERE id = ?',
      [category, title, description || '', where_to_cite || '', req.params.id]
    );
    res.json({ id: parseInt(req.params.id), category, title, description, where_to_cite });
  } catch (err) {
    console.error('Error updating citation:', err.message);
    res.status(500).json({ error: 'Failed to update citation' });
  }
};

// DELETE /api/citations/:id
exports.deleteCitation = (req, res) => {
  try {
    run('DELETE FROM citations WHERE id = ?', [req.params.id]);
    res.json({ message: 'Citation deleted successfully' });
  } catch (err) {
    console.error('Error deleting citation:', err.message);
    res.status(500).json({ error: 'Failed to delete citation' });
  }
};

// POST /api/citations/parse-pdf
exports.parseCitationPdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Failed to extract text from PDF. The document might be scanned as an image. Try a text-searchable PDF.' });
    }
    const result = await parseCitationFromText(text, req.headers);
    if (result.error) {
      return res.status(422).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('Error parsing citation PDF:', err.message);
    res.status(500).json({ error: 'Failed to analyze the PDF. Please try again or enter details manually.' });
  }
};
