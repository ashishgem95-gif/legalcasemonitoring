const { run, get } = require('../config/dbHelper');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'प्रवेश आवश्यक है। / Authentication token is missing.' });
  }

  try {
    const row = get(
      `SELECT u.*, s.expires_at
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ?`,
      [token]
    );

    if (!row) {
      return res.status(401).json({ error: 'अमान्य या समाप्त सत्र। / Invalid or expired session.' });
    }

    const now = new Date();
    const expiresAt = new Date(row.expires_at);
    if (now > expiresAt) {
      run('DELETE FROM user_sessions WHERE token = ?', [token]);
      return res.status(401).json({ error: 'सत्र समाप्त हो गया है। / Session has expired.' });
    }

    req.user = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      railwayScope: row.railway_scope,
      desc: row.desc
    };

    next();
  } catch (err) {
    console.error('Database error in auth middleware:', err);
    return res.status(500).json({ error: 'डेटाबेस त्रुटि / Database error during authentication.' });
  }
}

module.exports = { authenticateToken };
