const fs = require('fs');
const dbPath = '/app/legal_tracker.db';
if (fs.existsSync('/data/legal_tracker.db')) {
    const existing = fs.statSync('/data/legal_tracker.db').size;
    console.log('Database already exists on volume: ' + existing + ' bytes');
    process.exit(0);
}
if (!fs.existsSync(dbPath)) {
    console.log('No database found at ' + dbPath);
    process.exit(0);
}
const data = fs.readFileSync(dbPath);
fs.writeFileSync('/data/legal_tracker.db', data);
console.log('Uploaded database: ' + data.length + ' bytes');
