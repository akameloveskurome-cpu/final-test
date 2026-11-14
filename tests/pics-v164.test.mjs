// v164 behaviour tests: run the real apicSetBlob / apicMigrate / picsMissing / picWatch / plArt / mosaic from main.js with fakes.
import test from 'node:test'; import assert from 'node:assert/strict';
import { extract } from './extract.mjs';
const tick = () => new Promise(r => setImmediate(r));
function store(init = {}) { let m = { ...init }; return { get: () => ({ ...m }), save: x => { m = { ...x }; }, cur: () => m }; }

function setBlobWorld({ prev, putOk, old }) {
  const ap = store(prev === undefined ? {} : { N: prev }), ag = {}, log = [];
  const agDb = { put: () => putOk ? Promise.resolve() : Promise.reject(new Error('x')), get: () => Promise.resolve(old) };
  const fn = extract('src/main.js', 'apicSetBlob', { apicMap: ap.get, apicSave: ap.save, agSet: (n, b) => { ag[n] = b; }, apicDone: () => log.push('done'), agDb, apicDropOthers: n => log.push('drop ' + n), pushWidgetCovers: () => log.push('widgets'), repaintPics: () => log.push('repaint'), toast: t => log.push('toast ' + t) }, '}');
  return { fn, ap, ag, log };
}
test('a new artist photo is saved (map marker + live url), old copies dropped only after the save succeeds', async () => {
  const w = setBlobWorld({ prev: 'gif:1', putOk: true }); w.fn('N', 'BLOB');
  assert.equal(w.ap.cur().N, 'gif:1'); assert.equal(w.ag.N, 'BLOB'); assert.ok(!w.log.includes('drop N')); await tick();
  assert.deepEqual(w.log.filter(x => x !== 'done'), ['drop N', 'widgets']);
});
test('a failed save keeps the old text photo and tells the person', async () => {
  const w = setBlobWorld({ prev: 'data:image/png;base64,AAA', putOk: false }); w.fn('N', 'BLOB'); await tick(); await tick();
  assert.equal(w.ap.cur().N, 'data:image/png;base64,AAA'); assert.equal(w.ag.N, null); assert.ok(w.log.includes('toast Could not save that photo'));
});
test('a failed save with no old photo leaves no entry; an old stored GIF is put back on screen', async () => {
  const a = setBlobWorld({ putOk: false }); a.fn('N', 'B'); await tick(); await tick(); assert.ok(!('N' in a.ap.cur()));
  const b = setBlobWorld({ prev: 'gif:1', putOk: false, old: 'OLDBLOB' }); b.fn('N', 'B'); await tick(); await tick(); await tick();
  assert.equal(b.ag.N, 'OLDBLOB'); assert.ok(b.log.includes('repaint'));
});

function migrateWorld(map, { putFails = false, changeDuringSave = false } = {}) {
  const ap = store(map), ag = {}, order = [];
  const fetch = async v => ({ blob: async () => ({ size: v.length, v }) });
  const agDb = { put: async (k, b) => { order.push('put ' + k); if (putFails) throw new Error('x'); if (changeDuringSave) { const m = ap.get(); m[k] = 'data:CHANGED'; ap.save(m); } } };
  const fn = extract('src/main.js', 'apicMigrate', { apicMap: ap.get, apicSave: x => { order.push('save'); ap.save(x); }, agDb, agSet: (k, b) => { ag[k] = b; }, repaintPics: () => order.push('repaint'), fetch });
  return { fn, ap, ag, order };
}
test('old text photos move to the two-copy storage; the text is replaced only after the copy is written', async () => {
  const w = migrateWorld({ A: 'data:aaa', B: 'gif:1' }); await w.fn();
  assert.deepEqual(w.order, ['put A', 'save', 'repaint']); assert.equal(w.ap.cur().A, 'gif:1'); assert.equal(w.ap.cur().B, 'gif:1'); assert.ok(w.ag.A);
});
test('migration: failed write keeps the text; a photo changed while saving is left alone', async () => {
  const a = migrateWorld({ A: 'data:aaa' }, { putFails: true }); await a.fn(); assert.equal(a.ap.cur().A, 'data:aaa');
  const b = migrateWorld({ A: 'data:aaa' }, { changeDuringSave: true }); await b.fn(); assert.equal(b.ap.cur().A, 'data:CHANGED');
  const c = migrateWorld({ A: 'gif:1' }); await c.fn(); assert.deepEqual(c.order, []);
});

function missingWorld(o = {}) {
  const d = { spMap: () => ({}), tracks: [{ id: 't1' }], spUrls: new Map(), alpMap: () => ({}), byAlbum: () => true, alpUrls: new Map(), apicMap: () => ({}), agUrls: {}, gpMap: () => ({}), gpUrls: {}, playlists: [], ppUrl: new Map(), bgQuick: false, bgUrl: '', bgSaved: () => false, pfQuick: false, pfMedia: null, pfSaved: () => false, ...o };
  d.picsOf = extract('src/main.js', 'picsOf', {});
  return extract('src/main.js', 'picsMissing', d, '} catch');
}
test('picsMissing: nothing saved = nothing missing', () => assert.equal(missingWorld()(), false));
test('picsMissing: a saved picture that is not on screen counts (song, album, artist GIF, genre, playlist, background, profile)', () => {
  assert.equal(missingWorld({ spMap: () => ({ t1: 1 }) })(), true);
  assert.equal(missingWorld({ spMap: () => ({ t1: 1 }), spUrls: new Map([['t1', 'u']]) })(), false);
  assert.equal(missingWorld({ alpMap: () => ({ A: 1 }) })(), true);
  assert.equal(missingWorld({ apicMap: () => ({ N: 'gif:1' }) })(), true);
  assert.equal(missingWorld({ apicMap: () => ({ N: 'gif:1' }), agUrls: { N: 'u' } })(), false);
  assert.equal(missingWorld({ gpMap: () => ({ G: 1 }) })(), true);
  assert.equal(missingWorld({ playlists: [{ pics: [{ id: 'p1' }] }] })(), true);
  assert.equal(missingWorld({ playlists: [{ pics: [{ id: 'p1' }] }], ppUrl: new Map([['p1', 'u']]) })(), false);
  assert.equal(missingWorld({ bgSaved: () => true })(), true); assert.equal(missingWorld({ pfSaved: () => true })(), true);
  assert.equal(missingWorld({ spMap: () => { throw new Error('x'); } })(), false);
});
test('picWatch retries every 15 s while something is missing, skips a hidden page, stops after 40 ticks, restarts when asked again', () => {
  const timers = []; let miss = true, reloads = 0; const document = { hidden: false };
  const picWatch = extract('src/main.js', 'picWatch', { picWatchN: 0, picWatchOn: false, setTimeout: (f, ms) => timers.push([f, ms]), document, picsMissing: () => miss, reloadMissingPics: () => reloads++ });
  picWatch(); picWatch(); assert.equal(timers.length, 1); assert.equal(timers[0][1], 15000);
  timers.shift()[0](); assert.equal(reloads, 1); assert.equal(timers[0][1], 15000);
  document.hidden = true; timers.shift()[0](); assert.equal(reloads, 1);
  document.hidden = false; miss = false; timers.shift()[0](); assert.equal(reloads, 1);
  let n = 3; while (timers.length) { timers.shift()[0](); n++; } assert.equal(n, 41);
  picWatch(); assert.equal(timers.length, 1);
});

const covT = t => `<c ${t.id}>`;
const world = (spUrls = new Map()) => { const mosaic = extract('src/main.js', 'mosaic', { spUrls, covT, soHas: () => false }, '};'); const picsOf = extract('src/main.js', 'picsOf', {}); const ppUrl = new Map(); const ppBad = new Set(); const ppImg = p => `<img ${p.id}>`; return { mosaic, ppUrl, ppBad, plArt: extract('src/main.js', 'plArt', { picsOf, ppUrl, ppImg: p => ppUrl.has(p.id) ? ppImg(p) : '<wait>', ppBad, mosaic }) }; };
test('a playlist shows only its own first picture (a plain square while it loads); the original 4-square mosaic only when there is none or it cannot be shown', () => {
  const w = world(); const ts = ['a', 'b', 'c', 'd', 'e'].map((x, i) => ({ id: 't' + i, albumId: x }));
  assert.match(w.plArt({ pics: [{ id: 'p1' }] }, ts, 'thumb'), /pp-cover thumb"><wait>/);   // v208+: still loading = plain square, never the original mosaic under it
  w.ppBad.add('p1'); assert.equal((w.plArt({ pics: [{ id: 'p1' }] }, ts, 'thumb').match(/<c /g) || []).length, 4); w.ppBad.clear();   // picture cannot be shown at all = the original mosaic
  w.ppUrl.set('p1', 'u'); const r = w.plArt({ pics: [{ id: 'p1' }] }, ts, 'thumb'); assert.match(r, /pp-cover thumb"><img p1>/); assert.doesNotMatch(r, /<c /);
  assert.match(w.plArt({}, [], 'x'), /var\(--row-fill\)/);
});
test('mosaic: same album counted once; a song with its own picture is its own square', () => {
  const m = world(new Map([['t2', 'u']])).mosaic;
  assert.deepEqual(m([{ id: 't1', albumId: 'A' }, { id: 't2', albumId: 'A' }, { id: 't3', albumId: 'A' }]).match(/<c t\d>/g), ['<c t1>', '<c t2>', '<c t1>', '<c t1>']);
});
