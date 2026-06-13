const { run, get, all } = require('../config/dbHelper');
const { PASSWORD_ITERATIONS } = require('../config/database');
const crypto = require('crypto');

// Legacy iteration count for migration — existing passwords used 1000 iterations
const LEGACY_ITERATIONS = 1000;

function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'ईमेल और पासवर्ड आवश्यक हैं। / Email and password are required.' });
  }

  try {
    const user = get(
      'SELECT * FROM users WHERE email = ? OR id = ?',
      [email.toLowerCase().trim(), email.trim()]
    );

    if (!user) {
      return res.status(401).json({ error: 'अमान्य क्रेडेंशियल! / Invalid Credentials!' });
    }

    const iterations = user.password_iterations || LEGACY_ITERATIONS;
    const hash = crypto.pbkdf2Sync(password, user.salt, iterations, 64, 'sha512').toString('hex');

    if (hash !== user.password_hash) {
      return res.status(401).json({ error: 'अमान्य क्रेडेंशियल! / Invalid Credentials!' });
    }

    // Re-hash with stronger iterations if user was created with legacy count
    if (iterations < PASSWORD_ITERATIONS) {
      const newSalt = crypto.randomBytes(16).toString('hex');
      const newHash = crypto.pbkdf2Sync(password, newSalt, PASSWORD_ITERATIONS, 64, 'sha512').toString('hex');
      run(
        'UPDATE users SET password_hash = ?, salt = ?, password_iterations = ? WHERE id = ?',
        [newHash, newSalt, PASSWORD_ITERATIONS, user.id]
      );
      console.log(`Upgraded password hash for user ${user.id} to ${PASSWORD_ITERATIONS} iterations.`);
    }

    // Create session
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    run(
      'INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
      [token, user.id, expiresAt.toISOString()]
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        railwayScope: user.railway_scope,
        desc: user.description
      }
    });
  } catch (err) {
    console.error('Database error in login:', err);
    return res.status(500).json({ error: 'डेटाबेस त्रुटि / Database error during login.' });
  }
}

function logout(req, res) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(200).json({ message: 'सफलतापूर्वक लॉगआउट किया गया। / Successfully logged out.' });
  }

  try {
    run('DELETE FROM user_sessions WHERE token = ?', [token]);
    res.json({ message: 'सफलतापूर्वक लॉगआउट किया गया। / Successfully logged out.' });
  } catch (err) {
    console.error('Database error in logout:', err);
    return res.status(500).json({ error: 'लॉगआउट विफल / Failed to revoke session during logout.' });
  }
}

module.exports = { login, logout };
