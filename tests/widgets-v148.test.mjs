// v148: the three new home screen widgets (Now Playing large, Genres, Listening: Daily). Static checks (no Android here; they fail when a file or id goes missing, and pass after a harmless rename or reformat), plus the real doLaunch tap handler:
// every resource a Java file names exists, the manifest rows are installed, the settings buttons reach a real widget class, and a genre tap is understood by the app.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { extract } from './extract.mjs';

const rd = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const N = 'native-android/', RES = N + 'res/';
const java = Object.fromEntries(readdirSync(new URL('../' + N, import.meta.url)).filter(f => f.endsWith('.java')).map(f => [f, rd(N + f)]));
const layouts = readdirSync(new URL('../' + RES + 'layout', import.meta.url)).map(f => f.replace('.xml', ''));
const allIds = new Set(layouts.flatMap(l => [...rd(RES + 'layout/' + l + '.xml').matchAll(/@\+id\/(\w+)/g)].map(m => m[1])));
const strings = new Set([...rd(RES + 'values/lf_strings.xml').matchAll(/name="(\w+)"/g)].map(m => m[1]));
const NEW_JAVA = ['NowPlayingWidget.java', 'StatsWidgets.java', 'LiquidTiles.java', 'LiquidWidget.java'];

test('every R.id / R.layout / R.drawable used by the widget Java files exists', () => {
  for (const f of NEW_JAVA) {
    for (const m of java[f].matchAll(/R\.id\.(\w+)/g)) assert.ok(allIds.has(m[1]), f + ': R.id.' + m[1]);
    for (const m of java[f].matchAll(/R\.layout\.(\w+)/g)) assert.ok(layouts.includes(m[1]), f + ': R.layout.' + m[1]);
    for (const m of java[f].matchAll(/R\.drawable\.(\w+)/g)) assert.ok(existsSync(new URL('../' + RES + 'drawable/' + m[1] + '.xml', import.meta.url)), f + ': R.drawable.' + m[1]);
  }
});

test('every appwidget info file points at an existing layout and description string', () => {
  for (const f of readdirSync(new URL('../' + RES + 'xml', import.meta.url))) {
    const x = rd(RES + 'xml/' + f);
    if (!x.includes('appwidget-provider')) continue;   // v210: the battery-helper accessibility config lives in res/xml too
    const l = /@layout\/(\w+)/.exec(x)[1], d = /@string\/(\w+)/.exec(x)[1];
    assert.ok(layouts.includes(l), f + ' -> layout ' + l); assert.ok(strings.has(d), f + ' -> string ' + d);
  }
});

test('manifest rows: Genres, Listening: Daily and the large Now Playing widget are installed with their info files', () => {
  const sh = rd('scripts/install-native.sh');
  assert.match(sh, /\('Genres', 'Genres', 'lf_genres_info'\)/);
  assert.match(sh, /\('Daily', 'Listening: Daily', 'lf_stats_daily_info'\)/);
  assert.match(sh, /android:name="\.NowPlayingWidget"[^]*?@xml\/lf_nowplaying_info/);
  for (const f of ['lf_genres_info', 'lf_stats_daily_info', 'lf_nowplaying_info']) assert.ok(existsSync(new URL('../' + RES + 'xml/' + f + '.xml', import.meta.url)), f);
  assert.ok(java['LiquidTiles.java'].includes('public static class Genres extends AppWidgetProvider'));
  assert.ok(java['StatsWidgets.java'].includes('public static class Daily extends Base'));
});

test('StatsWidgets.ALL index = kind: Daily is kind 4 (the redraw loop passes the index as the kind)', () => {
  const s = java['StatsWidgets.java'];
  assert.match(s, /ALL = \{ Day\.class, Week\.class, Month\.class, All\.class, Daily\.class \}/);
  assert.match(s, /K_DAY = 0, K_WEEK = 1, K_MONTH = 2, K_ALL = 3, K_DAILY = 4/);
  assert.match(s, /kind == K_DAILY\) v = daily\(c\)/);
  assert.ok(s.includes('Day.class).setAction(ACTION_MIDNIGHT)'), 'the midnight alarm still goes to Day, which redraws every stats widget (Daily included)');
});

test('every "Add ... widget" button in Settings reaches a real widget class in LiquidNative.addWidget', () => {
  const main = rd('src/main.js'), kinds = [...main.matchAll(/data-act="addwidget" data-kind="(\w*)"/g)].map(m => m[1]);
  for (const k of ['nowplaying', 'genres', 'statsdaily']) assert.ok(kinds.includes(k), 'button for ' + k);
  const tiles = [...java['LiquidTiles.java'].matchAll(/public static class (\w+) extends AppWidgetProvider/g)].map(m => m[1].toLowerCase());
  const stats = [...java['StatsWidgets.java'].matchAll(/public static class (\w+) extends Base/g)].map(m => 'stats' + m[1].toLowerCase());
  const known = new Set(['', 'nowplaying', ...tiles, ...stats]);
  for (const k of kinds) assert.ok(known.has(k), 'addwidget kind "' + k + '" has no widget class');
  assert.match(java['LiquidNative.java'], /"nowplaying"\.equalsIgnoreCase\(kd\)\) k = NowPlayingWidget\.class/);
});

test('large Now Playing: the service pushes album + cover path, the buttons reuse the small widget broadcasts, one decode per song', () => {
  const ps = java['PlaybackService.java'], lw = java['LiquidWidget.java'], np = java['NowPlayingWidget.java'];
  assert.match(ps, /LiquidWidget\.push\(this, [^;]*albumTitle[^;]*cover, p\.isPlaying\(\)\)/);
  assert.match(lw, /static void push\(Context c, String title, String artist, String album, String cover, boolean playing\)/);
  assert.ok(lw.includes('NowPlayingWidget.refresh(c)'));
  for (const a of ['A_PLAY', 'A_NEXT', 'A_PREV']) assert.ok(np.includes('LiquidWidget.act(c, LiquidWidget.' + a));
  assert.ok(np.includes('lastPath') && np.includes('inSampleSize'));
  assert.ok(!/MediaButton|KeyEvent|onMediaButtonEvent/.test(np + lw), 'the Bluetooth / earphone button code is untouched by the widgets');
});

function launchWorld({ tracks = [1], genres = [{ n: 'Rock' }] } = {}) {
  const log = [], timers = [];
  const deps = { TABS: [['home'], ['library']], closeTop: () => {}, bar: { set: i => log.push('bar ' + i) }, tab: '', stack: [], renderSub: () => {}, renderMain: () => {}, lsx: { fresh: () => {} },
    push: (...a) => log.push(a.join(':')), tracks, genres, E: x => x, unesc: x => x, setTimeout: (f, ms) => timers.push([f, ms]) };
  return { log, timers, fn: extract('src/main.js', 'doLaunch', deps, '};') };
}
test('a Genres widget tap opens Genres (title) or that genre (chip, matched without case); an unknown genre stays on Genres', () => {
  let w = launchWorld(); w.fn('genres'); assert.deepEqual(w.log, ['bar 1', 'genres']);
  w = launchWorld(); w.fn('genre:rock'); assert.deepEqual(w.log, ['bar 1', 'genres', 'genre:Rock']);
  w = launchWorld(); w.fn('genre:Jazz'); assert.deepEqual(w.log, ['bar 1', 'genres']);
});
test('a Genres widget tap while the library is still loading waits and tries again, at most 20 times', () => {
  const w = launchWorld({ tracks: [] }); w.fn('genres'); assert.deepEqual(w.log, []); assert.equal(w.timers[0][1], 500);
  const w2 = launchWorld({ tracks: [] }); w2.fn('genres', 20); assert.equal(w2.timers.length, 0); assert.deepEqual(w2.log, ['bar 1', 'genres']);
});
test('Genres widget: top genres saved with the library, one request code per chip (static check)', () => {
  const t = java['LiquidTiles.java'];
  assert.ok(t.includes('putString("wGen", topGenres(tracks).toString())'));
  assert.ok(t.includes('open(c, "genre:" + items.get(s)[0], 41 + s)'));
  assert.ok(t.includes('open(c, "genres", 40)'));
  assert.ok([...rd('native-android/StatsWidgets.java').matchAll(/"lstats", (\d+)/g)].length >= 1);
});
