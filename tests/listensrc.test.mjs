import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { parseListens, buildExport, planPlays, FORMATS, SOURCE_NAMES } from '../src/listenio.js';
import { fromTempo, tempoBackup, jsonLines, fromScrobblerLog, scrobblerLog, lastfmCsv } from '../src/listensrc.js';
import { unzipText, expandFiles, isZip } from '../src/zipread.js';
import { zipFiles, toBase64, crc32 } from '../src/transfer.js';

const T0 = Date.UTC(2026, 8, 4, 8, 54, 30);
const TEMPO = { version: 9, schemaVersion: 58, tracks: [
  { id: 1, title: 'Call Out My Name', artist: 'The Weeknd', album: '', contentType: 'MUSIC' },
  { id: 2, title: 'Give It Up to Me', artist: 'Sean Paul, Keyshia Cole', album: 'Single', contentType: 'MUSIC' },
  { id: 3, title: 'A Podcast', artist: 'Host', contentType: 'PODCAST' }],
  enrichedMetadata: [{ trackId: 1, albumTitle: 'My Dear Melancholy,' }],
  listeningEvents: [
    { id: 1, track_id: 1, timestamp: T0, playDuration: 118052, estimatedDurationMs: 228373, wasSkipped: false },
    { id: 2, track_id: 2, timestamp: T0 + 400000, playDuration: 12000, estimatedDurationMs: 200000, wasSkipped: true },
    { id: 3, track_id: 3, timestamp: T0 + 900000, playDuration: 60000 },
    { id: 4, track_id: 9, timestamp: T0 + 1e6, playDuration: 60000 },
    { id: 5, track_id: 1, timestamp: T0 + 2e6, playDuration: 0 }] };

test('Tempo backup: music events only, album from enriched data, skipped plays kept (the 10 s rule decides what counts)', () => {
  const p = parseListens(JSON.stringify(TEMPO), 'data.json'); assert.equal(p.format, 'tempo'); assert.equal(p.plays.length, 2);
  assert.deepEqual([p.plays[0].title, p.plays[0].artist, p.plays[0].album, p.plays[0].start, p.plays[0].ms, p.plays[0].dur], ['Call Out My Name', 'The Weeknd', 'My Dear Melancholy,', T0, 118052, 228373]);
  const lib = [{ id: 't1', title: 'Give It Up to Me', trackArtist: 'Sean Paul', albumId: 'al:Single', dur: 200 }], plan = planPlays(p.plays, lib, t => ({ artist: t.trackArtist, album: 'Single' }));
  assert.equal(plan.matched, 1); assert.deepEqual(plan.rows.map(r => r.q), [1, 1]);   // 118 s and 12 s both count (10 s rule)
  assert.equal(fromTempo({ tracks: [], listeningEvents: [{ track_id: 1, timestamp: 1, playDuration: 1 }] }).length, 0);
});
test('Tempo export -> import gives the same plays back', () => {
  const segs = [{ i: 'a', t: 'Song A', a: 'Artist, Feat', al: 'Alb', aa: 'Artist', s: T0, d: 90000, f: 1, q: 1, sid: 's', pid: 'p1', n: 0 }, { i: 'b', t: 'Song B', a: 'Other', al: '', aa: 'Other', s: T0 + 5e5, d: 8000, f: 1, q: 0, sid: 's', pid: 'p2', n: 0 }];
  const f = buildExport('tempo', segs, new Date(T0)); assert.equal(f.count, 2); assert.equal(f.files[0].name, 'data.json'); assert.match(f.name, /tempo.*\.zip$/);
  const o = JSON.parse(f.files[0].text); assert.equal(o.schemaVersion, 58); assert.equal(o.tracks.length, 2); assert.equal(o.trackArtists.length, 3); assert.equal(o.listeningEvents[1].wasSkipped, true);
  const p = parseListens(f.files[0].text); assert.equal(p.format, 'tempo'); assert.deepEqual(p.plays.map(x => [x.title, x.artist, x.start, x.ms]), [['Song A', 'Artist, Feat', T0, 90000], ['Song B', 'Other', T0 + 5e5, 8000]]);
});
test('Last.fm API JSON (pages, now-playing skipped), Maloja, YouTube Music takeout', () => {
  const lf = { recenttracks: { track: [{ name: 'Now', artist: { '#text': 'X' }, '@attr': { nowplaying: 'true' } }, { name: 'Come Together', artist: { '#text': 'The Beatles' }, album: { '#text': 'Abbey Road' }, date: { uts: '1767643200' } }] } };
  let p = parseListens(JSON.stringify([lf, lf])); assert.equal(p.format, 'lastfm'); assert.equal(p.plays.length, 2); assert.equal(p.plays[0].start, 1767643200000); assert.equal(p.plays[0].album, 'Abbey Road');
  p = parseListens(JSON.stringify({ scrobbles: [{ time: 1767643200, duration: 200, track: { artists: ['A', 'B'], title: 'T', album: { albumtitle: 'Al' } } }] })); assert.equal(p.format, 'maloja'); assert.deepEqual([p.plays[0].artist, p.plays[0].album, p.plays[0].ms], ['A, B', 'Al', 200000]);
  p = parseListens(JSON.stringify([{ header: 'YouTube Music', title: 'Watched Song', subtitles: [{ name: 'Artist - Topic' }], time: '2026-01-05T20:00:00.000Z' }, { header: 'YouTube', title: 'Watched Cat', time: '2026-01-05T20:00:00Z' }]));
  assert.equal(p.format, 'ytmusic'); assert.deepEqual(p.plays.map(x => [x.title, x.artist]), [['Song', 'Artist']]);
});
test('ListenBrainz JSON Lines and the Audioscrobbler log are read; skipped (S) rows are not', () => {
  const l = JSON.stringify({ listened_at: 1767643200, track_metadata: { artist_name: 'A', track_name: 'T' } });
  assert.equal(jsonLines(l + '\n' + l).length, 2); assert.equal(jsonLines(l), null); assert.equal(parseListens(l + '\n' + l.replace('1767643200', '1767643300')).plays.length, 2);
  const log = '#AUDIOSCROBBLER/1.1\n#TZ/UTC\n#CLIENT/Rockbox\nArtist\tAlbum\tTitle\t1\t200\tL\t1767643200\t\nArtist\tAlbum\tSkipped\t2\t200\tS\t1767643300\t\n';
  const p = parseListens(log, 'x.scrobbler.log'); assert.equal(p.format, 'scrobblerlog'); assert.deepEqual(p.plays.map(x => [x.title, x.dur]), [['Title', 200000]]);
  assert.equal(fromScrobblerLog(scrobblerLog([{ start: 1767643200000, ms: 90000, title: 'T\tab', artist: 'A', album: '' }])).length, 1);
});
test('Last.fm CSV export is read back by the CSV importer; new formats are listed', () => {
  const segs = [{ i: 'a', t: 'Song "A"', a: 'Artist', al: 'Alb', aa: 'Artist', s: T0, d: 90000, f: 1, q: 1, sid: 's', pid: 'p1', n: 0 }];
  const f = buildExport('lastfmcsv', segs); assert.match(f.text, /^uts,utc_time,artist,artist_mbid,album,album_mbid,track,track_mbid/);
  const p = parseListens(f.text); assert.equal(p.plays.length, 1); assert.deepEqual([p.plays[0].title, p.plays[0].artist, p.plays[0].start], ['Song "A"', 'Artist', Math.floor(T0 / 1000) * 1000]);
  assert.match(lastfmCsv([{ start: Date.UTC(2026, 0, 5, 20, 7), title: 't', artist: 'a', album: '' }]), /05 Jan 2026, 20:07/);
  for (const id of ['lastfmcsv', 'scrobblerlog', 'tempo']) assert.ok(FORMATS.some(x => x.id === id));
  assert.equal(buildExport('scrobblerlog', segs).text.split('\n')[3].split('\t')[5], 'L'); assert.ok(SOURCE_NAMES.tempo);
});
// a real deflated zip (the kind Tempo / Spotify / ListenBrainz make), built here with node's zlib
function deflatedZip(files) {
  const parts = [], cd = []; let off = 0;
  for (const f of files) {
    const nm = Buffer.from(f.name), raw = Buffer.from(f.text), def = zlib.deflateRawSync(raw), crc = crc32(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(def.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(def.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nm, def); cd.push(ch, nm); off += 30 + nm.length + def.length;
  }
  const cdb = Buffer.concat(cd), eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(files.length, 8); eo.writeUInt16LE(files.length, 10); eo.writeUInt32LE(cdb.length, 12); eo.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...parts, cdb, eo]));
}
test('zip: deflated and stored files open, pictures / folders are skipped, a zip pick expands into its data files', async () => {
  const z = deflatedZip([{ name: 'data.json', text: JSON.stringify(TEMPO) }, { name: 'images/a.jpg', text: 'x' }, { name: 'notes.txt', text: 'héllo' }]);
  assert.ok(isZip(z)); const r = await unzipText(z); assert.deepEqual(r.map(x => x.name), ['data.json', 'notes.txt']); assert.equal(r[1].text, 'héllo'); assert.equal(parseListens(r[0].text).format, 'tempo');
  const s = await unzipText(zipFiles([{ name: 'a.csv', text: 'artist,track\nA,B' }])); assert.equal(s[0].text, 'artist,track\nA,B');
  const ex = await expandFiles([{ name: 'backup.zip', bytes: z }, { name: 'plain.json', text: '{}' }]); assert.deepEqual(ex.map(x => [x.name, x.zip || '']), [['data.json', 'backup.zip'], ['notes.txt', 'backup.zip'], ['plain.json', '']]);
  await assert.rejects(() => unzipText(new Uint8Array(40)), /zip/i);
});
