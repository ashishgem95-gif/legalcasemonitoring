/**
 * Integration tests for hcLookupService using a separate test database.
 * Tests the registry pattern, cache hit/miss, UPSERT, refresh batches, and error handling.
 *
 * IMPORTANT: This file sets HC_TEST_MODE=1 to use a separate test DB
 * (legal_tracker.test.db) so the main database is never touched.
 *
 * Run: HC_TEST_MODE=1 node --test src/tests/hc/hcLookupService.test.js
 */
process.env.HC_TEST_MODE = '1'; // MUST come before requiring any DB module

const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const TEST_DB_PATH = path.resolve(__dirname, '..', '..', '..', 'legal_tracker.test.db');

// Force a clean test DB before the entire suite
try { fs.unlinkSync(TEST_DB_PATH); } catch (_) { /* file may not exist yet */ }
try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch (_) {}
try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch (_) {}

// Initialize the test DB by loading database.js (HC_TEST_MODE is already set)
const { db, run, all, get } = require('../../config/dbHelper');
const svc = require('../../services/hcLookupService');

// Track scraper calls across tests
function makeMockScraper(name, options = {}) {
  return async ({ courtCode, caseType, caseNumber, caseYear }) => {
    const calls = svc._testCalls || (svc._testCalls = []);
    calls.push({ scraper: name, courtCode, caseType, caseNumber, caseYear });
    if (options.throwWith) throw options.throwWith;
    return {
      status: options.status || 'success',
      partyNames: options.partyNames || 'Mock Party vs Mock Respondent',
      caseStatus: options.caseStatus || 'Pending',
      nextHearingDate: options.nextHearingDate || '2026-07-15',
      latestOrderLink: options.latestOrderLink || 'https://example.com/order.pdf',
      historyLink: options.historyLink || 'https://example.com/history',
      hearings: options.hearings || [],
      source: 'mock-' + name,
    };
  };
}

beforeEach(() => {
  // Clear registry + cache table + call log between tests
  svc._resetForTests();
  if (svc._testCalls) svc._testCalls.length = 0;
  run('DELETE FROM hc_case_cache');
});

after(() => {
  // Clean up the test DB
  try { db.close(); } catch (_) {}
  try { fs.unlinkSync(TEST_DB_PATH); } catch (_) {}
  try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch (_) {}
  try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch (_) {}
});

test('registerHcScraper + getRegisteredScrapers', () => {
  assert.deepEqual(svc.getRegisteredScrapers(), []);
  svc.registerHcScraper('HC/Delhi', makeMockScraper('delhi'));
  svc.registerHcScraper('HC/Mumbai', makeMockScraper('mumbai'));
  assert.deepEqual(svc.getRegisteredScrapers().sort(), ['HC/Delhi', 'HC/Mumbai']);
});

test('registerHcScraper: validates inputs', () => {
  assert.throws(() => svc.registerHcScraper('', () => {}), /courtCode/);
  assert.throws(() => svc.registerHcScraper('HC/X', null), /scraperFn/);
});

test('lookupHcCase: cache miss → scraper called → UPSERT → result returned', async () => {
  svc.registerHcScraper('HC/Delhi', makeMockScraper('delhi'));
  const result = await svc.lookupHcCase('HC/Delhi', 'WP', '13907', '2022');

  assert.equal(result.status, 'success');
  assert.equal(result.partyNames, 'Mock Party vs Mock Respondent');
  assert.equal(result.source, 'mock-delhi');
  assert.equal(svc._testCalls.length, 1);
  assert.equal(svc._testCalls[0].scraper, 'delhi');
  assert.equal(svc._testCalls[0].caseType, 'WP');
  assert.equal(svc._testCalls[0].caseNumber, '13907');
  assert.equal(svc._testCalls[0].caseYear, '2022');

  // Verify UPSERT wrote a row
  const row = get(
    'SELECT * FROM hc_case_cache WHERE court_code = ? AND case_type = ? AND case_number = ? AND case_year = ?',
    ['HC/Delhi', 'WP', '13907', 2022]
  );
  assert.ok(row, 'cache row should exist after lookup');
  assert.equal(row.case_status, 'Pending');
  assert.equal(row.party_names, 'Mock Party vs Mock Respondent');
  assert.equal(row.source, 'mock-delhi');
});

test('lookupHcCase: cache hit on second call → scraper NOT called', async () => {
  svc.registerHcScraper('HC/Delhi', makeMockScraper('delhi'));

  // First call: miss
  await svc.lookupHcCase('HC/Delhi', 'WP', '13907', '2022');
  assert.equal(svc._testCalls.length, 1);

  // Second call: should be cache hit
  const result2 = await svc.lookupHcCase('HC/Delhi', 'WP', '13907', '2022');
  assert.equal(svc._testCalls.length, 1, 'scraper should NOT be called on cache hit');
  assert.equal(result2.source, 'cache');
  assert.equal(result2.partyNames, 'Mock Party vs Mock Respondent');
});

test('lookupHcCase: 501 error for unregistered court with clear message', async () => {
  await assert.rejects(
    svc.lookupHcCase('HC/Mumbai', 'WP', '1234', '2024'),
    (err) => {
      assert.equal(err.status, 501);
      assert.match(err.message, /No scraper registered for HC\/Mumbai/);
      return true;
    }
  );
});

test('lookupHcCase: throws on missing parameters', async () => {
  await assert.rejects(svc.lookupHcCase(null, 'WP', '1234', '2024'), /required/);
  await assert.rejects(svc.lookupHcCase('HC/Delhi', null, '1234', '2024'), /required/);
  await assert.rejects(svc.lookupHcCase('HC/Delhi', 'WP', null, '2024'), /required/);
  await assert.rejects(svc.lookupHcCase('HC/Delhi', 'WP', '1234', null), /required/);
});

test('lookupHcCase: 24-hour TTL is set on the cache row', async () => {
  svc.registerHcScraper('HC/Delhi', makeMockScraper('delhi'));
  const before = Date.now();
  await svc.lookupHcCase('HC/Delhi', 'WP', '13907', '2022');
  const after = Date.now();

  const row = get(
    'SELECT * FROM hc_case_cache WHERE court_code = ? AND case_type = ? AND case_number = ? AND case_year = ?',
    ['HC/Delhi', 'WP', '13907', 2022]
  );
  const expiresAtMs = new Date(row.expires_at).getTime();
  // expires_at should be ~24 hours (86_400_000 ms) from now, allow ±1s window
  assert.ok(Math.abs(expiresAtMs - before - 24 * 60 * 60 * 1000) < 2000, 'expires_at should be ~24h from call time');
  assert.ok(Math.abs(expiresAtMs - after - 24 * 60 * 60 * 1000) < 2000, 'expires_at should be ~24h from call time');
});

test('lookupHcCase: UPSERT updates existing row on re-lookup (after cache clear)', async () => {
  svc.registerHcScraper('HC/Delhi', makeMockScraper('delhi', { partyNames: 'First vs Second' }));
  await svc.lookupHcCase('HC/Delhi', 'WP', '13907', '2022');

  // Clear cache but keep registry
  run('DELETE FROM hc_case_cache');

  // Re-register with new mock that returns different data
  svc._resetForTests();
  svc.registerHcScraper('HC/Delhi', makeMockScraper('delhi', { partyNames: 'Third vs Fourth' }));
  await svc.lookupHcCase('HC/Delhi', 'WP', '13907', '2022');

  const row = get(
    'SELECT party_names FROM hc_case_cache WHERE court_code = ? AND case_type = ? AND case_number = ? AND case_year = ?',
    ['HC/Delhi', 'WP', '13907', 2022]
  );
  assert.equal(row.party_names, 'Third vs Fourth', 'UPSERT should update with new data');
});

test('refreshDueHcCases: returns 0 when no scrapers registered', async () => {
  const result = await svc.refreshDueHcCases();
  assert.equal(result.checkedCount, 0);
  assert.equal(result.errorCount, 0);
});

test('refreshDueHcCases: with no cases in DB, returns 0', async () => {
  svc.registerHcScraper('HC/Delhi', makeMockScraper('delhi'));
  // The test DB has no cases with forum='HC/Delhi' and next_hearing_date within 7 days
  const result = await svc.refreshDueHcCases();
  assert.equal(result.checkedCount, 0);
});

test('lookupHcCase: scraper error propagates and is NOT cached', async () => {
  let attempt = 0;
  const flakyScraper = async () => {
    attempt++;
    if (attempt === 1) throw new Error('Network timeout');
    return { status: 'success', partyNames: 'Recovered' };
  };
  svc.registerHcScraper('HC/Delhi', flakyScraper);

  await assert.rejects(
    svc.lookupHcCase('HC/Delhi', 'WP', '13907', '2022'),
    /Network timeout/
  );

  // No row should be cached because the result was a failure
  const row = get(
    'SELECT COUNT(*) AS n FROM hc_case_cache WHERE court_code = ?',
    ['HC/Delhi']
  );
  assert.equal(row.n, 0, 'failed scrapes should not write to cache');
});
