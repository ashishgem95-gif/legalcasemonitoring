const { fallbackRegexParser } = require('./src/services/summarizer');

console.log('=== Backend Component Verification ===\n');

// 1. Verify Summarizer Regex Fallback Parser
console.log('Testing: Summarizer Regex Fallback Parser...');
const sampleLegalText = `
  The petitioner filed a petition for early hearing of the case. 
  It is ordered that the respondent Union of India shall file a status report within four weeks. 
  The case is adjourned to next month. The petition is allowed.
`;

console.log('Sample Court Order Text:\n---');
console.log(sampleLegalText.trim());
console.log('---\n');

const summary = fallbackRegexParser(sampleLegalText);
console.log('Generated Heuristic Summary:\n---');
console.log(summary);
console.log('---\n');

if (summary.includes('ordered') && summary.includes('shall') && summary.includes('adjourned')) {
  console.log('✅ Summarizer Heuristics test PASSED! Extracted sentences containing "ordered", "shall", and "adjourned".');
} else {
  console.log('❌ Summarizer Heuristics test FAILED.');
}

console.log('\n2. Testing: Database Connection & Querying...');
try {
  const db = require('./src/config/database');
  
  db.get('SELECT sqlite_version() AS version', [], (err, row) => {
    if (err) {
      console.error('❌ Database connection/query FAILED:', err.message);
      process.exit(1);
    }
    console.log(`✅ Database connection successful. SQLite Version: ${row.version}`);
    
    // Check tables
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
      if (err) {
        console.error('❌ Table listing FAILED:', err.message);
        process.exit(1);
      }
      console.log('Tables in database:', tables.map(t => t.name).join(', '));
      
      const hasCases = tables.some(t => t.name === 'cases');
      const hasHearings = tables.some(t => t.name === 'hearing_history');
      
      if (hasCases && hasHearings) {
        console.log('✅ Required tables (cases, hearing_history) are present!');
      } else {
        console.log('❌ Required tables are missing. Please make sure legal_tracker.db is initialized.');
      }
      
      // Select count of cases
      db.get('SELECT COUNT(*) AS count FROM cases', [], (err, countRow) => {
        if (err) {
          console.error('❌ Querying cases table FAILED:', err.message);
        } else {
          console.log(`✅ Cases Table Record Count: ${countRow.count}`);
        }
        
        console.log('\nVerification completed.');
        process.exit(0);
      });
    });
  });
} catch (err) {
  console.log('Could not test database connection dynamically because dependencies may not be installed yet.');
  console.log('Error details:', err.message);
}
