# Court Case Monitoring System (CCMS)

**न्यायालयीन मामला निगरानी प्रणाली**

Ministry of Railways, Government of India — A full-stack application for tracking litigation cases, automated court order scraping, hearing timeline management, and physical file registry across all 17 Zonal Railways.

## Features

### Case Management
- **329+ cases** tracked with 14-column spreadsheet grid
- Drag-and-drop column reordering with localStorage persistence
- Sortable columns (click headers to sort asc/desc)
- Search, filter by status/forum/year/railway
- Pagination (15 per page)

### Automated Court Scraping
- **CAT (Central Administrative Tribunal)** — auto-fetches case details, hearing history, and PDF order links from `cgat.gov.in`
- **3,691 hearing records** scraped across 249 CAT cases
- **2,925 PDF order links** with dates
- **Next hearing dates** extracted from court's daily order pages
- Smart sync: only checks past-due cases, tracks `last_checked_at` to avoid redundant checks
- 30x concurrent requests for fast batch processing

### Case Detail Page
- Next Hearing Date badge (orange for upcoming, red for overdue, green for disposed)
- Chronological hearing timeline with sort toggle (ascending/descending)
- Court orders & documents section with clickable PDF links
- Stage-wise affidavits log
- Nodal officer & advocate contact cards
- Quick access to CAT case status page via "View on Court Website"

### Dashboard
- KPI metrics: Total Cases, Active Litigations, Pending Replies, Upcoming Hearings, Cases Disposed
- Clickable Disposed KPI — filters case grid by status
- Judicial updates & alerts panel with "Dismiss All" button
- Listed Today / Listed This Week hearing tabs
- Quick portal actions panel
- Live clock display

### Smart Sync
- Checks past-due cases on court websites for new orders
- Results popup shows updated vs still-pending cases with petitioner names
- Clickable case references navigate to case detail
- Avoids re-checking cases already checked today

### Additional Features
- **Dark mode** toggle with persistent preference
- **AI Model Settings** (gear icon) — configure provider/model/API key for LLM-powered parsing
- Citations library (Rule 56(j) & UPSC Advice precedents)
- File registry with physical file movement tracking
- Full-text search (FTS5) across cases, hearings, citations
- CSV export, analytics dashboard, audit log
- Bulk operations (update status/railway/delete)
- Saved view presets per user

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, React Router |
| Backend | Node.js, Express |
| Database | SQLite (via better-sqlite3) |
| Styling | CSS (Inter + Outfit fonts) |
| Scraping | Node.js fetch (30x concurrent), Playwright (headless Chromium) |
| Validation | Zod |
| Logging | Pino |
| Security | Helmet, express-rate-limit, PBKDF2 (600K iterations) |

## Quick Start

### Prerequisites
- Node.js v18+ (v20 recommended)
- npm

### Setup

```bash
# Clone
git clone https://github.com/ashishgem95-gif/legalcasemonitoring.git
cd legalcasemonitoring

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..

# Create environment file
cp backend/.env.example backend/.env

# (Optional) Seed cases from Excel — requires pandas
pip3 install pandas openpyxl
python3 seed_db.py

# Start servers
cd backend && node src/index.js &    # Port 5000
cd frontend && npm run dev           # Port 5173
```

Open **http://localhost:5173**

### Default Login

| User | Password | Access |
|------|----------|--------|
| `admin` | `abcd1234` | Super Admin (All Zones) |
| `nr_nodal` | `password` | Northern Railway |
| `er_nodal` | `password` | Eastern Railway |
| `wr_nodal` | `password` | Western Railway |

## API Endpoints

### Auth
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout

### Cases
- `GET /api/cases` — List all cases (search, filter, sort)
- `GET /api/cases/:id` — Get case detail
- `POST /api/cases` — Create case (Zod validated)
- `PUT /api/cases/:id` — Update case
- `DELETE /api/cases/:id` — Delete case
- `POST /api/cases/parse-file` — AI-powered case file parsing
- `POST /api/cases/parse-pdf` — PDF case file parsing

### Hearings
- `GET /api/cases/:id/hearings` — Get hearing history
- `POST /api/cases/:id/hearings` — Add hearing record

### Sync & Scraping
- `POST /api/sync/orders` — Full order scrape for all CAT cases
- `POST /api/sync/smart` — Smart sync for past-due cases only
- `POST /api/sync/playwright` — Playwright browser-based scraping
- `GET /api/sync/status` — Check sync status

### Analytics & Reports
- `GET /api/analytics/dashboard` — Dashboard stats
- `GET /api/analytics/health` — System health
- `GET /api/reports/export?format=csv` — CSV export
- `GET /api/reports/hearing-calendar` — Hearing calendar
- `GET /api/reports/zone-distribution` — Zone-wise distribution

### Other
- `GET /api/citations` — Legal citations
- `GET /api/alerts` — Case alerts
- `PUT /api/alerts/read-all` — Dismiss all alerts
- `GET /api/search?q=keyword` — Full-text search
- `POST /api/bulk/update` — Bulk operations
- `GET /api/audit-log` — Audit trail
- `GET /api/view-presets` — Saved column layouts

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/         # Database, logger, validator
│   │   ├── controllers/    # 15 controllers
│   │   ├── middleware/     # Auth middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Scrapers, LLM router, email, backup
│   │   └── tests/          # API test suite
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── utils/          # API client
│   │   ├── App.jsx         # Main app with routing
│   │   └── index.css       # Global styles
│   └── package.json
├── root/                   # Excel seed data
├── seed_db.py              # Database seeder
└── legal_tracker.db        # SQLite database
```

## Configuration

### AI/LLM Settings
Click the ⚙️ gear icon in the header to configure:
- **Provider**: Gemini, OpenAI, Anthropic, DeepSeek
- **Model**: Any model name (e.g., `gemini-1.5-flash`, `gpt-4o`, `deepseek-chat`)
- **API Key**: Your provider's API key

Or set in `backend/.env`:
```
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```

All LLM features fall back to regex-based parsing if no API key is configured.

## License

Ministry of Railways, Government of India — Internal Use
