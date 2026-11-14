// v98: the credit popup picture lives in the GitHub repo, folder notification-popup-gif-pic/. Put ANY picture there (gif, png, jpg, jpeg, webp, any file name).
// The app lists the folder through the GitHub API, downloads the newest picture and shows the popup again whenever its content differs from the one the person last saw.
// REPO / BRANCH are filled in by the GitHub build (VITE_REPO = "owner/name"). Without them (local dev) nothing is fetched.
const REPO = (import.meta.env && import.meta.env.VITE_REPO) || '';
const BRANCH = (import.meta.env && import.meta.env.VITE_BRANCH) || 'main';
const RAW = (n, repo = REPO, br = BRANCH) => `https://raw.githubusercontent.com/${repo}/${br}/notification-popup-gif-pic/${encodeURIComponent(n)}`;
export const POPUP_POLL_MS = 1000; // v131: 1 s manifest polling while the app is visible (was 0.3 s in v130)
const bust = () => Date.now();
/** BUG-36: manifest requests stop after 10 s, picture downloads after 30 s (a stalled request can no longer keep popPeekBusy / popRun set) */
const tmo = f => (u, o = {}) => {
  if (typeof AbortController === 'undefined') return f(u, o);
  const ac = new AbortController(), big = /\/notification-popup-gif-pic\/(?!latest\.json)/.test(String(u)), t = setTimeout(() => ac.abort(), big ? 30000 : 10000);
  return Promise.resolve(f(u, { ...o, signal: ac.signal })).catch(e => { clearTimeout(t); throw e; });
}; // refresh the manifest cache key every polling interval
const EXT = /\.(gif|png|jpe?g|webp|bmp)$/i;
const MANIFEST = (repo = REPO, br = BRANCH) => `https://raw.githubusercontent.com/${repo}/${br}/notification-popup-gif-pic/latest.json`;   // v121: written by the workflow; raw.githubusercontent has no API rate limit
const GUESS = ['character.gif', 'character.png', 'character.jpg', 'character.jpeg', 'character.webp', 'character.bmp'];   // used only when the GitHub API is unavailable
export const popupUrl = (name = GUESS[0]) => (REPO ? RAW(name) : '');

/** from the GitHub "contents" listing: the picture file names, in the order given */
export const imageNames = list => (Array.isArray(list) ? list.filter(f => f && f.type === 'file' && EXT.test(f.name)).map(f => f.name) : []);

/** what the bytes really are, so the file name does not matter */
export function sniffType(buf) {
  const a = new Uint8Array(buf, 0, Math.min(12, buf.byteLength)); const s = String.fromCharCode(...a);
  if (s.startsWith('GIF8')) return 'image/gif'; if (a[0] === 0x89 && s.slice(1, 4) === 'PNG') return 'image/png';
  if (a[0] === 0xff && a[1] === 0xd8) return 'image/jpeg'; if (s.startsWith('RIFF') && s.slice(8, 12) === 'WEBP') return 'image/webp';
  if (s.startsWith('BM') && buf.byteLength >= 26 && [12, 40, 52, 56, 64, 108, 124].includes(new DataView(buf).getUint32(14, true))) return 'image/bmp';   // BUG-42: check the DIB header size too
  return '';
}

/** v104: what the popup CSS needs to fit a picture into its space: aspect ratio + natural width (CSS scales it to fit, up to 2x for tiny pictures). null = not a usable picture. */
export const popFit = (w, h) => (w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h) ? { ar: w / h, nw: w } : null);

/** short fingerprint of the picture bytes (changes only when the picture changes) */
export async function fingerprint(buf) {
  try { const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(''); }
  catch { let x = 5381; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i++) x = ((x << 5) + x + a[i]) | 0; return 'h' + (x >>> 0).toString(16) + a.length; }
}

/** v121: notification-popup-gif-pic/latest.json = {"name":"file.gif"}; anything else = '' */
export const manifestName = j => (j && typeof j.name === 'string' && EXT.test(j.name) && !/[\\/]/.test(j.name) ? j.name : '');

/** v123: notification-popup-gif-pic/latest.json = {"name":"file.gif","stamp":"..."}. The stamp changes at EVERY upload (even the same picture sent again), so the popup comes back each time. '' = no stamp (old manifest). */
export const manifestStamp = j => (j && typeof j.stamp === 'string' && /^[\w.-]{1,64}$/.test(j.stamp) ? j.stamp : '');

/** v123: cheap check (one tiny file, no picture download): the manifest's { name, stamp }, or null */
export async function peekManifest(fetchFn = fetch, repo = REPO, branch = BRANCH) {
  if (!repo) return null;
  fetchFn = tmo(fetchFn);
  try { const r = await fetchFn(MANIFEST(repo, branch) + '?v=' + bust(), { cache: 'no-store' }); if (!r.ok) return null; const j = await r.json(); const name = manifestName(j); return name ? { name, stamp: manifestStamp(j) } : null; }
  catch { return null; }
}

/** v122: the pictures to try, best first, as a lazy list: 1) the manifest's picture (v129: and ONLY that one when a manifest exists), 2) the GitHub folder listing (newest first), 3) guessed names (2 and 3 only without any manifest).
 *  Before v122 a manifest that named a missing / unreadable file was a dead end (nothing else was tried), so one stale latest.json meant no popup for everybody. */
const API_TTL = 10 * 60 * 1000;
let apiCache = { key: '', at: 0, names: [], blockedUntil: 0 };   // BUG-041
/** test helper: forget the cached GitHub folder listing */
export const resetApiCache = () => { apiCache = { key: '', at: 0, names: [], blockedUntil: 0 }; };
async function* candidates(fetchFn, REPO, BRANCH, known = null) {
  const seen = new Set(), fresh = n => (seen.has(n) ? false : (seen.add(n), true));
  let first = '', stamp = '';
  if (known && known.name) { first = known.name; stamp = known.stamp || ''; }   // v129: the caller already read the manifest: do not read it twice
  else try {   // 1) the manifest the workflow writes (no rate limit, works on shared mobile networks)
    const r = await fetchFn(MANIFEST(REPO, BRANCH) + '?v=' + bust(), { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); first = manifestName(j); stamp = manifestStamp(j); }
  } catch { /* no manifest yet: use the folder listing */ }
  if (first) { if (fresh(first)) yield [first, stamp]; return; }   // v129: a manifest names THE picture. If it is not readable yet (CDN lag) the caller retries it; older pictures / API calls are never tried
  let names = [];
  const ckey = REPO + '@' + BRANCH, nowMs = Date.now();   // BUG-041: the API fallback is cached for 10 minutes and backs off after a rate limit, so a missing manifest no longer costs 1 + N API calls on every resume
  if (apiCache.key === ckey && nowMs - apiCache.at < API_TTL) names = apiCache.names.slice();
  else if (!(apiCache.key === ckey && nowMs < apiCache.blockedUntil)) {
    let limited = false;
    try {   // 2) the folder listing
      const r = await fetchFn(`https://api.github.com/repos/${REPO}/contents/notification-popup-gif-pic?ref=${encodeURIComponent(BRANCH)}`, { cache: 'no-store' });
      if (r.ok) names = imageNames(await r.json()); else if (r.status === 403 || r.status === 429) limited = true;
    } catch { /* offline or rate limited: fall back to the guessed names */ }
    if (names.length > 1) {
      const when = await Promise.all(names.map(async n => {
        try { const r = await fetchFn(`https://api.github.com/repos/${REPO}/commits?sha=${encodeURIComponent(BRANCH)}&path=${encodeURIComponent('notification-popup-gif-pic/' + n)}&per_page=1`, { cache: 'no-store' }); if (r.status === 403 || r.status === 429) limited = true; const j = r.ok ? await r.json() : []; return Date.parse(j[0]?.commit?.committer?.date) || 0; } catch { return 0; }
      }));
      names = names.map((n, i) => [n, when[i]]).sort((x, y) => y[1] - x[1]).map(x => x[0]);
    }
    if (limited) apiCache = { key: ckey, at: 0, names: [], blockedUntil: nowMs + API_TTL };   // rate limited: no API call for 10 minutes (the guessed names below still work)
    else if (names.length) apiCache = { key: ckey, at: nowMs, names: names.slice(), blockedUntil: 0 };
  }
  for (const n of names) if (fresh(n)) yield [n, ''];
  for (const n of GUESS) if (fresh(n)) yield [n, ''];   // 3)
}

/** -> { src, hash, stamp, id } or null (offline, no repo, no picture). `src` is an object URL, safe to use in <img>. */
export async function fetchPopupPic(fetchFn = fetch, repo = REPO, branch = BRANCH, known = null) {
  fetchFn = tmo(fetchFn);   // repo / branch: only the tests pass them; known = { name, stamp } from peekManifest (v129: saves a second manifest read)
  if (!repo) return null;
  for await (const [name, stamp] of candidates(fetchFn, repo, branch, known)) {
    try {
      const r = await fetchFn(RAW(name, repo, branch) + '?v=' + (stamp ? encodeURIComponent(stamp) : bust()), { cache: 'no-store' });   // v129: the upload stamp is the cache key (a new upload = a new URL, the same upload = a cacheable URL); without a stamp the per-second key stays
      if (!r.ok) continue;
      const buf = await r.arrayBuffer(), type = sniffType(buf);
      if (!buf.byteLength || !type) continue;
      const hash = await fingerprint(buf);
      return { src: URL.createObjectURL(new Blob([buf], { type })), hash, stamp, id: stamp ? hash + '.' + stamp : hash };   // v123: id = what the person "has seen": the picture AND the upload
    } catch { /* try the next one */ }
  }
  return null;
}
