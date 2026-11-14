// Listening Snapshot (src/snapshot.js + the Share snapshot flow in src/lstats.js): the picture shows the real numbers, names and covers for ANY period and ANY amount of listening.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, querySelectorAll() { return []; }, getElementById: () => null };
const { aggregate } = await import('../src/listenstats.js');
const S = await import('../src/snapshot.js');
const { initLStats } = await import('../src/lstats.js');

const M = 60000, y = new Date().getFullYear(), at = (m, d, h, mi = 0) => new Date(y, m, d, h, mi).getTime();
const seg = (i, t, a, al, s, d, q = 1, f = 1) => ({ i, t, a, al, s, d, f, q, sid: 'x' + s, pid: 'p' + s });
const segs = [
  seg('s1', 'Song &amp; One', 'Artist A', 'Album One', at(5, 10, 9), 40 * M), seg('s1', 'Song &amp; One', 'Artist A', 'Album One', at(5, 11, 9), 40 * M, 1, 0),
  seg('s2', 'Song Two', 'Artist B', 'Album Two', at(5, 12, 22), 30 * M),
];
const un = s => String(s).replace(/&amp;/g, '&');
const meta = g => ({ id: g.i, title: g.t, artists: [g.a], albumKey: 'k' + g.al, album: g.al, genres: g.i === 's1' ? ['Pop'] : [] });
const cover = (k, e) => ({ url: 'file://' + k + e.id, g: 'linear-gradient(145deg, #112233, #445566)', seed: e.name });

test('snapDur: exact, short, never rounds a real listen down to nothing', () => {
  assert.equal(S.snapDur(10000), '10 s'); assert.equal(S.snapDur(400), '1 s'); assert.equal(S.snapDur(0), '0 s');
  assert.equal(S.snapDur(260000), '4 min 20 s'); assert.equal(S.snapDur(37 * M), '37 min'); assert.equal(S.snapDur(185 * M), '3 h 05 min');
});
test('no listening -> no snapshot (null), never an empty card', () => {
  assert.equal(S.buildSnapshot({ A: aggregate([], 0, 9e15, meta), period: 'overall' }), null);
});
test('model numbers equal the aggregate; names are plain text (no &amp;); covers and top lists are filled', () => {
  const A = aggregate(segs, at(5, 1, 0), at(6, 1, 0), meta), m = S.buildSnapshot({ A, period: 'monthly', rangeText: 'June', unesc: un, cover });
  assert.equal(m.totalMs, 110 * M); assert.equal(m.time, '1 h 50 min');
  assert.deepEqual(m.counts, [['Plays', '3'], ['Songs', '2'], ['Artists', '2'], ['Albums', '2']]);
  assert.equal(m.topSongs[0].name, 'Song & One'); assert.equal(m.topSongs[0].stat, '2 plays · 1 h 20 min'); assert.equal(m.topSongs[0].short, undefined);
  assert.equal(m.topAlbums[0].name, 'Album One'); assert.equal(m.topAlbums[0].short, '2 plays'); assert.equal(m.topAlbums[0].sub, 'Artist A');
  assert.match(m.topAlbums[0].cover.url, /^file:\/\/album/); assert.equal(m.topArtists.length, 2);
  assert.ok(m.facts.some(f => f[0] === 'Top genre' && f[1] === 'Pop')); assert.ok(m.facts.length <= 4);
});
test('one song heard for 10 seconds is enough', () => {
  const t = Date.now() - 20000, A = aggregate([seg('s1', 'Solo', 'Me', 'Alb', t, 10000, 0)], 0, Date.now() + 864e5, meta), m = S.buildSnapshot({ A, period: 'overall', rangeText: 'x', unesc: un, cover });
  assert.equal(m.time, '10 s'); assert.deepEqual(m.counts, [['Song', '1'], ['Artist', '1'], ['Album', '1']]);   // no qualified play: no "Plays 0", singular labels
  assert.equal(m.topSongs[0].stat, '10 s'); assert.equal(m.topAlbums[0].short, '10 s');
});
test('file names and share text', () => {
  assert.equal(S.snapshotName('weekly', at(5, 1, 0)), `liquid-dark-weekly-${y}-06-01.png`);
  assert.equal(S.snapshotName('monthly', at(5, 1, 0)), `liquid-dark-monthly-${y}-06.png`); assert.equal(S.snapshotName('yearly', new Date(y, 0, 1).getTime()), `liquid-dark-yearly-${y}.png`);
  const A = aggregate(segs, 0, 9e15, meta), m = S.buildSnapshot({ A, period: 'overall', rangeText: 'Since June', unesc: un, cover });
  assert.match(S.shareText(m), /1 h 50 min of music\. Top album: Album One\. Top song: Song & One\./);
});
test('colours: hex / rgb / hsl parse, var() resolves, no gradient falls back to name-made colours', () => {
  assert.deepEqual(S.parseColor('#abc'), [170, 187, 204]); assert.deepEqual(S.parseColor('rgb(1, 2, 3)'), [1, 2, 3]); assert.deepEqual(S.parseColor('hsl(0,100%,50%)'), [255, 0, 0]); assert.equal(S.parseColor('nope'), null);
  assert.deepEqual(S.gradientColors("url('x#aabbcc.png') center/cover, linear-gradient(145deg, #112233, var(--c))", 's', n => (n === '--c' ? '#445566' : '')), ['#112233', '#445566']);
  const f = S.gradientColors('', 'Album'); assert.equal(f.length, 2); assert.deepEqual(f, S.gradientColors('', 'Album'));
});

// fake canvas: records what is drawn
function fakeEnv(loadImage) {
  const log = { text: [], img: [], size: null };
  const mk = (w, h) => { log.size = log.size || [w, h]; const grad = { addColorStop() {} }, ctx = new Proxy({ measureText: t => ({ width: String(t).length * 14 }), createLinearGradient: () => grad, createRadialGradient: () => grad, fillText: t => log.text.push(t), drawImage: (...a) => log.img.push(a[0]), getImageData: () => ({ data: new Uint8ClampedArray([200, 50, 50, 255]) }) }, { get: (t, k) => (k in t ? t[k] : () => {}), set: () => true }); return { getContext: () => ctx, toBlob: cb => cb(new Blob(['png'])) }; };
  return { env: { makeCanvas: mk, loadImage, cssVar: () => '' }, log };
}
test('renderSnapshot writes the real names and draws the real cover pictures', async () => {
  const A = aggregate(segs, 0, 9e15, meta), m = S.buildSnapshot({ A, period: 'overall', rangeText: 'Since June', unesc: un, cover }), { env, log } = fakeEnv(async u => ({ naturalWidth: 100, naturalHeight: 100, u }));
  const r = await S.renderSnapshot(m, env);
  for (const s of ['Album One', 'Album Two', 'Song & One', 'Song Two', 'Artist A', 'Artist B', '1 h 50 min', 'All-Time Snapshot', 'ALL TIME']) assert.ok(log.text.includes(s), 'missing text: ' + s);
  assert.ok(log.img.length >= 6 && log.img.some(i => /album/.test(i.u)) && log.img.some(i => /song/.test(i.u)));
  assert.equal(r.width, 1080); assert.ok(r.height > 1500 && r.height < 3200);
});
test('a cover that cannot load is a gradient; the rest is still drawn', async () => {
  const A = aggregate(segs, 0, 9e15, meta), m = S.buildSnapshot({ A, period: 'overall', rangeText: 'x', unesc: un, cover }), { env, log } = fakeEnv(async () => null);
  await S.renderSnapshot(m, env); assert.equal(log.img.length, 0); assert.ok(log.text.includes('Album One'));
  const p = await S.makeSnapshotPng(m, env); assert.ok(p.blob.size > 0 && p.withCovers === true);
});
test('a canvas the browser refuses to export is drawn again without covers', async () => {
  const A = aggregate(segs, 0, 9e15, meta), m = S.buildSnapshot({ A, period: 'overall', rangeText: 'x', unesc: un, cover }); let n = 0;
  const { env } = fakeEnv(async () => ({ naturalWidth: 9, naturalHeight: 9 })), mk = env.makeCanvas;
  env.makeCanvas = (w, h) => { const c = mk(w, h); if (w === 1080 && ++n === 1) c.toBlob = () => { throw new Error('tainted'); }; return c; };
  const p = await S.makeSnapshotPng(m, env); assert.equal(p.withCovers, false);
});
test('fit / wrap never exceed the width and never split an emoji', () => {
  const c = { measureText: t => ({ width: Array.from(String(t)).length * 10 }) };
  assert.equal(S.fit(c, 'abcdefghij', 60), 'abcde…'); assert.equal(S.fit(c, 'short', 60), 'short');
  assert.ok(!/[\ud800-\udbff]…$/.test(S.fit(c, '🎷🎷🎷🎷🎷🎷🎷🎷', 45)));
  const w = S.wrap(c, 'one two three four five six seven', 80, 2); assert.equal(w.length, 2); assert.ok(w.every(l => Array.from(l).length <= 8)); assert.ok(w[1].endsWith('…'));
});

// the screen flow, with the same fake history the dashboard test uses
const tracks = [{ id: 's1', title: 'Song &amp; One', artist: 'Artist A', albumId: 'al1', genres: ['Pop'] }, { id: 's2', title: 'Song Two', artist: 'Artist B', albumId: 'al2', genres: [] }];
const mkD = (getListens, sheets) => ({
  Native: { getListens, getListenDays: async () => ({ days: [] }), getListenSeen: async () => ({ seen: [] }), state: {} },
  escH: x => String(x), pl: (n, w) => n + ' ' + w, I: new Proxy({}, { get: () => '' }), unesc: un,
  tracks: () => tracks, trackAlbum: t => ({ g: 'G', cover: 'cov://' + t.albumId, title: 'Album ' + t.albumId }), trackArtists: t => [t.artist],
  byAlbum: k => (k === 'al1' || k === 'al2' ? { g: 'G', g0: '#123456', cover: 'cov://' + k, title: 'Album ' + k, artist: 'AA ' + k } : null),
  artistCov: () => '', header: () => '', push() {}, rerender() {}, refreshHome() {}, toast() {}, tokenColour: () => '', sheet: h => sheets.push(h), closeSheet() {}, stack: () => [], tab: () => 'home',
});
test('the screen flow uses a fresh read, matches the dashboard, and works for day / week / month / year / overall', async () => {
  const sheets = [], reads = [], D = mkD(async r => { reads.push(r); return { segs }; }, sheets), L = initLStats(D);
  L.state.period = 'monthly'; L.state.ref = at(5, 15, 12); await L._test.load(true); const dash = L.state.data.A, before = reads.length;
  const r = await L._test.snapshotModel('monthly', at(5, 15, 12));
  assert.ok(reads.length > before, 'must read the history database again, not reuse the screen copy');
  assert.equal(r.model.totalMs, dash.totalMs); assert.equal(r.model.topSongs.length, dash.songs.size); assert.equal(r.model.topSongs[0].name, 'Song & One');
  assert.equal(r.model.topAlbums[0].cover.url, 'cov://al1'); assert.equal(r.model.topAlbums[0].sub, 'AA al1'); assert.equal(r.model.topArtists[0].cover.url, 'cov://al1');
  for (const p of ['daily', 'weekly', 'monthly', 'yearly', 'overall']) { const x = await L._test.snapshotModel(p, at(5, 10, 12)); assert.ok(x && x.model.totalMs > 0, p + ' has data'); assert.equal(x.model.period, p); }
  assert.equal(await L._test.snapshotModel('daily', at(1, 1, 12)), null);   // a day with no listening: nothing to share
});
test('an unreadable history is an error, not "no listening"', async () => {
  const L = initLStats(mkD(async () => { throw new Error('db locked'); }, []));
  await assert.rejects(() => L._test.snapshotModel('weekly', Date.now()), /db locked/);
});
test('the snapshot actions are wired (the screen handles them)', async () => {
  const lx = initLStats(mkD(async () => ({ segs: [] }), [])); for (const a of ['ls-snap', 'ls-snap-share', 'ls-snap-save']) assert.equal(lx.action(a, {}), true);
});
