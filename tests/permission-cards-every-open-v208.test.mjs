// v208: while Android "Allow background activity" or notifications are OFF, their cards are shown on every app open until the person allows them.
// The background card uses the picture from background-allow-gif-pic/, the notification card the one from notification-popup-gif-pic/ (two separate pictures).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const rd = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const M = rd('src/main.js'), B = rd('src/bgallow.js'), N = rd('src/native.js'), J = rd('native-android/LiquidNative.java'), BP = rd('src/bgallowpic.js'), P = rd('src/popup.js');

test('notification card: asked on every open while notifications are off, not once ever', () => {
  assert.ok(M.includes('const wantsPerm = !granted && !permShownOpen;'));
  assert.doesNotMatch(M, /const wantsPerm = !granted && !asked;/);
  assert.ok(M.includes('if (needPerm) permShownOpen = true;'));                         // shown once per open, not every second
  assert.ok(/permShownOpen = false;\s*\/\/ a new open/.test(M) && M.includes('>= 10000'));   // a new open = away 10 s or more
  assert.ok(M.includes("if (!pic && !firstTime && !wantsPerm) return;"));                 // the plain card is allowed when permission is wanted
  assert.ok(M.includes('if (permTrip) { permTrip = false; if (!permHiddenAt || Date.now() - permHiddenAt < 10000) return; }'));                   // coming back from the Android prompt / settings is not a new open
});

test('notification card uses the notification-popup picture, never the background one', () => {
  assert.ok(M.includes('fetchPopupPic(undefined, undefined, undefined, man)') && M.includes('notifSheet(pic, needPerm)'));
  assert.ok(P.includes('notification-popup-gif-pic') && !P.includes('background-allow-gif-pic'));
  assert.ok(BP.includes("BGALLOW_DIR = 'background-allow-gif-pic'") && !BP.includes('notification-popup-gif-pic'));
});

test('Allow: system prompt first; when it cannot appear, Android notification settings open', () => {
  assert.ok(M.includes('case \'notif-allow\'') && M.includes('notifAllow()'));
  assert.ok(M.includes('Date.now() - t0 < 700') && M.includes('Native.openNotificationSettings()'));
  assert.ok(N.includes('openNotificationSettings: () => (N ? N.openNotificationSettings()'));
  assert.ok(J.includes('public void openNotificationSettings(PluginCall call)') && J.includes('ACTION_APP_NOTIFICATION_SETTINGS') && J.includes('ACTION_APPLICATION_DETAILS_SETTINGS'));
});

test('background card: shown on every open while Android has background activity OFF', () => {
  assert.ok(B.includes('if (shownOpen) return;') && B.includes('Native.isBackgroundAllowed()') && B.includes('shownOpen = true; openStamp = pic.stamp'));
  assert.ok(/if \(allowed \|\| root\(\) \|\| blocked\(\)( \|\| accessibilityFirst\(\))?\) return;/.test(B));            // allowed = no card (only a NEW upload shows it then)
  assert.ok(B.includes("if (pic.stamp && pic.stamp !== seen)"));                           // a new upload still shows once, even when already allowed
  assert.ok(B.includes('shownOpen = false;') && B.includes('>= 10000') && B.includes('if (trip) { trip = false; if (!hiddenAt || Date.now() - hiddenAt < TRIP_MAX_MS) return; }'));
  assert.ok(B.includes("trip = true; try { Native.openBackgroundSettings()"));
});

test('background card: plain card when the picture cannot be read for a while; the picture swaps in later', () => {
  assert.ok(B.includes('if (Date.now() > readyAt + 8000) await maybeShow();'));
  assert.ok(B.includes('swapPic(o, pic.src)'));
});

test('the two cards never stack', () => {
  assert.ok(B.includes("document.querySelector('#sheet .popcard')"));                      // the background card waits for the notification card
  assert.ok(M.includes("document.getElementById('lf-bgallow') || document.getElementById('lf-assist')) { setTimeout(() => startPopup()"));   // and the notification card waits for the background card
});

test('background "allowed" = not battery-optimized (the switch, confirmed by adb); restricted and app-ops are logged only (v210c)', () => {
  assert.ok(J.includes('isBackgroundRestricted()'));
  assert.ok(J.includes('o.put("allowed", ignoring);'));   // v210c: the switch follows ignoring; the other signals never decide
  assert.ok(J.includes('Build.VERSION.SDK_INT >= 28'));
  assert.ok(J.includes('o.put("ignoring", ignoring); o.put("restricted", restricted);'));
});

test('v209c: the OnePlus / OPPO / Realme switch is also read from the background app-ops (ignored / errored = OFF); no answer = not blocked', () => {
  const m = J.slice(J.indexOf('public void isBackgroundAllowed(PluginCall call)'), J.indexOf('private String openOemBackgroundPage'));
  assert.ok(m.includes('\"android:run_in_background\"') && m.includes('\"android:run_any_in_background\"'));
  assert.ok(m.includes('checkOpNoThrow(op, uid, own)') && m.includes('mode == 1 || mode == 2'));
  assert.ok(m.includes('boolean appOpBlocked = false;'));
  assert.ok(m.includes('Log.i(\"LiquidNative\", \"background: allowed check ignoring='));   // the three raw values are in the app log for diagnosis
});
