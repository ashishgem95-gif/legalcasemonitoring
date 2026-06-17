const path = require('path');
const fs = require('fs');

const possiblePaths = [
  path.resolve(__dirname, '../../legal_tracker.db'),
  path.resolve(__dirname, '../legal_tracker.db'),
  path.resolve(process.cwd(), 'legal_tracker.db'),
];

let dbPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) { dbPath = p; break; }
}

if (!dbPath) {
  console.error('Could not find legal_tracker.db. Tried:');
  possiblePaths.forEach(p => console.error('  -', p));
  process.exit(1);
}

console.log('Using database at:', dbPath);
console.log('');

const Database = require('better-sqlite3');
const db = new Database(dbPath, { readonly: false });

const DRY_RUN = process.argv.includes('--dry-run');

const rows = db.prepare(`
  SELECT c.id, c.case_ref_no, c.next_hearing_date AS current_date,
    (SELECT substr(order_summary, instr(order_summary, '| Next: ') + 8, 10)
     FROM hearing_history
     WHERE case_id = c.id
       AND order_summary LIKE '%| Next: %'
     ORDER BY hearing_date DESC
     LIMIT 1) AS new_date
  FROM cases c
  WHERE EXISTS (
    SELECT 1 FROM hearing_history
    WHERE case_id = c.id
    AND order_summary LIKE '%| Next: %'
  )
`).all();

console.log(`Found ${rows.length} cases with Next: dates in hearing history`);
console.log('');

let updated = 0, skipped = 0, errors = 0;
const changes = [];

for (const r of rows) {
  if (!r.new_date || r.new_date.length !== 10) { skipped++; continue; }
  if (r.current_date && r.new_date <= r.current_date) { skipped++; continue; }
  
  try {
    if (DRY_RUN) {
      console.log(`[DRY-RUN] Case ${r.id} (${r.case_ref_no}): ${r.current_date || 'NULL'} -> ${r.new_date}`);
    } else {
      db.prepare('UPDATE cases SET next_hearing_date = ? WHERE id = ?').run(r.new_date, r.id);
      console.log(`✓ Case ${r.id} (${r.case_ref_no}): ${r.current_date || 'NULL'} -> ${r.new_date}`);
    }
    changes.push({ id: r.id, case_ref_no: r.case_ref_no, from: r.current_date, to: r.new_date });
    updated++;
  } catch (e) {
    console.error(`✗ Error on case ${r.id}: ${e.message}`);
    errors++;
  }
}

console.log('');
console.log('========================================');
console.log(`Summary: ${updated} updated, ${skipped} skipped, ${errors} errors`);
if (DRY_RUN) console.log('(DRY RUN — no changes were made)');
console.log('========================================');

db.close();
