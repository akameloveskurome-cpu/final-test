// v211: battery-helper (Accessibility) cards. Order of ALL permission popups (main.js + bgallow.js), each one 10 s after the one before it:
//   1. All files access (Android system screen)  2. Notifications card  3. Accessibility card (this file, step 1: opens Accessibility settings)
//   4. "Allow restricted settings" card (this file, step 2: the person opens App info by long pressing the icon, then three dots; the app does NOT open it)  5. Accessibility card AGAIN (step 3: opens Accessibility settings, now it can be turned On)
//   6. Background activity card (bgallow.js, opens Battery usage directly).
// While Liquid Dark's accessibility service is OFF this sequence runs on every open. Not now stops it for this open only; it comes back on the next open.
import { Native } from './native.js';
import { ASSIST_PICS } from './assistpics.js';
const WAIT_MS = 10000;
let stage = 0, trip = false, hiddenAt = 0, readyAt = Date.now() + WAIT_MS, wasBlocked = false, started = false, off = true, checkedOnce = false, busy = false;
let gate = () => false, onDone = () => {};
export function setAssistGate(fn) { gate = typeof fn === 'function' ? fn : () => false; }   // main.js: true once All files access and the notification card are finished
export function setAssistDone(fn) { onDone = typeof fn === 'function' ? fn : () => {}; }
export const assistStage = () => stage;   // 0 = Accessibility, 1 = Allow restricted settings, 2 = Accessibility again, 3 = finished for this open
/** True while the sequence still has a card to show this open (the background card waits for it). */
export function assistPending() { return started && Native.isNative && stage < 3 && (off || !checkedOnce); }
export function assistCardOpen() { return !!document.getElementById('lf-assist'); }
try { document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  readyAt = Math.max(readyAt, Date.now() + WAIT_MS);   // back from Settings: 10 s of quiet before the next card
  if (trip) { trip = false; return; }                  // coming back from Android settings is not a new open
  if (hiddenAt && Date.now() - hiddenAt >= 10000) { stage = 0; checkedOnce = false; }   // a new open: the whole sequence again if still off
}); } catch {}
// Each step = a caption + a screenshot with a red "tap here" mark (src/assistpics.js).
const step = (n, text, key) => '<div style="text-align:left;font-size:15px;line-height:1.45;margin:0 0 6px;"><b>' + n + '.</b> ' + text + '</div><img alt="" src="' + ASSIST_PICS[key] + '" style="display:block;width:62%;max-width:230px;margin:0 auto 18px;border-radius:12px;">';
const CARDS = [
  { title: 'Step 1: open Accessibility', go: 'Open Accessibility',
    body: '<p style="font-size:15px;line-height:1.5;margin:0 0 14px;">Liquid Dark uses Android\'s Accessibility setting for one thing: it opens <b>Battery usage</b> for you. It does not read other apps and does not turn the switch on for you.</p>'
      + '<p style="font-size:15px;line-height:1.5;margin:0 0 14px;">First Android has to be asked once, so it shows the next card. Do these taps:</p>'
      + step(1, 'Tap <b>Downloaded apps</b>.', 'a1') + step(2, 'Tap <b>Liquid Dark battery helper</b> (it is greyed out, tap it anyway).', 'a2')
      + step(3, 'Android shows <b>Restricted setting</b>. Tap <b>OK</b>, then come back to Liquid Dark.', 'a3') },
  { title: 'Step 2: Allow restricted settings', go: 'Got it, I will do this',
    body: '<p style="font-size:15px;line-height:1.5;margin:0 0 14px;">Now the option is unlocked, but Android hides it if the app opens App info for you. Open App info yourself like this (leave Liquid Dark first: press Home):</p>'
      + step(1, 'On your home screen (or in the app drawer) <b>long press</b> the <b>Liquid Dark</b> icon.', 'c1') + step(2, 'Tap <b>App info</b>.', 'c2')
      + step(3, 'Tap the <b>three dots</b> (top right).', 'a4') + step(4, 'Tap <b>Allow restricted settings</b> and enter your PIN or fingerprint. Then come back to Liquid Dark.', 'a5') },
  { title: 'Step 3: turn the battery helper On', go: 'Open Accessibility',
    body: '<p style="font-size:15px;line-height:1.5;margin:0 0 14px;">Restricted settings are allowed now, so the switch works this time.</p>'
      + step(1, 'In Accessibility open <b>Downloaded apps</b>, then tap <b>Liquid Dark battery helper</b>. It is not greyed out any more.', 'b1') + step(2, 'Turn the switch <b>On</b>, then come back to Liquid Dark.', 'b2') },
];
async function refresh() {
  try { off = !(await Native.batteryAssistStatus()).enabled; } catch { off = false; }
  checkedOnce = true;
  if (!off) stage = 3;   // already on: nothing to ask
}
async function tick() {
  if (!Native.isNative || busy || stage >= 3 || document.hidden) return;
  busy = true;
  try {
    const blocked = !gate() || assistCardOpen();
    if (blocked) { wasBlocked = true; return; }
    if (wasBlocked) { wasBlocked = false; readyAt = Math.max(readyAt, Date.now() + WAIT_MS); }   // the card before this one just went away: 10 s first
    if (Date.now() < readyAt) return;
    await refresh();
    if (stage >= 3 || document.hidden || assistCardOpen() || !gate()) return;
    build(stage);
  } finally { busy = false; }
}
export async function maybeShowAssist() { await tick(); return assistCardOpen(); }   // kept for callers; the poller below does the real work
export function startAssist() { started = true; tick(); setInterval(tick, 1000); }
function close() { const o = document.getElementById('lf-assist'); if (o) o.remove(); onDone(); }
function build(n) {
  const c = CARDS[n];
  const o = document.createElement('div');
  o.id = 'lf-assist'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
  o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;';
  o.innerHTML = '<div style="max-width:420px;max-height:100%;overflow-y:auto;color:#fff;font-family:system-ui,sans-serif;text-align:center;">'
    + '<h2 style="margin:0 0 12px;font-size:22px;">' + c.title + '</h2>' + c.body
    + '<button data-as="go" style="width:100%;padding:14px;font-size:17px;border:0;border-radius:12px;background:#ff3b5c;color:#fff;margin-bottom:10px;">' + c.go + '</button>'
    + '<button data-as="later" style="width:100%;padding:12px;font-size:15px;border:0;border-radius:12px;background:#222;color:#bbb;">Not now</button></div>';
  o.addEventListener('click', e => {
    const b = e.target.closest('[data-as]'); if (!b) return;
    if (b.dataset.as === 'go') {
      trip = true; stage = n + 1; readyAt = Date.now() + WAIT_MS;
      try {
        if (n !== 1) Promise.resolve(Native.openAccessibilityList()).catch(() => { trip = false; });   // steps 1 and 3 = Android's Accessibility list. Step 2 opens nothing: the person long presses the icon -> App info -> three dots (opened by the app, Android hides "Allow restricted settings")
      } catch { trip = false; }
    } else stage = 3;   // Not now: the sequence stops for this open
    close();
  });
  document.body.appendChild(o);
}
