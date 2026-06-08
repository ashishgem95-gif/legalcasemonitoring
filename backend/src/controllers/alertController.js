const db = require('../config/database');
const scraperService = require('../services/scraperService');

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows);
  });
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) return reject(err);
    resolve({ id: this.lastID, changes: this.changes });
  });
});

// GET /api/alerts - List all unread notifications joined with case details
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
    if (railway) {
      query += ' AND c.railway = ?';
      params.push(railway);
    }
    query += ' ORDER BY a.created_at DESC';

    const alerts = await dbAll(query, params);
    res.json(alerts);
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
};

// PUT /api/alerts/:id/read - Mark alert as read (is_read = 1)
const markAlertAsRead = async (req, res) => {
  try {
    const alertId = req.params.id;
    await dbRun('UPDATE case_alerts SET is_read = 1 WHERE id = ?', [alertId]);
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Error marking alert as read:', err);
    res.status(500).json({ error: 'Failed to clear notification.' });
  }
};

// POST /api/cases/trigger-crawl - Execute a manual crawl of all case links immediately
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

// POST /api/cases/check-due-cases - Start a check of only past-due cases in the background
const checkDueCases = async (req, res) => {
  try {
    // Run the check in the background asynchronously (do not await)
    scraperService.checkCaseLinks(req.headers, true)
      .then(result => {
        console.log(`[Background Sync] Due cases check completed. Scraped: ${result.checkedCount}, Alerts: ${result.alertsCreated}`);
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

module.exports = {
  getAlerts,
  markAlertAsRead,
  triggerManualCrawl,
  checkDueCases
};
