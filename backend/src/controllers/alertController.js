const { run, all } = require('../config/dbHelper');
const scraperService = require('../services/scraperService');

// GET /api/alerts
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

    const alerts = all(query, params);
    res.json(alerts);
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
};

// PUT /api/alerts/:id/read
const markAlertAsRead = async (req, res) => {
  try {
    run('UPDATE case_alerts SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Error marking alert as read:', err);
    res.status(500).json({ error: 'Failed to clear notification.' });
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
    run('UPDATE case_alerts SET is_read = 1 WHERE is_read = 0');
    res.json({ message: 'All notifications dismissed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss notifications.' });
  }
};

module.exports = { getAlerts, markAlertAsRead, markAllAlertsAsRead, triggerManualCrawl, checkDueCases };
