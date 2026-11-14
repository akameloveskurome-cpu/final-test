import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMATS, exportLists, toM3u8, toXspf, toCsv, buildFiles, parseAny, parseM3u, planForeign, summaryForeign } from '../src/plforeign.js';

const trk = (id, path, title, artist, album, dur = 200) => ({ id, uri: 'content://x/' + path, path, title, trackArtist: artist, albumId: 'al:' + album, dur });
const aaOf = t => ({ artist: t.trackArtist, album: t.albumId.slice(3) });
const LIB = [
  trk('t1', 'Rock/Abbey Road/01 Come Together.flac', 'Come Together', 'The Beatles', 'Abbey Road', 259),
  trk('t2', 'Rock/Abbey Road/02 Something.flac', 'Something', 'The Beatles', 'Abbey Road', 183),
  trk('t3', 'Jazz/Kind of Blue/01 So What.flac', 'So What', 'Miles Davis', 'Kind of Blue', 562),
  trk('t4', 'Pop/Tom &amp; Jerry/01 Hello.flac', 'Hello &lt;3', 'Tom &amp; Jerry', 'Tom &amp; Jerry', 120),
  trk('t5', 'Pop/Mix/05 Blinding Lights.flac', 'Blinding Lights', 'The Weeknd', 'After Hours', 200),
];
const lists = [{ id: 'p1', name: 'Road: trip', ids: ['t1', 't3', 'gone', 't4'] }, { id: 'p2', name: 'Road: trip', ids: ['t2'] }];
const ex = exportLists(lists, LIB, aaOf);

test('exportLists gives RAW strings and drops songs that are gone', () => {
  assert.equal(ex[0].songs.length, 3); assert.equal(ex[0].songs[2].title, 'Hello <3'); assert.equal(ex[0].songs[2].artist, 'Tom & Jerry'); assert.equal(ex[0].songs[0].dur, 259);
});
test('M3U8 export has EXTINF with seconds and "Artist - Title", and re-imports to the same songs', () => {
  const m = toM3u8(ex[0]);
  assert.match(m, /^#EXTM3U\n#PLAYLIST:Road: trip\n#EXTINF:259,The Beatles - Come Together\n#EXTALB:Abbey Road\nRock\/Abbey Road\/01 Come Together.flac\n/);
  const back = parseAny(m, 'x.m3u8'); assert.equal(back[0].name, 'Road: trip');
  const plan = planForeign(back, LIB, aaOf, []); assert.deepEqual(plan.lists[0].ids, ['t1', 't3', 't4']);
});
test('XSPF export re-imports (escaping, percent-encoded paths, unicode)', () => {
  const x = toXspf(ex[0]); assert.match(x, /<location>Rock\/Abbey%20Road\/01%20Come%20Together\.flac<\/location>/); assert.match(x, /Tom &amp; Jerry/);
  const back = parseAny(x, 'a.xspf'); assert.equal(back[0].songs[2].title, 'Hello <3'); assert.equal(back[0].songs[0].path, 'Rock/Abbey Road/01 Come Together.flac');
  assert.deepEqual(planForeign(back, LIB, aaOf, []).lists[0].ids, ['t1', 't3', 't4']);
});
test('CSV export re-imports and several playlists stay separate', () => {
  const c = toCsv([ex[0], { ...ex[1], name: 'Second' }]); const back = parseAny(c, 'all.csv');
  assert.equal(back.length, 2); assert.equal(back[0].songs.length, 3); assert.equal(back[1].songs[0].title, 'Something');
});
test('buildFiles: one playlist = one file, several = zip, csv = single file', () => {
  const one = buildFiles('m3u8', [ex[0]], new Date(2026, 10, 7)); assert.equal(one.name, 'Road trip.m3u8'); assert.ok(one.text);
  const many = buildFiles('xspf', ex, new Date(2026, 10, 7)); assert.equal(many.mime, 'application/zip'); assert.deepEqual(many.files.map(f => f.name), ['Road trip.xspf', 'Road trip (2).xspf']);
  assert.equal(buildFiles('csv', ex, new Date(2026, 10, 7)).name, 'liquid-dark-playlists-20261107.csv');
  assert.throws(() => buildFiles('nope', ex), /format/); assert.equal(FORMATS.length, 4);
});
test('M3U from another device: absolute paths, EXTINF without album, file:// urls', () => {
  const t = '#EXTM3U\n#EXTINF:183,The Beatles - Something\n/storage/emulated/0/Music/Rock/Abbey Road/02 Something.flac\n#EXTINF:10,Nobody - Nothing\nC:\\Music\\x\\y.mp3\nfile:///sdcard/Music/Jazz/Kind%20of%20Blue/01%20So%20What.flac\nhttps://stream.example/radio\n';
  const r = parseM3u(t, 'Mine.m3u'); assert.equal(r[0].name, 'Mine'); assert.equal(r[0].songs.length, 4);
  assert.equal(r[0].songs[3].path, '');   // web streams have no file
  const p = planForeign(r, LIB, aaOf, []); assert.deepEqual(p.lists[0].ids, ['t2', 't3']); assert.equal(p.total, 4); assert.equal(p.missing.length, 2);
  assert.equal(summaryForeign(p), 'Imported 1 playlist: 2 of 4 songs matched');
});
test('Spotify Exportify CSV: "Artist Name(s)" with several artists, remaster / feat tags are ignored', () => {
  const csv = 'Track URI,Track Name,Album Name,Artist Name(s),Release Date,Duration (ms)\nspotify:track:1,Come Together - Remastered 2009,Abbey Road (Remastered),The Beatles,1969,259000\nspotify:track:2,Blinding Lights (feat. X),After Hours,The Weeknd;Someone,2020,200000\nspotify:track:3,Unknown,Nope,Nobody,2000,1\n';
  const r = parseAny(csv, 'Road Trip.csv'); assert.equal(r[0].name, 'Road Trip');
  const p = planForeign(r, LIB, aaOf, []);
  assert.deepEqual(p.lists[0].ids, ['t1', 't5']);
});
test('Soundiiz-style CSV with a playlist column + Apple Music tab-separated export', () => {
  const sz = 'Playlist name,Title,Artist,Album\nA,So What,Miles Davis,Kind of Blue\nB,Something,The Beatles,Abbey Road\nB,Come Together,The Beatles,Abbey Road\n';
  const r = parseAny(sz, 'x.csv'); assert.deepEqual(r.map(p => p.name), ['A', 'B']); assert.equal(r[1].songs.length, 2);
  const am = 'Name\tArtist\tAlbum\nSo What\tMiles Davis\tKind of Blue\n';
  assert.equal(planForeign(parseAny(am, 'Library.txt'), LIB, aaOf, []).lists[0].ids[0], 't3');
});
test('Spotify data download (Playlist1.json), JSPF, PLS, bare track array, "Artist - Title" lines', () => {
  const sp = JSON.stringify({ playlists: [{ name: 'Faves', items: [{ track: { trackName: 'So What', artistName: 'Miles Davis', albumName: 'Kind of Blue' } }, { track: null }] }] });
  assert.equal(planForeign(parseAny(sp, 'Playlist1.json'), LIB, aaOf, []).lists[0].ids[0], 't3');
  const jspf = JSON.stringify({ playlist: { title: 'J', track: [{ title: 'Something', creator: 'The Beatles', album: 'Abbey Road' }] } });
  assert.equal(parseAny(jspf, 'j.jspf')[0].name, 'J');
  const pls = '[playlist]\nFile1=/m/Rock/Abbey Road/02 Something.flac\nTitle1=The Beatles - Something\nNumberOfEntries=1\n';
  assert.equal(planForeign(parseAny(pls, 'a.pls'), LIB, aaOf, []).lists[0].ids[0], 't2');
  assert.equal(parseAny(JSON.stringify([{ title: 'So What', artist: 'Miles Davis' }]), 'arr.json')[0].songs.length, 1);
  assert.equal(planForeign(parseAny('Miles Davis - So What\nThe Beatles - Something\n', 'notes.txt'), LIB, aaOf, []).matched, 2);
});
test('our own backup still imports; junk and empty files are refused; name clash gets (2)', () => {
  const own = JSON.stringify({ app: 'liquid-dark', kind: 'playlists', version: 1, playlists: [{ name: 'Mine', songs: [{ id: 't1', path: 'Rock/Abbey Road/01 Come Together.flac', title: 'Come Together', artist: 'The Beatles', album: 'Abbey Road' }] }] });
  const r = parseAny(own, 'liquid-dark-playlists.json'); assert.equal(planForeign(r, LIB, aaOf, ['mine']).lists[0].name, 'Mine (2)');
  for (const bad of ['', 'hello world', '{"a":1}', '[]', 'a,b\n1,2']) assert.throws(() => parseAny(bad, 'x'), /Not a playlist file/, bad);
  assert.throws(() => parseAny(JSON.stringify({ kind: 'playlists', version: 9, playlists: [{ name: 'x', songs: [{ id: 'a' }] }] }), 'f.json'), /newer/);
});

test('CSV export keeps two playlists with the same name apart (the app allows duplicate names)', () => {
  const dup = [{ id: 'a', name: 'Mix', ids: ['t1'] }, { id: 'b', name: 'mix', ids: ['t2', 't3'] }, { id: 'c', name: 'Mix (2)', ids: ['t5'] }];
  const out = buildFiles('csv', exportLists(dup, LIB, aaOf));
  const back = parseAny(out.text, out.name);
  assert.equal(back.length, 3); assert.deepEqual(back.map(p => p.songs.length), [1, 2, 1]);
  assert.equal(new Set(back.map(p => p.name.toLowerCase())).size, 3);
});
