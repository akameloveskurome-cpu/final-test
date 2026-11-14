// v146: "Allow background activity" popup. A picture / GIF from background-allow-gif-pic/ (polled every second, no rebuild) opens a full-screen card whose button
// takes the person to Android's Battery usage > Allow background activity page. Shown ONCE per upload stamp (a new upload shows it again, even if the person already allowed it).
// v208: after the first launch, only when a picture has been uploaded. The first launch shows the plain card once (no picture needed).
import { fetchBgAllowPic, BGALLOW_POLL_MS } from './bgallowpic.js';
import { Native } from './native.js';
const SEEN = 'lf.bgAllowSeen', ASKED = 'lf.bgAllowAsked';
const memFlags = {};   // BUG-153: session copy, used when localStorage is blocked (no re-showing every second)
const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch { return memFlags[k] || ''; } };
const lsSet = (k, v) => { memFlags[k] = v; try { localStorage.setItem(k, v); } catch {} };
const WAIT_MS = 10000;   // v146b: never open before the app has been on screen for 10 s: Android's "All files access" screen and the picture download come first
let pic = { src: '', stamp: '' }, busy = false, openStamp = '', readyAt = Date.now() + WAIT_MS, hold = 0;
export function bgAllowHold(p) { hold++; Promise.resolve(p).catch(() => {}).finally(() => { hold--; readyAt = Math.max(readyAt, Date.now() + WAIT_MS); }); }   // main.js passes the All-files-access request here: the popup waits for it, then 10 s more
try { document.addEventListener('visibilitychange', () => { if (!document.hidden) readyAt = Math.max(readyAt, Date.now() + WAIT_MS); }); } catch {}

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
    if (b.dataset.bg === 'go') { try { Native.openBackgroundSettings().catch(() => {}); } catch {} }
  });
  document.body.appendChild(o);
}
function swapPic(o, src) {   // a new picture while the card is open: replace only the picture, never rebuild the card (no blinking)
  const body = o.querySelector('.bgbody'); if (!body) return;
  const cur = body.querySelector('.bgimg');
  if (!src) { if (cur) cur.remove(); return; }
  if (cur) cur.src = src; else body.insertAdjacentHTML('afterbegin', `<img class="bgimg" alt="" src="${src}">`);
}
const blocked = () => !!document.querySelector('#sheet [data-upd]') || !!document.querySelector('#lf-splash[style*="display: flex"]');

async function maybeShow() {
  if (root() || blocked() || document.hidden || hold > 0 || Date.now() < readyAt) return;
  const seen = lsGet(SEEN), asked = lsGet(ASKED);
  if (pic.stamp && pic.stamp !== seen) { lsSet(SEEN, pic.stamp); lsSet(ASKED, '1'); openStamp = pic.stamp; build(pic.src); return; }
  if (!asked && !pic.stamp) {
    lsSet(ASKED, '1');   // first launch only: the plain card once; skipped when Android already allows it
    let allowed = false; try { allowed = !!(await Native.isBackgroundAllowed()).allowed; } catch {}
    if (!allowed && !root()) { openStamp = ''; build(''); }
  }
}
export async function bgAllowCheck() {
  if (!Native.isNative || document.hidden || busy) return;
  busy = true;
  try {
    const r = await fetchBgAllowPic(fetch, undefined, undefined, pic.stamp);
    if (!r) return;   // manifest or picture not readable yet (slow / offline): wait, never show a plain popup before the picture had its chance
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
