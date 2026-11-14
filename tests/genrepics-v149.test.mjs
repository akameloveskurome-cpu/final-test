// v149 behaviour tests: run the real aplay / albumCard / albumRow / markPlaying / genreCov from main.js with fake deps.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';
const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');
function world(cur) {
  const tracks = [{ id: 't1', albumId: 'A' }, { id: 't2', albumId: 'B' }];
  const Native = { current: () => cur };
  const aplay = extract('src/main.js', 'aplay', { Native, tracks });
  const cov = a => `<cov ${a.id || ''}>`;
  const albumCard = extract('src/main.js', 'albumCard', { aplay, cov });
  const albumRow = extract('src/main.js', 'albumRow', { aplay, cov });
  return { aplay, albumCard, albumRow, Native, tracks };
}
test('the album of the playing song is marked on cards and rows (and only that album)', () => {
  const w = world({ id: 't1' });
  assert.equal(w.aplay('A'), true); assert.equal(w.aplay('B'), false); assert.equal(w.aplay(''), false);
  assert.match(w.albumCard({ id: 'A', title: 'x', artist: 'y' }), /class="card aplay"[^>]*data-aid="A"/);
  assert.match(w.albumRow({ id: 'A', title: 'x', artist: 'y' }), /class="row arow aplay"[^>]*data-aid="A"/);
  assert.doesNotMatch(w.albumCard({ id: 'B', title: 'x', artist: 'y' }), /aplay/);
  assert.doesNotMatch(w.albumRow({ id: 'B', title: 'x', artist: 'y' }), /aplay/);
});
test('albumId on the current song wins; nothing playing marks nothing', () => {
  assert.equal(world({ id: 'zz', albumId: 'B' }).aplay('B'), true);
  assert.equal(world(null).aplay('A'), false);
});
test('markPlaying updates live: [data-aid] elements get / lose aplay, [data-tid] get playing', () => {
  const w = world({ id: 't2' });
  const mk = ds => { const s = new Set(); return { dataset: ds, classList: { toggle: (c, on) => on ? s.add(c) : s.delete(c) }, s }; };
  const rows = [mk({ tid: 't1' }), mk({ tid: 't2' })], albs = [mk({ aid: 'A' }), mk({ aid: 'B' })];
  const document = { querySelectorAll: q => q === '[data-tid]' ? rows : q === '[data-aid]' ? albs : [] };
  extract('src/main.js', 'markPlaying', { Native: w.Native, document, aplay: w.aplay }, '  document.querySelectorAll(\'[data-aid]\')')();
  assert.ok(!rows[0].s.has('playing') && rows[1].s.has('playing')); assert.ok(!albs[0].s.has('aplay') && albs[1].s.has('aplay'));
});
test('genre picture: its own store is used, the artist photo store is not; no picture = the first song cover', () => {
  const calls = []; const cov = (a, cls) => { calls.push(a); return 'C'; };
  const mk = gpUrls => extract('src/main.js', 'genreCov', { genreTracks: () => [{ id: 't1' }], trackAlbum: () => ({ id: 'A', g: 'G' }), NOALBUM: { g: 'N' }, gpUrls, gOf: a => a.g, PIC_BASE: '#111', cov });
  mk({ Rock: 'blob:r' })('Rock'); assert.match(calls[0].g, /^url\('blob:r'\) center\/cover no-repeat, #111$/);   // v208+: replaces the original, nothing of it underneath
  mk({})('Rock'); assert.equal(calls[1].g, 'G');
});
test('CSS guard (needs a browser to run for real): playing album turns red', () => { assert.match(css, /\.row\.aplay \.meta b[^{]*\{color:var\(--accent\)\}/); });
