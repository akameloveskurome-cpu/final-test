// v146: Home stats-banner picture (stats-banner-gif-pic/): same one-second manifest poll and per-stamp backoff as the Credits picture.
import { sniffType, manifestName, manifestStamp } from './popup.js';
import { createPicRetryGate, manifest404IsGone } from './picretry.js';
const REPO = (import.meta.env && import.meta.env.VITE_REPO) || '';
const BRANCH = (import.meta.env && import.meta.env.VITE_BRANCH) || 'main';
export const BANNER_DIR = 'stats-banner-gif-pic';
export const BANNER_POLL_MS = 1000;
const base = (repo, br) => `https://raw.githubusercontent.com/${repo}/${br}/${BANNER_DIR}/`;
const retry = createPicRetryGate();
const assetKey = (j, name, stamp) => stamp || (typeof j?.commit === 'string' && j.commit) || name;

/** -> { src, stamp }, { same: true }, { gone: true } or null. */
export async function fetchBannerPic(fetchFn = fetch, repo = REPO, branch = BRANCH, have = '') {
  if (!repo) return null;
  let key = '';
  try {
    const m = await fetchFn(base(repo, branch) + 'latest.json?v=' + Date.now(), { cache: 'no-store' });
    if (!m.ok) return m.status === 404 && await manifest404IsGone(fetchFn, repo, branch) ? { gone: true } : null;   // BUG #2: guarded like splashpic.js (BUG-196)
    const j = await m.json(), name = manifestName(j), stamp = manifestStamp(j);
    if (!name) return null;
    key = assetKey(j, name, stamp);
    if (key === have) return { same: true, stamp: key };
    if (!retry.canTry(key)) return null;
    const r = await fetchFn(base(repo, branch) + encodeURIComponent(name) + '?v=' + encodeURIComponent(key), { cache: 'no-store' });
    if (!r.ok) { retry.fail(key); return null; }
    const buf = await r.arrayBuffer(), type = sniffType(buf);
    if (!buf.byteLength || !type) { retry.fail(key); return null; }
    const src = URL.createObjectURL(new Blob([buf], { type }));
    retry.succeed(key);
    return { src, stamp: key };
  } catch {
    if (key) retry.fail(key);
    return null;
  }
}

/** BUG-205: the picture did not decode: back off like a failed download. */
export const bannerPicFailed = stamp => retry.fail(stamp);
