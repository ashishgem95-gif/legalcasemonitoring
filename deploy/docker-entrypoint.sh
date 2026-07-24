#!/bin/sh
# ── Docker entrypoint — initialise persistent data files ──
# Ensures the required data files/dirs exist on host-mounted volumes
# before the backend starts.

set -e

# Create empty data files if they don't exist (Docker bind-mount creates
# directories for missing paths; this converts them to files).
DB_PATH="${DB_PATH:-/app/backend/legal_tracker.db}"
if [ ! -f "$DB_PATH" ]; then
  echo "Entrypoint: creating empty $DB_PATH"
  mkdir -p "$(dirname "$DB_PATH")"
  touch "$DB_PATH"
fi

# Ensure data directories exist
for d in backups document_archive root; do
  mkdir -p "/app/$d"
done

# Copy example env if real one doesn't exist
if [ ! -f /app/backend/.env ]; then
  echo "Entrypoint: creating /app/backend/.env from example"
  if [ -f /app/deploy/.env.production ]; then
    cp /app/deploy/.env.production /app/backend/.env
    echo "  ⚠  EDIT backend/.env with your API keys!"
  else
    touch /app/backend/.env
  fi
fi

exec "$@"
