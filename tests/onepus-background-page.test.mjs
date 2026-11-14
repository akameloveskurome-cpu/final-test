// OnePlus: "Allow" on the Keep-the-music-playing card opens the app's own "Power consumption controls" page (Allow foreground / background activity, Allow auto launch, Force stop).
// Java is checked on the source text (no Android here); the routing was also run against stub Android classes in the AI sandbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const J = readFileSync(new URL('../native-android/LiquidNative.java', import.meta.url), 'utf8');
const body = (from, to) => { const a = J.indexOf(from), b = J.indexOf(to, a + 1); assert.ok(a > -1 && b > a, from); return J.slice(a, b); };
const open = body('public void openBackgroundSettings(final PluginCall call)', 'public void canInstallUpdates');

test('OnePlus only: the power page step is guarded by onePlus(), which matches OnePlus and nothing else', () => {
  const f = body('private static boolean onePlus()', 'private boolean bgStart');
  assert.match(f, /m\.contains\("oneplus"\)/);
  assert.doesNotMatch(f, /oppo|realme/, 'OPPO / Realme keep their old order');
  assert.match(open, /if \(onePlus\(\)\) \{ String page = openOplusAppPage\(pkg\);/);
});

test('the OnePlus page is tried BEFORE the generic battery page, which is tried before the older brand list (order unchanged for everyone else)', () => {
  const a = open.indexOf('openOplusAppPage(pkg)'), b = open.indexOf('VIEW_ADVANCED_POWER_USAGE_DETAIL'), c = open.indexOf('openOemBackgroundPage(pkg)'), d = open.indexOf('ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, u');
  assert.ok(a > -1 && a < b && b < c && c < d, 'power page < generic < brand list < ignore dialog');
  assert.ok(open.indexOf('ACTION_APPLICATION_DETAILS_SETTINGS') > d, 'app info is still the last resort');
});

test('known ColorOS / OxygenOS power-consumption pages are tried, then a run-time scan of exported pages of pre-installed apps', () => {
  const k = body('private String openOplusAppPage(String pkg)', 'public void openBackgroundSettings');
  assert.match(k, /com\.oplus\.battery", "com\.oplus\.powermanager\.fuelgaue\.PowerConsumptionActivity"/);
  assert.match(k, /com\.coloros\.oppoguardelf", "com\.coloros\.powermanager\.fuelgaue\.PowerConsumptionActivity"/);
  assert.ok(k.indexOf('known') < k.indexOf('oplusAppPageScan()'));
  const s = body('private ComponentName oplusAppPageScan()', 'private String openOplusAppPage');
  assert.match(s, /eqSystemApp\(pi\.applicationInfo\)/);
  assert.match(s, /!ai\.exported \|\| !ai\.enabled/);
  assert.match(s, /powerconsumption/);
});

test('the page gets the package name (extras and package: data) and every try is logged', () => {
  const b = body('private boolean bgStart', 'private volatile ComponentName oplusPageCache');
  for (const k of ['"package_name"', '"packageName"', '"pkg_name"', 'Uri.parse("package:" + pkg)', 'Log.i("LiquidNative", "background: "']) assert.ok(b.includes(k), k);
});

test('the slow package scan runs on LIB_POOL, not on the plugin thread', () => {
  assert.match(open, /LIB_POOL\.execute/);
  assert.match(open, /o\.put\("via", via\); call\.resolve\(o\)/);
});

test('the Allow button and the repeat-every-open logic are untouched', () => {
  const B = readFileSync(new URL('../src/bgallow.js', import.meta.url), 'utf8');
  assert.ok(B.includes("trip = true; try { Native.openBackgroundSettings()"));
  assert.match(J, /public void isBackgroundAllowed\(PluginCall call\)/);
});
