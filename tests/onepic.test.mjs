// v145c: one custom picture at a time (artist, album, playlist, background): choose one or go back to default; nothing old is kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const M = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('artist, album and playlist all use the same sheet: choose (replaces) + Back to default', () => {
  assert.match(M, /function picSheet\(/);
  assert.match(M, /picSheet\('Photo for '/); assert.match(M, /picSheet\('Picture for ' \+ \(a \? a\.title/); assert.match(M, /case 'pp-edit': .*picSheet\('Picture for ' \+ q\.name/);
  assert.match(M, /data-act=\"apic-albums\"[^`]*Use an album cover/);   // v149 (owner request): an artist photo can be an album cover from the library
  assert.match(M, /case 'apic-back': apicSheet\(\)/);
  assert.match(M, /Back to default/);
});
test('album picture: one file per album (same key), deleted on reset, restored after a restart', () => {
  assert.match(M, /alDb\.put\(id, b\)/); assert.match(M, /alDb\.del\(id\)/); assert.match(M, /restorePics\(Object\.keys\(alpMap\(\)\), alDb, alpSet,/);
  assert.match(M, /case 'alp-edit'/); assert.match(M, /data-act=\"alp-edit\"/);
});
test('replacing an artist photo or choosing an album cover deletes the old GIF; playlist pictures collapse to one', () => {
  assert.match(M, /keepOriginal\(f\)\.then\(b => apicSetBlob\(nm, b, mine\)\)/); assert.match(M, /apicDropOthers\(n\); pushWidgetCovers\(\); \}\)/);   // v164: a still photo is saved like a GIF; the old one is dropped only after the new one is safe
  assert.match(M, /case 'apic-album': \{ apicDropGif/);
  assert.match(M, /extra old ones are deleted/); assert.doesNotMatch(M, /i\.multiple = true; i\.id = 'ppfile'/);
});
test('listening stats never show album / artist pictures set by the user', async () => {
  globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, querySelectorAll() { return []; } };
  const { initLStats } = await import('../src/lstats.js');
  const MIN = 60000, y = new Date().getFullYear(), s0 = new Date(y, 0, 10, 9).getTime(), hit = [];
  const trap = n => () => { hit.push(n); return ''; };
  const tracks = [{ id: 's1', title: 'S', artist: 'A', albumId: 'al1', genres: ['Pop'] }];
  const D = { Native: { getListens: async () => ({ segs: [{ i: 's1', t: 'S', a: 'A', al: 'Al', s: s0, d: 40 * MIN, f: 1, q: 1, sid: 'x', pid: 'p' }] }), getListenDays: async () => ({ days: [] }), getListenSeen: async () => ({ seen: [] }), state: {} },
    escH: x => String(x), pl: (n, w) => n + ' ' + w, I: new Proxy({}, { get: () => '' }), unesc: x => x, tracks: () => tracks, trackAlbum: () => ({ g: 'ORIG', title: 'A' }), trackArtists: t => [t.artist], byAlbum: k => ({ g: 'ORIG', title: k }),
    header: () => '', push() {}, rerender() {}, refreshHome() {}, toast() {}, tokenColour: () => '', sheet() {}, closeSheet() {}, stack: () => [], tab: () => 'home',
    artistCov: trap('artistCov'), gOf: trap('gOf'), alpUrls: trap('alpUrls'), apicOf: trap('apicOf') };
  const L = initLStats(D);
  for (const per of ['daily', 'weekly', 'monthly', 'yearly']) { L.state.period = per; L.state.ref = s0; await L._test.load(true); await L.screens.lstats(); }
  assert.deepEqual(hit, []);
});
test('plays are merged only after the saved counts were loaded', () => {
  assert.match(M, /if \(!Native\.isNative \|\| !statsReady\) return;/);
});
