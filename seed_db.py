import os
import re
import sqlite3
import pandas as pd
from datetime import datetime

DB_PATH = "legal_tracker.db"
EXCEL_PATH = "root/clean data - legal cases.xlsx - Sheet1.csv.xlsx"

def clean_date(val):
    if pd.isna(val) or not str(val).strip():
        return None
    val_str = str(val).strip()
    
    # Check if it looks like an Excel serial date number
    if val_str.replace('.', '', 1).isdigit():
        try:
            # Excel dates start from 1900-01-01 (or 1899-12-30 due to 1900 leap year bug)
            excel_date = float(val_str)
            return pd.to_datetime(excel_date, unit='D', origin='1899-12-30').strftime("%Y-%m-%d")
        except:
            pass

    # Try parsing formats: DD.MM.YYYY, YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(val_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
            
    # Try using pandas helper for arbitrary date strings
    try:
        parsed_dt = pd.to_datetime(val_str, errors='coerce')
        if pd.notna(parsed_dt):
            return parsed_dt.strftime("%Y-%m-%d")
    except:
        pass

    return None

def split_names(name_str):
    if pd.isna(name_str) or not str(name_str).strip():
        return "Unknown Petitioner", "Union of India (UOI) & Ors."
    
    name_str = str(name_str).strip()
    # Delimiters: Vs., VS, vs, v/s, V/s
    parts = re.split(r'\s+(?:Vs\.?|VS|vs|v/s|V/s)\s+', name_str, flags=re.IGNORECASE)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return name_str, "Union of India (UOI) & Ors."

def seed_database():
    if not os.path.exists(EXCEL_PATH):
        print(f"Error: Case spreadsheet not found at {EXCEL_PATH}")
        return
        
    print(f"Reading case spreadsheet from {EXCEL_PATH}...")
    df = pd.read_excel(EXCEL_PATH, sheet_name="Sheet1")
    
    print("Connecting to database...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Enable Foreign Key support
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Create tables matching extended data models
    print("Creating tables...")
    cursor.execute("""
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS hearing_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER,
        hearing_date DATE NOT NULL,
        order_raw_text TEXT,
        order_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );
    """)
    
    cases_inserted = 0
    hearings_inserted = 0
    
    print("Processing spreadsheet rows...")
    for index, row in df.iterrows():
        # Extrapolate case reference number fields
        case_type = str(row.get('Case Type', '')).strip() if pd.notna(row.get('Case Type')) else ""
        case_num = str(row.get('Case Number', '')).strip() if pd.notna(row.get('Case Number')) else ""
        year = str(row.get('Year', '')).strip() if pd.notna(row.get('Year')) else ""
        forum = str(row.get('CAT/HC', '')).strip() if pd.notna(row.get('CAT/HC')) else ""
        
        # Clean case_num if it ends in float representation like "2342.0"
        if case_num.endswith('.0'):
            case_num = case_num[:-2]
        if year.endswith('.0'):
            year = year[:-2]
            
        # Skip if crucial reference fields are missing or blank
        if not case_type or case_type == 'nan' or not case_num or case_num == 'nan':
            continue
            
        # Construct natural unique key
        case_ref_no = f"{case_type}/{case_num}/{year}"
        if forum and forum != 'nan':
            case_ref_no += f" ({forum})"
            
        # Parse applicant and respondent names
        name_val = row.get('Name', '')
        applicant, respondent = split_names(name_val)
        
        # Clean and parse date columns
        date_reply = clean_date(row.get('Reply Filed', ''))
        doh_date = clean_date(row.get('DOH', ''))
        
        # Insert case record
        try:
            cursor.execute("""
            INSERT OR REPLACE INTO cases (
                case_ref_no, railway, applicant, respondent, employee_designation,
                case_type, case_number, case_year, forum, synopsis, file_no, link_file_no,
                date_filing_reply, present_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                case_ref_no,
                str(row.get('Railway', '')).strip() if pd.notna(row.get('Railway')) else None,
                applicant,
                respondent,
                str(row.get('Designation', '')).strip() if pd.notna(row.get('Designation')) else None,
                case_type,
                case_num,
                int(float(year)) if year and year != 'nan' and year.isdigit() else None,
                forum if forum != 'nan' else None,
                str(row.get('Issue', '')).strip() if pd.notna(row.get('Issue')) else "",
                str(row.get('File No.', '')).strip() if pd.notna(row.get('File No.')) else None,
                str(row.get('Link File No.', '')).strip() if pd.notna(row.get('Link File No.')) else None,
                date_reply,
                str(row.get('Status', '')).strip() if pd.notna(row.get('Status')) else "Pending"
            ))
            
            # Retrieve generated case ID for hearing log foreign key link
            cursor.execute("SELECT id FROM cases WHERE case_ref_no = ?", (case_ref_no,))
            case_id = cursor.fetchone()[0]
            cases_inserted += 1
            
            # If DOH (Date of Hearing) is present, seed the first chronological hearing record
            if doh_date:
                # Add default text describing initial migrated hearing
                cursor.execute("""
                INSERT INTO hearing_history (case_id, hearing_date, order_raw_text, order_summary)
                VALUES (?, ?, ?, ?)
                """, (
                    case_id,
                    doh_date,
                    "Historical hearing record imported during database seeding.",
                    "Migrated historical hearing date."
                ))
                hearings_inserted += 1
                
        except Exception as e:
            print(f"Error inserting row {index + 1} ({case_ref_no}): {e}")
            
    conn.commit()
    conn.close()
    print(f"Seeding process finished! Successfully ingested {cases_inserted} cases and seeded {hearings_inserted} hearings.")

if __name__ == "__main__":
    seed_database()
