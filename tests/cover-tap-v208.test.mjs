// v208: tapping a cover. Now Playing shows the ORIGINAL cover by default (Settings > Tap cover shows original = on); album pages always show the person's own picture / GIF.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';
const M = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('viewHtml: custom flag off = the original cover (a.g), on = the custom layer (song picture first, then the album picture)', () => {
  const coverHtml = extract('src/main.js', 'coverHtml', {});
  const gOf = a => 'ALB:' + a.id, gOfT = t => 'SONG:' + t.id;
  const coverHtmlC = extract('src/main.js', 'coverHtmlC', { gOf, gOfT });
  const viewHtml = extract('src/main.js', 'viewHtml', { coverHtml, coverHtmlC });
  assert.equal(viewHtml({ id: 'A', g: 'ORIG' }), '<span class="cover blk" style="--g:ORIG"></span>');
  assert.equal(viewHtml({ id: 'A', g: 'ORIG', _c: false, _t: { id: 'T' } }), '<span class="cover blk" style="--g:ORIG"></span>');
  assert.equal(viewHtml({ id: 'A', g: 'ORIG', _c: true }), '<span class="cover blk" style="--g:ALB:A"></span>');
  assert.equal(viewHtml({ id: 'A', g: 'ORIG', _c: true, _t: { id: 'T' } }), '<span class="cover blk" style="--g:SONG:T"></span>');
});
test('the setting exists, is ON by default, is cleaned on import and has a plain name in the import sheet', () => {
  assert.match(M, /npImmersive: false, npTapOrig: true,/);
  assert.ok(M.includes("set.npTapOrig = set.npTapOrig !== false;"));
  assert.ok(M.includes("tg('npTapOrig', set.npTapOrig !== false)"));
  assert.ok(readFileSync(new URL('../src/settingsio.js', import.meta.url), 'utf8').includes("npTapOrig: 'Tap cover shows original'"));
});
test('GUARD (needs the running app): Now Playing follows the setting, the album page always uses the custom picture, the track-change refresh keeps the mode', () => {
  assert.ok(M.includes('openCover({ ...trackAlbum(t), _np: true, _t: t, _c: set.npTapOrig === false })'));
  assert.ok(M.includes('openCover({ ...al, _c: true })'));
  assert.ok(M.includes("_c: v.dataset.cu === '1'"));
});
