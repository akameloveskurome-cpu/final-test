// v146: "Allow background activity" popup. A picture / GIF from background-allow-gif-pic/ (polled every second, no rebuild) opens a full-screen card whose button
// takes the person to Android's Battery usage > Allow background activity page. Shown ONCE per upload stamp (a new upload shows it again, even if the person already allowed it).
// v211: order is notification -> accessibility (3 cards) -> this card.
// Owner's order (still 0.208.0): when the accessibility cards are due too, THEY come first and this card only 10 s after they are finished or dismissed (setBgAllowAfter(assistHoldsBg) in main.js; the hold has its own fail-safe in assist.js, so it can never hide this card for good). Never two cards at once.
// v213: FIX "the card never shows": Native.isBackgroundAllowed() never answered (the Java call.resolve was commented out), so maybeShow() waited for ever and `busy` stayed true: no card, no re-check.
// The Java is fixed, and this file can no longer freeze either: the Android check has a 4 s time limit (NATIVE_CHECK_MS) and a stuck `busy` is released after 20 s (BUSY_MAX_MS).
// v209: sequence(): notification card first, then the background card 10 s after the notification card is gone (never together).
// v208: while Android's "Allow background activity" is OFF the card is shown every time the app is opened (cold start, or back after 10 s or more away) until the person allows it,
// with the picture from background-allow-gif-pic/ (a plain card when none is uploaded). When it is already allowed, only a NEW upload shows it, once (as before).
import { fetchBgAllowPic, BGALLOW_POLL_MS } from './bgallowpic.js';
import { Native } from './native.js';
import { enterCard, leaveCard } from './cardlayer.js';
const SEEN = 'lf.bgAllowSeen', ASKED = 'lf.bgAllowAsked';
const memFlags = {};   // BUG-153: session copy, used when localStorage is blocked (no re-showing every second)
const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch { return memFlags[k] || ''; } };
const lsSet = (k, v) => { memFlags[k] = v; try { localStorage.setItem(k, v); } catch {} };
const TRIP_MAX_MS = 10000;   // v212: a trip to Android's battery page counts as "same open" only if the person is back within 10 s (the same 10 s as every other "new open" rule)
const WAIT_MS = 10000;   // v146b: never open before the app has been on screen for 10 s: Android's "All files access" screen and the picture download come first
const NATIVE_CHECK_MS = 4000;   // v213: the Android "is it allowed" question gets 4 s; no answer = treated as "allowed" for now (never a card by mistake) and asked again in 5 s
const BUSY_MAX_MS = 20000;   // v213: a check that is still running after 20 s (hung picture download or Android call) no longer blocks the next one
const withTimeout = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); Promise.resolve(p).then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); no(e); }); });
let pic = { src: '', stamp: '' }, busy = false, busyAt = 0, busyTok = 0, openStamp = '', readyAt = Date.now() + WAIT_MS, hold = 0;
let notifGate = () => false, wasBlocked = false, launchAt = Date.now();
const NOTIF_WAIT_CAP = 45000;   // v209: the notification card is waited for at most this long after launch (if it never shows, the background card still comes)
let afterGate = () => false;
export function setBgAllowAfter(fn) { afterGate = typeof fn === 'function' ? fn : () => false; }   // main.js: true while the accessibility cards still have to be shown this open (this card waits, then 10 s)
export function setBgAllowGate(fn) { notifGate = typeof fn === 'function' ? fn : () => false; }   // main.js: true while the notification card is still due this open
let shownOpen = false, trip = false, hiddenAt = 0, okUntil = 0;   // shownOpen: shown during this open; trip: the person is on Android's battery page (coming back is not a new open)
export function bgAllowHold(p) {   // v212: fail-safe: never longer than 30 s while the app is on screen, even if the Android screen never reports back
  hold++; let done = false;
  const release = () => { if (done) return; done = true; hold--; readyAt = Math.max(readyAt, Date.now() + WAIT_MS); };
  try { setTimeout(release, 30000); } catch {}
  Promise.resolve(p).catch(() => {}).finally(release);
}   // main.js passes the All-files-access request here: the popup waits for it, then 10 s more
try { document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  readyAt = Math.max(readyAt, Date.now() + WAIT_MS);
  okUntil = 0;   // look again: the person may have changed it in Android settings
  if (trip) { trip = false; if (!hiddenAt || Date.now() - hiddenAt < TRIP_MAX_MS) return; }   // v212: back from the battery page within 10 s = same open; away longer (left from there, opened the app again later) = a NEW open
  if (hiddenAt && Date.now() - hiddenAt >= 10000) { shownOpen = false; launchAt = Date.now(); }   // a new open: ask again if it is still off (and the notification card gets its turn first again)
}); } catch {}

async function decodes(src) {
  const im = new Image(); im.src = src;
  try { if (im.decode) await im.decode(); else await new Promise((a, b) => { im.onload = a; im.onerror = b; }); return im.naturalWidth > 0; } catch { return false; }
}
const accessibilityFirst = () => { try { return !!afterGate(); } catch { return false; } };
const root = () => document.getElementById('lf-bgallow');
export function bgAllowDemo(src) { bgAllowClose(); build(src || ''); }   // screenshots only (browser, window.__lf)
let opener = null;   // v214: the element that had focus before the card opened (focus goes back there)
export function bgAllowClose() { const o = root(); if (!o) return false; o.remove(); const f = opener; opener = null; leaveCard(f); return true; }
function html(src) {
  return `<div class="bgbody">${src ? `<img class="bgimg" alt="" src="${src}">` : ''}<b>Keep the music playing</b><p>Tap <b>Allow</b>, then switch on <b>Allow background activity</b> on the next screen. Without it Android can stop Liquid Dark in the background and listening time and plays get lost.</p></div><div class="bgact"><button data-bg="go">Allow</button><button data-bg="later">Later</button></div>`;
}
function build(src) {
  const o = document.createElement('div'); o.id = 'lf-bgallow'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.innerHTML = html(src);
  o.addEventListener('click', e => {
    const b = e.target.closest('[data-bg]'); if (!b) return;
    bgAllowClose();
    if (b.dataset.bg === 'go') { trip = true; try { Native.openBackgroundSettings().catch(() => { trip = false; }); } catch { trip = false; } }
  });
  opener = document.activeElement;
  document.body.appendChild(o);
  enterCard(o, '[data-bg="go"]');   // v214: focus lands on Allow
}
function swapPic(o, src) {   // a new picture while the card is open: replace only the picture, never rebuild the card (no blinking)
  const body = o.querySelector('.bgbody'); if (!body) return;
  const cur = body.querySelector('.bgimg');
  if (!src) { if (cur) cur.remove(); return; }
  if (cur) cur.src = src; else body.insertAdjacentHTML('afterbegin', `<img class="bgimg" alt="" src="${src}">`);
}
const blocked = () => !!document.getElementById('lf-assist') || !!document.querySelector('#sheet [data-upd]') || !!document.querySelector('#sheet .popcard') || !!document.querySelector('#lf-splash[style*="display: flex"]');   // v208: also waits while the notification card is open (never two cards at once)

/** v209: the two permission cards never come together. Notification card first; the background card starts its 10 s countdown only AFTER the notification card is gone
 *  (Allow / Later / swiped away / Back), and also waits while the notification card is still due (picture downloading, Android prompt open). */
function sequence() {
  const b = blocked();
  if (b) wasBlocked = true;
  else if (wasBlocked) { wasBlocked = false; readyAt = Math.max(readyAt, Date.now() + WAIT_MS); }   // the card just went away: 10 s of quiet first
  if (!b && notifGate() && Date.now() - launchAt < NOTIF_WAIT_CAP) readyAt = Math.max(readyAt, Date.now() + WAIT_MS);
  if (!b) { let a = false; try { a = !!afterGate(); } catch {} if (a) readyAt = Math.max(readyAt, Date.now() + WAIT_MS); }   // accessibility first: 10 s of quiet AFTER its last card
}
async function maybeShow() {
  sequence();
  if (root() || blocked() || document.hidden || hold > 0 || Date.now() < readyAt || accessibilityFirst()) return;
  const seen = lsGet(SEEN);
  if (pic.stamp && pic.stamp !== seen) { lsSet(SEEN, pic.stamp); lsSet(ASKED, '1'); openStamp = pic.stamp; shownOpen = true; build(pic.src); return; }   // a NEW upload: shown once, even when it is already allowed
  if (shownOpen) return;
  if (Date.now() < okUntil) return;   // checked a moment ago and it was allowed
  let allowed = true; try { allowed = !!(await withTimeout(Native.isBackgroundAllowed(), NATIVE_CHECK_MS)).allowed; } catch {}   // v208: OFF -> shown on every open until allowed (v213: with a time limit, so a call that never answers cannot freeze the card)
  if (allowed) okUntil = Date.now() + 5000;   // v212: while it is ON the app looks again every 5 s (was 15 s): switched OFF in Android while the app is open = the card comes within seconds
  if (allowed || root() || blocked() || accessibilityFirst()) return;   // the accessibility cards may have come due while Android was answering
  lsSet(ASKED, '1'); shownOpen = true; openStamp = pic.stamp || ''; build(pic.src);
}
export async function bgAllowCheck() {
  if (!Native.isNative || document.hidden) return;
  if (busy && Date.now() - busyAt < BUSY_MAX_MS) return;   // v213: ...unless it has been stuck for 20 s
  busy = true; busyAt = Date.now(); const tok = ++busyTok;
  try {
    sequence();   // runs every second, also while the picture is not readable yet
    const r = await fetchBgAllowPic(fetch, undefined, undefined, pic.stamp);
    if (!r) { if (Date.now() > readyAt + 8000) await maybeShow(); return; }   // manifest or picture not readable yet (slow / offline): wait 8 s more for the picture; then the plain card shows (when background activity is off) and the picture swaps in as soon as it loads
    if (!r.same) {
      const old = pic.src;
      if (r.gone) pic = { src: '', stamp: '' };
      else if (await decodes(r.src)) pic = { src: r.src, stamp: r.stamp };
      else { try { URL.revokeObjectURL(r.src); } catch {} return; }
      const o = root();
      if (o && r.gone) swapPic(o, '');
      else if (o && pic.stamp !== openStamp) { swapPic(o, pic.src); openStamp = pic.stamp; lsSet(SEEN, pic.stamp); }
      if (old && old !== pic.src && !(o && o.querySelector('.bgimg[src="' + old + '"]'))) { try { URL.revokeObjectURL(old); } catch {} }
    }
    await maybeShow();
  } catch {} finally { if (tok === busyTok) busy = false; }
}
export function startBgAllow() { bgAllowCheck(); setInterval(bgAllowCheck, BGALLOW_POLL_MS); }
