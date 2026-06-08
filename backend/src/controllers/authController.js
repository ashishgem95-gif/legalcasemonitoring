const db = require('../config/database');
const crypto = require('crypto');

function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'ईमेल और पासवर्ड आवश्यक हैं। / Email and password are required.' });
  }

  db.get(
    'SELECT * FROM users WHERE email = ? OR id = ?',
    [email.toLowerCase().trim(), email.toLowerCase().trim()],
    (err, user) => {
      if (err) {
        console.error('Database error in login:', err);
        return res.status(500).json({ error: 'डेटाबेस त्रुटि / Database error during login.' });
      }

      if (!user) {
        return res.status(401).json({ error: 'अमान्य क्रेडेंशियल! / Invalid Credentials! Please use correct email and password.' });
      }

      // Hash provided password using user's salt
      const hash = crypto.pbkdf2Sync(password, user.salt, 1000, 64, 'sha512').toString('hex');

      if (hash !== user.password_hash) {
        return res.status(401).json({ error: 'अमान्य क्रेडेंशियल! / Invalid Credentials! Please use correct email and password.' });
      }

      // Create session
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiration
      const expiresAtStr = expiresAt.toISOString();

      db.run(
        'INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
        [token, user.id, expiresAtStr],
        (sessionErr) => {
          if (sessionErr) {
            console.error('Failed to create session:', sessionErr);
            return res.status(500).json({ error: 'सत्र निर्माण विफल / Failed to create session.' });
          }

          // Return token and user details (excluding sensitive columns)
          res.json({
            token,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              railwayScope: user.railway_scope,
              desc: user.desc
            }
          });
        }
      );
    }
  );
}

function logout(req, res) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(200).json({ message: 'सफलतापूर्वक लॉगआउट किया गया। / Successfully logged out.' });
  }

  db.run(
    'DELETE FROM user_sessions WHERE token = ?',
    [token],
    (err) => {
      if (err) {
        console.error('Database error in logout:', err);
        return res.status(500).json({ error: 'लॉगआउट विफल / Failed to revoke session during logout.' });
      }

      res.json({ message: 'सफलतापूर्वक लॉगआउट किया गया। / Successfully logged out.' });
    }
  );
}

module.exports = {
  login,
  logout
};
