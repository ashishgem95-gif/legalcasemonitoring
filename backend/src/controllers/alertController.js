const { run, all } = require('../config/dbHelper');
const scraperService = require('../services/scraperService');

// GET /api/alerts (legacy — still uses is_read flag for backward compat)
const getAlerts = async (req, res) => {
  try {
    const { railway } = req.query;
    let query = `
      SELECT a.*, c.case_ref_no, c.applicant, c.railway
      FROM case_alerts a
      JOIN cases c ON a.case_id = c.id
      WHERE a.is_read = 0
    `;
    const params = [];
    if (req._railwayScope) {
      query += ' AND c.railway = ?';
      params.push(req._railwayScope);
    } else if (railway) {
      query += ' AND c.railway = ?';
      params.push(railway);
    }
    query += ' ORDER BY a.created_at DESC';

    const alerts = all(query, params);
    res.json(alerts);
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
};

// PUT /api/alerts/:id/read (legacy)
const markAlertAsRead = async (req, res) => {
  try {
    run('UPDATE case_alerts SET is_read = 1 WHERE id = ?', [req.params.id]);
    run('INSERT OR IGNORE INTO case_alert_reads (alert_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Error marking alert as read:', err);
    res.status(500).json({ error: 'Failed to clear notification.' });
  }
};

// GET /api/notifications — merged notification center
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const scope = req._railwayScope || null;
    const scopeFilter = scope ? 'AND c.railway = ?' : '';
    const scopeParams = scope ? [scope] : [];

    const alerts = all(
      `SELECT a.id AS alert_id, a.case_id, a.message, a.created_at,
              c.case_ref_no, c.applicant, c.railway
       FROM case_alerts a
       JOIN cases c ON a.case_id = c.id
       LEFT JOIN case_alert_reads r ON a.id = r.alert_id AND r.user_id = ?
       WHERE a.is_read = 0 AND r.alert_id IS NULL
       ${scopeFilter}
       ORDER BY a.created_at DESC
       LIMIT 20`,
      [userId, ...scopeParams]
    ).map(a => ({
      id: `alert:${a.alert_id}`,
      type: 'court_update',
      case_id: a.case_id,
      case_ref_no: a.case_ref_no,
      applicant: a.applicant,
      message: a.message,
      date: a.created_at,
      severity: 'info',
      dismissable: true,
    }));

    const upcomingHearings = all(
      `SELECT c.id AS case_id, c.case_ref_no, c.applicant, c.railway,
              c.next_hearing_date
       FROM cases c
       WHERE COALESCE(c.present_status, 'Pending') NOT LIKE '%Disposed%'
         AND c.next_hearing_date IS NOT NULL
         AND c.next_hearing_date >= date('now')
         AND c.next_hearing_date <= date('now', '+7 days')
         ${scopeFilter}
       ORDER BY c.next_hearing_date ASC
       LIMIT 20`,
      scopeParams
    ).map(h => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const d = new Date(h.next_hearing_date);
      const daysLeft = Math.ceil((d - today) / 86400000);
      return {
        id: `hearing:${h.case_id}`,
        type: 'upcoming_hearing',
        case_id: h.case_id,
        case_ref_no: h.case_ref_no,
        applicant: h.applicant,
        message: daysLeft === 0 ? 'Hearing today' : `Hearing in ${daysLeft} day(s)`,
        date: h.next_hearing_date,
        severity: daysLeft <= 2 ? 'urgent' : 'warning',
        dismissable: false,
      };
    });

    const overdueReplies = all(
      `SELECT c.id AS case_id, c.case_ref_no, c.applicant, c.railway,
              c.last_date_reply
       FROM cases c
       WHERE COALESCE(c.present_status, 'Pending') NOT LIKE '%Disposed%'
         AND c.last_date_reply IS NOT NULL
         AND c.last_date_reply < date('now')
         AND c.date_filing_reply IS NULL
         ${scopeFilter}
       ORDER BY c.last_date_reply ASC
       LIMIT 20`,
      scopeParams
    ).map(r => ({
      id: `reply:${r.case_id}`,
      type: 'overdue_reply',
      case_id: r.case_id,
      case_ref_no: r.case_ref_no,
      applicant: r.applicant,
      message: 'Reply deadline passed',
      date: r.last_date_reply,
      severity: 'urgent',
      dismissable: false,
    }));

    const allNotifs = [...overdueReplies, ...upcomingHearings, ...alerts];
    res.json({ notifications: allNotifs, unreadCount: allNotifs.length });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
};

// PUT /api/notifications/alert/:id/read — dismiss a scraper alert for this user
const markNotificationRead = async (req, res) => {
  try {
    const alertId = req.params.id;
    run('INSERT OR IGNORE INTO case_alert_reads (alert_id, user_id) VALUES (?, ?)', [alertId, req.user.id]);
    res.json({ message: 'Notification dismissed.' });
  } catch (err) {
    console.error('Error dismissing notification:', err);
    res.status(500).json({ error: 'Failed to dismiss notification.' });
  }
};

// PUT /api/notifications/read-all — dismiss all scraper alerts for this user
const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const scope = req._railwayScope;
    let query;
    let params;
    if (scope) {
      query = `INSERT OR IGNORE INTO case_alert_reads (alert_id, user_id)
               SELECT a.id, ? FROM case_alerts a
               JOIN cases c ON a.case_id = c.id
               WHERE a.is_read = 0 AND c.railway = ?`;
      params = [userId, scope];
    } else {
      query = `INSERT OR IGNORE INTO case_alert_reads (alert_id, user_id)
               SELECT id, ? FROM case_alerts WHERE is_read = 0`;
      params = [userId];
    }
    run(query, params);
    res.json({ message: 'All notifications dismissed.' });
  } catch (err) {
    console.error('Error dismissing all notifications:', err);
    res.status(500).json({ error: 'Failed to dismiss notifications.' });
  }
};

// POST /api/cases/trigger-crawl
const triggerManualCrawl = async (req, res) => {
  try {
    const result = await scraperService.checkCaseLinks(req.headers, false);
    res.json({
      status: 'success',
      scrapedCount: result.checkedCount,
      alertsCreated: result.newAlertsCount
    });
  } catch (err) {
    console.error('Error in manual scan trigger:', err);
    res.status(500).json({ error: 'Failed to execute court updates check.' });
  }
};

// POST /api/cases/check-due-cases
const checkDueCases = async (req, res) => {
  try {
    scraperService.checkCaseLinks(req.headers, true)
      .then(result => {
        console.log(`[Background Sync] Due cases check completed. Scraped: ${result.checkedCount}, Alerts: ${result.newAlertsCount}`);
      })
      .catch(err => {
        console.error('[Background Sync] Failed during due cases scan:', err.message);
      });

    res.json({
      status: 'checking',
      message: 'Background synchronisation of due court cases initiated.'
    });
  } catch (err) {
    console.error('Error initiating due cases check:', err);
    res.status(500).json({ error: 'Failed to initiate court updates check.' });
  }
};

const markAllAlertsAsRead = async (req, res) => {
  try {
    if (req._railwayScope) {
      run(`UPDATE case_alerts SET is_read = 1 WHERE is_read = 0 AND case_id IN (SELECT id FROM cases WHERE railway = ?)`, [req._railwayScope]);
    } else {
      run('UPDATE case_alerts SET is_read = 1 WHERE is_read = 0');
    }
    res.json({ message: 'All notifications dismissed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss notifications.' });
  }
};

module.exports = {
  getAlerts,
  markAlertAsRead,
  markAllAlertsAsRead,
  triggerManualCrawl,
  checkDueCases,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
