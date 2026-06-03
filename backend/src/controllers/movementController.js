const db = require('../config/database');

/**
 * Get file movements, optionally filtered by file ID
 */
exports.getMovements = (req, res) => {
  const { file_id } = req.query;
  
  let query = `
    SELECT fm.*, pf.file_number, pf.subject,
           c1.name AS from_custodian_name, c1.designation AS from_custodian_designation,
           c2.name AS to_custodian_name, c2.designation AS to_custodian_designation
    FROM file_movements fm
    INNER JOIN physical_files pf ON fm.file_id = pf.id
    LEFT JOIN personnel c1 ON fm.from_custodian_id = c1.id
    INNER JOIN personnel c2 ON fm.to_custodian_id = c2.id
  `;
  const params = [];

  if (file_id) {
    query += ' WHERE fm.file_id = ?';
    params.push(file_id);
  }

  query += ' ORDER BY fm.movement_date DESC, fm.id DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching movements:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve movements log' });
    }
    res.json(rows);
  });
};

/**
 * Record a new physical file movement (dispatch)
 */
exports.createMovement = (req, res) => {
  const { file_id, to_custodian_id, movement_date, purpose, remarks } = req.body;

  if (!file_id || !to_custodian_id || !movement_date) {
    return res.status(400).json({ error: 'File, Recipient Custodian, and Dispatch Date are required.' });
  }

  // Retrieve current custodian of the file to use as from_custodian_id
  const fileQuery = 'SELECT currently_with_id, status FROM physical_files WHERE id = ?';
  db.get(fileQuery, [file_id], (err, file) => {
    if (err) {
      console.error('Error finding file for movement:', err.message);
      return res.status(500).json({ error: 'Failed to record file movement' });
    }
    if (!file) {
      return res.status(404).json({ error: 'Physical file not found' });
    }

    const fromCustodianId = file.currently_with_id;

    // Check if dispatching to the same person
    if (fromCustodianId === parseInt(to_custodian_id)) {
      return res.status(400).json({ error: 'The file is already in the custody of this person.' });
    }

    db.serialize(() => {
      // Begin recording the movement
      const insertMovementQuery = `
        INSERT INTO file_movements (file_id, from_custodian_id, to_custodian_id, movement_date, purpose, remarks)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.run(insertMovementQuery, [file_id, fromCustodianId, to_custodian_id, movement_date, purpose || '', remarks || ''], function(mErr) {
        if (mErr) {
          console.error('Error logging file movement:', mErr.message);
          return res.status(500).json({ error: 'Failed to log file movement' });
        }

        const newMovementId = this.lastID;

        // Update the file's current custodian and set status to 'ACTIVE' or 'CHECKED_OUT' (if transferred)
        const updateFileQuery = `
          UPDATE physical_files
          SET currently_with_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        db.run(updateFileQuery, [to_custodian_id, file_id], (uErr) => {
          if (uErr) {
            console.error('Error updating file custodian:', uErr.message);
            return res.status(500).json({ error: 'Failed to update file custodian record' });
          }

          res.status(201).json({
            id: newMovementId,
            file_id,
            from_custodian_id: fromCustodianId,
            to_custodian_id,
            movement_date,
            purpose,
            remarks
          });
        });
      });
    });
  });
};
