// v210: battery helper (Accessibility). Optional for the person; the app still works without it. Only taps Battery usage on Liquid Dark's own App info page, after Allow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const rd = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the service only acts after Allow arms it, on Liquid Dark\'s own App info page, and never flips the switch', () => {
  const s = rd('native-android/BatteryAssistService.java');
  assert.match(s, /extends AccessibilityService/);
  assert.match(s, /LiquidNative\.batteryAssistArmedUntil/);
  assert.match(s, /findAccessibilityNodeInfosByText\("Liquid Dark"\)/);
  assert.match(s, /findAccessibilityNodeInfosByText\("Battery usage"\)/);
  assert.doesNotMatch(s, /Allow background activity/, 'the switch itself is never tapped');
});

test('Allow on the background card arms the helper for 30 s, then the existing page routes run', () => {
  const j = rd('native-android/LiquidNative.java');
  assert.match(j, /batteryAssistArmedUntil = System\.currentTimeMillis\(\) \+ 30000/);
  assert.ok(j.indexOf('batteryAssistArmedUntil = System') < j.indexOf('LIB_POOL.execute', j.indexOf('public void openBackgroundSettings')));
});

test('the accessibility config is the minimum: window events and content only, described in plain words', () => {
  const x = rd('native-android/res/xml/lf_battery_assist.xml');
  assert.match(x, /canRetrieveWindowContent="true"/);
  assert.match(x, /android:description="@string\/lf_assist_desc"/);
  assert.match(rd('native-android/res/values/lf_assist_strings.xml'), /name="lf_assist_desc">Liquid Dark uses this only to open Battery usage/);
});

test('the manifest registers the service with the Accessibility permission (idempotent install step)', () => {
  const sh = rd('scripts/install-native.sh');
  assert.match(sh, /BatteryAssistService/);
  assert.match(sh, /android\.permission\.BIND_ACCESSIBILITY_SERVICE/);
  assert.match(sh, /@xml\/lf_battery_assist/);
});

test('v211 cards: Accessibility, then Allow restricted settings (App info), then Accessibility again; Not now stops this open', () => {
  const a = rd('src/assist.js');
  assert.match(a, /openAccessibilityList/);
  assert.match(a, /openAccessibilitySettings/);
  assert.match(a, /Allow restricted settings/);
  assert.match(a, /three dots/);
  assert.match(a, /Downloaded apps/);
  assert.match(a, /Liquid Dark battery helper/);
  assert.match(a, /Not now/);
  assert.equal((a.match(/go: 'Open Accessibility'/g) || []).length, 2, 'Accessibility card appears twice');
  assert.ok(a.indexOf("go: 'Open Accessibility'") < a.indexOf("go: 'Open App info'") && a.indexOf("go: 'Open App info'") < a.lastIndexOf("go: 'Open Accessibility'"));
  assert.match(a, /n === 1 \? Native\.openAccessibilitySettings\(\) : Native\.openAccessibilityList\(\)/);
  assert.match(a, /WAIT_MS = 10000/);
  assert.match(a, /ASSIST_PICS/);
  const pics = rd('src/assistpics.js');
  for (const k of ['a1', 'a2', 'a3', 'a4', 'a5']) assert.match(pics, new RegExp(k + ": 'data:image/jpeg;base64,"), 'tutorial picture ' + k);
  assert.match(a, /Restricted setting/);
  assert.match(a, /overflow-y:auto/, 'card scrolls on small phones');
  const j = rd('native-android/LiquidNative.java');
  assert.match(j, /public void openAccessibilityList/);
  assert.match(j, /ACTION_ACCESSIBILITY_SETTINGS/);
  assert.match(rd('src/native.js'), /openAccessibilityList/);
});

test('v211 popup order: All files access -> notification card -> accessibility cards -> background card', () => {
  const m = rd('src/main.js');
  assert.ok(m.indexOf('allFilesDone = true') > -1 && m.indexOf('if (!allFilesDone') > -1, 'all-files gate exists');
  assert.doesNotMatch(m, /await maybeShowAssist\(\)/, 'accessibility no longer runs before the notification card');
  assert.match(m, /setAssistGate\(\(\) => allFilesDone && notifChecked && !\(permOff && !permShownOpen\)/);
  assert.match(m, /setBgAllowGate\(\(\) => \(permOff && !permShownOpen\) \|\| assistPending\(\)\)/);
  const b = rd('src/bgallow.js');
  assert.match(b, /getElementById\('lf-assist'\)/);
  assert.match(b, /assistPending/);
});
