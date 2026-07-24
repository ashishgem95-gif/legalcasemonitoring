// Single shared in-memory advisory lock for ALL sync entry points
// (scraperService crawl + syncController batch/playwright/orders/smart/hc/full).
// Prevents concurrent syncs from writing partial or duplicate state and from
// creating duplicate case_alerts.

let holder = null; // { type, startedAt }

function tryAcquire(type) {
  if (holder) return false;
  holder = { type, startedAt: new Date().toISOString() };
  return true;
}

function release() {
  holder = null;
}

function isLocked() {
  return holder !== null;
}

function getState() {
  return holder;
}

module.exports = { tryAcquire, release, isLocked, getState };
