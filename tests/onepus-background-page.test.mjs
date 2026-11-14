// OnePlus / OPPO (Reno...) / Realme: "Allow" on the Keep-the-music-playing card opens the app's App info page (always opens), and a toast says "Tap Battery usage, then turn on Allow background activity".
// Why: the page with POWER CONSUMPTION CONTROLS (Allow background activity) sits INSIDE App info > Battery usage and is not a page other apps can open (guessing its class names did not work on a real OnePlus).
// Java is checked on the source text (no Android here); the Java also compiles against stub classes in tests/java-probe*.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const J = readFileSync(new URL('../native-android/LiquidNative.java', import.meta.url), 'utf8');
const body = (from, to) => { const a = J.indexOf(from), b = J.indexOf(to, a + 1); assert.ok(a > -1 && b > a, from); return J.slice(a, b); };
const open = body('public void openBackgroundSettings(final PluginCall call)', 'public void canInstallUpdates');

test('OnePlus, OPPO and Realme are detected by oplusPhone(); other brands are not', () => {
  const f = body('private boolean oplusPhone()', 'private void bgHint');
  for (const k of ['m.contains("oneplus")', 'm.contains("oppo")', 'm.contains("realme")']) assert.ok(f.includes(k), k);
  assert.doesNotMatch(f, /samsung|vivo|xiaomi|google|pixel|motorola|huawei/i);
  assert.match(f, /com\.oplus\.battery/, 'a re-branded ColorOS phone is found by its battery app');
});

test('on those phones the battery page found on THIS phone is tried first, then App info + the two-tap hint, all before every other page', () => {
  const f = open.indexOf('openFoundBatteryPage(pkg)');
  assert.ok(f > -1 && f < open.indexOf('ACTION_APPLICATION_DETAILS_SETTINGS'), 'discovered page before App info');
  assert.match(open, /via = "battery-page:" \+ found/);
  const a = open.indexOf('else if (tryStart(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, u)))');
  const b = open.indexOf('VIEW_ADVANCED_POWER_USAGE_DETAIL');
  assert.ok(a > -1 && a < b, 'App info before the generic battery page');
  assert.match(open, /bgHint\("Tap Battery usage, then turn on Allow background activity"\)/);
  assert.match(open, /via = "app-info:battery-usage"/);
});

test('the toast is posted on the UI thread and cannot crash the call', () => {
  const h = body('private void bgHint', '@PluginMethod\n  public void openBackgroundSettings');
  assert.match(h, /ui\.post\(/);
  assert.match(h, /Toast\.LENGTH_LONG/);
  assert.match(h, /catch \(Throwable ignored\)/);
});

test('the run-time page scan and the guessed-page helpers are gone (they did not work on a real phone)', () => {
  for (const k of ['openOplusAppPage', 'oplusAppPageScan', 'oplusPageCache', 'bgStart(', 'onePlus()']) assert.ok(!J.includes(k), k);
});

test('every other brand: generic battery page, brand list, MIUI, then App info + the same hint; the "Let app always run in background?" dialog is never used', () => {
  const b = open.indexOf('VIEW_ADVANCED_POWER_USAGE_DETAIL'), c = open.indexOf('openOemBackgroundPage(pkg)'), d = open.indexOf('via = "app-info";');
  assert.ok(b > -1 && b < c && c < d);
  assert.ok(open.indexOf('bgHint(', d) > d, 'the App info fallback also shows the hint');
  assert.doesNotMatch(open, /(?:ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS|ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)/, 'no ignore-battery dialog / list in the Allow chain');
});

test('the work runs on LIB_POOL and the call always resolves', () => {
  assert.match(open, /LIB_POOL\.execute/);
  assert.match(open, /o\.put\("via", via\); call\.resolve\(o\)/);
});

test('the Allow button and the repeat-every-open logic are untouched', () => {
  const B = readFileSync(new URL('../src/bgallow.js', import.meta.url), 'utf8');
  assert.ok(B.includes("trip = true; try { Native.openBackgroundSettings()"));
  assert.match(J, /public void isBackgroundAllowed\(PluginCall call\)/);
});

test('the battery page is FOUND from the phone\'s own manifests (nothing guessed), only real battery-detail entries are tried, best first, max 6, every one logged', () => {
  const d = body('private List<String[]> bgDiscover()', 'private String openFoundBatteryPage');
  assert.match(d, /openXmlResourceParser\("AndroidManifest\.xml"\)/);
  assert.match(d, /Log\.i\("LiquidNative", "background: found rank "/);
  const r = body('private static int bgRank', 'private List<String[]> bgDiscover()');
  for (const k of ['POWER_CONSUMPTION', 'ADVANCED_POWER_USAGE_DETAIL', 'APP_BATTERY', 'SAVER', 'OPTIMIZ']) assert.ok(r.includes(k), k);
  const o = body('private String openFoundBatteryPage', '@PluginMethod\n  public void openBackgroundSettings');
  assert.match(o, /tries\+\+ >= 6/);
  assert.match(o, /Log\.i\("LiquidNative", "background: try "/);
  assert.match(d, /exported && !off/, 'only exported, enabled pages');
});
