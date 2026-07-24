#!/usr/bin/env bash
set -euo pipefail
# ── One-time Pi setup for Legal Case Monitoring ──
# Run:  chmod +x setup-pi.sh && sudo ./setup-pi.sh
# Assumes Raspberry Pi OS (Debian Bookworm), 8 GB RAM.

PI_USER="${SUDO_USER:-$USER}"
PROJECT_DIR="/home/$PI_USER/legal-case-monitoring"

echo "=== 1. System packages ==="
sudo apt-get update -qq
sudo apt-get install -y -qq \
  curl git build-essential python3 \
  sqlite3 nginx

echo "=== 2. Node.js 22 (ARM64) ==="
if ! command -v node &>/dev/null || [[ "$(node -v)" < "v18" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
  sudo apt-get install -y nodejs
fi
echo "Node $(node -v) · npm $(npm -v)"

echo "=== 3. Clone / pull project ==="
if [ -d "$PROJECT_DIR" ]; then
  cd "$PROJECT_DIR" && git pull origin main
else
  git clone https://github.com/ashishgem95-gif/legalcasemonitoring.git "$PROJECT_DIR"
  cd "$PROJECT_DIR"
fi

echo "=== 4. Install dependencies ==="
npm install --prefix backend --ignore-scripts=false 2>&1 | tail -5
npm install --prefix frontend 2>&1 | tail -3

echo "=== 5. Install Playwright browser (Chromium) ==="
npx playwright install chromium 2>&1 | tail -3

echo "=== 6. Build frontend ==="
npm run build --prefix frontend 2>&1 | tail -5

echo "=== 7. Environment file ==="
if [ ! -f backend/.env ]; then
  cp deploy/.env.production backend/.env
  echo "Created backend/.env — PLEASE EDIT IT with your Gemini/OpenAI API keys"
  echo "  nano backend/.env"
fi

echo "=== 8. systemd service ==="
sudo cp deploy/legal-case-monitoring.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable legal-case-monitoring
sudo systemctl start legal-case-monitoring
sleep 3
sudo systemctl status legal-case-monitoring --no-pager | head -12

echo ""
echo "✅ Setup complete!"
echo "   App should be running at http://$(hostname -I | awk '{print $1}'):5000"
echo "   Logs:  sudo journalctl -u legal-case-monitoring -f"
echo "   Restart:  sudo systemctl restart legal-case-monitoring"
