// v132: pictures and GIFs for playlists, of ANY size.
// The playlist file (playlists.json / localStorage) only keeps a tiny description of each picture: { id, name, type, size }.
// The picture itself is stored untouched (no shrinking, no re-encoding, GIFs keep moving) in IndexedDB, which has no 5 MB limit like localStorage.
// The first picture of a playlist is its cover. Pure helpers here are tested in tests/plpics.test.mjs; the storage takes a backend so tests need no browser.

import { packBlob, unpackBlob, isLegacy } from './blobsafe.js';
import { mirrorPut, mirrorGet, mirrorHas, mirrorDel, mirrorTombed, mirrorUntomb } from './picmirror.js';

export const MAX_PICS = 500;   // per playlist (a size limit does not exist; this only stops a runaway)
const EXT = /\.(gif|png|jpe?g|webp|avif|bmp|svg|heic|heif|apng|ico)$/i;
const BY_EXT = { gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml', heic: 'image/heic', heif: 'image/heif', apng: 'image/png', ico: 'image/x-icon' };

/** A picture or GIF? (by its type, or by its extension when the phone gives no type) */
export const isPicFile = f => !!f && (/^image\//i.test(f.type || '') || EXT.test(f.name || ''));

/** The type to store with it: the file's own, else guessed from the extension, else a plain image. */
export const picType = f => {
  if (f && /^image\//i.test(f.type || '')) return f.type.toLowerCase();
  const m = EXT.exec((f && f.name) || ''); return m ? BY_EXT[m[1].toLowerCase()] || 'image/*' : 'image/*';
};

export const isGif = p => !!p && (p.type === 'image/gif' || /\.gif$/i.test(p.name || ''));

/** Readable size: 840 B, 12.4 KB, 3.1 MB, 1.2 GB */
export const fmtSize = n => {
  n = Number(n); if (!isFinite(n) || n < 0) return '';
  n = Math.floor(n);
  if (n < 1024) return n + ' B';
  const u = ['KB', 'MB', 'GB']; let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  if (Math.round(n * 10) / 10 >= 1024 && i < u.length - 1) { n /= 1024; i++; }   // BUG-384 / BUG-342: round first, then promote
  return (n >= 99.95 ? n.toFixed(0) : n.toFixed(1)) + ' ' + u[i];
};

/** What the playlist file may hold: only well-formed descriptions, no duplicates, nothing else. */
export const normalizePics = list => {
  const out = [], seen = new Set();
  (Array.isArray(list) ? list : []).forEach(p => {
    if (!p || typeof p !== 'object') return;
    const id = String(p.id ?? ''); if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ id, name: String(p.name ?? 'picture').slice(0, 200), type: String(p.type || 'image/*').slice(0, 60), size: Number.isFinite(Number(p.size)) ? Math.max(0, Number(p.size)) : 0 });
  });
  return out.slice(0, MAX_PICS);
};

/** A new id that is not used yet (stamp = Date.now().toString(36), n = counter, used = Set of ids) */
export const newPicId = (used, stamp, n) => { let id = 'i' + stamp + n; while (used.has(id)) id += 'x'; return id; };

/** The description of a File, ready for the playlist file */
export const describe = (file, id) => ({ id, name: String(file.name || 'picture').slice(0, 200), type: picType(file), size: Math.max(0, Number(file.size) || 0) });

export const removePic = (list, id) => list.filter(p => p.id !== id);

/** Move one picture by dir (-1 / +1). Returns a new list; out of range = same order. */
export const movePic = (list, id, dir) => {
  const i = list.findIndex(p => p.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list.slice();
  const out = list.slice(); [out[i], out[j]] = [out[j], out[i]]; return out;
};

/** Make a picture the cover = the first one. */
export const makeCover = (list, id) => {
  const p = list.find(x => x.id === id); return p ? [p, ...list.filter(x => x.id !== id)] : list.slice();
};

/* ---------- storage ---------- */
/** backend = { get(id) -> Promise<Blob|undefined>, put(id, blob) -> Promise, del(id) -> Promise } */
export function memoryBackend() {
  const m = new Map();
  return { get: id => Promise.resolve(m.get(id)), put: (id, b) => { m.set(id, b); return Promise.resolve(); }, del: id => { m.delete(id); return Promise.resolve(); }, _map: m };
}

/** The real one: its own IndexedDB database, so nothing else in the app is touched. */
export function idbBackend(idb = globalThis.indexedDB) {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!idb) return rej(new Error('IndexedDB not available'));
    const r = idb.open('lf-playlist-pics', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('pics');
    r.onsuccess = () => { const db = r.result; db.onversionchange = db.onclose = () => { dbp = null; try { db.close(); } catch {} }; res(db); };   // BUG-360: a closed handle is reopened
    r.onerror = () => { dbp = null; rej(r.error); };
  }));
  const tx = (mode, fn, retry = true) => open().then(db => new Promise((res, rej) => {
    let t, rq; try { t = db.transaction('pics', mode); rq = fn(t.objectStore('pics')); } catch (e) { dbp = null; return rej(e); }   // BUG-360
    t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted'));
  })).catch(e => { if (retry && e && e.name === 'InvalidStateError') return tx(mode, fn, false); throw e; });
  const K = id => 'lf-playlist-pics:' + id;
  return {
    get: id => mirrorTombed(K(id)) ? Promise.resolve(undefined) : tx('readonly', s => s.get(id)).catch(() => null).then(v => {
      const b = unpackBlob(v);
      if (b) { if (isLegacy(v)) packBlob(v).then(p => tx('readwrite', s => s.put(p, id))).catch(() => {}); mirrorHas(K(id)).then(h => { if (!h) mirrorPut(K(id), b); }); return b; }
      return mirrorGet(K(id)).then(m => { if (m) packBlob(m).then(p => tx('readwrite', s => s.put(p, id))).catch(() => {}); return m || undefined; });   // IndexedDB has none: use the file copy (and put it back)
    }),
    put: async (id, b) => { const [i, m] = await Promise.all([packBlob(b).then(v => tx('readwrite', s => s.put(v, id))).then(() => true, () => false), mirrorPut(K(id), b)]); if (!i && !m) throw new Error('save failed'); },
    del: id => { const nd = mirrorDel(K(id)); return tx('readwrite', s => s.delete(id)).then(async r => { if (await nd) mirrorUntomb(K(id)); return r; }, async e => { if (await nd) mirrorUntomb(K(id)); throw e; }); },   // BUG-75: the mark is cleared only once the native copy is really gone   // BUG-361: a failed delete does not leave the picture hidden
  };
}
