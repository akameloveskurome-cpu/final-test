// v159: a re-imported Tempo file made by this app adds nothing twice, also for plays whose artist names were cleaned on import
// (v158 gave those plays a different play id on the second import, so 6 plays of the owner's history appeared twice).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseListens, buildExport, planPlays, playKeysOf } from '../src/listenio.js';

const T0 = Date.UTC(2026, 8, 4, 8, 0, 0);
const ev = (id, track_id, t, ms) => ({ id, track_id, timestamp: T0 + t, playDuration: ms, source: 'in.krosbits.musicolet', wasSkipped: false, endTimestamp: T0 + t + ms, estimatedDurationMs: 200000, tzOffsetMinutes: 330, sessionId: 's' + id });
const TEMPO = {
  tracks: [
    { id: 1, title: 'Real Song', artist: 'Eurythmics, Annie Lennox', album: 'Touch', primaryArtistId: 1, contentType: 'MUSIC' },
    { id: 2, title: 'pursuit - slowed', artist: 'isq \u2022 Recommended for you', primaryArtistId: 2, contentType: 'MUSIC' },
    { id: 3, title: 'SABI, MIA BOYKA', artist: 'Базовый минимум (slowed).mp3', primaryArtistId: 3, contentType: 'MUSIC' },
  ],
  artists: [{ id: 1, name: 'Eurythmics' }, { id: 2, name: 'isq' }],
  listeningEvents: [ev(1, 1, 0, 120000), ev(2, 2, 100000, 50000), ev(3, 3, 200000, 31000)],
};

// What the first import stores (rows as ListenDb keeps them: cleaned names, raw-tag play ids)
const first = planPlays(parseListens(JSON.stringify(TEMPO), 'data.json').plays, [], () => ({})).rows;

test('the cleaned-name play gets a different play id when the export is read back (the cause of the duplicates)', () => {
  const exported = buildExport('tempo', first, new Date(T0), 'Me').files[0].text;
  const again = planPlays(parseListens(exported).plays, [], () => ({})).rows;
  const a = first.find(r => r.t === 'pursuit - slowed'), b = again.find(r => r.t === 'pursuit - slowed');
  assert.notEqual(a.pid, b.pid);   // without the natural-key check this play would be added a second time
});

test('re-importing our own Tempo export adds nothing twice (plays with cleaned artist names included)', () => {
  const exported = buildExport('tempo', first, new Date(T0), 'Me').files[0].text;
  const have = playKeysOf(first);
  const again = planPlays(parseListens(exported).plays, [], () => ({}), have).rows;
  assert.equal(again.length, 0);
});

test('a play that is really new is still added when the history already has other plays', () => {
  const have = playKeysOf(first);
  const more = [{ start: T0 + 900000, ms: 60000, title: 'pursuit - slowed', artist: 'isq', album: '', albumArtist: '', dur: 0 }];
  const rows = planPlays(more, [], () => ({}), have).rows;
  assert.equal(rows.length, 1);
});

test('the same play twice in one file is still counted once, and playKeysOf keeps the cleaned names', () => {
  const dup = [{ start: T0, ms: 60000, title: 'X', artist: 'Y', album: '', albumArtist: '', dur: 0 }, { start: T0, ms: 60000, title: 'X', artist: 'Y', album: '', albumArtist: '', dur: 0 }];
  assert.equal(planPlays(dup, [], () => ({}), new Set()).rows.length, 1);
  assert.equal(playKeysOf([{ s: T0, t: 'pursuit - slowed', a: 'isq' }]).has(`${T0}|pursuit - slowed|isq`), true);
});

// The widgets get the library's known artists from the app (same split as the app).
test('stats widgets receive the known artists: JS side runs for real (Native bridge call + data.widgetArtists)', async () => {
  const { Native } = await import('../src/native.js'), { widgetArtists } = await import('../src/data.js');
  assert.equal(typeof Native.setWidgetArtists, 'function');
  assert.equal(await Native.setWidgetArtists(JSON.parse(JSON.stringify(widgetArtists()))), undefined);   // no plugin here: resolves, never throws
  const w = widgetArtists(); assert.ok(Array.isArray(w.known) && Array.isArray(w.protect) && 'smart' in w);
});
// Java side cannot run here (no Gradle): kept as a shape guard, the GitHub build compiles it.
import { readFileSync } from 'node:fs';
test('Java guard: plugin method and artist split exist (compiled by the GitHub build)', () => {
  const rd = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const N = rd('native-android/LiquidNative.java'), W = rd('native-android/StatsWidgets.java');
  assert.ok(N.includes('public void setWidgetArtists(PluginCall call)') && N.includes('StatsWidgets.setKnown('));
  assert.ok(W.includes('static List<String> artistsOf(Context c, String artist') && W.includes('static String artistKey(String name)') && W.includes('static List<String> splitKnown('));
  assert.ok(!/static List<String> artistsOf\(String artist/.test(W));
});
