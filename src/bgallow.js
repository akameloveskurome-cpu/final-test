// v146: "Allow background activity" popup. A picture / GIF from background-allow-gif-pic/ (polled every second, no rebuild) opens a full-screen card whose button
// takes the person to Android's Battery usage > Allow background activity page. Shown ONCE per upload stamp (a new upload shows it again, even if the person already allowed it).
// v209: sequence(): notification card first, then the background card 10 s after the notification card is gone (never together).
// v208: while Android's "Allow background activity" is OFF the card is shown every time the app is opened (cold start, or back after 10 s or more away) until the person allows it,
// with the picture from background-allow-gif-pic/ (a plain card when none is uploaded). When it is already allowed, only a NEW upload shows it, once (as before).
import { fetchBgAllowPic, BGALLOW_POLL_MS } from './bgallowpic.js';
import { Native } from './native.js';
const SEEN = 'lf.bgAllowSeen', ASKED = 'lf.bgAllowAsked';
const memFlags = {};   // BUG-153: session copy, used when localStorage is blocked (no re-showing every second)
const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch { return memFlags[k] || ''; } };
const lsSet = (k, v) => { memFlags[k] = v; try { localStorage.setItem(k, v); } catch {} };
const WAIT_MS = 10000;   // v146b: never open before the app has been on screen for 10 s: Android's "All files access" screen and the picture download come first
let pic = { src: '', stamp: '' }, busy = false, openStamp = '', readyAt = Date.now() + WAIT_MS, hold = 0;
let notifGate = () => false, wasBlocked = false, launchAt = Date.now();
const NOTIF_WAIT_CAP = 45000;   // v209: the notification card is waited for at most this long after launch (if it never shows, the background card still comes)
export function setBgAllowGate(fn) { notifGate = typeof fn === 'function' ? fn : () => false; }   // main.js: true while the notification card is still due this open
let shownOpen = false, trip = false, hiddenAt = 0, okUntil = 0;   // shownOpen: shown during this open; trip: the person is on Android's battery page (coming back is not a new open)
export function bgAllowHold(p) { hold++; Promise.resolve(p).catch(() => {}).finally(() => { hold--; readyAt = Math.max(readyAt, Date.now() + WAIT_MS); }); }   // main.js passes the All-files-access request here: the popup waits for it, then 10 s more
try { document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  readyAt = Math.max(readyAt, Date.now() + WAIT_MS);
  okUntil = 0;   // look again: the person may have changed it in Android settings
  if (trip) { trip = false; return; }
  if (hiddenAt && Date.now() - hiddenAt >= 10000) { shownOpen = false; launchAt = Date.now(); }   // a new open: ask again if it is still off (and the notification card gets its turn first again)
}); } catch {}

async function decodes(src) {
  const im = new Image(); im.src = src;
  try { if (im.decode) await im.decode(); else await new Promise((a, b) => { im.onload = a; im.onerror = b; }); return im.naturalWidth > 0; } catch { return false; }
}
const root = () => document.getElementById('lf-bgallow');
export function bgAllowDemo(src) { bgAllowClose(); build(src || ''); }   // screenshots only (browser, window.__lf)
export function bgAllowClose() { const o = root(); if (!o) return false; o.remove(); return true; }
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
  document.body.appendChild(o);
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
  if (!b && notifGate() && Date.now() - launchAt < NOTIF_WAIT_CAP) readyAt = Math.max(readyAt, Date.now() + WAIT_MS);   // notification card still coming: keep waiting
}
async function maybeShow() {
  sequence();
  if (root() || blocked() || document.hidden || hold > 0 || Date.now() < readyAt) return;
  const seen = lsGet(SEEN);
  if (pic.stamp && pic.stamp !== seen) { lsSet(SEEN, pic.stamp); lsSet(ASKED, '1'); openStamp = pic.stamp; shownOpen = true; build(pic.src); return; }   // a NEW upload: shown once, even when it is already allowed
  if (shownOpen) return;
  if (Date.now() < okUntil) return;   // checked a moment ago and it was allowed
  let allowed = true; try { allowed = !!(await Native.isBackgroundAllowed()).allowed; } catch {}   // v208: OFF -> shown on every open until allowed
  if (allowed) okUntil = Date.now() + 15000;
  if (allowed || root() || blocked()) return;
  lsSet(ASKED, '1'); shownOpen = true; openStamp = pic.stamp || ''; build(pic.src);
}
export async function bgAllowCheck() {
  if (!Native.isNative || document.hidden || busy) return;
  busy = true;
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
  } catch {} finally { busy = false; }
}
export function startBgAllow() { bgAllowCheck(); setInterval(bgAllowCheck, BGALLOW_POLL_MS); }
