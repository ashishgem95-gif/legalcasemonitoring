const { run, get, all } = require('../config/dbHelper');

// GET /api/physical-files
exports.getFiles = (req, res) => {
  try {
    const { search, status, zonal_railway } = req.query;
    let query = `
      SELECT pf.*, c.name AS currently_with_name, c.designation AS currently_with_designation, c.department AS currently_with_department
      FROM physical_files pf
      LEFT JOIN personnel c ON pf.currently_with_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'All Statuses') {
      query += ' AND pf.status = ?';
      params.push(status);
    }

    if (zonal_railway && zonal_railway !== 'All Locations') {
      query += ' AND pf.zonal_railway LIKE ?';
      params.push(`%${zonal_railway}%`);
    }

    if (search) {
      query += ` AND (
        pf.file_number LIKE ? OR pf.subject LIKE ? OR pf.description LIKE ?
        OR pf.zonal_railway LIKE ? OR c.name LIKE ?
      )`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    query += ' ORDER BY pf.file_number ASC';
    res.json(all(query, params));
  } catch (err) {
    console.error('Error fetching physical files:', err.message);
    res.status(500).json({ error: 'Failed to retrieve physical files' });
  }
};

// GET /api/physical-files/:id
exports.getFileById = (req, res) => {
  try {
    const file = get(`
      SELECT pf.*, c.name AS currently_with_name, c.designation AS currently_with_designation, c.department AS currently_with_department
      FROM physical_files pf
      LEFT JOIN personnel c ON pf.currently_with_id = c.id
      WHERE pf.id = ?
    `, [req.params.id]);

    if (!file) {
      return res.status(404).json({ error: 'Physical file not found' });
    }

    file.movements = all(`
      SELECT fm.*,
             c1.name AS from_custodian_name, c1.designation AS from_custodian_designation,
             c2.name AS to_custodian_name, c2.designation AS to_custodian_designation
      FROM file_movements fm
      LEFT JOIN personnel c1 ON fm.from_custodian_id = c1.id
      INNER JOIN personnel c2 ON fm.to_custodian_id = c2.id
      WHERE fm.file_id = ?
      ORDER BY fm.movement_date DESC, fm.id DESC
    `, [req.params.id]);

    res.json(file);
  } catch (err) {
    console.error('Error fetching file details:', err.message);
    res.status(500).json({ error: 'Failed to retrieve file details' });
  }
};

// POST /api/physical-files
exports.createFile = (req, res) => {
  try {
    const { file_number, subject, description, currently_with_id, zonal_railway, status } = req.body;
    if (!file_number || !subject) {
      return res.status(400).json({ error: 'File Number and Subject are required fields' });
    }

    const fileStatus = status || 'ACTIVE';
    const result = run(
      'INSERT INTO physical_files (file_number, subject, description, currently_with_id, zonal_railway, status) VALUES (?, ?, ?, ?, ?, ?)',
      [file_number, subject, description || '', currently_with_id || null, zonal_railway || '', fileStatus]
    );

    if (currently_with_id) {
      const today = new Date().toISOString().split('T')[0];
      run(
        'INSERT INTO file_movements (file_id, from_custodian_id, to_custodian_id, movement_date, purpose, remarks) VALUES (?, NULL, ?, ?, ?, ?)',
        [result.id, currently_with_id, today, 'Initial Registry Entry', 'File entered into system register.']
      );
    }

    res.status(201).json({ id: result.id, file_number, subject, description, currently_with_id, zonal_railway, status: fileStatus });
  } catch (err) {
    console.error('Error creating physical file:', err.message);
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A file with this File Number already exists.' });
    }
    res.status(500).json({ error: 'Failed to create physical file' });
  }
};

// PUT /api/physical-files/:id
exports.updateFile = (req, res) => {
  try {
    const { id } = req.params;
    const { file_number, subject, description, currently_with_id, zonal_railway, status } = req.body;
    if (!file_number || !subject) {
      return res.status(400).json({ error: 'File Number and Subject are required fields' });
    }

    const original = get('SELECT currently_with_id FROM physical_files WHERE id = ?', [id]);
    if (!original) {
      return res.status(404).json({ error: 'Physical file not found' });
    }

    const originalCustodian = original.currently_with_id;
    const newCustodian = currently_with_id || null;

    run(
      `UPDATE physical_files
       SET file_number = ?, subject = ?, description = ?, currently_with_id = ?, zonal_railway = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [file_number, subject, description || '', newCustodian, zonal_railway || '', status || 'ACTIVE', id]
    );

    if (originalCustodian !== newCustodian && newCustodian !== null) {
      const today = new Date().toISOString().split('T')[0];
      run(
        'INSERT INTO file_movements (file_id, from_custodian_id, to_custodian_id, movement_date, purpose, remarks) VALUES (?, ?, ?, ?, ?, ?)',
        [id, originalCustodian, newCustodian, today, 'Custodian changed via File Edit', 'Updated in the file registry details form.']
      );
    }

    res.json({ id: parseInt(id), file_number, subject, description, currently_with_id: newCustodian, zonal_railway, status });
  } catch (err) {
    console.error('Error updating physical file:', err.message);
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A file with this File Number already exists.' });
    }
    res.status(500).json({ error: 'Failed to update physical file' });
  }
};

// DELETE /api/physical-files/:id
exports.deleteFile = (req, res) => {
  try {
    run('DELETE FROM physical_files WHERE id = ?', [req.params.id]);
    res.json({ message: 'Physical file deleted successfully' });
  } catch (err) {
    console.error('Error deleting physical file:', err.message);
    res.status(500).json({ error: 'Failed to delete physical file' });
  }
};
