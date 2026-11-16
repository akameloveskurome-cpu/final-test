// v211: battery-helper (Accessibility) cards. Order of ALL permission popups (main.js + bgallow.js), each one 10 s after the one before it:
//   1. All files access (Android system screen)  2. Notifications card  3. Accessibility card (this file, step 1: opens Accessibility settings)
//   4. "Allow restricted settings" card (this file, step 2: the person opens App info by long pressing the icon, then three dots; the app does NOT open it)  5. Accessibility card AGAIN (step 3: opens Accessibility settings, now it can be turned On)
//   6. Background activity card (bgallow.js, opens Battery usage directly).
// While Liquid Dark's accessibility service is OFF this sequence runs on every open. Not now stops it for this open only; it comes back on the next open.
// Owner's order (still 0.208.0): when BOTH are due, the accessibility cards come FIRST and the background card only 10 s after they are finished / dismissed (assistHoldsBg() below, wired in main.js with setBgAllowAfter). Never two cards at once.
import { Native } from './native.js';
import { ASSIST_PICS } from './assistpics.js';
import { enterCard, leaveCard } from './cardlayer.js';
import { ASSIST_ALT } from './assistpics.js';
import { addScrollHint } from './scrollhint.js';   // red "Scroll down ↓" while more is below (shared with sheets, lists and pages)
const WAIT_MS = 10000;
const TRIP_MAX_MS = 600000;   // v212: step 2 is done by hand, so allow up to 10 minutes away before a return counts as a NEW open
const PKEY = 'lf.assist', PKEEP_MS = 3600000;   // v213: progress is remembered for an hour, because step 2 closes the app and the next open is a fresh start
function savedStage() { try { const j = JSON.parse(localStorage.getItem(PKEY) || 'null'); if (j && Date.now() - j.at < PKEEP_MS && j.stage > 0 && j.stage < 3) return j.stage | 0; } catch {} return 0; }
function saveStage(s) { try { localStorage.setItem(PKEY, JSON.stringify({ stage: s, at: Date.now() })); } catch {} }
function clearStage() { try { localStorage.removeItem(PKEY); } catch {} }
let rs = 'unknown';   // v213: "Allow restricted settings" state from Android (allowed / restricted / unknown)
let rsIgnore = false;   // the person pressed a Back button: Android's "restricted settings" answer is not used to skip cards for the rest of this open
let prevGate = false;
let stage = savedStage(), trip = false, hiddenAt = 0, readyAt = Date.now() + WAIT_MS, wasBlocked = false, started = false, off = true, checkedOnce = false, busy = false;
let gate = () => false, onDone = () => {};
export function setAssistGate(fn) { gate = typeof fn === 'function' ? fn : () => false; }   // main.js: true once All files access and the notification card are finished
export function setAssistDone(fn) { onDone = typeof fn === 'function' ? fn : () => {}; }
let activityAt = Date.now();   // v212: last time this sequence did anything (card shown / closed / person came back); the background card uses it so a stuck sequence can never hold it back for good
export const assistActivityAt = () => activityAt;
export const assistStage = () => stage;   // 0 = Accessibility, 1 = Allow restricted settings, 2 = Accessibility again, 3 = finished for this open
/** True while the sequence still has a card to show this open (the background card waits for it). */
export function assistPending() { return started && Native.isNative && stage < 3 && (off || !checkedOnce); }
export function assistCardOpen() { return !!document.getElementById('lf-assist'); }
const HOLD_IDLE_MS = 45000;   // fail-safe: the background card waits for these cards only while this sequence is alive (something happened in the last 45 s). A sequence that never gets its turn can never hide the background card for good.
/** True while the accessibility sequence still has a card to show this open: the background card then waits (accessibility first). */
export function assistHoldsBg() {
  if (!started || !Native.isNative || stage >= 3) return false;
  if (checkedOnce && !off) return false;   // helper already ON: nothing to ask
  if (assistCardOpen()) return true;
  return Date.now() - activityAt < HOLD_IDLE_MS;
}
/** Quick, silent look at the helper switch (no card): so a helper that is already ON never holds the background card back. */
async function quickCheck() {
  try { off = !(await Native.batteryAssistStatus()).enabled; } catch { off = false; }
  checkedOnce = true;
  if (!off) { stage = 3; clearStage(); }
}
try { document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  activityAt = Date.now();
  readyAt = Math.max(readyAt, Date.now() + WAIT_MS);   // back from Settings: 10 s of quiet before the next card
  if (trip) { trip = false; if (!hiddenAt || Date.now() - hiddenAt < TRIP_MAX_MS) return; }   // coming back from Android settings is not a new open (v212: unless the person was away 10+ minutes: then it is a new open and the cards come again)
  if (hiddenAt && Date.now() - hiddenAt >= 10000) { stage = savedStage(); checkedOnce = false; rsIgnore = false; }   // a new open: the sequence again if still off (from the step the person got to within the last hour)
  if (started) quickCheck().catch(() => {});   // look at the helper switch right away (a helper turned On in Settings releases the background card at once)
}); } catch {}
// Each step = a caption + a screenshot with a red "tap here" mark (src/assistpics.js).
const step = (n, text, key) => '<div style="text-align:left;font-size:15px;line-height:1.45;margin:0 0 6px;"><b>' + n + '.</b> ' + text + '</div><img alt="' + ASSIST_ALT[key] + '" src="' + ASSIST_PICS[key] + '" style="display:block;width:62%;max-width:230px;margin:0 auto 18px;border-radius:12px;">';
const CARDS = [
  { title: 'Step 1: open Accessibility', go: 'Open Accessibility',
    body: '<p style="font-size:15px;line-height:1.5;margin:0 0 14px;">Liquid Dark uses Android\'s Accessibility setting for one thing: it opens <b>Battery usage</b> for you. It does not read other apps and does not turn the switch on for you.</p>'
      + '<p style="font-size:15px;line-height:1.5;margin:0 0 14px;">First Android has to be asked once, so it shows the next card. Do these taps:</p>'
      + step(1, 'Tap <b>Downloaded apps</b>.', 'a1') + step(2, 'Tap <b>Liquid Dark</b> (it is greyed out, tap it anyway).', 'a2')
      + step(3, 'Android shows <b>Restricted setting</b>. Tap <b>OK</b>, then come back to Liquid Dark.', 'a3') },
  { title: 'Step 2: Allow restricted settings', go: 'Got it, I will do this',
    body: '<p style="font-size:15px;line-height:1.5;margin:0 0 14px;">Now the option is unlocked, but Android hides it if the app opens App info for you. When you tap the button below, <b>Liquid Dark closes by itself</b>. Then open App info yourself like this:</p>'
      + step(1, 'On your home screen (or in the app drawer) <b>long press</b> the <b>Liquid Dark</b> icon.', 'c1') + step(2, 'Tap <b>App info</b>.', 'c2')
      + step(3, 'Tap the <b>three dots</b> (top right).', 'a4') + step(4, 'Tap <b>Allow restricted settings</b> and enter your PIN or fingerprint. Then open Liquid Dark again.', 'a5')
      + '<p style="text-align:left;font-size:15px;line-height:1.45;margin:0 0 16px;">Cannot long press? Open Android <b>Settings</b>, find <b>Liquid Dark</b> in the apps list and tap it, then do steps 3 and 4 above. No pictures needed.</p>'
      + '<div style="text-align:left;border:1px solid #555;border-radius:12px;padding:12px;margin:0 0 16px;">'
      + '<div style="font-size:15px;line-height:1.45;margin:0 0 8px;"><b>Do not see "Allow restricted settings"?</b> If the three dots only show <b>Uninstall for all users</b>, like in this picture, step 1 was not done right.</div>'
      + '<img alt="' + ASSIST_ALT.s1 + '" src="' + ASSIST_PICS.s1 + '" style="display:block;width:78%;max-width:290px;margin:0 auto 10px;border-radius:12px;">'
      + '<div style="font-size:15px;line-height:1.45;">Tap <b>Back to step 1</b> below. Open Accessibility, tap <b>Downloaded apps</b>, tap <b>Liquid Dark</b> (it is greyed out, tap it anyway). When Android says <b>Restricted setting</b>, tap <b>OK</b>. Then do step 2 again.</div></div>' },
  { title: 'Step 3: turn Liquid Dark On', go: 'Open Accessibility',
    body: '<p style="font-size:15px;line-height:1.5;margin:0 0 14px;">Restricted settings are allowed now, so the switch works this time.</p>'
      + step(1, 'In Accessibility open <b>Downloaded apps</b>, then tap <b>Liquid Dark</b>. It is not greyed out any more.', 'b1') + step(2, 'Turn the switch <b>On</b>, then come back to Liquid Dark.', 'b2') },
];
async function refresh() {
  try { off = !(await Native.batteryAssistStatus()).enabled; } catch { off = false; }
  checkedOnce = true;
  if (!off) { stage = 3; clearStage(); return; }   // helper already ON (this is the one thing Android lets the app see for sure): nothing to ask, steps 1 and 2 are obviously done
  try { rs = String((await Native.restrictedStatus()).state || 'unknown'); } catch { rs = 'unknown'; }
  if (rsIgnore) rs = 'unknown';
}
// Which card is next: Android 13+ tells us if "Allow restricted settings" is done. Done = straight to step 3. Not done = steps 1 then 2 (step 2 again until it is done). Unknown = the step remembered.
const cardIndex = () => (rs === 'allowed' ? 2 : rs === 'restricted' ? Math.min(stage, 1) : stage);
async function tick() {
  if (!Native.isNative || busy || stage >= 3 || document.hidden) return;
  busy = true;
  try {
    const g = !!gate(); if (g && !prevGate) activityAt = Date.now(); prevGate = g;   // the card before this one just finished: the sequence is alive again
    const blocked = !g || assistCardOpen() || !!document.getElementById('lf-bgallow');   // v213: the background card no longer waits for these cards, so these cards never open on top of it
    if (blocked) { wasBlocked = true; return; }
    if (wasBlocked) { wasBlocked = false; readyAt = Math.max(readyAt, Date.now() + WAIT_MS); }   // the card before this one just went away: 10 s first
    if (Date.now() < readyAt) return;
    await refresh();
    if (stage >= 3 || document.hidden || assistCardOpen() || !gate() || document.getElementById('lf-bgallow')) return;   // never two cards at once
    build(cardIndex());
  } finally { busy = false; }
}
export async function maybeShowAssist() { await tick(); return assistCardOpen(); }   // kept for callers; the poller below does the real work
export function startAssist() { started = true; activityAt = Date.now(); quickCheck().catch(() => {}); tick(); setInterval(tick, 1000); }
let opener = null;   // v214: focus goes back here when the card closes
/** v214: Android Back / Escape on an accessibility card = Not now (this open only, same as the button). */
export function assistBack() { if (!assistCardOpen()) return false; stage = 3; close(); return true; }
function close() { activityAt = Date.now(); const o = document.getElementById('lf-assist'); if (o) o.remove(); const f = opener; opener = null; leaveCard(f); onDone(); }
function build(n) {
  activityAt = Date.now();
  opener = document.activeElement;
  const c = CARDS[n];
  const o = document.createElement('div');
  o.id = 'lf-assist'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
  o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;';
  o.innerHTML = '<div style="max-width:420px;max-height:100%;overflow-y:auto;color:#fff;font-family:system-ui,sans-serif;text-align:center;">'
    + '<h2 style="margin:0 0 12px;font-size:22px;">' + c.title + '</h2>' + c.body
    + '<button data-as="go" style="width:100%;padding:14px;font-size:17px;border:0;border-radius:12px;background:#ff3b5c;color:#fff;margin-bottom:10px;">' + c.go + '</button>'
    + (n === 2 ? '<button data-as="redo" style="width:100%;padding:12px;font-size:15px;border:0;border-radius:12px;background:#222;color:#fff;margin-bottom:10px;">Back to step 2 (switch greyed out?)</button>' : '')
    + (n >= 1 ? '<button data-as="back1" style="width:100%;padding:12px;font-size:15px;border:0;border-radius:12px;background:#222;color:#fff;margin-bottom:10px;">' + (n === 1 ? 'Menu only shows "Uninstall for all users"? Back to step 1' : 'Back to step 1') + '</button>' : '')
    + '<button data-as="later" style="width:100%;padding:12px;font-size:15px;border:0;border-radius:12px;background:#222;color:#bbb;">Not now</button></div>';
  o.addEventListener('click', e => {
    const b = e.target.closest('[data-as]'); if (!b) return;
    if (b.dataset.as === 'go') {
      trip = true; stage = n + 1; readyAt = Date.now() + WAIT_MS; saveStage(Math.min(stage, 2));
      if (n === 1) setTimeout(() => { try { Promise.resolve(Native.exitApp()).catch(() => {}); } catch {} }, 350);   // v213: step 2 closes the app so the person can long press its icon
      try {
        if (n !== 1) Promise.resolve(Native.openAccessibilityList()).catch(() => { trip = false; });   // steps 1 and 3 = Android's Accessibility list. Step 2 opens nothing: the person long presses the icon -> App info -> three dots (opened by the app, Android hides "Allow restricted settings")
      } catch { trip = false; }
    } else if (b.dataset.as === 'redo') { stage = 1; rs = 'unknown'; rsIgnore = true; saveStage(1); close(); build(1); return; }   // v213: the switch was greyed out: step 2 comes AT ONCE (not after the 10 s timer, and whatever Android's state check says)
    else if (b.dataset.as === 'back1') { stage = 0; rs = 'unknown'; rsIgnore = true; clearStage(); close(); build(0); return; }   // the person wants the FIRST card again: it comes AT ONCE, and Android's restricted-settings answer does not skip cards until the next open
    else stage = 3;   // Not now: the sequence stops for this open
    close();
  });
  document.body.appendChild(o);
  try { addScrollHint(o.firstElementChild); } catch {}
  enterCard(o, '[data-as="go"]');   // v214: focus lands on the card's main button
}
