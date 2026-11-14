import test from 'node:test';
import assert from 'node:assert/strict';
import { unesc, norm, buildExport, exportText, parseImport, planImport, makeIndex, matchSong, freeName, summary, FILE_NAME } from '../src/plexport.js';

// Library tracks as data.js stores them: strings HTML-escaped, `path` = folder-relative path.
const trk = (id, path, title, artist, album) => ({ id, uri: 'content://x/' + path, path, title, trackArtist: artist, albumId: 'al:' + album });
const aaOf = t => ({ artist: t.albumArtistOverride || t.trackArtist, album: t.albumId.slice(3) });
const LIB = [
  trk('t1', 'Rock/Abbey Road/01 Come Together.flac', 'Come Together', 'The Beatles', 'Abbey Road'),
  trk('t2', 'Rock/Abbey Road/02 Something.flac', 'Something', 'The Beatles', 'Abbey Road'),
  trk('t3', 'Jazz/Kind of Blue/01 So What.flac', 'So What', 'Miles Davis', 'Kind of Blue'),
  trk('t4', 'Pop/Tom &amp; Jerry/01 Hello &lt;3.flac', 'Hello &lt;3', 'Tom &amp; Jerry', 'Tom &amp; Jerry'),
  trk('t5', 'Cafe/01 Chanson.flac', 'Chanson d\u2019Été', 'Édith Piaf', 'La Vie en Rose'),
];

test('unesc undoes the library escaping, norm ignores case, accents and spacing', () => {
  assert.equal(unesc('Tom &amp; Jerry &lt;3 &quot;x&quot;'), 'Tom & Jerry <3 "x"');
  assert.equal(norm('  Édith   PIAF '), 'edith piaf');
  assert.equal(norm(null), '');
});

test('buildExport writes RAW strings, keeps order and duplicates, keeps unknown ids as {id}', () => {
  const o = buildExport([{ id: 'p1', name: 'Mix & Match', ids: ['t4', 't1', 'gone', 't4'] }], LIB, aaOf, new Date('2026-11-01T10:00:00Z'));
  assert.equal(o.kind, 'playlists'); assert.equal(o.version, 1); assert.equal(o.exported, '2026-11-01T10:00:00.000Z');
  const p = o.playlists[0];
  assert.equal(p.name, 'Mix & Match');
  assert.deepEqual(p.songs.map(s => s.id), ['t4', 't1', 'gone', 't4']);
  assert.deepEqual(p.songs[0], { id: 't4', path: 'Pop/Tom & Jerry/01 Hello <3.flac', title: 'Hello <3', artist: 'Tom & Jerry', album: 'Tom & Jerry' });
  assert.deepEqual(p.songs[2], { id: 'gone' });
  assert.equal(FILE_NAME, 'liquid-dark-playlists.json');
});

test('parseImport accepts our file, ids-only playlists.json, and rejects junk', () => {
  const ours = exportText(buildExport([{ id: 'p', name: 'A', ids: ['t1'] }], LIB, aaOf));
  const a = parseImport(ours);
  assert.equal(a.length, 1); assert.equal(a[0].name, 'A'); assert.equal(a[0].songs[0].title, 'Come Together');
  const b = parseImport(JSON.stringify({ playlists: [{ id: 'p1', name: 'Old', ids: ['t1', 't2'] }] }));
  assert.deepEqual(b[0].songs.map(s => s.id), ['t1', 't2']);
  assert.equal(parseImport('\uFEFF' + ours).length, 1);                       // BOM from some editors
  for (const bad of ['', 'not json', '42', '{}', '{"kind":"playlists","playlists":[]}', '{"playlists":"x"}']) assert.throws(() => parseImport(bad), /playlist/i, bad);
  assert.throws(() => parseImport(JSON.stringify({ kind: 'playlists', version: 2, playlists: [{ name: 'x', songs: [] }] })), /newer/);
});

test('parseImport cleans names and skips broken entries', () => {
  const r = parseImport(JSON.stringify({ kind: 'playlists', version: 1, playlists: [null, { name: '   ', songs: [null, 5, { id: 'a', title: 7 }] }, { name: 'x'.repeat(100), songs: [] }] }));
  assert.equal(r.length, 2);
  assert.equal(r[0].name, 'Imported'); assert.equal(r[0].songs.length, 1); assert.equal(r[0].songs[0].title, '7');
  assert.equal(r[1].name.length, 100);   // no name length limit
});

test('match by path first, even when tags differ', () => {
  const idx = makeIndex(LIB, aaOf);
  assert.equal(matchSong({ id: 'zzz', path: 'rock/abbey road/01 COME TOGETHER.flac', title: 'Wrong', artist: '', album: '' }, idx).id, 't1');
  assert.equal(matchSong({ id: '', path: '/Jazz\\Kind of Blue/01 So What.flac', title: '', artist: '', album: '' }, idx).id, 't3');
});

test('match by title+artist+album when the path changed, ignoring case and accents', () => {
  const idx = makeIndex(LIB, aaOf);
  assert.equal(matchSong({ id: 'q', path: 'Moved/elsewhere.flac', title: 'chanson d\u2019ete', artist: 'EDITH PIAF', album: 'la vie en rose' }, idx).id, 't5');
  assert.equal(matchSong({ id: 'q', path: '', title: 'Hello <3', artist: 'Tom & Jerry', album: 'Tom & Jerry' }, idx).id, 't4');   // raw '&' / '<' in the file vs escaped in the library
});

test('id is only the last resort; unknown songs do not match', () => {
  const idx = makeIndex(LIB, aaOf);
  assert.equal(matchSong({ id: 't2', path: '', title: '', artist: '', album: '' }, idx).id, 't2');
  assert.equal(matchSong({ id: 'nope', path: 'x/y.flac', title: 'Nothing', artist: 'Nobody', album: 'None' }, idx), null);
  assert.equal(matchSong({ id: '', path: '', title: '', artist: '', album: '' }, idx), null);
});

test('two library copies with the same tags: a repeated song picks the other copy', () => {
  const lib = [trk('c1', 'A/s.flac', 'Same', 'X', 'Y'), trk('c2', 'B/s.flac', 'Same', 'X', 'Y')];
  const plan = planImport([{ name: 'P', songs: [{ id: '', path: 'gone/1.flac', title: 'Same', artist: 'X', album: 'Y' }, { id: '', path: 'gone/2.flac', title: 'Same', artist: 'X', album: 'Y' }] }], lib, aaOf, []);
  assert.deepEqual(plan.lists[0].ids, ['c1', 'c2']);
});

test('planImport counts matched / total, keeps order, drops unmatched', () => {
  const imp = [{ name: 'Road', songs: [{ id: 'old1', path: 'Rock/Abbey Road/02 Something.flac' }, { id: 'old2', path: 'Missing.flac', title: 'Ghost', artist: 'A', album: 'B' }, { id: 'old3', path: 'Jazz/Kind of Blue/01 So What.flac' }] }, { name: 'Empty', songs: [] }].map(p => ({ ...p, songs: p.songs.map(s => ({ title: '', artist: '', album: '', ...s })) }));
  const plan = planImport(imp, LIB, aaOf, []);
  assert.deepEqual(plan.lists.map(l => l.ids), [['t2', 't3'], []]);
  assert.equal(plan.matched, 2); assert.equal(plan.total, 3);
  assert.equal(summary(plan), 'Imported 2 playlists: 2 of 3 songs matched');
  assert.equal(summary({ lists: [1], matched: 1, total: 1 }), 'Imported 1 playlist: 1 of 1 songs matched');
});

test('name clash appends (2), (3); case-insensitive; existing playlists are never touched', () => {
  assert.equal(freeName('Fav', new Set()), 'Fav');
  const names = new Set(['fav', 'fav (2)']);
  assert.equal(freeName('FAV', names), 'FAV (3)');
  assert.ok(names.has('fav (3)'));
  const existing = ['Road', 'road (2)'];
  const plan = planImport([{ name: 'Road', songs: [] }, { name: 'Road', songs: [] }, { name: 'New', songs: [] }], LIB, aaOf, existing);
  assert.deepEqual(plan.lists.map(l => l.name), ['Road (3)', 'Road (4)', 'New']);
  assert.deepEqual(existing, ['Road', 'road (2)']);
});

test('round trip: export, reinstall with a re-picked folder (new ids and uris, same relative paths), import', () => {
  const lists = [{ id: 'p1', name: 'Best of "all"', ids: ['t5', 't1', 't4', 't3'] }, { id: 'p2', name: 'Chill', ids: ['t2'] }];
  const text = exportText(buildExport(lists, LIB, aaOf));
  // new library: every id and uri differs, tags stay the same
  const lib2 = LIB.map(t => ({ ...t, id: 'n' + t.id.slice(1), uri: 'content://other/' + t.path }));
  const plan = planImport(parseImport(text), lib2, aaOf, []);
  assert.deepEqual(plan.lists.map(l => l.name), ['Best of "all"', 'Chill']);
  assert.deepEqual(plan.lists.map(l => l.ids), [['n5', 'n1', 'n4', 'n3'], ['n2']]);
  assert.equal(plan.matched, 5); assert.equal(plan.total, 5);
});

test('round trip when files were renamed or moved: tags still match', () => {
  const text = exportText(buildExport([{ id: 'p1', name: 'X', ids: ['t1', 't3'] }], LIB, aaOf));
  const lib2 = LIB.map(t => ({ ...t, id: 'm' + t.id.slice(1), path: 'Everything/' + t.path.split('/').pop() }));
  const plan = planImport(parseImport(text), lib2, aaOf, []);
  assert.deepEqual(plan.lists[0].ids, ['m1', 'm3']);
});

test('a big playlist (5000 songs) imports fast', () => {
  const big = Array.from({ length: 5000 }, (_, i) => trk('b' + i, `D${i % 50}/f${i}.flac`, 'T' + i, 'A' + (i % 40), 'L' + (i % 90)));
  const text = exportText(buildExport([{ id: 'p', name: 'Big', ids: big.map(t => t.id) }], big, aaOf));
  const t0 = Date.now();
  const plan = planImport(parseImport(text), big.map(t => ({ ...t, id: 'z' + t.id })), aaOf, []);
  assert.equal(plan.matched, 5000);
  assert.ok(Date.now() - t0 < 2000);
});
