// Yearly listening data: the totals are still computed from the stored segments, and there is NO yearly recap (swipeable cards). The separate plain Snapshot picture (tests/snapshot.test.mjs) is a different feature.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, querySelectorAll() { return []; } };
const { initLStats } = await import('../src/lstats.js');

const M = 60000, y = new Date().getFullYear(), at = (m, d, h, mi = 0) => new Date(y, m, d, h, mi).getTime();
const segs = [
  { i: 's1', t: 'Song One', a: 'Artist A', al: 'Album One', s: at(0, 10, 9), d: 40 * M, f: 1, q: 1, sid: 'x1', pid: 'p1' },
  { i: 's1', t: 'Song One', a: 'Artist A', al: 'Album One', s: at(0, 11, 9), d: 40 * M, f: 0, q: 1, sid: 'x2', pid: 'p2' },
  { i: 's2', t: 'Song Two', a: 'Artist B', al: 'Album Two', s: at(0, 12, 22), d: 30 * M, f: 1, q: 1, sid: 'x3', pid: 'p3' },
];
const tracks = [{ id: 's1', title: 'Song One', artist: 'Artist A', albumId: 'al1', genres: ['Pop'] }, { id: 's2', title: 'Song Two', artist: 'Artist B', albumId: 'al2', genres: [] }];
const D = {
  Native: { getListens: async () => ({ segs }), getListenDays: async () => ({ days: [] }), getListenSeen: async () => ({ seen: [] }), state: {} },
  escH: x => String(x), pl: (n, w) => n + ' ' + w + (n === 1 ? '' : 's'), I: new Proxy({}, { get: () => '' }), unesc: x => x,
  tracks: () => tracks, trackAlbum: t => ({ g: 'ORIG-' + t.albumId, title: 'Album ' + t.albumId }), trackArtists: t => [t.artist],
  byAlbum: k => (k === 'al1' || k === 'al2' ? { g: 'ORIG-' + k, title: k } : null),
  artistCov: () => '', header: () => '', push() {}, rerender() {}, refreshHome() {}, toast() {}, tokenColour: () => '', sheet() {}, closeSheet() {}, stack: () => [], tab: () => 'home',
};

test('yearly data still comes from the stored listening segments', async () => {
  const L = initLStats(D); L.state.period = 'yearly'; L.state.ref = at(5, 1, 12);
  await L._test.load(true);
  assert.ok(L.state.data && L.state.data.A.totalMs === 110 * M);
  assert.equal(L.state.data.A.plays, 3); assert.equal(L.state.data.A.songs.size, 2); assert.equal(L.state.data.A.artists.size, 2);
});
test('the yearly recap is gone (rendered screen has no recap/share/cards, no recap actions or exports)', async () => {
  const L = initLStats(D);
  for (const per of ['daily', 'weekly', 'monthly', 'yearly']) {
    L.state.period = per; L.state.ref = at(5, 1, 12); await L._test.load(true);
    const html = await L.screens.lstats();
    assert.equal(typeof html, 'string'); assert.ok(html.includes('Listening Stats'), per);
    assert.doesNotMatch(html, /ls-recap|ls-share|recap|wrapped|wcard/i, per);
  }
  for (const a of ['ls-recap', 'ls-share', 'ls-wrapped']) assert.equal(L.action(a), false, a);
  for (const k of [...Object.keys(L), ...Object.keys(L._test)]) assert.doesNotMatch(k, /recap|wrap|buildCards/i, k);
});
