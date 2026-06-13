const { get, all } = require('../config/dbHelper');

// GET /api/analytics/dashboard
exports.getDashboard = (req, res) => {
  try {
    const scopeFilter = req._railwayScope ? ' AND railway = ?' : '';
    const scopeParams = req._railwayScope ? [req._railwayScope] : [];

    const total = get(`SELECT COUNT(*) as c FROM cases WHERE 1=1 ${scopeFilter}`, scopeParams).c;
    const active = get(`SELECT COUNT(*) as c FROM cases WHERE (present_status IS NULL OR present_status = 'Pending') ${scopeFilter}`, scopeParams).c;
    const disposed = get(`SELECT COUNT(*) as c FROM cases WHERE present_status = 'Disposed' ${scopeFilter}`, scopeParams).c;
    const pendingReplies = get(`SELECT COUNT(*) as c FROM cases WHERE last_date_reply IS NOT NULL AND date_filing_reply IS NULL ${scopeFilter}`, scopeParams).c;

    const today = new Date().toISOString().split('T')[0];
    const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const upcomingHearings = get(
      `SELECT COUNT(*) as c FROM hearing_history h JOIN cases c ON h.case_id = c.id WHERE h.hearing_date BETWEEN ? AND ?${req._railwayScope ? ' AND c.railway = ?' : ''}`,
      [today, weekEnd, ...scopeParams]
    ).c;

    const byType = all(
      `SELECT case_type, COUNT(*) as count FROM cases WHERE 1=1 ${scopeFilter} GROUP BY case_type ORDER BY count DESC`,
      scopeParams
    );

    const monthlyTrend = all(
      `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
       FROM cases
       WHERE created_at >= DATE('now', '-12 months') ${scopeFilter}
       GROUP BY month ORDER BY month`,
      scopeParams
    );

    const byForum = all(
      `SELECT forum, COUNT(*) as count FROM cases WHERE 1=1 ${scopeFilter} GROUP BY forum ORDER BY count DESC`,
      scopeParams
    );

    const ageDistribution = all(
      `SELECT
        CASE
          WHEN created_at >= DATE('now', '-30 days') THEN '30d'
          WHEN created_at >= DATE('now', '-90 days') THEN '90d'
          WHEN created_at >= DATE('now', '-180 days') THEN '180d'
          WHEN created_at >= DATE('now', '-365 days') THEN '1yr'
          ELSE '1yr+'
        END as age_bucket,
        COUNT(*) as count
       FROM cases WHERE 1=1 ${scopeFilter} GROUP BY age_bucket ORDER BY age_bucket`,
      scopeParams
    );

    res.json({
      total, active, disposed, pendingReplies, upcomingHearings,
      byType, monthlyTrend, byForum, ageDistribution
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
};

// GET /api/analytics/health
exports.getSystemHealth = (req, res) => {
  try {
    const { db } = require('../config/database');
    const dbSize = get('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()');

    const alerts = get('SELECT COUNT(*) as c FROM case_alerts WHERE is_read = 0').c;
    const users = get('SELECT COUNT(*) as c FROM users').c;
    const casesWithLinks = get('SELECT COUNT(*) as c FROM cases WHERE court_link IS NOT NULL AND court_link != \'\'').c;

    res.json({
      database: { sizeBytes: dbSize?.size || 0 },
      alerts: { unread: alerts },
      users: { total: users },
      scraper: { casesWithLinks }
    });
  } catch (err) {
    console.error('Health error:', err);
    res.status(500).json({ error: 'Failed to get system health' });
  }
};
