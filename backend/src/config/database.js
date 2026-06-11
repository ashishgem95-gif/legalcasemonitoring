const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const PASSWORD_ITERATIONS = 600000;

const dbPath = path.resolve(__dirname, '..', '..', '..', 'legal_tracker.db');

const db = new Database(dbPath);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
console.log('Connected to database at:', dbPath);
console.log('Foreign key support enabled.');

// ── cases ──
db.exec(`
  CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_ref_no VARCHAR UNIQUE NOT NULL,
    railway VARCHAR,
    applicant VARCHAR,
    respondent VARCHAR,
    employee_designation VARCHAR,
    case_type VARCHAR,
    case_number VARCHAR,
    case_year INTEGER,
    forum VARCHAR,
    synopsis TEXT,
    file_no VARCHAR,
    link_file_no VARCHAR,
    last_date_reply DATE,
    date_filing_reply DATE,
    present_status TEXT,
    last_date_appeal_implementation DATE,
    nodal_officer_name VARCHAR,
    nodal_officer_contact VARCHAR,
    advocate_name VARCHAR,
    advocate_contact VARCHAR,
    original_oa_no VARCHAR,
    original_oa_forum VARCHAR,
    original_oa_date_disposal DATE,
    original_oa_status TEXT,
    court_link VARCHAR,
    last_fetched_hash VARCHAR,
    last_fetched_at TIMESTAMP,
    charge_sheet_issued_date DATE,
    charge_sheet_issued_notes TEXT,
    reply_to_charges_date DATE,
    reply_to_charges_notes TEXT,
    inquiry_commenced_date DATE,
    inquiry_commenced_notes TEXT,
    io_report_submitted_date DATE,
    io_report_submitted_notes TEXT,
    da_notice_date DATE,
    da_notice_notes TEXT,
    reply_to_da_notice_date DATE,
    reply_to_da_notice_notes TEXT,
    da_penalty_order_date DATE,
    da_penalty_order_notes TEXT,
    upsc_advice_date DATE,
    upsc_advice_notes TEXT,
    appeal_oa_filed_date DATE,
    appeal_oa_filed_notes TEXT,
    counter_affidavit_filed_date DATE,
    counter_affidavit_filed_notes TEXT,
    cat_court_order_date DATE,
    cat_court_order_notes TEXT,
    writ_petition_filed_date DATE,
    writ_petition_filed_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('cases table verified/created.');

// ── hearing_history ──
db.exec(`
  CREATE TABLE IF NOT EXISTS hearing_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER,
    hearing_date DATE NOT NULL,
    order_raw_text TEXT,
    order_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  );
`);
console.log('hearing_history table verified/created.');

// ── citations ──
db.exec(`
  CREATE TABLE IF NOT EXISTS citations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    description TEXT,
    where_to_cite TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
const citationCount = db.prepare('SELECT COUNT(*) AS count FROM citations').get();
if (citationCount.count === 0) {
  console.log('Pre-seeding legal citations database...');
  const insertCitation = db.prepare('INSERT INTO citations (category, title, description, where_to_cite) VALUES (?, ?, ?, ?)');
  insertCitation.run(
    '56j',
    'State of Gujarat Vs. Umedbhai M. Patel (2001) 3 SCC 314',
    'The Supreme Court laid down detailed guidelines for compulsory retirement under Rule 56(j). It held that compulsory retirement is not a punishment and does not entail loss of retiral benefits.',
    'Cite this in responses to compulsory retirement challenges under Rule 56(j)/Rule 1802.'
  );
  insertCitation.run(
    '56j',
    'Union of India Vs. Dulal Dutt (1993) 2 SCC 179',
    'It was held that an order of compulsory retirement is not an order of punishment. The administrative authority has the absolute right to retire a government servant in public interest.',
    'Cite to limit judicial review of Rule 56(j) orders.'
  );
  insertCitation.run(
    'upsc_advice',
    'Union of India Vs. T.V. Patel (2007) 4 SCC 785',
    'The Supreme Court held that the advice of the UPSC is directory in nature and is not binding on the disciplinary authority.',
    'Cite in departmental inquiry challenges where non-supply of UPSC advice is argued.'
  );
  insertCitation.run(
    'upsc_advice',
    'State of Tamil Nadu Vs. Thiru K.V. Karuppiah (2007)',
    'The court affirmed that while consultation with UPSC is a constitutional safeguard, the decision remains with the President/Governor.',
    'Cite to defend instances where the government has deviated from UPSC advice.'
  );
  console.log('Legal citations pre-seeding completed.');
}

// ── case_affidavits ──
db.exec(`
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
`);
console.log('case_affidavits table verified/created.');

// ── personnel ──
db.exec(`
  CREATE TABLE IF NOT EXISTS personnel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR NOT NULL,
    designation VARCHAR,
    department VARCHAR,
    contact_no VARCHAR,
    email VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('personnel table verified/created.');

// ── physical_files ──
db.exec(`
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
`);
console.log('physical_files table verified/created.');

// ── file_movements ──
db.exec(`
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
`);
console.log('file_movements table verified/created.');

// Seed personnel and files
const personnelCount = db.prepare('SELECT COUNT(*) AS count FROM personnel').get();
if (personnelCount.count === 0) {
  console.log('Pre-seeding personnel, physical files, and movements database...');
  const insertPerson = db.prepare('INSERT INTO personnel (name, designation, department, contact_no, email) VALUES (?, ?, ?, ?, ?)');
  const insertFile = db.prepare('INSERT INTO physical_files (file_number, subject, description, currently_with_id, zonal_railway, status) VALUES (?, ?, ?, ?, ?, ?)');
  const insertMovement = db.prepare('INSERT INTO file_movements (file_id, from_custodian_id, to_custodian_id, movement_date, purpose, remarks) VALUES (?, ?, ?, ?, ?, ?)');

  const persons = [
    { info: insertPerson.run('Aravind Sharma', 'Finance Officer', 'Finance Department', '9876543210', 'aravind.sharma@railways.gov.in'), data: ['FIN-2026-008', 'Annual Budget Allocation', 'Allocation of operational budget for FY26-27.', 'ER'] },
    { info: insertPerson.run('Sneha Patel', 'HR Manager', 'HR & Establishment', '9876543211', 'sneha.patel@railways.gov.in'), data: ['HR-2026-015', 'Recruitment Plan Q3', 'Proposal for expanding the engineering and technical cadre.', 'ECR'] },
    { info: insertPerson.run('Meera Nair', 'Legal Advisor', 'Legal Cell', '9876543212', 'meera.nair@railways.gov.in'), data: ['LEG-2026-042', 'Vendor Agreement - TechCorp', 'Service agreement with TechCorp for software licenses.', 'NR'] },
    { info: insertPerson.run('Amit Verma', 'Admin Executive', 'General Administration', '9876543213', 'amit.verma@railways.gov.in'), data: ['ADM-2026-101', 'Office Renovation Plan', 'Civil work layout and quotation for renovation of block B.', 'WR'] }
  ];

  persons.forEach(p => {
    const custodianId = p.info.lastInsertRowid;
    const [number, subject, description, railway] = p.data;
    const fileResult = insertFile.run(number, subject, description, custodianId, railway, 'ACTIVE');
    insertMovement.run(fileResult.lastInsertRowid, null, custodianId, '2026-06-01', 'Initial file creation and registry entry.', 'System initialized.');
  });
  console.log('DocuFlow database pre-seeding completed.');
}

// ── case_alerts ──
db.exec(`
  CREATE TABLE IF NOT EXISTS case_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  );
`);
console.log('case_alerts table verified/created.');

// ── users ──
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    salt VARCHAR NOT NULL,
    password_iterations INTEGER DEFAULT ${PASSWORD_ITERATIONS},
    role VARCHAR NOT NULL,
    railway_scope VARCHAR NOT NULL,
    desc TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('users table verified/created.');

// Migration: add password_iterations to existing users table
try { db.exec(`ALTER TABLE users ADD COLUMN password_iterations INTEGER DEFAULT 1000`); } catch (e) { /* column exists */ }

const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get();
if (userCount.count === 0) {
  console.log('Pre-seeding users database...');
  const insertUser = db.prepare('INSERT INTO users (id, name, email, password_hash, salt, password_iterations, role, railway_scope, desc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

  const seedUsers = [
    { id: 'admin', name: 'Shri R. K. Singh', email: 'admin@railways.gov.in', password: 'abcd1234', role: 'Super Admin / Central Legal Cell', railwayScope: 'All', desc: 'Complete global monitoring access to all cases across all 17 Zonal Railways and Divisions.' },
    { id: 'nr_nodal', name: 'Smt. Anjali Sharma', email: 'nr_nodal@railways.gov.in', password: 'password', role: 'Nodal Officer (Northern Railway - NR)', railwayScope: 'NR', desc: 'Restricted view. Only displays and manages cases originating from the Northern Railway Zone.' },
    { id: 'er_nodal', name: 'Shri Manoj Mukherjee', email: 'er_nodal@railways.gov.in', password: 'password', role: 'Nodal Officer (Eastern Railway - ER)', railwayScope: 'ER', desc: 'Restricted view. Only displays and manages cases originating from the Eastern Railway Zone.' },
    { id: 'wr_nodal', name: 'Shri Vikram Mehta', email: 'wr_nodal@railways.gov.in', password: 'password', role: 'Nodal Officer (Western Railway - WR)', railwayScope: 'WR', desc: 'Restricted view. Only displays and manages cases originating from the Western Railway Zone.' }
  ];

  seedUsers.forEach(u => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(u.password, salt, PASSWORD_ITERATIONS, 64, 'sha512').toString('hex');
    insertUser.run(u.id, u.name, u.email.toLowerCase(), hash, salt, PASSWORD_ITERATIONS, u.role, u.railwayScope, u.desc);
  });
  console.log('Users database pre-seeding completed.');
}

// ── user_sessions ──
db.exec(`
  CREATE TABLE IF NOT EXISTS user_sessions (
    token VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);
console.log('user_sessions table verified/created.');

// Migration: add missing columns to cases table for existing databases
const addColumn = (colName, colType) => {
  try { db.exec(`ALTER TABLE cases ADD COLUMN ${colName} ${colType}`); } catch (e) { /* duplicate */ }
};

addColumn('original_oa_no', 'VARCHAR');
addColumn('original_oa_forum', 'VARCHAR');
addColumn('original_oa_date_disposal', 'DATE');
addColumn('original_oa_status', 'TEXT');
addColumn('court_link', 'VARCHAR');
addColumn('last_fetched_hash', 'VARCHAR');
addColumn('last_fetched_at', 'TIMESTAMP');

const stages = [
  'charge_sheet_issued', 'reply_to_charges', 'inquiry_commenced',
  'io_report_submitted', 'da_notice', 'reply_to_da_notice',
  'da_penalty_order', 'upsc_advice', 'appeal_oa_filed',
  'counter_affidavit_filed', 'cat_court_order', 'writ_petition_filed'
];
stages.forEach(stage => {
  addColumn(`${stage}_date`, 'DATE');
  addColumn(`${stage}_notes`, 'TEXT');
});

// ── audit_log ──
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR NOT NULL,
    action VARCHAR NOT NULL,
    target_type VARCHAR NOT NULL,
    target_id INTEGER,
    details TEXT,
    ip_address VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('audit_log table verified/created.');

// ── case_documents ──
db.exec(`
  CREATE TABLE IF NOT EXISTS case_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    filename VARCHAR NOT NULL,
    original_name VARCHAR NOT NULL,
    mime_type VARCHAR DEFAULT 'application/pdf',
    file_size INTEGER,
    storage_path VARCHAR NOT NULL,
    uploaded_by VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  );
`);
console.log('case_documents table verified/created.');

// ── view_presets ──
db.exec(`
  CREATE TABLE IF NOT EXISTS view_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    config TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('view_presets table verified/created.');

// ── email_queue ──
db.exec(`
  CREATE TABLE IF NOT EXISTS email_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER,
    recipient VARCHAR NOT NULL,
    subject VARCHAR NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR DEFAULT 'PENDING',
    scheduled_for DATE,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('email_queue table verified/created.');

// ── FTS5 full-text search index ──
try {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS cases_fts USING fts5(
      case_ref_no, applicant, respondent, synopsis, forum, railway, file_no,
      content='cases', content_rowid='id'
    );
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS cases_fts_ai AFTER INSERT ON cases BEGIN
      INSERT INTO cases_fts(rowid, case_ref_no, applicant, respondent, synopsis, forum, railway, file_no)
      VALUES (new.id, new.case_ref_no, new.applicant, new.respondent, new.synopsis, new.forum, new.railway, new.file_no);
    END;
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS cases_fts_ad AFTER DELETE ON cases BEGIN
      INSERT INTO cases_fts(cases_fts, rowid, case_ref_no, applicant, respondent, synopsis, forum, railway, file_no)
      VALUES('delete', old.id, old.case_ref_no, old.applicant, old.respondent, old.synopsis, old.forum, old.railway, old.file_no);
    END;
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS cases_fts_au AFTER UPDATE ON cases BEGIN
      INSERT INTO cases_fts(cases_fts, rowid, case_ref_no, applicant, respondent, synopsis, forum, railway, file_no)
      VALUES('delete', old.id, old.case_ref_no, old.applicant, old.respondent, old.synopsis, old.forum, old.railway, old.file_no);
      INSERT INTO cases_fts(rowid, case_ref_no, applicant, respondent, synopsis, forum, railway, file_no)
      VALUES (new.id, new.case_ref_no, new.applicant, new.respondent, new.synopsis, new.forum, new.railway, new.file_no);
    END;
  `);
  console.log('FTS5 full-text search index verified/created.');
} catch (e) {
  console.log('FTS5 note:', e.message);
}

module.exports = { db, PASSWORD_ITERATIONS };
