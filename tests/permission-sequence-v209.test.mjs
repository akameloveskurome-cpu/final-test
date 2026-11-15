// v209: notification card first, background card 10 s AFTER it is gone (never together); phone-brand fallbacks for the background settings page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const rd = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const M = rd('src/main.js'), B = rd('src/bgallow.js'), J = rd('native-android/LiquidNative.java');

test('background card counts 10 s from the moment the notification card goes away', () => {
  assert.ok(B.includes('function sequence()') && B.includes('else if (wasBlocked) { wasBlocked = false; readyAt = Math.max(readyAt, Date.now() + WAIT_MS); }'));
  assert.ok(B.includes('const WAIT_MS = 10000;'));
  assert.ok(B.includes('sequence();   // runs every second'));
});
test('background card waits while the notification card is still due, and for the Android prompt', () => {
  assert.ok(B.includes('notifGate() && Date.now() - launchAt < NOTIF_WAIT_CAP'));
  assert.ok(M.includes('setBgAllowGate(() => permOff && !permShownOpen);') && M.includes('permOff = !granted;'));
  assert.ok(M.includes('bgAllowHold(notifAllow())'));
});
test('background settings: brand pages for Oppo / Realme / OnePlus, Vivo, Samsung, Huawei, Xiaomi are tried before the generic fallbacks', () => {
  for (const k of ['oppo', 'realme', 'oneplus', 'vivo', 'samsung', 'huawei', 'xiaomi']) assert.ok(J.includes('m.contains("' + k + '")'), k);
  assert.ok(J.indexOf('openOemBackgroundPage(pkg)') < J.indexOf('ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, u'));
});
test('the two cards still use their own picture folders', () => {
  assert.ok(rd('src/popup.js').includes('notification-popup-gif-pic'));
  assert.ok(rd('src/bgallowpic.js').includes("BGALLOW_DIR = 'background-allow-gif-pic'"));
});
