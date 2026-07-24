# Legal Case Monitoring — Raspberry Pi 4 Deployment

## Prerequisites
- Raspberry Pi 4 with 8 GB RAM running Raspberry Pi OS (64-bit, Bookworm)
- At least 4 GB free disk
- GitHub Personal Access Token (for clone/pull)

## Option A — Docker (recommended, most portable)

```bash
# 1. Clone the repo
git clone https://github.com/ashishgem95-gif/legal-case-monitoring-pi.git ~/legal-case-monitoring
cd ~/legal-case-monitoring

# 2. Copy your existing DB + create env file
#    If you already have a legal_tracker.db from another machine, copy it here.
#    Otherwise the app creates a fresh one on first start.
#    Then:
nano backend/.env      # set GEMINI_API_KEY etc.

# 3. Build and start
docker compose up -d --build

# 4. Check logs
docker compose logs -f

# App is running at http://<your-pi-ip>:5000
```

### Docker commands

| Action | Command |
|--------|---------|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| Rebuild + start | `docker compose up -d --build` |
| Logs | `docker compose logs -f` |
| Rebuild after git pull | `git pull && docker compose up -d --build` |

### Updating after a code change

```bash
cd ~/legal-case-monitoring
git pull
docker compose up -d --build   # rebuilds with new code, existing data preserved
```

---

## Option B — systemd (without Docker)

```bash
sudo apt install -y git
git clone https://github.com/ashishgem95-gif/legal-case-monitoring-pi.git ~/legal-case-monitoring
cd ~/legal-case-monitoring
sudo bash deploy/setup-pi.sh
```

---

## Manual setup (debugging / customising)

### 1. Clone the project

### 1. Clone the project
```bash
cd ~
git clone https://github.com/ashishgem95-gif/legalcasemonitoring.git legal-case-monitoring
cd legal-case-monitoring
```

### 2. Install system dependencies
```bash
sudo apt update
sudo apt install -y curl git build-essential python3 sqlite3 nginx
```

### 3. Install Node.js 22
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
node -v   # should show v22.x
```

### 4. Install project deps + Playwright
```bash
npm install --prefix backend
npm install --prefix frontend
npx playwright install chromium
```

### 5. Build the frontend
```bash
npm run build --prefix frontend
```

### 6. Configure environment
```bash
cp deploy/.env.production backend/.env
nano backend/.env   # set GEMINI_API_KEY etc.
```

### 7. Start with systemd (auto-restart on boot / crash)

```bash
sudo cp deploy/legal-case-monitoring.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable legal-case-monitoring
sudo systemctl start legal-case-monitoring
sudo systemctl status legal-case-monitoring
```

### 8. (Optional) Nginx reverse proxy for SSL + clean domain

```nginx
# /etc/nginx/sites-available/legal-case-monitoring
server {
    listen 80;
    server_name your-domain.in;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then: `sudo ln -s /etc/nginx/sites-available/legal-case-monitoring /etc/nginx/sites-enabled/ && sudo systemctl restart nginx`

---

## Useful commands

| Action | Command |
|--------|---------|
| Start / stop / restart | `sudo systemctl start/stop/restart legal-case-monitoring` |
| View live logs | `sudo journalctl -u legal-case-monitoring -f` |
| Last 50 log lines | `sudo journalctl -u legal-case-monitoring -n 50 --no-pager` |
| App status | `sudo systemctl status legal-case-monitoring` |
| Open SQLite shell | `sqlite3 legal_tracker.db` |
| Backup DB | `cp legal_tracker.db backups/backup_$(date +%Y-%m-%d).db` |

## Data directory

All data lives under `~/legal-case-monitoring/`:
- `legal_tracker.db` — SQLite database (back it up regularly!)
- `backups/` — auto-backups created by the backup scheduler
- `root/` — Excel import files (HC/SC updates, general import)
- `document_archive/` — uploaded PDF orders and documents
- `backend/.env` — secrets (API keys)

## Performance notes (Pi 4, 8 GB)

- **RAM idle:** ~250 MB (backend + built frontend)
- **RAM during sync:** ~600–800 MB (Playwright browser spike)
- **CPU sync:** 2–4 cores at 60–80% during auto-crawl
- **Disk:** The DB + all documents typically fit in 500 MB – 2 GB
- The systemd service includes `Restart=always` — if sync runs out of RAM, the process restarts automatically
