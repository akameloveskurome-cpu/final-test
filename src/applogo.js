// The launcher icon is baked into the APK at build time (scripts/apply-app-logo.py, from the same
// app-logo-pic/latest.json picture). This file only handles the Settings > About logo, which comes
// live from app-logo-pic/latest.json, checked every 1000 ms; with no logo uploaded it is hidden.
import { sniffType, manifestName, manifestStamp } from './popup.js';
import { createPicRetryGate, manifest404IsGone } from './picretry.js';
const REPO = (import.meta.env && import.meta.env.VITE_REPO) || '';
const BRANCH = (import.meta.env && import.meta.env.VITE_BRANCH) || 'main';
export const APP_LOGO_POLL_MS = 1000;
const LIVE_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/app-logo-pic/`;
const retry = createPicRetryGate();
let live = { src: '', stamp: '', busy: false };
let watcherStarted = false;

// v144: remove the old base64 logo cache (it competed with the mandatory-update
// gate for localStorage quota). The logo is now kept only in memory.
try { localStorage.removeItem('lf.appLogo'); } catch {}

export const appLogoSrc = () => live.src;
export { applyBundledLogo as syncAppLogo };
function applyBundledLogo() {
  const img = document.getElementById('lf-about-logo');
  if (img) {
    if (live.src) {
      img.onerror = () => { img.onerror = null; img.removeAttribute('src'); img.style.display = 'none'; };
      if (img.getAttribute('src') !== live.src) img.src = live.src;
      img.style.display = '';
    } else {
      img.removeAttribute('src');
      img.style.display = 'none';
    }
  }
  const link = document.querySelector('link[rel="icon"]');
  if (link) { if (live.src) link.href = live.src; else link.remove(); }
  else if (live.src) {
    const l = document.createElement('link');
    l.rel = 'icon'; l.href = live.src;
    document.head.appendChild(l);
  }
}

// force (app resume): ignore document.hidden, open the retry gate, and if a check is
// already running, run one more as soon as it finishes instead of dropping the request.
let rerun = false;
export async function checkLatestAppLogo({ force = false } = {}) {
  if (live.busy) { if (force) rerun = true; return false; }
  if (!force && typeof document !== 'undefined' && document.hidden) return false;
  if (!REPO) { applyBundledLogo(); return false; }
  if (force) retry.clear();
  live.busy = true;
  let key = '';
  try {
    const m = await fetch(LIVE_BASE + 'latest.json?v=' + Date.now(), { cache: 'no-store' });
    if (m.status === 404) {
      if (!(await manifest404IsGone(fetch, REPO, BRANCH))) return false;   // BUG #2: a wrong branch / private repo / captive page also say 404
      if (live.src) { try { URL.revokeObjectURL(live.src); } catch {} live = { src: '', stamp: '', busy: true }; applyBundledLogo(); }
      return false;
    }
    if (!m.ok) return false;
    const j = await m.json(), name = manifestName(j), stamp = manifestStamp(j);
    if (!name) return false;
    key = stamp || (typeof j?.commit === 'string' && j.commit) || name;
    if (key === live.stamp || (!force && !retry.canTry(key))) return false;
    const r = await fetch(LIVE_BASE + encodeURIComponent(name) + '?v=' + encodeURIComponent(key), { cache: 'no-store' });
    if (!r.ok) { retry.fail(key); return false; }
    const buf = await r.arrayBuffer(), type = sniffType(buf);
    if (!buf.byteLength || !type) { retry.fail(key); return false; }
    const old = live.src;
    live = { src: URL.createObjectURL(new Blob([buf], { type })), stamp: key, busy: true };
    retry.succeed(key);
    applyBundledLogo();
    if (old) setTimeout(() => { try { URL.revokeObjectURL(old); } catch {} }, 3000);
    return true;
  } catch {
    if (key) retry.fail(key);
    return false;
  } finally {
    live.busy = false;
    if (rerun) { rerun = false; checkLatestAppLogo({ force: true }).catch(() => {}); }
  }
}

export async function startAppLogoWatcher() {
  if (watcherStarted) return;
  watcherStarted = true;
  applyBundledLogo();
  checkLatestAppLogo().catch(() => {});
  setInterval(() => { checkLatestAppLogo().catch(() => {}); }, APP_LOGO_POLL_MS);
  if (typeof MutationObserver !== 'undefined' && document.body) {
    // BUG-154: many DOM changes in one frame now cause one check, not one check each
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const img = document.getElementById('lf-about-logo');
        if (img && live.src && img.getAttribute('src') !== live.src) applyBundledLogo();
        else if (img && !live.src && (img.getAttribute('src') || img.style.display !== 'none')) applyBundledLogo();
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
}
