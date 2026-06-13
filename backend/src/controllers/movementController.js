const { run, get, all } = require('../config/dbHelper');

// GET /api/file-movements
exports.getMovements = (req, res) => {
  try {
    const { file_id } = req.query;
    let query = `
      SELECT fm.*, pf.file_number, pf.subject,
             c1.name AS from_custodian_name, c1.designation AS from_custodian_designation,
             c2.name AS to_custodian_name, c2.designation AS to_custodian_designation
      FROM file_movements fm
      INNER JOIN physical_files pf ON fm.file_id = pf.id
      LEFT JOIN personnel c1 ON fm.from_custodian_id = c1.id
      INNER JOIN personnel c2 ON fm.to_custodian_id = c2.id
      WHERE 1=1
    `;
    const params = [];
    if (file_id) {
      query += ' AND fm.file_id = ?';
      params.push(file_id);
    }
    if (req._railwayScope) {
      query += ' AND pf.zonal_railway = ?';
      params.push(req._railwayScope);
    }
    query += ' ORDER BY fm.movement_date DESC, fm.id DESC';
    res.json(all(query, params));
  } catch (err) {
    console.error('Error fetching movements:', err.message);
    res.status(500).json({ error: 'Failed to retrieve movements log' });
  }
};

// POST /api/file-movements
exports.createMovement = (req, res) => {
  try {
    const { file_id, to_custodian_id, movement_date, purpose, remarks } = req.body;

    if (!file_id || !to_custodian_id || !movement_date) {
      return res.status(400).json({ error: 'File, Recipient Custodian, and Dispatch Date are required.' });
    }

    const file = get('SELECT currently_with_id, status FROM physical_files WHERE id = ?', [file_id]);
    if (!file) {
      return res.status(404).json({ error: 'Physical file not found' });
    }

    const fromCustodianId = file.currently_with_id;
    if (fromCustodianId === parseInt(to_custodian_id)) {
      return res.status(400).json({ error: 'The file is already in the custody of this person.' });
    }

    const result = run(
      'INSERT INTO file_movements (file_id, from_custodian_id, to_custodian_id, movement_date, purpose, remarks) VALUES (?, ?, ?, ?, ?, ?)',
      [file_id, fromCustodianId, to_custodian_id, movement_date, purpose || '', remarks || '']
    );

    run(
      'UPDATE physical_files SET currently_with_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [to_custodian_id, file_id]
    );

    res.status(201).json({
      id: result.id, file_id, from_custodian_id: fromCustodianId, to_custodian_id, movement_date, purpose, remarks
    });
  } catch (err) {
    console.error('Error logging file movement:', err.message);
    res.status(500).json({ error: 'Failed to log file movement' });
  }
};
