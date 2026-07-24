// One-time backfill: derive status_category for every existing case from its
// present_status, using the SAME mapping as the DB triggers in config/database.js.
// Safe to re-run; only updates rows whose status_category is null/empty.

const { db } = require('../src/config/database');
const { all, run } = require('../src/config/dbHelper');

function categorize(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('withdrawn')) return 'Withdrawn';
  if (s.includes('stay')) return 'Stay Granted';
  if (s.includes('sine die')) return 'Sine Die';
  if (s.includes('allow')) return 'Allowed';
  if (s.includes('settl')) return 'Settled';
  if (s.includes('dismiss') || s.includes('dispose') || s.includes('dropped') || s.includes('closed') || s.includes('quash')) return 'Dismissed';
  if (s === '' || s === null) return 'Pending';
  if (
    s.includes('pending') || s.includes('reply') || s.includes('filed') || s.includes('hearing') ||
    s.includes('adjourn') || s.includes('listed') || s.includes('granted') || s.includes('notice') ||
    s.includes('order') || s.includes('commenc') || s.includes('proceeding') || s.includes('matter') ||
    s.includes('stage') || s.includes('argument')
  ) return 'Pending';
  return 'Other';
}

const rows = all("SELECT id, present_status FROM cases WHERE status_category IS NULL OR status_category = ''");
const tx = db.transaction(() => {
  for (const r of rows) {
    run('UPDATE cases SET status_category = ? WHERE id = ?', [categorize(r.present_status), r.id]);
  }
});
tx();

console.log(`Backfilled status_category for ${rows.length} case(s).`);

// Print a quick distribution for verification.
const dist = all('SELECT status_category, COUNT(*) c FROM cases GROUP BY status_category ORDER BY c DESC');
dist.forEach(d => console.log(`  ${String(d.status_category).padEnd(14)} ${d.c}`));
