import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldCheck, progressText, changeText, MIN_GAP_MS } from '../src/autocheck.js';

const base = { enabled: true, hasFolder: true, busy: false, now: 1_000_000_000, last: 0 };

test('shouldCheck: first check of a run is allowed', () => assert.equal(shouldCheck(base), true));
test('shouldCheck: setting off, no folder, or a scan already running = never', () => {
  assert.equal(shouldCheck({ ...base, enabled: false }), false);
  assert.equal(shouldCheck({ ...base, hasFolder: false }), false);
  assert.equal(shouldCheck({ ...base, busy: true }), false);
});
test('shouldCheck: at most once per 10 minutes (exact boundary allowed)', () => {
  const last = base.now - MIN_GAP_MS + 1;
  assert.equal(shouldCheck({ ...base, last }), false);
  assert.equal(shouldCheck({ ...base, last: base.now - MIN_GAP_MS }), true);
  assert.equal(shouldCheck({ ...base, last: base.now - 5 * 60_000 }), false);
});
test('shouldCheck: a clock that moved backwards does not block forever', () => assert.equal(shouldCheck({ ...base, last: base.now + 3_600_000 }), true));

test('progressText: counts with thousands separators, clamps, and handles unknown totals', () => {
  assert.equal(progressText(120, 4310), 'Scanning 120 / 4,310');
  assert.equal(progressText(9999, 4310), 'Scanning 4,310 / 4,310');
  assert.equal(progressText(0, 0), 'Scanning…');
  assert.equal(progressText(undefined, undefined), 'Scanning…');
  assert.equal(progressText(-5, 10), 'Scanning 0 / 10');
});

test('changeText: silent when nothing changed, otherwise says what happened', () => {
  assert.equal(changeText({ added: 0, removed: 0 }), '');
  assert.equal(changeText({}), '');
  assert.equal(changeText(), '');
  assert.equal(changeText({ added: 1 }), '1 new song added');
  assert.equal(changeText({ added: 12 }), '12 new songs added');
  assert.equal(changeText({ removed: 1 }), '1 song removed');
  assert.equal(changeText({ added: 3, removed: 2 }), '3 new songs added, 2 songs removed');
});
