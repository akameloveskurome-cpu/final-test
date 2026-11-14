// Fix session 4 (BUG-024, 114, 189, 196, 203, 228, 240, 275, 326, 327, 353, 373, 408). Behaviour tests run real code; tests labelled GUARD are source checks for CSS / workflow / wiring with no runtime here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLrc } from '../src/lrc.js';
import { fetchSplashPic } from '../src/splashpic.js';
import { dirOf } from '../src/data.js';
import { extract } from './extract.mjs';
import * as fs0 from 'node:fs';
const rd = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('BUG-373: a stamp with 75 seconds stays lyric text instead of vanishing', () => {
  const r = parseLrc('[00:75]odd\n[00:05.00]ok');
  assert.ok(r.lines.some(l => l.text === '[00:75]odd'));
  assert.ok(r.lines.some(l => l.text === 'ok' && l.t === 5));
});

test('BUG-353: a double slash in a path does not make an unnamed folder', () => {
  assert.equal(dirOf({ path: 'Music//A/x.flac' }), 'Music/A');
  assert.equal(dirOf({ path: 'x.flac' }), '');
});

test('BUG-196: a 404 for the splash manifest is "gone" only while the repo still answers', async () => {
  const res = (status, body) => ({ ok: status === 200, status, json: async () => body || {}, arrayBuffer: async () => new ArrayBuffer(0) });
  const down = async () => res(404);                                   // everything 404: wrong branch / private repo / captive page
  assert.equal(await fetchSplashPic(down, 'o/r', 'main', ''), null);
  const emptied = async url => (String(url).includes('/update/latest.json') ? res(200, { code: 'x' }) : res(404));
  assert.deepEqual(await fetchSplashPic(emptied, 'o/r', 'main', ''), { gone: true });
  const broken = async () => { throw new Error('offline'); };
  assert.equal(await fetchSplashPic(broken, 'o/r', 'main', ''), null);
});

test('GUARD: BUG-024: the app no longer registers a listener for an event the plugin never sends', () => {
  assert.ok(!/addListener\('onUpdateProgress'/.test(rd('src/native.js')));
});

test('GUARD: BUG-275: the toast sits above sheets (90/91), the cover viewer (95) and the picture viewer (96)', () => {
  const css = rd('src/styles/app.css');
  assert.ok(/\.toast\{[^}]*z-index:97/.test(css));
  assert.ok(!/\.toast\{[^}]*z-index:80/.test(css));
});

test('GUARD: BUG-228: dvh rules exist behind @supports', () => {
  assert.ok(/@supports \(height:100dvh\)/.test(rd('src/styles/app.css')));
});

test('BUG-240: the stats filter ignores case AND accents (real fold)', () => {
  const fold = extract('src/lstats.js', 'fold');
  assert.equal(fold('Beyoncé'), 'beyonce'); assert.ok(fold('BEYONCÉ').includes(fold('beyonce')));
  assert.equal(fold(null), ''); assert.equal(fold(undefined), ''); assert.equal(fold('Sigur Rós'), 'sigur ros');
});
test('GUARD (needs browser): BUG-114 / BUG-408 stats screen wiring', () => {
  const s = rd('src/lstats.js');
  assert.ok(s.includes('BUG-114') && s.includes('same time last week') && s.includes('BUG-408') && s.includes('fold(e.target.value'));
});
test('GUARD: BUG-189 / 203 / 326 / 327: workflow', { skip: !fs0.existsSync(new URL('../.github/workflows/android.yml', import.meta.url)) && 'no .github/workflows/android.yml in this copy (zips drop dot-folders); it runs on GitHub' }, () => {
  const w = rd('.github/workflows/android.yml');
  assert.ok(!/ls -t \.\/\*\.zip/.test(w) && w.includes('git log -1 --format=%ct'));
  assert.ok(w.includes('actions/cache@v6') && w.includes('~/.gradle/caches'));
  assert.ok(/unpack:\n    runs-on: ubuntu-latest\n    timeout-minutes: 30/.test(w));
  assert.ok(w.includes('gh release view latest') && !w.includes('--limit 100'));
});
