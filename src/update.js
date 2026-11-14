// In-app updates are keyed by the SHA-256 fingerprint of the files that ship in the APK.
// The Android versionCode is a second, independent safety check: it rejects stale manifests
// and verifies that the APK downloaded from the fixed GitHub release is the requested build.
export const UPDATE_POLL_MS = 1000;
const REPO = (import.meta.env && import.meta.env.VITE_REPO) || '';
const BRANCH = (import.meta.env && import.meta.env.VITE_BRANCH) || 'main';
const MY_ID = (import.meta.env && import.meta.env.VITE_CODE_ID) || '';
const API_FALLBACK_MS = 10 * 60 * 1000;
const bust = () => Date.now();
const FETCH_TIMEOUT_MS = 10000;
/** BUG-02: every update request gets a timeout so updBusy can never hang on a stalled connection */
const withTimeout = (fetchFn, url, opts = {}) => {
  if (typeof AbortController === 'undefined') return fetchFn(url, opts);
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  return Promise.resolve(fetchFn(url, { ...opts, signal: ac.signal })).finally(() => clearTimeout(t));
};

export const codeIdFromNotes = body => { const m = /\bcode ([0-9a-f]{12})\b/i.exec(String(body || '')); return m ? m[1].toLowerCase() : ''; };
export const buildFromNotes = body => { const m = /\bbuild (\d{10})\b/i.exec(String(body || '')); return m ? Number(m[1]) : 0; };
export const shaFromNotes = body => { const m = /\bsha256 ([0-9a-f]{64})\b/i.exec(String(body || '')); return m ? m[1].toLowerCase() : ''; };

/** update/latest.json -> { id, apk, build?, sha256? } or null. */
export const manifestUpdate = j => {
  if (!(j && typeof j.code === 'string' && /^[0-9a-f]{12}$/i.test(j.code))) return null;
  const m = { id: j.code.toLowerCase(), apk: typeof j.apk === 'string' && /^[\w.-]+\.apk$/i.test(j.apk) ? j.apk : 'liquid-dark.apk' };
  const b = Number(j.vcode);
  if (Number.isSafeInteger(b) && b > 1e9 && b < 2147483647) m.build = b;
  if (typeof j.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(j.sha256)) m.sha256 = j.sha256.toLowerCase();
  return m;
};

// A matching fingerprint is decisive: that exact code is already installed, even when a
// redundant/manual rebuild has a larger Android versionCode. Otherwise, a known build number
// prevents a stale/older manifest from being offered again after installation.
export const isUpdate = (myId, myBuild, manifest) => {
  if (!myId || !manifest || !manifest.id || manifest.id === myId) return false;
  // A fingerprint mismatch alone is not enough to lock a phone: when Android
  // cannot report the installed build (or the remote manifest has no build),
  // we cannot prove that the offered APK is newer. Fail closed instead of
  // prompting forever with an update the app cannot safely reconcile.
  const installed = Number(myBuild) || 0;
  const offered = Number(manifest.build) || 0;
  if (!Number.isSafeInteger(installed) || installed <= 0 || !Number.isSafeInteger(offered) || offered <= 0) return false;
  return offered > installed;
};

// The mandatory-update gate can be restored after a process restart. Release it when either
// the newly installed app contains the target fingerprint OR Android reports its target build.
export const pendingUpdateIsInstalled = (pending, installedId, installedBuild) => {
  if (!pending || typeof pending.id !== 'string') return false;
  if (installedId && pending.id === installedId) return true;
  const target = Number(pending.build) || 0, installed = Number(installedBuild) || 0;
  return target > 0 && installed > 0 && installed >= target;
};

// Capacitor's App.getInfo().build is Android's installed versionCode. Cache it for the current
// process; invalidate on app resume so a package replacement can never leave a stale value.
let installedP = null;
export const clearInstalledBuildCache = () => { installedP = null; };
export const getInstalledBuild = (refresh = false) => {
  if (refresh) clearInstalledBuildCache();
  return installedP || (installedP = (async () => {
    try {
      const { App } = await import('@capacitor/app');
      const i = await App.getInfo(), n = Number(i && i.build);
      return Number.isSafeInteger(n) && n > 0 ? n : 0;
    } catch { return 0; }
  })());
};

let last = null, apiAt = 0, etag = '', apiLast = null;
let confirmed = false;
export const resetUpdateCache = () => { last = null; apiAt = 0; etag = ''; apiLast = null; confirmed = false; };
export const MY_CODE_ID = MY_ID;
export const lastCheckConfirmed = () => confirmed;

/** -> { url, id, name, build?, sha256? } when a different fingerprint is published. */
export async function checkUpdate(fetchFn = fetch, { repo = REPO, branch = BRANCH, myId = MY_ID, myBuild } = {}) {
  if (!repo || !myId) { confirmed = false; return null; }
  if (myBuild === undefined) myBuild = await getInstalledBuild();
  confirmed = false;
  let soft = false;
  try {
    const r = await withTimeout(fetchFn, `https://raw.githubusercontent.com/${repo}/${branch}/update/latest.json?v=${bust()}`, { cache: 'no-store' });   // v148 fix: no custom header (it forces a CORS preflight that raw.githubusercontent.com can refuse inside the app, so the check always failed); ?v= already defeats caches
    if (r.ok) {
      const m = manifestUpdate(await r.json());
      confirmed = !!m;
      last = m && isUpdate(myId, myBuild, m) ? {
        // The fingerprint query parameter prevents an intermediary from serving a previous
        // liquid-dark.apk even though the GitHub release asset has the same fixed filename.
        url: `https://github.com/${repo}/releases/download/latest/${encodeURIComponent(m.apk)}?code=${encodeURIComponent(m.id)}&build=${encodeURIComponent(m.build || '')}`,
        id: m.id, name: m.apk,
        ...(m.build ? { build: m.build } : {}),
        ...(m.sha256 ? { sha256: m.sha256 } : {}),
      } : null;
      return last;
    }
    soft = r.status !== 404;
  } catch { soft = true; }   // v148 fix: a blocked / failed manifest request now falls through to the GitHub release check instead of giving up
  const a = await apiCheck(fetchFn, repo, myId, myBuild);
  return soft && !confirmed ? last : a;   // both sources failed: keep the last known answer
}

async function apiCheck(fetchFn, repo, myId, myBuild) {
  if (Date.now() - apiAt < API_FALLBACK_MS) return apiLast;
  apiAt = Date.now();
  try {
    const r = await withTimeout(fetchFn, `https://api.github.com/repos/${repo}/releases/tags/latest`, { cache: 'no-store', headers: etag ? { 'If-None-Match': etag } : {} });
    if (r.status === 304) { confirmed = true; return apiLast; }
    if (!r.ok) return apiLast;
    etag = (r.headers && r.headers.get && r.headers.get('etag')) || '';
    const j = await r.json(), id = codeIdFromNotes(j.body);
    const assets = j.assets || [];
    // The release keeps a stable human-friendly alias plus immutable, fingerprinted APKs.
    // Always use the stable alias for the legacy API fallback; the manifest path uses its exact immutable asset.
    const apk = assets.find(a => a.name === 'liquid-dark.apk') || assets.find(a => a.name === 'liquid-flac.apk') || assets.find(a => /\.apk$/i.test(a.name));
    confirmed = !!id;
    const build = buildFromNotes(j.body), sha256 = shaFromNotes(j.body);
    apiLast = apk && isUpdate(myId, myBuild, { id, build }) ? {
      url: `${apk.browser_download_url}?code=${encodeURIComponent(id)}&build=${encodeURIComponent(build || '')}`,
      id, name: apk.name, ...(build ? { build } : {}), ...(sha256 ? { sha256 } : {}),
    } : null;
    return apiLast;
  } catch { return apiLast; }
}
