// v144: live splash art keeps its one-second manifest poll, but a failed media
// request or undecodable asset is backed off per stamp instead of downloaded
// every second. This folder is separate from app-logo-pic/ (launcher/About logo).
import { sniffType, manifestName, manifestStamp } from './popup.js';
import { createPicRetryGate } from './picretry.js';
const REPO = (import.meta.env && import.meta.env.VITE_REPO) || '';
const BRANCH = (import.meta.env && import.meta.env.VITE_BRANCH) || 'main';
export const SPLASH_DIR = 'splash-pic';
export const SPLASH_POLL_MS = 1000;
export const SPLASH_MIN_MS = 2800;   // v208: the splash picture stays on screen at least this long (counted from the moment the picture is really visible); the library keeps loading underneath, and Home shows its own loading animation if it takes longer
export const SPLASH_CACHE_KEY = 'lf.splashCache';
const DB_NAME = 'lf-splash', STORE = 'pic', KEY = 'current';
const base = (repo, br) => `https://raw.githubusercontent.com/${repo}/${br}/${SPLASH_DIR}/`;
const retry = createPicRetryGate();
// Splash accepts still pictures only (png, jpg, jpeg, webp, bmp). GIFs are ignored.
const isGif = (name, type) => /\.gif$/i.test(name || '') || type === 'image/gif';
const assetKey = (j, name, stamp) => stamp || (typeof j?.commit === 'string' && j.commit) || name;

const idb = () => new Promise((res, rej) => {
  try {
    const q = indexedDB.open(DB_NAME, 1);
    q.onupgradeneeded = () => q.result.createObjectStore(STORE);
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  } catch (e) { rej(e); }
});
const run = async (mode, fn) => { const db = await idb(); try { return await new Promise((res, rej) => { const t = db.transaction(STORE, mode); const r = fn(t.objectStore(STORE)); t.oncomplete = () => res(r && r.result); t.onerror = t.onabort = () => rej(t.error); }); } finally { db.close(); } };

/** v142: saved picture -> { blob, stamp } or null. Never throws. */
export async function splashLoad() { try { const v = await run('readonly', st => st.get(KEY)); if (v && v.blob && isGif('', v.blob.type)) { splashClear(); return null; } return v && v.blob && v.stamp ? v : null; } catch { return null; } }
/** v142: keep the picture (any size) and its stamp for the next launch. Never throws. */
export async function splashSave(blob, stamp) { try { await run('readwrite', st => st.put({ blob, stamp }, KEY)); return true; } catch { return false; } }
/** v142: forget the saved picture (the folder was emptied). */
export async function splashClear() { try { await run('readwrite', st => st.delete(KEY)); } catch {} }

/** -> { src, blob, stamp }, { same: true }, { gone: true }, or null. */
export async function fetchSplashPic(fetchFn = fetch, repo = REPO, branch = BRANCH, have = '') {
  if (!repo) return null;
  let key = '';
  try {
    const m = await fetchFn(base(repo, branch) + 'latest.json?v=' + Date.now(), { cache: 'no-store' });
    if (!m.ok) {   // BUG-196: a 404 means "folder emptied" only when another file of the same repo still answers (a wrong branch, a private repo or a captive page also say 404)
      if (m.status !== 404) return null;
      try { const u = await fetchFn(`https://raw.githubusercontent.com/${repo}/${branch}/update/latest.json?v=` + Date.now(), { cache: 'no-store' }); return u && u.ok ? { gone: true } : null; } catch { return null; }
    }
    const j = await m.json(), name = manifestName(j), stamp = manifestStamp(j);
    if (!name || isGif(name)) return null;
    key = assetKey(j, name, stamp);
    if (key === have) return { same: true, stamp: key };
    if (!retry.canTry(key)) return null;
    const r = await fetchFn(base(repo, branch) + encodeURIComponent(name) + '?v=' + encodeURIComponent(key), { cache: 'no-store' });
    if (!r.ok) { retry.fail(key); return null; }
    const buf = await r.arrayBuffer(), type = sniffType(buf);
    if (!buf.byteLength || !type || isGif('', type)) { retry.fail(key); return null; }
    const blob = new Blob([buf], { type }), src = URL.createObjectURL(blob);
    retry.succeed(key);
    return { src, blob, stamp: key };
  } catch {
    // Once the manifest identifies an asset, all network/read/decode-path
    // failures must pass through the same per-stamp retry gate.
    if (key) retry.fail(key);
    return null;
  }
}
