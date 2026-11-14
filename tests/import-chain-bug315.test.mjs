// BUG-315: the two biggest import bugs had no test that follows the REAL call order of main.js importLs():
//   parseListens(file) -> planPlays(plays, tracks, aaOf, haveKeys) -> countInHistory(parsed, haveKeys)   (the SAME Set is passed to both)
// and no Spotify test file had a row with ms_played 0 (BUG-128 / 285).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseListens, planPlays, countInHistory, playKeysOf, toPlays } from '../src/listenio.js';

const trk = (id, title, artist, album, dur) => ({ id, title, trackArtist: artist, albumId: 'al:' + album, dur });
const aaOf = t => ({ artist: t.trackArtist, album: t.albumId.slice(3) });
const LIB = [trk('t1', 'Come Together', 'The Beatles', 'Abbey Road', 259), trk('t2', 'So What', 'Miles Davis', 'Kind of Blue', 562)];
const iso = ms => new Date(ms).toISOString();
const T0 = Date.UTC(2026, 0, 5, 20, 0, 0);

const spotify = JSON.stringify([
  { ts: iso(T0), ms_played: 259000, master_metadata_track_name: 'Come Together', master_metadata_album_artist_name: 'The Beatles', master_metadata_album_album_name: 'Abbey Road' },
  { ts: iso(T0 + 600000), ms_played: 0, master_metadata_track_name: 'So What', master_metadata_album_artist_name: 'Miles Davis', master_metadata_album_album_name: 'Kind of Blue' },
  { ts: iso(T0 + 900000), ms_played: 562000, master_metadata_track_name: 'So What', master_metadata_album_artist_name: 'Miles Davis', master_metadata_album_album_name: 'Kind of Blue' },
]);

test('BUG-315 (BUG-284): parse -> planPlays -> countInHistory on ONE shared Set, in the order main.js uses', () => {
  const have = new Set();                                   // empty history
  const parsed = parseListens(spotify, 'Streaming_History_Audio_2026.json');
  assert.ok(parsed.plays && parsed.plays.length >= 2);
  const plan = planPlays(parsed.plays, LIB, aaOf, have);    // fills nothing in the caller's Set (BUG-284: it works on a copy)
  const c1 = countInHistory(parsed, have);
  assert.equal(c1.already, 0, 'nothing is in the history yet, so the preview must say 0 already there');
  assert.ok(plan.rows.length > 0);
  // the rows are stored; the history now holds them. The SAME file imported again must report everything as already there and add nothing.
  const have2 = playKeysOf(plan.rows);
  const plan2 = planPlays(parsed.plays, LIB, aaOf, have2);
  const c2 = countInHistory(parsed, have2);
  assert.equal(plan2.rows.length, 0, 're-import adds no row');
  assert.equal(c2.already, plan.rows.length, 'every stored play is reported as already there');
});

test('BUG-315 (BUG-285): a Spotify file with ms_played 0 never becomes a counted 3-minute play', () => {
  const parsed = parseListens(spotify, 'Streaming_History_Audio_2026.json');
  const rows = planPlays(parsed.plays, LIB, aaOf, new Set()).rows;
  assert.equal(rows.some(r => r.t === 'So What' && r.d < 1000), false, 'the instant skip (0 ms) is not imported');
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => r.d > 0 && r.d <= 562000), 'no row got a made-up length');
  const sec = rows.find(r => r.t === 'So What'); assert.ok(sec, 'the real So What play is kept'); assert.equal(sec.q, 1); assert.equal(sec.d, 562000);   // (Spotify ts = END of the play, so the start is not compared)
});

test('BUG-315: a stored play survives toPlays -> planPlays unchanged (no double count when re-importing our own plays)', () => {
  const rows = planPlays(parseListens(spotify, 'x.json').plays, LIB, aaOf, new Set()).rows;
  const back = toPlays(rows);
  assert.equal(back.length, rows.length);
  assert.equal(back.reduce((a, p) => a + p.ms, 0), rows.reduce((a, r) => a + r.d, 0));
});
