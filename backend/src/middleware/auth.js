const db = require('../config/database');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'प्रवेश आवश्यक है। / Authentication token is missing.' });
  }

  // Look up session in DB
  db.get(
    `SELECT u.*, s.expires_at 
     FROM user_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ?`,
    [token],
    (err, row) => {
      if (err) {
        console.error('Database error in auth middleware:', err);
        return res.status(500).json({ error: 'डेटाबेस त्रुटि / Database error during authentication.' });
      }

      if (!row) {
        return res.status(401).json({ error: 'अमान्य या समाप्त सत्र। / Invalid or expired session.' });
      }

      // Check expiration
      const now = new Date();
      const expiresAt = new Date(row.expires_at);
      if (now > expiresAt) {
        // Delete expired session
        db.run('DELETE FROM user_sessions WHERE token = ?', [token], (delErr) => {
          if (delErr) console.error('Failed to clean up expired session:', delErr);
        });
        return res.status(401).json({ error: 'सत्र समाप्त हो गया है। / Session has expired.' });
      }

      // Populate user info on request
      req.user = {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        railwayScope: row.railway_scope,
        desc: row.desc
      };

      next();
    }
  );
}

module.exports = { authenticateToken };
