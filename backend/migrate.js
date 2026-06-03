const sqlite3 = require('./node_modules/sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '..', 'legal_tracker.db');

console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  
  db.serialize(() => {
    // Check if table exists first
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='physical_files'", [], (err, table) => {
      if (err) {
        console.error('Error checking table existence:', err);
        process.exit(1);
      }
      
      if (!table) {
        console.log('physical_files table does not exist yet. No migration needed.');
        process.exit(0);
      }
      
      db.all("PRAGMA table_info(physical_files)", [], (err, columns) => {
        if (err) {
          console.error('Error checking table columns:', err);
          process.exit(1);
        }
        
        const hasRackShelf = columns.some(c => c.name === 'rack_shelf');
        const hasZonalRailway = columns.some(c => c.name === 'zonal_railway');
        
        console.log('Table columns:', columns.map(c => c.name));
        
        if (hasRackShelf && !hasZonalRailway) {
          console.log('Migrating physical_files: Renaming rack_shelf to zonal_railway...');
          db.run("ALTER TABLE physical_files RENAME COLUMN rack_shelf TO zonal_railway;", (err) => {
            if (err) {
              console.error('Migration failed:', err);
              process.exit(1);
            } else {
              console.log('✅ Migration succeeded!');
              process.exit(0);
            }
          });
        } else {
          console.log('No migration needed or already migrated.');
          process.exit(0);
        }
      });
    });
  });
});
