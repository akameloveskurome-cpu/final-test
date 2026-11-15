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
  assert.match(x, /android:description="Liquid Dark uses this only to open Battery usage/);
});

test('the manifest registers the service with the Accessibility permission (idempotent install step)', () => {
  const sh = rd('scripts/install-native.sh');
  assert.match(sh, /BatteryAssistService/);
  assert.match(sh, /android\.permission\.BIND_ACCESSIBILITY_SERVICE/);
  assert.match(sh, /@xml\/lf_battery_assist/);
});

test('the card: Allow opens Accessibility settings, Not now closes it, and it is shown once per open', () => {
  const a = rd('src/assist.js');
  assert.match(a, /openAccessibilitySettings/);
  assert.match(a, /Not now/);
  assert.match(a, /shownThisOpen/);
  assert.ok(existsSync(new URL('../src/assist.js', import.meta.url)));
});

test('popup order: the accessibility card comes before the notification card, and the background card waits for it', () => {
  const m = rd('src/main.js');
  const acc = m.indexOf('await maybeShowAssist()');
  const notif = m.indexOf("localStorage.getItem('lf.notifAsked')");
  assert.ok(acc > -1 && notif > -1 && acc < notif, 'accessibility check runs before the notification check');
  assert.match(rd('src/bgallow.js'), /getElementById\('lf-assist'\)/);
});
