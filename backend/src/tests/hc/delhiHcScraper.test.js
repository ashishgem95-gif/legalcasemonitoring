/**
 * Unit tests for the helper functions exported by delhiHcScraper.
 * No network, no Playwright, no DB — pure function tests.
 *
 * Run: node --test src/tests/hc/delhiHcScraper.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStatus, parseDateLoose } = require('../../services/delhiHcScraper');

test('normalizeStatus: DISPOSED variants', () => {
  assert.equal(normalizeStatus('DISPOSED'), 'Disposed');
  assert.equal(normalizeStatus('Disposed'), 'Disposed');
  assert.equal(normalizeStatus('DECIDED'), 'Disposed');
  assert.equal(normalizeStatus('DISMISSED'), 'Disposed');
  assert.equal(normalizeStatus('SETTLED'), 'Disposed');
  assert.equal(normalizeStatus('WITHDRAWN'), 'Disposed');
  assert.equal(normalizeStatus('CLOSED'), 'Disposed');
});

test('normalizeStatus: PENDING variants', () => {
  assert.equal(normalizeStatus('PENDING'), 'Pending');
  assert.equal(normalizeStatus('Pending'), 'Pending');
  assert.equal(normalizeStatus('Adjourned for Hearing'), 'Pending');
  assert.equal(normalizeStatus('HEARING'), 'Pending');
  assert.equal(normalizeStatus('ADJOURNED'), 'Pending');
});

test('normalizeStatus: edge cases', () => {
  assert.equal(normalizeStatus(null), null);
  assert.equal(normalizeStatus(''), null);
  assert.equal(normalizeStatus('   '), null);
  assert.equal(normalizeStatus(undefined), null);
});

test('normalizeStatus: unknown values pass through as title case', () => {
  assert.equal(normalizeStatus('contempt'), 'Contempt');
  assert.equal(normalizeStatus('UNKNOWN_STATUS'), 'Unknown_status');
});

test('parseDateLoose: DD/MM/YYYY', () => {
  assert.equal(parseDateLoose('15/03/2025'), '2025-03-15');
  assert.equal(parseDateLoose('1/1/2026'), '2026-01-01');
  assert.equal(parseDateLoose('31/12/2024'), '2024-12-31');
  assert.equal(parseDateLoose('15/03/2025  '), '2025-03-15');
});

test('parseDateLoose: DD-MM-YY (2-digit year)', () => {
  assert.equal(parseDateLoose('15-03-25'), '2025-03-15');
  assert.equal(parseDateLoose('15-03-99'), '2099-03-15');
  assert.equal(parseDateLoose('01-01-00'), '2000-01-01');
});

test('parseDateLoose: DD.MM.YYYY', () => {
  assert.equal(parseDateLoose('15.03.2025'), '2025-03-15');
});

test('parseDateLoose: YYYY-MM-DD (ISO)', () => {
  assert.equal(parseDateLoose('2025-03-15'), '2025-03-15');
  assert.equal(parseDateLoose('2024-12-31'), '2024-12-31');
  assert.equal(parseDateLoose('2026-01-01'), '2026-01-01');
});

test('parseDateLoose: regression for the M2 unanchored-regex bug', () => {
  // The original bug: parseDateLoose('2025-03-15') returned '2015-03-25'
  // because the regex matched '25-03-15' starting at offset 2 and
  // treated '15' as the year (then +2000 → 2015) and '25' as the day.
  assert.equal(parseDateLoose('2025-03-15'), '2025-03-15');
  assert.equal(parseDateLoose('2025-12-31'), '2025-12-31');
  assert.equal(parseDateLoose('2024-02-29'), '2024-02-29');
});

test('parseDateLoose: garbage / null / empty / undefined', () => {
  assert.equal(parseDateLoose('garbage'), null);
  assert.equal(parseDateLoose('15 Mar 2025'), null);
  assert.equal(parseDateLoose(''), null);
  assert.equal(parseDateLoose('   '), null);
  assert.equal(parseDateLoose(null), null);
  assert.equal(parseDateLoose(undefined), null);
  assert.equal(parseDateLoose(0), null);
});
