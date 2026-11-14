// v208: the splash picture: no blink before it, and it stays at least 2.8 seconds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPLASH_MIN_MS, SPLASH_POLL_MS } from '../src/splashpic.js';
const M = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const H = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('the splash picture stays at least 2.8 seconds; the manifest poll is still 1 second', () => {
  assert.equal(SPLASH_MIN_MS, 2800);
  assert.equal(SPLASH_POLL_MS, 1000);
  assert.ok(M.includes('SPLASH_MIN_MS - (Date.now() - window.__lfSplashAt)'));
  assert.ok(!/setTimeout\(splashHide, 1000\)/.test(M));
});
test('GUARD (needs a phone): index.html reads + decodes the saved picture before the app script, starts it invisible, then shows it; the app script reuses it', () => {
  assert.ok(H.indexOf('__lfSplashP') > H.indexOf('id="lf-splash"') && H.indexOf('__lfSplashP') < H.indexOf('src/main.js'));
  assert.ok(/opacity:0;transition:opacity \.2s/.test(H));
  assert.ok(H.includes("indexedDB.open('lf-splash',1)") && H.includes("createObjectStore('pic')"));
  assert.ok(H.includes("get('current')") && H.includes('im.decode()'));
  assert.ok(M.includes('window.__lfSplashP'));
});
test('no saved picture = the cover is removed at once (no 2.8 s of nothing)', () => {
  assert.ok(M.includes("if (!splashPic.src) { splashHide(); return; }"));
});
