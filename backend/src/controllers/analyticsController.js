const { get, all } = require('../config/dbHelper');

// GET /api/analytics/dashboard
exports.getDashboard = (req, res) => {
  try {
    const total = get('SELECT COUNT(*) as c FROM cases').c;
    const active = get("SELECT COUNT(*) as c FROM cases WHERE present_status IS NULL OR present_status = 'Pending'").c;
    const disposed = get("SELECT COUNT(*) as c FROM cases WHERE present_status = 'Disposed'").c;
    const pendingReplies = get('SELECT COUNT(*) as c FROM cases WHERE last_date_reply IS NOT NULL AND date_filing_reply IS NULL').c;

    const today = new Date().toISOString().split('T')[0];
    const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const upcomingHearings = get(
      'SELECT COUNT(*) as c FROM hearing_history WHERE hearing_date BETWEEN ? AND ?',
      [today, weekEnd]
    ).c;

    // Case type breakdown
    const byType = all(
      'SELECT case_type, COUNT(*) as count FROM cases GROUP BY case_type ORDER BY count DESC'
    );

    // Monthly trend (last 12 months)
    const monthlyTrend = all(
      `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
       FROM cases
       WHERE created_at >= DATE('now', '-12 months')
       GROUP BY month ORDER BY month`
    );

    // Forum distribution
    const byForum = all(
      'SELECT forum, COUNT(*) as count FROM cases GROUP BY forum ORDER BY count DESC'
    );

    // Age distribution
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
       FROM cases GROUP BY age_bucket ORDER BY age_bucket`
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
