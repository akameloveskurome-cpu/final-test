// "Allow" on the Keep-the-music-playing card opens the app's own "Power consumption controls" page (Allow foreground / background activity, Allow auto launch, Force stop).
// OnePlus / OPPO / Realme (one ColorOS family): the Battery usage page first; this app's App info (Battery usage one tap away) only if the phone protects that page.
// Java is checked on the source text (no Android here); the routing was also run against stub Android classes in the AI sandbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const J = readFileSync(new URL('../native-android/LiquidNative.java', import.meta.url), 'utf8');
const body = (from, to) => { const a = J.indexOf(from), b = J.indexOf(to, a + 1); assert.ok(a > -1 && b > a, from); return J.slice(a, b); };
const open = body('public void openBackgroundSettings(final PluginCall call)', 'public void canInstallUpdates');

test('oplusFamily() is OnePlus, OPPO and Realme, nothing else', () => {
  const f = body('private static boolean oplusFamily()', 'private boolean bgStart');
  for (const k of ['"oneplus"', '"oppo"', '"realme"']) assert.ok(f.includes(k), k);
  assert.doesNotMatch(f, /samsung|vivo|xiaomi|huawei|google/i);
  assert.match(open, /if \(oplusFamily\(\)\) \{[^\n]*\n\s*String page = openOplusAppPage\(pkg\);/);
});

test('ColorOS family: the Battery usage page first, THIS app\'s App info as fallback (not the generic battery page); other brands keep their own order', () => {
  const fam = open.slice(open.indexOf('if (oplusFamily()) {   // OnePlus'), open.indexOf('if (via.isEmpty()) {'));
  assert.ok(fam.indexOf('openOplusAppPage(pkg)') > -1 && fam.indexOf('openOplusAppPage(pkg)') < fam.indexOf('ACTION_APPLICATION_DETAILS_SETTINGS'), 'family: power page < App info');
  assert.doesNotMatch(fam, /VIEW_ADVANCED_POWER_USAGE_DETAIL/, 'the generic page is not tried before App info on the family');
  const rest = open.slice(open.indexOf('if (via.isEmpty()) {'));
  const idx = k => { const i = rest.indexOf(k); assert.ok(i > -1, k); return i; };
  const o = [idx('VIEW_ADVANCED_POWER_USAGE_DETAIL'), idx('openOemBackgroundPage(pkg)'), idx('oplusAppPageScan()'), idx('com.miui.powerkeeper'), idx('ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, u'), idx('ACTION_APPLICATION_DETAILS_SETTINGS')];
  for (let i = 1; i < o.length; i++) assert.ok(o[i - 1] < o[i], 'step ' + i + ' comes after step ' + (i - 1));
  assert.match(rest, /if \(!oplusFamily\(\)\) \{/, 'the run-time search step is only for the other brands (the family already searched)');
});

test('App info route tells the person the one tap that is left: result hint + a native toast (visible over Settings)', () => {
  assert.match(open, /"app-info"\.equals\(via\)/);
  assert.match(open, /o\.put\("hint", HOW_TO_TURN_ON\)/);
  assert.match(open, /android\.widget\.Toast\.makeText\(getContext\(\), HOW_TO_TURN_ON/);
  assert.match(open, /Toast\.LENGTH_SHORT/, 'the how-to is ONE short toast (about 2 s), not four long ones');
  assert.doesNotMatch(open, /i < 4; i\+\+|Thread\.sleep\(3000\)|Toast\.LENGTH_LONG/, 'no repeating toast loop any more');
  assert.equal((open.match(/Toast\.makeText/g) || []).length, 1, 'one toast call only');
  assert.match(open, /getActivity\(\)\.runOnUiThread/);
});

test('the protected-page reason is written down for the next person', () => {
  assert.match(J, /OPLUS_COMPONENT_SAFE/);
});

test('known ColorOS / OxygenOS power-consumption pages are tried, then a run-time scan of exported pages of pre-installed apps', () => {
  const k = body('private String openOplusAppPage(String pkg)', 'public void openBackgroundSettings');
  assert.match(k, /com\.oplus\.battery", "com\.oplus\.powermanager\.fuelgaue\.PowerConsumptionActivity"/);
  assert.match(k, /com\.coloros\.oppoguardelf", "com\.coloros\.powermanager\.fuelgaue\.PowerConsumptionActivity"/);
  assert.ok(k.indexOf('PowerControlActivity') < k.indexOf('PowerConsumptionActivity'), 'the real class is tried first');
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
  assert.match(open, /o\.put\("via", via\);/);
  assert.match(open, /call\.resolve\(o\);/);
});

test('the Allow button and the repeat-every-open logic are untouched', () => {
  const B = readFileSync(new URL('../src/bgallow.js', import.meta.url), 'utf8');
  assert.ok(B.includes("trip = true; try { Native.openBackgroundSettings()"));
  assert.match(J, /public void isBackgroundAllowed\(PluginCall call\)/);
});

test('v209b: the run-time scan never picks Android\'s own Settings app (its page is the generic Battery usage page: Unrestricted / Optimized / Restricted)', () => {
  const s = body('private ComponentName oplusAppPageScan()', 'private String openOplusAppPage');
  assert.match(s, /pk\.startsWith\(\"com\.android\.settings\"\)/);
  assert.match(s, /pk\.startsWith\(\"com\.google\.android\.settings\"\)/);
  assert.match(s, /name\.contains\(\"advancedpowerusage\"\)/);
  assert.ok(s.indexOf('com.android.settings') < s.indexOf('eqNorm(ai.name)'), 'the package is skipped before any page of it is looked at');
});
