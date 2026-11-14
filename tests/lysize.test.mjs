// v148: free lyrics size + the right-edge clipping fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanLyPx, lyName, LY_MIN, LY_MAX, LY_DEF } from '../src/lysize.js';
const rd = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('default is Medium (23 px); a bad or missing value falls back to the old label, then to Medium', () => {
  assert.equal(LY_DEF, 23);
  assert.equal(cleanLyPx(undefined, undefined), 23); assert.equal(cleanLyPx(null, 'Medium'), 23); assert.equal(cleanLyPx('', 'Large'), 26);
  assert.equal(cleanLyPx(undefined, 'Small'), 20); assert.equal(cleanLyPx('abc', 'Large'), 26); assert.equal(cleanLyPx(NaN, 'nope'), 23);
});
test('any whole pixel size works, clamped to the range and rounded', () => {
  assert.equal(cleanLyPx(31, 'Medium'), 31); assert.equal(cleanLyPx('31.6', 'Medium'), 32); assert.equal(cleanLyPx(2, 'Medium'), LY_MIN); assert.equal(cleanLyPx(900, 'Medium'), LY_MAX);
  assert.equal(cleanLyPx(0, 'Large'), LY_MIN);
});
test('names: the three old sizes keep their name, other sizes show pixels', () => {
  assert.equal(lyName(23), 'Medium (23 px)'); assert.equal(lyName(20), 'Small (20 px)'); assert.equal(lyName(26), 'Large (26 px)'); assert.equal(lyName(31), '31 px');
});
test('GUARD (needs the running app / a browser): main.js: the default is Medium, the size comes from lyricPx, the row opens a slider screen and the slider is saved', () => {
  const m = rd('src/main.js');
  assert.match(m, /lyricSize: 'Medium', userName/);
  assert.match(m, /--lyric-size', cleanLyPx\(set\.lyricPx, set\.lyricSize\) \+ 'px'/);
  assert.match(m, /case 'lyricsize': push\('lysize'\)/);
  assert.match(m, /e\.target\.dataset\.lypx !== undefined\) \{ set\.lyricPx = cleanLyPx/);
  assert.match(m, /set\.lyricPx = cleanLyPx\(set\.lyricPx, set\.lyricSize\)/);   // migration: an older saved Large keeps 26 px
});
test('GUARD (CSS needs a browser): right-edge fix: every synced line is narrower by the biggest scale (it grows from its left edge)', () => {
  const css = rd('src/styles/app.css');
  assert.match(css, /\.ln\.tap\{width:80%;width:calc\(100% \/ max\(var\(--ly-zoom,1\.02\), var\(--ly-small,\.94\), 1\)\);box-sizing:border-box;overflow-wrap:anywhere\}/);
  assert.match(css, /\.ln\.tap\.cur\{opacity:1;transform:scale\(var\(--ly-zoom,1\.02\)\)\}/);
});
