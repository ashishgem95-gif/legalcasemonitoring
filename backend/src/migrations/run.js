/**
 * Migration runner — applies SQL migrations in order, tracks applied ones in
 * `schema_migrations` table. Usage:
 *   node src/migrations/run.js           # apply pending migrations
 *   node src/migrations/run.js --down 001_add_order_uploaded_flag   # rollback one
 */
const fs = require('fs');
const path = require('path');
const { run, get, all } = require('../config/dbHelper');
const db = require('../config/database');

const MIGRATIONS_DIR = __dirname;
const isDown = process.argv.includes('--down');
const targetName = isDown ? process.argv[process.argv.indexOf('--down') + 1] : null;

/**
 * Split a SQL file into individual statements.
 * - Strips line comments starting with --
 * - Splits on semicolons that are not inside string literals
 * - Returns trimmed, non-empty statements
 */
function splitSqlStatements(sql) {
  // Remove line comments
  const cleaned = sql
    .split('\n')
    .map(line => {
      const idx = line.indexOf('--');
      // Don't strip if -- appears inside a string literal (rough heuristic)
      const before = line.substring(0, idx);
      const singleQuotes = (before.match(/'/g) || []).length;
      if (idx >= 0 && singleQuotes % 2 === 0) {
        return line.substring(0, idx);
      }
      return line;
    })
    .join('\n');

  return cleaned
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !/^\s*$/.test(s));
}

(async () => {
  try {
    await db.ready;

    await run(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`);

    const applied = (await all('SELECT name FROM schema_migrations')).map(r => r.name);
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') && !f.endsWith('_down.sql'))
      .sort();

    if (!isDown) {
      for (const file of files) {
        if (applied.includes(file)) {
          console.log(`✓ ${file} (already applied)`);
          continue;
        }
        console.log(`→ Applying ${file}...`);
        const rawSql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        const statements = splitSqlStatements(rawSql);
        try {
          for (const stmt of statements) {
            await run(stmt);
          }
          await run('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)',
            [file, new Date().toISOString()]);
          console.log(`✓ ${file} applied (${statements.length} statement${statements.length === 1 ? '' : 's'})`);
        } catch (err) {
          console.error(`✗ ${file} failed:`, err.message);
          process.exit(1);
        }
      }
      console.log('\nAll migrations applied.');
    } else {
      if (!targetName) {
        console.error('Usage: node run.js --down <migration_name>');
        process.exit(1);
      }
      const downFile = path.join(MIGRATIONS_DIR, `${targetName.replace(/\.sql$/, '')}_down.sql`);
      if (!fs.existsSync(downFile)) {
        console.error(`No down file found: ${downFile}`);
        process.exit(1);
      }
      console.log(`→ Rolling back ${targetName}...`);
      const rawSql = fs.readFileSync(downFile, 'utf8');
      const statements = splitSqlStatements(rawSql);
      try {
        for (const stmt of statements) {
          await run(stmt);
        }
        await run('DELETE FROM schema_migrations WHERE name = ?', [targetName]);
        console.log(`✓ ${targetName} rolled back`);
      } catch (err) {
        console.error(`✗ Rollback failed:`, err.message);
        process.exit(1);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('Migration runner error:', err);
    process.exit(1);
  }
})();
