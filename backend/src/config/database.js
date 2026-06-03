const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// The DB file is at the workspace root
const dbPath = path.resolve(__dirname, '..', '..', '..', 'legal_tracker.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to database at:', dbPath);
    db.serialize(() => {
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON;', (err) => {
        if (err) {
          console.error('Failed to enable foreign keys', err);
        } else {
          console.log('Foreign key support enabled.');
        }
      });

      // Create citations table
      db.run(`
        CREATE TABLE IF NOT EXISTS citations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category VARCHAR NOT NULL,
          title VARCHAR NOT NULL,
          description TEXT,
          where_to_cite TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `, (err) => {
        if (err) {
          console.error('Failed to create citations table:', err);
        } else {
          // Seed citations if empty
          db.get('SELECT COUNT(*) AS count FROM citations', [], (err, row) => {
            if (!err && row && row.count === 0) {
              console.log('Pre-seeding legal citations database...');
              const stmt = db.prepare('INSERT INTO citations (category, title, description, where_to_cite) VALUES (?, ?, ?, ?)');
              
              stmt.run(
                '56j',
                'State of Gujarat Vs. Umedbhai M. Patel (2001) 3 SCC 314',
                'The Supreme Court laid down detailed guidelines for compulsory retirement under Rule 56(j). It held that compulsory retirement is not a punishment and does not entail loss of retiral benefits. The order can be challenged if it is arbitrary, mala fide, or based on no evidence.',
                'Cite this in responses to compulsory retirement challenges under Rule 56(j)/Rule 1802. Use to justify the absolute right of the government to retire an employee whose integrity is doubtful or who has become deadwood.'
              );
              
              stmt.run(
                '56j',
                'Union of India Vs. Dulal Dutt (1993) 2 SCC 179',
                'It was held that an order of compulsory retirement is not an order of punishment. The administrative authority has the absolute right to retire a government servant in public interest, and the court will not substitute its own judgment for that of the authority.',
                'Cite to limit judicial review of Rule 56(j) orders. Emphasize that the subjective satisfaction of the review committee should not be lightly interfered with by courts unless there is gross mala fide.'
              );
              
              stmt.run(
                'upsc_advice',
                'Union of India Vs. T.V. Patel (2007) 4 SCC 785',
                'The Supreme Court held that the advice of the Union Public Service Commission (UPSC) is directory in nature and is not binding on the disciplinary authority. It is not mandatory to supply a copy of the UPSC advice to the delinquent employee prior to passing the final penalty order.',
                'Cite in departmental inquiry challenges where the employee argues that non-supply of UPSC advice prior to the final decision violated principles of natural justice.'
              );
              
              stmt.run(
                'upsc_advice',
                'State of Tamil Nadu Vs. Thiru K.V. Karuppiah (2007)',
                'The court affirmed that while consultation with UPSC is a constitutional safeguard, it does not mean that the government must accept the recommendation of the Commission in every case. The decision remains with the President/Governor.',
                'Cite to defend instances where the government has deviated from UPSC advice in disciplinary proceedings, showing that proper administrative procedures were followed.'
              );
              
              stmt.finalize();
              console.log('Legal citations pre-seeding completed.');
            }
          });
        }
      });

      // Create case_affidavits table
      db.run(`
        CREATE TABLE IF NOT EXISTS case_affidavits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          case_id INTEGER NOT NULL,
          filing_date DATE NOT NULL,
          filed_by VARCHAR NOT NULL,
          affidavit_type VARCHAR NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
        );
      `, (err) => {
        if (err) {
          console.error('Failed to create case_affidavits table:', err);
        } else {
          console.log('case_affidavits table verified/created.');
        }
      });

      // Create personnel table
      db.run(`
        CREATE TABLE IF NOT EXISTS personnel (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR NOT NULL,
          designation VARCHAR,
          department VARCHAR,
          contact_no VARCHAR,
          email VARCHAR,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `, (err) => {
        if (err) {
          console.error('Failed to create personnel table:', err);
        } else {
          console.log('personnel table verified/created.');
          
          // Create physical_files table
          db.run(`
            CREATE TABLE IF NOT EXISTS physical_files (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              file_number VARCHAR UNIQUE NOT NULL,
              subject VARCHAR NOT NULL,
              description TEXT,
              currently_with_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
              zonal_railway VARCHAR,
              status VARCHAR DEFAULT 'ACTIVE',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `, (err) => {
            if (err) {
              console.error('Failed to create physical_files table:', err);
            } else {
              console.log('physical_files table verified/created.');
              
              // Create file_movements table
              db.run(`
                CREATE TABLE IF NOT EXISTS file_movements (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  file_id INTEGER NOT NULL REFERENCES physical_files(id) ON DELETE CASCADE,
                  from_custodian_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
                  to_custodian_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
                  movement_date DATE NOT NULL,
                  purpose TEXT,
                  remarks TEXT,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
              `, (err) => {
                if (err) {
                  console.error('Failed to create file_movements table:', err);
                } else {
                  console.log('file_movements table verified/created.');
                  
                  // Seed personnel and physical files if empty
                  db.get('SELECT COUNT(*) AS count FROM personnel', [], (err, row) => {
                    if (!err && row && row.count === 0) {
                      console.log('Pre-seeding personnel, physical files, and movements database...');
                      
                      const personnelData = [
                        ['Aravind Sharma', 'Finance Officer', 'Finance Department', '9876543210', 'aravind.sharma@railways.gov.in'],
                        ['Sneha Patel', 'HR Manager', 'HR & Establishment', '9876543211', 'sneha.patel@railways.gov.in'],
                        ['Meera Nair', 'Legal Advisor', 'Legal Cell', '9876543212', 'meera.nair@railways.gov.in'],
                        ['Amit Verma', 'Admin Executive', 'General Administration', '9876543213', 'amit.verma@railways.gov.in']
                      ];

                      const insertPerson = db.prepare('INSERT INTO personnel (name, designation, department, contact_no, email) VALUES (?, ?, ?, ?, ?)');
                      
                      let seededPersonsCount = 0;
                      const personIds = {};

                      personnelData.forEach((p) => {
                        insertPerson.run(p, function(err) {
                          if (!err) {
                            personIds[p[0]] = this.lastID;
                          }
                          seededPersonsCount++;
                          if (seededPersonsCount === personnelData.length) {
                            insertPerson.finalize();
                            
                            // Now seed files
                            const filesData = [
                              ['FIN-2026-008', 'Annual Budget Allocation', 'Allocation of operational budget for FY26-27.', 'Aravind Sharma', 'ER', 'ACTIVE'],
                              ['HR-2026-015', 'Recruitment Plan Q3', 'Proposal for expanding the engineering and technical cadre.', 'Sneha Patel', 'ECR', 'ACTIVE'],
                              ['LEG-2026-042', 'Vendor Agreement - TechCorp', 'Service agreement with TechCorp for software licenses.', 'Meera Nair', 'NR', 'ACTIVE'],
                              ['ADM-2026-101', 'Office Renovation Plan', 'Civil work layout and quotation for renovation of block B.', 'Amit Verma', 'WR', 'ACTIVE']
                            ];

                            const insertFile = db.prepare('INSERT INTO physical_files (file_number, subject, description, currently_with_id, zonal_railway, status) VALUES (?, ?, ?, ?, ?, ?)');
                            const insertMovement = db.prepare('INSERT INTO file_movements (file_id, from_custodian_id, to_custodian_id, movement_date, purpose, remarks) VALUES (?, ?, ?, ?, ?, ?)');

                            let seededFilesCount = 0;
                            filesData.forEach((f) => {
                              const custodianId = personIds[f[3]];
                              insertFile.run(f[0], f[1], f[2], custodianId, f[4], f[5], function(err) {
                                if (!err) {
                                  const fileId = this.lastID;
                                  // Create initial movement log
                                  insertMovement.run(fileId, null, custodianId, '2026-06-01', 'Initial file creation and registry entry.', 'System initialized.', (err) => {
                                    if (err) console.error('Failed to insert initial movement:', err);
                                  });
                                } else {
                                  console.error('Failed to insert file:', err);
                                }
                                seededFilesCount++;
                                if (seededFilesCount === filesData.length) {
                                  insertFile.finalize();
                                  insertMovement.finalize();
                                  console.log('DocuFlow database pre-seeding completed.');
                                }
                              });
                            });
                          }
                        });
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });

      // Create case_alerts table
      db.run(`
        CREATE TABLE IF NOT EXISTS case_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          case_id INTEGER NOT NULL,
          message TEXT NOT NULL,
          is_read INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
        );
      `, (err) => {
        if (err) {
          console.error('Failed to create case_alerts table:', err);
        } else {
          console.log('case_alerts table verified/created.');
        }
      });

      // Helper to add missing columns to cases table
      const addColumn = (colName, colType) => {
        db.run(`ALTER TABLE cases ADD COLUMN ${colName} ${colType};`, (err) => {
          if (err) {
            if (!err.message.includes('duplicate column name')) {
              console.log(`Note for column ${colName}:`, err.message);
            }
          } else {
            console.log(`Column ${colName} successfully added to cases table.`);
          }
        });
      };

      addColumn('original_oa_no', 'VARCHAR');
      addColumn('original_oa_forum', 'VARCHAR');
      addColumn('original_oa_date_disposal', 'DATE');
      addColumn('original_oa_status', 'TEXT');
      addColumn('court_link', 'VARCHAR');
      addColumn('last_fetched_hash', 'VARCHAR');
      addColumn('last_fetched_at', 'TIMESTAMP');

      // 12 stages progression columns
      const stages = [
        'charge_sheet_issued',
        'reply_to_charges',
        'inquiry_commenced',
        'io_report_submitted',
        'da_notice',
        'reply_to_da_notice',
        'da_penalty_order',
        'upsc_advice',
        'appeal_oa_filed',
        'counter_affidavit_filed',
        'cat_court_order',
        'writ_petition_filed'
      ];
      stages.forEach(stage => {
        addColumn(`${stage}_date`, 'DATE');
        addColumn(`${stage}_notes`, 'TEXT');
      });
    });
  }
});

module.exports = db;
