const { get, all } = require('../config/dbHelper');

// GET /api/reports/case-summary
exports.getCaseSummary = (req, res) => {
  try {
    const { railway, from_date, to_date } = req.query;
    let query = `SELECT c.*, h.next_hearing
      FROM cases c
      LEFT JOIN (SELECT case_id, MAX(hearing_date) as next_hearing FROM hearing_history GROUP BY case_id) h
        ON c.id = h.case_id
      WHERE 1=1`;
    const params = [];

    if (railway) { query += ' AND c.railway = ?'; params.push(railway); }
    if (from_date) { query += ' AND c.created_at >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND c.created_at <= ?'; params.push(to_date); }

    query += ' ORDER BY c.updated_at DESC';

    res.json(all(query, params));
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

// GET /api/reports/hearing-calendar
exports.getHearingCalendar = (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const from = from_date || new Date().toISOString().split('T')[0];
    const to = to_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let hearingQuery = `SELECT h.*, c.case_ref_no, c.applicant, c.respondent, c.forum, c.railway
       FROM hearing_history h
       JOIN cases c ON h.case_id = c.id
       WHERE h.hearing_date BETWEEN ? AND ?`;
    const hearingParams = [from, to];
    if (req._railwayScope) {
      hearingQuery += ' AND c.railway = ?';
      hearingParams.push(req._railwayScope);
    }
    hearingQuery += ' ORDER BY h.hearing_date ASC';
    const hearings = all(hearingQuery, hearingParams);

    res.json(hearings);
  } catch (err) {
    console.error('Calendar error:', err);
    res.status(500).json({ error: 'Failed to generate hearing calendar' });
  }
};

// GET /api/reports/zone-distribution
exports.getZoneDistribution = (req, res) => {
  try {
    let zonesQuery = `SELECT railway, COUNT(*) as total,
        SUM(CASE WHEN present_status = 'Disposed' THEN 1 ELSE 0 END) as disposed,
        SUM(CASE WHEN present_status = 'Pending' OR present_status IS NULL THEN 1 ELSE 0 END) as pending
       FROM cases`;
    const zonesParams = [];
    if (req._railwayScope) {
      zonesQuery += ' WHERE railway = ?';
      zonesParams.push(req._railwayScope);
    }
    zonesQuery += ' GROUP BY railway ORDER BY total DESC';
    const zones = all(zonesQuery, zonesParams);
    res.json(zones);
  } catch (err) {
    console.error('Zone distribution error:', err);
    res.status(500).json({ error: 'Failed to generate zone distribution' });
  }
};

// GET /api/reports/export
exports.exportCases = (req, res) => {
  try {
    const { railway, format } = req.query;
    let query = `SELECT case_ref_no, railway, applicant, respondent, case_type, case_number, case_year,
      forum, present_status, last_date_reply, date_filing_reply, nodal_officer_name
      FROM cases WHERE 1=1`;
    const params = [];
    if (railway) { query += ' AND railway = ?'; params.push(railway); }
    query += ' ORDER BY case_ref_no';

    const rows = all(query, params);

    if (format === 'csv') {
      const headers = Object.keys(rows[0] || {}).join(',');
      const csvRows = rows.map(r => Object.values(r).map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=cases_export.csv');
      return res.send([headers, ...csvRows].join('\n'));
    }

    res.json(rows);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export cases' });
  }
};
