# Legal Case Monitoring — Development Plan

## Current Version
`v3.9` — commit `a7c6670` on `main`

## Constraints
- Do NOT change seeded passwords (`admin`/`abcd1234` + 19 zonal users in `database.js:280-299`)
- Do NOT add/change `.gitignore` entries (user syncs across home/office workstations)
- All AI features use frontend-configured API keys (Gemini/OpenAI/Claude/DeepSeek) sent via `x-ai-api-key` header
- Railway scope enforcement: zonal users only see their zone's data via `req._railwayScope`
- Use Node extension (Option B) for all backend additions — no FastAPI microservice

## Audit: 33 Findings (2 Critical, 12 High, 12 Medium, 7 Low)

### Security (9 findings) — All Fixed except C1
| ID | Finding | Status |
|----|---------|--------|
| C1 | Hardcoded passwords in seed data | SKIPPED (intentional) |
| C2 | No rate limiting on AI/parse routes | FIXED — added `aiLimiter` (10/min) |
| C3 | Missing `requireRole` on mutating routes | FIXED — added to 15 routes |
| C4 | API key in URL query string (Gemini) | FIXED — moved to `x-goog-api-key` header |
| C5 | No file size/type limits on uploads | FIXED — multer 20MB + PDF filter |
| C6 | No railway scope enforcement on sub-routes | FIXED — `enforceScope` on hearings/affidavits/pleadings/documents |
| C7 | Document download IDOR | FIXED — `cases.railway` join + scope check |
| C8 | Duplicate case detection missing | FIXED — composite UNIQUE check + pre-submit modal |
| C9 | Secret exposure risk in env/tools | FIXED — no secrets in client code |

### Backend Bugs/Perf (14 findings) — All Fixed
| ID | Finding | Status |
|----|---------|--------|
| B1 | 8 correlated subqueries in getCases | FIXED — single LEFT JOIN |
| B2 | No indexes on filtered/joined columns | FIXED — 7 new indexes |
| B3 | Missing `order_uploaded` column on hearing_history | FIXED — added + backfill |
| B4 | IST date issues in dashboard + sync | FIXED — `istToday()`/`istDateOffset()` helpers |
| B5 | No scope enforcement in reports controller | FIXED — added `req._railwayScope` |
| B6 | No scope enforcement in file registry | FIXED — added `req._railwayScope` |
| B7 | No scope enforcement in pleadings | FIXED — full rewrite |
| B8 | No scope enforcement in affidavits | FIXED — added checks |
| B9 | SmartSync IST date | FIXED — applied `istToday()` |
| B10 | No transactions in scraper controllers | DEFERRED (M6) |
| B11 | Dual sync locks not unified | DEFERRED (M7) |
| B12 | Comprehensive audit logging missing | DEFERRED (H8) |
| B13 | No PDF OCR fallback | FIXED — Tesseract.js chain |
| B14 | `pdf-parse` returns empty for scanned docs | FIXED — fallback to `pdfjs-dist` + Tesseract |

### Frontend Bugs/UX (11 findings) — All Fixed except H12
| ID | Finding | Status |
|----|---------|--------|
| H1 | Hardcoded `http://` API URL | FIXED — `window.location.protocol` |
| H2 | `getAiHeaders()` not sending key | FIXED — reads from localStorage |
| H3 | useEffect race condition (AnalyticsTab) | FIXED — `active` flag + cleanup |
| H4 | useEffect race condition (KanbanTab) | FIXED — `active` flag + cleanup |
| H5 | No error states on dashboard | FIXED — error banners + Retry buttons |
| H6 | Citations modal: no PDF upload flow | FIXED — upload → AI auto-fill |
| H7 | Dark mode: Recharts not adapting | FIXED — `useTheme()` context |
| H8 | Comprehensive audit logging | DEFERRED |
| H9 | Analytics KPI showing wrong upcoming count | FIXED — switched to `cases.next_hearing_date` |
| H10 | HearingTimeline dead component | FIXED — removed |
| H11 | Dark mode: no shared state | FIXED — `ThemeContext.jsx` created |
| H12 | Incomplete useEffect cleanup in other tabs | DEFERRED (28 hooks need review) |
| H13 | Modal accessibility issues | DEFERRED (M12) |

## Feature Priority Order (Quick Wins First)
All implemented in v3.9.

### Q4 — Duplicate Case Detection
- `GET /api/cases/check-duplicate` endpoint
- Checks `case_ref_no` exact match + composite `(forum, case_type, case_number, case_year)`
- Pre-submit warning modal in `CaseForm.jsx` with "Create anyway" / "View existing" buttons
- Respects railway scope
- SQLite UNIQUE on `case_ref_no` remains as final guard

### Q3 — Dark Mode Polish
- `index.css`: added `--red`/`--red-bg` CSS vars
- `theme-overrides.css`: `#111827` + tinted background catch-all rules
- `AiSettingsPanel.jsx`: replaced inline styles with CSS vars
- `ThemeContext.jsx`: shared `isDark` state for JS components
- `AnalyticsTab.jsx`: Recharts adaptive colors via `useTheme()`
- `App.jsx`: removed local `darkToggle` state → uses context
- NOT doing full inline-style refactor (370+ hardcoded hex values)

### Q1 — Hearing Preparation Checklist
- `hearing_checklist_items` table (auto-creates 4 items per hearing on insert)
- UI: popover on each hearing row in CaseDetail Activity Timeline
- CalendarTab: prep badge for upcoming hearings with unchecked items
- Status: pending/completed per item

### M4 — Case Lifecycle Workflow Visualizer
- `@xyflow/react` + `dagre` for auto-layout
- 6-phase horizontal flow: Filing → Initial Hearing → Evidence → Arguments → Judgment → Disposal
- 12 sub-stages pulled from `PROGRESSION_STAGES` (previously dead code in CaseDetail.jsx)
- Color-coded nodes (completed/current/upcoming)

### M3 — Document OCR
- Server-side Tesseract.js
- Fallback chain: `pdf-parse` → if empty AND file ≤ 5MB → `pdfjs-dist` render pages → Tesseract OCR → concatenated text
- Integrated into 3 PDF handlers: citation parsing, document upload, pleading upload

## Deferred for Next Session

### Q1 — Hearing Checklist (DONE — no further work needed)

### M5 — Custom Report Builder
- User-defined filters + column picker
- Was user's top priority (from "reporting is too rigid" pain point)
- Not yet started

### H8 — Comprehensive Audit Logging
- Audit table: `(user_id, action, resource_type, resource_id, old_value, new_value, ip_address)`
- Middleware for CRUD operations

### H12 — useEffect Cleanup
- 28 useEffect hooks across all tabs need `active` flag + cleanup return
- Currently fixed only in AnalyticsTab and KanbanTab

### M6 — Transactions in Scraper Controllers
- Current scraper INSERTs/UPDATEs not wrapped in transactions
- Risk of partial writes on failure

### M7 — Unify Dual Sync Locks
- Two separate sync lock mechanisms exist; unify into one

### M12 — Modal Accessibility
- Focus trapping, ESC handling, aria attributes

## HC Scraper Plan
See separate file: `docs/hc-scraper-plan.md`
- 5 milestones, 10 files, 2 new deps
- Option B (Node extension) — reuse `backend/` infra
- Deferred — not started

## Architecture Notes
- Backend: Express.js + SQLite (better-sqlite3) on port 5000
- Frontend: React + Vite on port 5173
- DB file: `legal_tracker.db` (SQLite)
- `getAiHeaders()` sends `x-ai-api-key` from localStorage
- `API_BASE_URL` uses `window.location.protocol` (not hardcoded http)
- Dark mode state: `ThemeContext.jsx` (React context, not local state)
- Duplicate check route `GET /cases/check-duplicate` must be placed BEFORE `/cases/:id` in routes to avoid route shadowing
- `hearing_history` has `order_uploaded INTEGER DEFAULT 0` column (backfilled for existing DBs)
