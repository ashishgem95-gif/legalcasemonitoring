const { get, all } = require('../config/dbHelper');
const { istToday, istDateOffset } = require('../config/constants');

// GET /api/analytics/dashboard
exports.getDashboard = (req, res) => {
  try {
    const scopeFilter = req._railwayScope ? ' AND railway = ?' : '';
    const scopeParams = req._railwayScope ? [req._railwayScope] : [];

    const total = get(`SELECT COUNT(*) as c FROM cases WHERE 1=1 ${scopeFilter}`, scopeParams).c;
    const active = get(`SELECT COUNT(*) as c FROM cases WHERE (present_status IS NULL OR present_status = 'Pending') ${scopeFilter}`, scopeParams).c;
    const disposed = get(`SELECT COUNT(*) as c FROM cases WHERE present_status = 'Disposed' ${scopeFilter}`, scopeParams).c;
    const pendingReplies = get(`SELECT COUNT(*) as c FROM cases WHERE last_date_reply IS NOT NULL AND date_filing_reply IS NULL ${scopeFilter}`, scopeParams).c;

    const today = istToday();
    const weekEnd = istDateOffset(7);
    const upcomingHearings = get(
      `SELECT COUNT(*) as c FROM cases
       WHERE next_hearing_date BETWEEN ? AND ?
         AND COALESCE(present_status, 'Pending') != 'Disposed' ${scopeFilter}`,
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

// GET /api/analytics/charts
exports.getChartData = (req, res) => {
  try {
    const days = parseInt(req.query.range) || 30;
    const scopeFilter = req._railwayScope ? ' AND c.railway = ?' : '';
    const scopeParams = req._railwayScope ? [req._railwayScope] : [];

    const statusDistribution = all(
      `SELECT COALESCE(present_status, 'Pending') as status, COUNT(*) as count FROM cases c WHERE 1=1 ${scopeFilter} GROUP BY COALESCE(present_status, 'Pending') ORDER BY count DESC`,
      scopeParams
    );

    const hearingsPerWeek = all(
      `SELECT strftime('%W', hearing_date) as week, strftime('%Y-%m', hearing_date) as month, COUNT(*) as count
       FROM hearing_history h JOIN cases c ON h.case_id = c.id
       WHERE h.hearing_date >= DATE('now', '-' || ? || ' days') ${scopeFilter}
       GROUP BY week, month ORDER BY month, week`,
      [days, ...scopeParams]
    );

    const disposalsTrend = all(
      `SELECT strftime('%Y-%m', updated_at) as month, COUNT(*) as count
       FROM cases c
       WHERE present_status = 'Disposed' AND updated_at >= DATE('now', '-365 days') ${scopeFilter}
       GROUP BY month ORDER BY month`,
      scopeParams
    );

    const casesByRailway = all(
      `SELECT COALESCE(railway, 'Unknown') as railway, COUNT(*) as count FROM cases c WHERE 1=1 ${scopeFilter} GROUP BY railway ORDER BY count DESC`,
      scopeParams
    );

    res.json({ statusDistribution, hearingsPerWeek, disposalsTrend, casesByRailway });
  } catch (err) {
    console.error('Analytics chart error:', err);
    res.status(500).json({ error: 'Failed to generate chart data' });
  }
};

// GET /api/analytics/insights
exports.getInsights = (req, res) => {
  try {
    const scopeFilter = req._railwayScope ? ' AND railway = ?' : '';
    const scopeParams = req._railwayScope ? [req._railwayScope] : [];

    const advocateStats = all(
      `SELECT COALESCE(advocate_name, 'Unassigned') as name,
              COUNT(*) as total,
              SUM(CASE WHEN COALESCE(present_status, 'Pending') = 'Disposed' THEN 1 ELSE 0 END) as disposed
       FROM cases WHERE 1=1 ${scopeFilter}
       GROUP BY advocate_name ORDER BY total DESC LIMIT 8`,
      scopeParams
    );

    const nodalStats = all(
      `SELECT COALESCE(nodal_officer_name, 'Unassigned') as name,
              COUNT(*) as total,
              SUM(CASE WHEN COALESCE(present_status, 'Pending') != 'Disposed' THEN 1 ELSE 0 END) as pending
       FROM cases WHERE 1=1 ${scopeFilter}
       GROUP BY nodal_officer_name ORDER BY pending DESC LIMIT 8`,
      scopeParams
    );

    const forumPending = all(
      `SELECT COALESCE(forum, 'Unknown') as forum,
              COUNT(*) as pending
       FROM cases
       WHERE COALESCE(present_status, 'Pending') != 'Disposed' ${scopeFilter}
       GROUP BY forum ORDER BY pending DESC LIMIT 8`,
      scopeParams
    );

    const agingReplies = all(
      `SELECT id, case_ref_no, forum, railway, last_date_reply,
              CAST(julianday('now') - julianday(last_date_reply) AS INTEGER) as days_overdue
       FROM cases
       WHERE last_date_reply IS NOT NULL AND date_filing_reply IS NULL
         AND julianday(last_date_reply) < julianday('now') ${scopeFilter}
       ORDER BY days_overdue DESC LIMIT 10`,
      scopeParams
    );

    const agingRepliesCount = get(
      `SELECT COUNT(*) as c FROM cases
       WHERE last_date_reply IS NOT NULL AND date_filing_reply IS NULL
         AND julianday(last_date_reply) < julianday('now') ${scopeFilter}`,
      scopeParams
    ).c;

    const avgDisposalDays = get(
      `SELECT AVG(CAST(julianday(updated_at) - julianday(created_at) AS INTEGER)) as avg_days
       FROM cases
       WHERE present_status = 'Disposed' ${scopeFilter}`,
      scopeParams
    ).avg_days;

    res.json({
      advocateStats,
      nodalStats,
      forumPending,
      agingReplies,
      agingRepliesCount,
      avgDisposalDays: avgDisposalDays != null ? Math.round(avgDisposalDays) : null
    });
  } catch (err) {
    console.error('Analytics insights error:', err);
    res.status(500).json({ error: 'Failed to generate insights' });
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
