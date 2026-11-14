// v134 feature: your own picture or GIF as the app background (Home, every tab, every Settings page, Now Playing, lyrics).
// ANY size: the file is stored untouched (no shrinking, no re-encoding, GIFs keep moving) in its own IndexedDB, which has no 5 MB limit like localStorage.
// Settings (dim, fit) are tiny and live in the normal settings. Pure helpers here are tested in tests/bgmedia.test.mjs; the storage takes a backend so tests need no browser.
import { isPicFile } from './plpics.js';

export { isPicFile };
export const BG_DIM_MIN = 0, BG_DIM_MAX = 85, BG_DIM_DEF = 0;   // v208+: 0 = your picture exactly as it is (nothing laid over it); the Darken slider is still there if you want text easier to read
export const BG_FITS = ['fill', 'fit'];                           // fill = cover the whole screen (edges may be cropped); fit = show the whole picture (bars on the sides if the shapes differ)

/** dim: whole number BG_DIM_MIN..BG_DIM_MAX, anything else = the default. */
export const cleanDim = v => { const n = Math.round(Number(v)); return Number.isFinite(n) && typeof v !== 'boolean' && !Array.isArray(v) && !(typeof v === 'string' && !v.trim()) && v !== null ? Math.min(BG_DIM_MAX, Math.max(BG_DIM_MIN, n)) : BG_DIM_DEF; };
export const cleanFit = v => (BG_FITS.includes(v) ? v : 'fill');

/** The CSS values for the two settings. */
export const bgVars = (dim, fit) => ({ '--bgdimc': `rgba(0,0,0,${(cleanDim(dim) / 100).toFixed(2)})`, '--bgsize': cleanFit(fit) === 'fit' ? 'contain' : 'cover' });

/* ---------- storage ---------- */
/** backend = { get() -> Promise<Blob|null>, put(blob) -> Promise, del() -> Promise } */
export function memoryBackend() {
  let b = null;
  return { get: () => Promise.resolve(b), put: x => { b = x; return Promise.resolve(); }, del: () => { b = null; return Promise.resolve(); } };
}

/** The real one: its own IndexedDB database (lf-background), so nothing else in the app is touched. */
import { packBlob, unpackBlob, isLegacy } from './blobsafe.js';
import { mirrorPut, mirrorGet, mirrorHas, mirrorDel, mirrorTombed, mirrorUntomb } from './picmirror.js';

export function idbBackend(idb = globalThis.indexedDB) {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!idb) return rej(new Error('IndexedDB not available'));
    const r = idb.open('lf-background', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error); };
  }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction('kv', mode), rq = fn(t.objectStore('kv'));
    t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted'));
  }));
  const K = 'lf-background:media';
  return {
    get: () => mirrorTombed(K) ? Promise.resolve(null) : tx('readonly', s => s.get('media')).catch(() => null).then(v => {
      const b = unpackBlob(v);
      if (b) { if (isLegacy(v)) packBlob(v).then(p => tx('readwrite', s => s.put(p, 'media'))).catch(() => {}); mirrorHas(K).then(h => { if (!h) mirrorPut(K, b); }); return b; }
      return mirrorGet(K).then(m => { if (m) packBlob(m).then(p => tx('readwrite', s => s.put(p, 'media'))).catch(() => {}); return m || null; });
    }),
    put: async b => { const [i, m] = await Promise.all([packBlob(b).then(v => tx('readwrite', s => s.put(v, 'media'))).then(() => true, () => false), mirrorPut(K, b)]); if (!i && !m) throw new Error('save failed'); },
    del: () => { const nd = mirrorDel(K); return tx('readwrite', s => s.delete('media')).then(async r => { if (await nd) mirrorUntomb(K); return r; }); },   // BUG-75
  };
}
