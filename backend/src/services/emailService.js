const { run, all } = require('../config/dbHelper');
const { logger } = require('../config/logger');

async function queueHearingReminder(caseId, recipient, caseRefNo, hearingDate) {
  const subject = `Hearing Reminder: ${caseRefNo} on ${hearingDate}`;
  const body = `This is an automated reminder from the Court Case Monitoring System.\n\nCase: ${caseRefNo}\nHearing Date: ${hearingDate}\n\nPlease ensure all necessary preparations are complete.\n\n- Ministry of Railways, Government of India`;

  run(
    `INSERT INTO email_queue (case_id, recipient, subject, body, status, scheduled_for)
     VALUES (?, ?, ?, ?, 'PENDING', ?)`,
    [caseId, recipient, subject, body, hearingDate]
  );
  logger.info({ caseId, recipient }, 'Queued hearing reminder email');
}

async function checkAndQueueReminders() {
  try {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const targetDate = twoDaysFromNow.toISOString().split('T')[0];

    const upcoming = all(
      `SELECT h.case_id, h.hearing_date, c.case_ref_no, c.nodal_officer_name, c.nodal_officer_contact
       FROM hearing_history h
       JOIN cases c ON h.case_id = c.id
       WHERE h.hearing_date = ?`,
      [targetDate]
    );

    for (const h of upcoming) {
      if (h.nodal_officer_contact) {
        await queueHearingReminder(h.case_id, h.nodal_officer_contact, h.case_ref_no, h.hearing_date);
      }
    }

    logger.info({ count: upcoming.length }, 'Processed hearing reminder queue');
    return upcoming.length;
  } catch (err) {
    logger.error({ err }, 'Failed to check hearing reminders');
    return 0;
  }
}

async function processEmailQueue() {
  try {
    const pending = all(
      `SELECT * FROM email_queue WHERE status = 'PENDING'
       AND (scheduled_for IS NULL OR scheduled_for <= DATE('now', 'localtime'))`
    );

    for (const email of pending) {
      // In production, integrate with SMTP/SendGrid here
      logger.info({ to: email.recipient, subject: email.subject }, 'Would send email');

      run(
        `UPDATE email_queue SET status = 'SENT', sent_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [email.id]
      );
    }

    if (pending.length > 0) logger.info({ count: pending.length }, 'Processed email queue');
    return pending.length;
  } catch (err) {
    logger.error({ err }, 'Failed to process email queue');
    return 0;
  }
}

module.exports = { queueHearingReminder, checkAndQueueReminders, processEmailQueue };
