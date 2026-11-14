// v208: import / export files have no size limit any more (it was 80 MB for a picked or saved file and 200 MB per file inside a .zip).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const J = readFileSync(new URL('../native-android/LiquidNative.java', import.meta.url), 'utf8'), Z = readFileSync(new URL('../src/zipread.js', import.meta.url), 'utf8');

test('Java: no 80 MB cap on a picked file or on a saved file; a plain text file over ~2 GB gets a clear message', () => {
  assert.doesNotMatch(J, /MAX_TRANSFER/);
  assert.ok(!/is too big"/.test(J) && !/too big to save/.test(J));
  assert.ok(J.includes('Integer.MAX_VALUE - 64') && J.includes('is too large to read as text'));
  assert.ok(J.includes('OutOfMemoryError ? "file too large to read"'));   // memory problems are still a controlled message
});

test('zip reading: no per-file size limit by default', () => {
  assert.ok(/\{ max = Infinity, want = WANT \} = \{\}/.test(Z));
  assert.doesNotMatch(Z, /200e6/);
});
