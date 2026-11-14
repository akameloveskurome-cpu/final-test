// v158: Tempo import / export checked against the real backup format, Smart artist grouping for history of songs that are not in the library,
// and artist pictures: different artists never share a picture key (Hindi / Tamil / Japanese names lost their vowel signs in artistKey).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseListens, buildExport, planPlays } from '../src/listenio.js';
import { fromTempo, tempoBackup, isJunkSong } from '../src/listensrc.js';
import { artistKey } from '../src/artistnames.js';
import { picAliases } from '../src/artistpics.js';
import { setSmartArtists, snapshotArtists, learnArtists } from '../src/data.js';

const T0 = Date.UTC(2026, 8, 4, 8, 0, 0);
const ev = (id, track_id, t, ms, o = {}) => ({ id, track_id, timestamp: T0 + t, playDuration: ms, source: 'in.krosbits.musicolet', wasSkipped: false, endTimestamp: T0 + t + ms, estimatedDurationMs: 200000, tzOffsetMinutes: 330, sessionId: 's' + id, ...o });
const TEMPO = {
  tracks: [
    { id: 1, title: 'Real Song', artist: 'Eurythmics, Annie Lennox, Dave Stewart', album: 'Touch', primaryArtistId: 1, contentType: 'MUSIC' },
    { id: 2, title: 'Applying changes', artist: '122 audio-files found Internal Storage › Xo › Albums', primaryArtistId: 2, contentType: 'MUSIC' },
    { id: 3, title: 'A little something extra for you!', artist: 'Discover exciting music experiences, brand offers through Premium Rewards. Claim now!', primaryArtistId: 3, contentType: 'MUSIC' },
    { id: 4, title: 'pursuit - slowed', artist: 'isq \u2022 Recommended for you', primaryArtistId: 4, contentType: 'MUSIC' },
    { id: 5, title: 'SABI, MIA BOYKA', artist: 'Базовый минимум (slowed).mp3', primaryArtistId: 5, contentType: 'MUSIC' },
    { id: 6, title: 'Con Calma', artist: '6.8M views', primaryArtistId: 6, contentType: 'MUSIC' },
    { id: 7, title: 'Duplicated', artist: 'Someone', primaryArtistId: 7, contentType: 'MUSIC' },
  ],
  artists: [{ id: 1, name: 'Eurythmics' }, { id: 4, name: 'isq' }, { id: 7, name: 'Someone' }],
  listeningEvents: [
    ev(1, 1, 0, 120000, { tzOffsetMinutes: 60 }), ev(2, 2, 1000, 40000), ev(3, 3, 2000, 30000), ev(4, 4, 3000, 50000), ev(5, 5, 4000, 31000), ev(6, 6, 5000, 31000),
    ev(7, 7, 900000, 100000), ev(8, 7, 905000, 150000, { source: 'com.spotify.music', estimatedDurationMs: 200000 }),   // same song heard by two apps at once
    ev(9, 7, 2000000, 90000), ev(10, 7, 2000000 + 100000 + 60000, 90000),                                         // really played twice in a row (same app): both count
  ],
};

test('Tempo import: junk (scan text, ads, view counts) dropped, YouTube text cleaned, swapped file-name fields fixed', () => {
  const p = fromTempo(TEMPO);
  assert.equal(isJunkSong('Applying changes', 'x'), true); assert.equal(isJunkSong('Blinding Lights', 'The Weeknd'), false);
  assert.deepEqual(p.map(x => x.title), ['Real Song', 'pursuit - slowed', 'Базовый минимум (slowed)', 'Duplicated', 'Duplicated', 'Duplicated']);
  const y = p.find(x => x.title === 'pursuit - slowed'); assert.equal(y.artist, 'isq'); assert.equal(y.rawArtist, 'isq \u2022 Recommended for you');
  const s = p.find(x => x.title.startsWith('Базовый')); assert.equal(s.artist, 'SABI, MIA BOYKA');
});
test('Tempo import: one play heard by two apps counts once (the longer record), two real replays both count', () => {
  const d = fromTempo(TEMPO).filter(x => x.title === 'Duplicated');
  assert.equal(d.length, 3); assert.equal(d[0].ms, 150000); assert.equal(d[0].start, T0 + 905000);
});
test('Tempo import: time zone of each play and the primary artist as album artist are kept; the play id still comes from the raw tags', () => {
  const p = fromTempo(TEMPO), a = p[0]; assert.equal(a.tz, 60); assert.equal(a.albumArtist, 'Eurythmics'); assert.equal(a.dur, 200000);
  const rows = planPlays(parseListens(JSON.stringify(TEMPO), 'data.json').plays, [], () => ({}));
  assert.equal(rows.rows[0].tz, 60); assert.equal(rows.rows[0].aa, 'Eurythmics');
  const y = rows.rows.find(r => r.t === 'pursuit - slowed'), raw = planPlays([{ start: T0 + 3000, ms: 50000, title: 'pursuit - slowed', artist: 'isq \u2022 Recommended for you', album: '', albumArtist: '', dur: 0 }], [], () => ({})).rows[0];
  assert.equal(y.pid, raw.pid);   // same id as an older version made: importing the same file again adds nothing twice
});
test('Tempo export is shaped like the real backup and reads back', () => {
  const plays = fromTempo(TEMPO).map(x => ({ ...x, q: x.ms >= 30000 }));
  const o = tempoBackup(plays, 'Denji', new Date(T0));
  assert.equal(o.userName, 'Denji'); assert.equal(o.badges.length, 28); assert.ok(o.userPreferences.hideStreaks === false && o.userPreferences.lastfmSyncFrequency === 'NONE');
  const t1 = o.tracks.find(t => t.title === 'Real Song'); assert.equal(t1.primaryArtistId, o.artists.find(a => a.name === 'Eurythmics').id);
  assert.deepEqual(o.trackArtists.filter(x => x.trackId === t1.id).map(x => [x.role, x.creditOrder]), [['PRIMARY', 0], ['PRIMARY', 1], ['PRIMARY', 2]]);
  const f = tempoBackup([{ start: T0, ms: 90000, title: 'S', artist: 'The Weeknd feat. Ed Sheeran', album: 'Al', q: 1, tz: 330 }], '', new Date(T0));
  assert.deepEqual(f.trackArtists.map(x => x.role), ['PRIMARY', 'FEATURED']); assert.equal(f.albums.length, 1); assert.equal(f.listeningEvents[0].tzOffsetMinutes, 330);
  const back = parseListens(JSON.stringify(o), 'data.json'); assert.equal(back.format, 'tempo'); assert.equal(back.plays.length, plays.length);
  assert.equal(buildExport('tempo', [{ i: '1', t: 'S', a: 'A', al: '', aa: '', s: T0, d: 90000, f: 1, q: 1, sid: 'x', pid: 'p', n: 0, p0: 0, p1: 0, tz: 120 }], new Date(T0), 'Me').files[0].text.includes('"tzOffsetMinutes":120'), true);
});

test('artistKey keeps the vowel signs / voiced marks of non-Latin names (different artists never share a key), Latin accents still merge', () => {
  assert.notEqual(artistKey('\u0915\u0941\u092e\u093e\u0930'), artistKey('\u0915\u092e\u0930'));      // Hindi
  assert.notEqual(artistKey('\u30ac\u30af\u30c8'), artistKey('\u30ab\u30af\u30c8'));                  // Japanese dakuten
  assert.notEqual(artistKey('\u0b85\u0ba9\u0bbf\u0bb0\u0bc1\u0ba4\u0bcd'), artistKey('\u0b85\u0ba9\u0bb0\u0ba4'));   // Tamil
  assert.equal(artistKey('Beyonc\u00e9'), artistKey('Beyonce')); assert.equal(artistKey('The Weeknd'), artistKey('Weeknd')); assert.equal(artistKey('Sigur R\u00f3s'), artistKey('Sigur Ros'));
});
test('a custom picture of one artist is not found as an alias of a different artist (it would be deleted when the other gets a picture)', () => {
  const stored = ['\u0915\u0941\u092e\u093e\u0930', '\u0915\u092e\u0930', '\u30ac\u30af\u30c8'];
  assert.deepEqual(picAliases(stored, '\u0915\u092e\u0930', artistKey), ['\u0915\u092e\u0930']);
  assert.deepEqual(picAliases(stored, '\u30ab\u30af\u30c8', artistKey), []);
});

test('listening history of songs NOT in the library follows Smart artist grouping (split collabs, merged spellings, off = as tagged)', () => {
  setSmartArtists(true); learnArtists(['The Weeknd', 'Eurythmics', 'Tyler, The Creator']);
  assert.deepEqual(snapshotArtists('The Weeknd feat. Ed Sheeran', 'S', 'The Weeknd'), ['The Weeknd', 'Ed Sheeran']);
  assert.deepEqual(snapshotArtists('Eurythmics, Annie Lennox, Dave Stewart', 'S', 'Eurythmics'), ['Eurythmics', 'Annie Lennox', 'Dave Stewart']);
  assert.deepEqual(snapshotArtists('Tyler, The Creator', 'S', 'Tyler'), ['Tyler, The Creator']);   // protected act stays one artist
  assert.deepEqual(snapshotArtists('Weeknd', 'S', ''), ['Weeknd']); assert.equal(snapshotArtists('The Weeknd', 'S', '')[0], 'The Weeknd');
  assert.deepEqual(snapshotArtists('', 'S', ''), ['Unknown Artist']);
  setSmartArtists(false); assert.deepEqual(snapshotArtists('The Weeknd feat. Ed Sheeran', 'S', 'The Weeknd'), ['The Weeknd feat. Ed Sheeran']); setSmartArtists(true);
});
