/**
 * Database adapter — Local SQLite (better-sqlite3) in dev, Turso in production
 */
const path = require('path');

let db;

// Check if running on Vercel
if (process.env.VERCEL || process.env.TURSO_DATABASE_URL) {
  // ── Turso (production) ──
  const { createClient } = require('@libsql/client');
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Wrapper to mimic better-sqlite3 sync API
  db = {
    prepare(sql) {
      return {
        run(...args) {
          const params = args[0] || [];
          const result = turso.execute({ sql, args: Array.isArray(params) ? params : [params] });
          return { lastInsertRowid: result.lastInsertRowid, changes: result.rowsAffected };
        },
        get(...args) {
          const params = args[0] || [];
          const result = turso.execute({ sql, args: Array.isArray(params) ? params : [params] });
          return result.rows[0] || undefined;
        },
        all(...args) {
          const params = args[0] || [];
          const result = turso.execute({ sql, args: Array.isArray(params) ? params : [params] });
          return result.rows;
        },
        async runAsync(...args) {
          const params = args[0] || [];
          return turso.execute({ sql, args: Array.isArray(params) ? params : [params] });
        },
      };
    },
    exec(sql) {
      turso.execute({ sql });
    },
    transaction(fn) {
      fn(this);
    },
  };
} else {
  // ── Local SQLite ──
  const Database = require('better-sqlite3');
  const dbPath = path.resolve(__dirname, '..', '..', '..', 'legal_tracker.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
}

module.exports = db;
