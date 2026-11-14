import test from 'node:test';
import assert from 'node:assert/strict';
import { toPlays, buildExport, parseListens, parseTime, planPlays, planLiquid, summary, FORMATS } from '../src/listenio.js';

const trk = (id, title, artist, album, dur) => ({ id, title, trackArtist: artist, albumId: 'al:' + album, dur });
const aaOf = t => ({ artist: t.trackArtist, album: t.albumId.slice(3) });
const LIB = [trk('t1', 'Come Together', 'The Beatles', 'Abbey Road', 259), trk('t2', 'So What', 'Miles Davis', 'Kind of Blue', 562)];
const T0 = Date.UTC(2026, 0, 5, 20, 0, 0);
const seg = (o) => ({ i: 't1', t: 'Come Together', a: 'The Beatles', al: 'Abbey Road', aa: 'The Beatles', s: T0, d: 60000, f: 1, q: 0, sid: 'S1', pid: 'P1', n: 0, p0: 0, p1: 60000, ...o });
const SEGS = [seg({ d: 20000, q: 0, n: 0 }), seg({ s: T0 + 25000, d: 40000, q: 1, n: 1 }), seg({ i: 't2', t: 'So What', a: 'Miles Davis', al: 'Kind of Blue', aa: 'Miles Davis', s: T0 + 400000, d: 10000, q: 0, pid: 'P2', n: 0, sid: 'S1' })];

test('toPlays joins the segments of one play; the short skip stays unqualified', () => {
  const p = toPlays(SEGS); assert.equal(p.length, 2); assert.equal(p[0].ms, 60000); assert.equal(p[0].q, 1); assert.equal(p[1].q, 0);
});
test('every export format holds only qualified plays (like a scrobbler), with the right field names', () => {
  const lb = JSON.parse(buildExport('listenbrainz', SEGS).text); assert.equal(lb.length, 1);
  assert.equal(lb[0].listened_at, Math.floor(T0 / 1000)); assert.equal(lb[0].track_metadata.artist_name, 'The Beatles'); assert.equal(lb[0].track_metadata.release_name, 'Abbey Road'); assert.equal(lb[0].track_metadata.additional_info.liquid_listened_ms, 60000);   // BUG-132: listened time has its own field now
  const sp = JSON.parse(buildExport('spotify', SEGS).text); assert.equal(sp[0].ms_played, 60000); assert.equal(sp[0].master_metadata_track_name, 'Come Together'); assert.equal(sp[0].ts, new Date(T0 + 60000).toISOString());
  const csv = buildExport('csv', SEGS, new Date(2026, 10, 7)); assert.equal(csv.name, 'liquid-dark-listening-scrobbles-20261107.csv'); assert.equal(csv.count, 1); assert.match(csv.text, /^Timestamp \(UTC\),Unix time,Artist,Track,Album,Album artist,Minutes played\r\n/);
  assert.throws(() => buildExport('x', SEGS), /format/); assert.equal(FORMATS.length, 7);
});
test('Liquid backup is lossless and re-imports with the same play ids and seq numbers', () => {
  const f = buildExport('liquid', SEGS), back = parseListens(f.text, 'a.json'); assert.equal(back.format, 'liquid'); assert.equal(back.segs.length, 3);
  const plan = planLiquid(back.segs, LIB, aaOf); assert.deepEqual(plan.rows.map(r => [r.pid, r.n]), [['P1', 0], ['P1', 1], ['P2', 0]]); assert.equal(plan.matched, 3);
  assert.throws(() => parseListens(JSON.stringify({ kind: 'listening', version: 5, segments: [] }), 'x.json'), /newer/);
});
test('Liquid import links songs by name when the track id changed (new phone / re-picked folder)', () => {
  const plan = planLiquid([seg({ i: 'OLDID' })], LIB, aaOf); assert.equal(plan.rows[0].i, 't1');
  const unk = planLiquid([seg({ i: 'OLDID', t: 'Gone', a: 'Nobody' })], LIB, aaOf); assert.equal(unk.rows[0].i, 'OLDID'); assert.equal(unk.matched, 0);
});
test('ListenBrainz file (array and API payload) imports', () => {
  const arr = [{ listened_at: 1767643200, track_metadata: { artist_name: 'The Beatles', track_name: 'Come Together', release_name: 'Abbey Road', additional_info: { duration_ms: 259000 } } }, { listened_at: 1767643500, track_metadata: { artist_name: 'X', track_name: 'Y' } }];
  const a = parseListens(JSON.stringify(arr), 'lb.json'); assert.equal(a.plays.length, 2); assert.equal(a.plays[0].start, 1767643200000); assert.equal(a.plays[0].ms, 0); assert.equal(a.plays[0].dur, 259000);   // BUG-132: duration_ms is the track length, not the listened time
  assert.equal(parseListens(JSON.stringify({ payload: { listens: arr } }), 'lb.json').plays.length, 2);
});
test('Spotify extended history: ts is the END of the play, podcasts are skipped; old StreamingHistory too', () => {
  const rows = [{ ts: '2026-01-05T20:04:19Z', ms_played: 259000, master_metadata_track_name: 'Come Together', master_metadata_album_artist_name: 'The Beatles', master_metadata_album_album_name: 'Abbey Road' }, { ts: '2026-01-05T21:00:00Z', ms_played: 1000, master_metadata_track_name: null, episode_name: 'Pod' }];
  const r = parseListens(JSON.stringify(rows), 'Streaming_History_Audio_2026_0.json'); assert.equal(r.plays.length, 1); assert.equal(r.plays[0].start, Date.parse('2026-01-05T20:04:19Z') - 259000);
  const old = parseListens(JSON.stringify([{ endTime: '2026-01-05 20:04', artistName: 'The Beatles', trackName: 'Come Together', msPlayed: 259000 }]), 'StreamingHistory0.json'); assert.equal(old.plays.length, 1); assert.equal(old.plays[0].ms, 259000);
});
test('CSV: our own, Last.fm style ("05 Jan 2026, 20:00"), Apple Music play activity, Pano / generic unix time', () => {
  const own = parseListens(buildExport('csv', SEGS).text, 'a.csv'); assert.equal(own.plays.length, 1); assert.equal(own.plays[0].start, T0); assert.equal(Math.round(own.plays[0].ms / 1000), 60);
  const lf = parseListens('artist,album,track,date\nThe Beatles,Abbey Road,Come Together,"05 Jan 2026, 20:00"\n', 'lastfm.csv'); assert.equal(lf.plays.length, 1); assert.equal(new Date(lf.plays[0].start).getFullYear(), 2026);
  const am = parseListens('Song Name,Artist Name,Event Start Timestamp,Play Duration Milliseconds,Media Duration In Milliseconds\nSo What,Miles Davis,2026-01-05T20:00:00Z,562000,562000\n', 'Apple Music Play Activity.csv'); assert.equal(am.plays[0].ms, 562000); assert.equal(am.plays[0].dur, 562000);
  const pano = parseListens('Artist,Track,Album,Timestamp\nThe Beatles,Come Together,Abbey Road,1767643200\n', 'pano.csv'); assert.equal(pano.plays[0].start, 1767643200000);
  const one = parseListens('Title,Timestamp\nThe Beatles - Come Together,1767643200000\n', 'x.csv'); assert.equal(one.plays[0].artist, 'The Beatles'); assert.equal(one.plays[0].title, 'Come Together');
});
test('junk is refused', () => { for (const bad of ['', 'hi', '{}', '[]', 'a,b\n1,2', '[{"x":1}]']) assert.throws(() => parseListens(bad, 'x'), /Not a listening-history file/, bad); });
test('parseTime: seconds, ms, ISO, text dates', () => {
  assert.equal(parseTime(1767643200), 1767643200000); assert.equal(parseTime('1767643200000'), 1767643200000); assert.equal(parseTime('2026-01-05T20:00:00Z'), T0); assert.equal(parseTime('nonsense'), 0); assert.equal(parseTime(''), 0);
  assert.ok(parseTime('05 Jan 2026, 20:00') > 0);
});
test('planPlays: matches the library, keeps unknown songs with a stable id, fills the listening time, groups sessions, is deterministic', () => {
  const plays = [{ start: T0, ms: 0, title: 'Come Together - Remastered 2009', artist: 'The Beatles', album: '', dur: 0 }, { start: T0 + 10 * 60000, ms: 0, title: 'Mystery', artist: 'Somebody', album: 'LP', dur: 0 }, { start: T0 + 5 * 3600000, ms: 8000, title: 'So What', artist: 'Miles Davis', album: '', dur: 0 }];
  const a = planPlays(plays, LIB, aaOf), b = planPlays(plays, LIB, aaOf);
  assert.deepEqual(a.rows, b.rows); assert.equal(a.matched, 2);
  assert.equal(a.rows[0].i, 't1'); assert.equal(a.rows[0].d, 259000); assert.equal(a.rows[0].q, 1); assert.equal(a.rows[0].al, 'Abbey Road');
  assert.match(a.rows[1].i, /^x/); assert.equal(a.rows[1].d, 180000);
  assert.equal(a.rows[0].sid, a.rows[1].sid); assert.notEqual(a.rows[1].sid, a.rows[2].sid);
  assert.equal(a.rows[2].q, 0);   // 8 s of a 562 s song is not a play (the rule is 10 s)
  assert.equal(new Set(a.rows.map(r => r.pid)).size, 3);
});
test('BUG-128: Spotify rows keep Spotify\'s rule (0 ms = skip, no song-length fallback); other sources keep the fallback', () => {
  const rows = planPlays([
    { start: T0, ms: 0, title: 'Come Together - Remastered 2009', artist: 'The Beatles', album: '', dur: 0, src: 'spotify' },
    { start: T0 + 3600000, ms: 0, title: 'Come Together - Remastered 2009', artist: 'The Beatles', album: '', dur: 0 },
    { start: T0 + 7200000, ms: 8000, title: 'Come Together - Remastered 2009', artist: 'The Beatles', album: '', dur: 0, src: 'spotify' },
  ], LIB, aaOf).rows;
  assert.equal(rows.length, 2);
  assert.equal(rows.find(r => r.s === T0 + 3600000).d, 259000);   // Last.fm-style row with no time: song length
  assert.equal(rows.find(r => r.s === T0 + 7200000).d, 8000);    // Spotify row: its real time, not a song length
  assert.equal(rows.find(r => r.s === T0 + 7200000).q, 0);
  assert.equal(rows.some(r => r.s === T0), false);                // Spotify instant skip: never imported
});

test('summary text', () => {
  assert.match(summary(5, 5, 3), /^Imported 5 listening records · 3 matched/); assert.match(summary(2, 5, 0), /3 already there/); assert.match(summary(0, 5, 5), /Nothing new/); assert.match(summary(1, 1, 0), /^Imported 1 listening record$/);
});

test('v148: a backup keeps the time zone each listen happened in; old backups fall back to this phone', () => {
  const seg = { i: 'a', t: 'T', a: 'A', al: 'L', aa: 'A', s: 1700000000000, d: 60000, f: 1, q: 1, sid: 's', pid: 'p', n: 0, p0: 0, p1: 0 };
  const text = JSON.stringify({ app: 'liquid-dark', kind: 'listening', version: 1, segments: [{ ...seg, tz: 330 }, { ...seg, pid: 'p2', tz: 'junk' }, { ...seg, pid: 'p3' }] });
  const { segs } = parseListens(text);
  assert.deepEqual(segs.map(g => g.tz), [330, null, null]);
  const { rows } = planLiquid(segs, [], () => ({}));
  assert.equal(rows[0].tz, 330);
  assert.equal(rows[1].tz, -new Date(seg.s).getTimezoneOffset());
  assert.equal(rows[2].tz, -new Date(seg.s).getTimezoneOffset());
});

test('Spotify-format export keeps the TRACK artist (not the album artist) so a re-import does not rename compilation artists', () => {
  const segs = [{ i: 'x', t: 'Song', a: 'Track Artist', al: 'Compilation', aa: 'Various Artists', s: 1700000000000, d: 60000, f: 1, q: 1, sid: 's', pid: 'p1', n: 0, p0: 0, p1: 60, tz: 330 }];
  const sp = JSON.parse(buildExport('spotify', segs).text);
  assert.equal(sp[0].master_metadata_album_artist_name, 'Track Artist');
  const back = parseListens(JSON.stringify(sp), 'h.json');
  assert.equal(back.plays[0].artist, 'Track Artist'); assert.equal(back.plays[0].title, 'Song');
});
