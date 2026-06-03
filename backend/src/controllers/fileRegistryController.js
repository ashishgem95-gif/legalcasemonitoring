const db = require('../config/database');

/**
 * Get physical files with filters (search, status, rack_shelf)
 */
exports.getFiles = (req, res) => {
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
      pf.file_number LIKE ? 
      OR pf.subject LIKE ? 
      OR pf.description LIKE ? 
      OR pf.zonal_railway LIKE ? 
      OR c.name LIKE ?
    )`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
  }

  query += ' ORDER BY pf.file_number ASC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching physical files:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve physical files' });
    }
    res.json(rows);
  });
};

/**
 * Get a specific physical file by ID including its movement history
 */
exports.getFileById = (req, res) => {
  const { id } = req.params;

  const fileQuery = `
    SELECT pf.*, c.name AS currently_with_name, c.designation AS currently_with_designation, c.department AS currently_with_department
    FROM physical_files pf
    LEFT JOIN personnel c ON pf.currently_with_id = c.id
    WHERE pf.id = ?
  `;

  db.get(fileQuery, [id], (err, file) => {
    if (err) {
      console.error('Error fetching file details:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve file details' });
    }
    if (!file) {
      return res.status(404).json({ error: 'Physical file not found' });
    }

    const movementsQuery = `
      SELECT fm.*, 
             c1.name AS from_custodian_name, c1.designation AS from_custodian_designation,
             c2.name AS to_custodian_name, c2.designation AS to_custodian_designation
      FROM file_movements fm
      LEFT JOIN personnel c1 ON fm.from_custodian_id = c1.id
      INNER JOIN personnel c2 ON fm.to_custodian_id = c2.id
      WHERE fm.file_id = ?
      ORDER BY fm.movement_date DESC, fm.id DESC
    `;

    db.all(movementsQuery, [id], (err, movements) => {
      if (err) {
        console.error('Error fetching file movements:', err.message);
        return res.status(500).json({ error: 'Failed to retrieve movement history' });
      }
      file.movements = movements;
      res.json(file);
    });
  });
};

/**
 * Create a new physical file and log its initial placement/movement
 */
exports.createFile = (req, res) => {
  const { file_number, subject, description, currently_with_id, zonal_railway, status } = req.body;

  if (!file_number || !subject) {
    return res.status(400).json({ error: 'File Number and Subject are required fields' });
  }

  const query = `
    INSERT INTO physical_files (file_number, subject, description, currently_with_id, zonal_railway, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const fileStatus = status || 'ACTIVE';

  db.run(query, [file_number, subject, description || '', currently_with_id || null, zonal_railway || '', fileStatus], function(err) {
    if (err) {
      console.error('Error creating physical file:', err.message);
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'A file with this File Number already exists.' });
      }
      return res.status(500).json({ error: 'Failed to create physical file' });
    }

    const newFileId = this.lastID;

    // If an initial custodian is assigned, create an initial movement log
    if (currently_with_id) {
      const today = new Date().toISOString().split('T')[0];
      const movementQuery = `
        INSERT INTO file_movements (file_id, from_custodian_id, to_custodian_id, movement_date, purpose, remarks)
        VALUES (?, NULL, ?, ?, ?, ?)
      `;
      db.run(movementQuery, [newFileId, currently_with_id, today, 'Initial Registry Entry', 'File entered into system register.'], (mErr) => {
        if (mErr) {
          console.error('Error creating initial movement log:', mErr.message);
        }
      });
    }

    res.status(201).json({
      id: newFileId,
      file_number,
      subject,
      description,
      currently_with_id,
      zonal_railway,
      status: fileStatus
    });
  });
};

/**
 * Update an existing physical file and auto-log custody change if modified
 */
exports.updateFile = (req, res) => {
  const { id } = req.params;
  const { file_number, subject, description, currently_with_id, zonal_railway, status } = req.body;

  if (!file_number || !subject) {
    return res.status(400).json({ error: 'File Number and Subject are required fields' });
  }

  // Get original file to check if custodian has changed
  db.get('SELECT currently_with_id FROM physical_files WHERE id = ?', [id], (err, original) => {
    if (err) {
      console.error('Error fetching original file for update:', err.message);
      return res.status(500).json({ error: 'Failed to update physical file' });
    }
    if (!original) {
      return res.status(404).json({ error: 'Physical file not found' });
    }

    const originalCustodian = original.currently_with_id;
    const newCustodian = currently_with_id || null;

    const updateQuery = `
      UPDATE physical_files
      SET file_number = ?, subject = ?, description = ?, currently_with_id = ?, zonal_railway = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    db.run(updateQuery, [file_number, subject, description || '', newCustodian, zonal_railway || '', status || 'ACTIVE', id], function(uErr) {
      if (uErr) {
        console.error('Error updating physical file:', uErr.message);
        if (uErr.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'A file with this File Number already exists.' });
        }
        return res.status(500).json({ error: 'Failed to update physical file' });
      }

      // If the custodian changed, log a movement entry
      if (originalCustodian !== newCustodian && newCustodian !== null) {
        const today = new Date().toISOString().split('T')[0];
        const movementQuery = `
          INSERT INTO file_movements (file_id, from_custodian_id, to_custodian_id, movement_date, purpose, remarks)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        db.run(movementQuery, [id, originalCustodian, newCustodian, today, 'Custodian changed via File Edit', 'Updated in the file registry details form.'], (mErr) => {
          if (mErr) {
            console.error('Error logging file edit movement:', mErr.message);
          }
        });
      }

      res.json({
        id: parseInt(id),
        file_number,
        subject,
        description,
        currently_with_id: newCustodian,
        zonal_railway,
        status
      });
    });
  });
};

/**
 * Delete an existing physical file
 */
exports.deleteFile = (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM physical_files WHERE id = ?';
  db.run(query, [id], function(err) {
    if (err) {
      console.error('Error deleting physical file:', err.message);
      return res.status(500).json({ error: 'Failed to delete physical file' });
    }
    res.json({ message: 'Physical file deleted successfully' });
  });
};
