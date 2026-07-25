# ── Legal Case Monitoring — Docker image ──
# Builds the app; data is mounted via docker-compose volumes.
# Test:
#   docker build -t legal-case-monitoring .
#   docker-compose up -d

# ── Stage 1: Frontend build ──
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Stage 2: Backend + Playwright runtime ──
FROM node:22-slim
LABEL org.opencontainers.image.title="Legal Case Monitoring"
LABEL org.opencontainers.image.description="Court Case Monitoring System — Ministry of Railways"

# Install Playwright system deps (auto-detects ARM64 vs amd64)
RUN apt-get update -qq \
    && apt-get install -y -qq --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests and install
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend

# Install Playwright Chromium (detects ARM64 automatically for Pi 4/5)
RUN npx playwright install --with-deps chromium 2>&1 | tail -3

# Copy source code
COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts
COPY backend/legal_tracker.db ./backend/legal_tracker.db
COPY --from=frontend-build /app/dist ./frontend/dist

# Entrypoint — ensures data files exist before the app starts
COPY deploy/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=5000
ENV AUTO_CRAWL_ON_START=true
ENV SQLITE_JOURNAL=DELETE
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/ || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "backend/src/index.js"]
