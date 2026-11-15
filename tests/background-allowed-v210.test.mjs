// v210c: the background switch is read from the battery-optimization whitelist (ignoring). Confirmed with adb on OnePlus and OPPO.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const J = readFileSync(new URL('../native-android/LiquidNative.java', import.meta.url), 'utf8');
const B = readFileSync(new URL('../src/bgallow.js', import.meta.url), 'utf8');
test('allowed is decided by ignoring only', () => {
  assert.match(J, /o\.put\("allowed", ignoring\);/);
});
test('the log line the owner reads is unchanged', () => {
  assert.ok(J.includes('"background: allowed check ignoring=" + ignoring + " restricted=" + restricted + " appOpBlocked=" + appOpBlocked'));
});
test('the popup re-checks when the app comes back to the front (no stale OK)', () => {
  assert.match(B, /okUntil = 0;   \/\/ look again/);
});
