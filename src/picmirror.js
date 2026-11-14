// v150: a SECOND copy of every custom picture / GIF / video as a plain file in the app's own storage (Android: filesDir/lfpics/),
// next to the copy in IndexedDB. Canvas files already live like this and survive restarts; now pictures do too.
// Loading tries IndexedDB first, then this copy; a picture found in only one place is copied to the other. In a browser / tests there is no native part: everything here quietly does nothing.
// File name = the key written in hex ('k' + hex), so the list of files alone is enough to find every picture again.

let P = null;   // { putPic, picPath, delPic, listPics, url }
export const useMirror = p => { P = p || null; };
export const mirrorOn = () => !!P;

const CH = 1536 * 1024;   // bytes per piece sent to the phone (the bridge is not made for one huge string)
const EXT = { 'image/gif': 'gif', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp', 'image/svg+xml': 'svg', 'image/heic': 'heic', 'image/heif': 'heif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/x-matroska': 'mkv', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v', 'video/3gpp': '3gp' };   // BUG #10: the other video types the profile picker accepts
const TYPE = Object.fromEntries(Object.entries(EXT).map(([t, e]) => [e, t])); TYPE.jpeg = 'image/jpeg';
export const extOf = type => EXT[String(type || '').toLowerCase().split(';')[0].trim()] || 'bin';   // BUG-337
/** v151: a file the phone gave NO type for is recognised by its first bytes, so it is saved as .gif / .png ... and the WebView serves it with the right type. */
export const sniffExt = u8 => {
  if (!u8 || u8.length < 12) return 'bin';
  const a = i => u8[i], t = (i, s) => [...s].every((c, k) => a(i + k) === c.charCodeAt(0));
  if (t(0, 'GIF8')) return 'gif'; if (a(0) === 0x89 && t(1, 'PNG')) return 'png'; if (a(0) === 0xff && a(1) === 0xd8) return 'jpg';
  if (t(0, 'RIFF') && t(8, 'WEBP')) return 'webp'; if (t(0, 'BM')) return 'bmp'; if (t(4, 'ftyp')) return t(8, 'avif') ? 'avif' : (t(8, 'heic') || t(8, 'heix') || t(8, 'mif1')) ? 'heic' : 'mp4';
  if (a(0) === 0x1a && a(1) === 0x45 && a(2) === 0xdf && a(3) === 0xa3) return 'webm';
  return 'bin';
};

const hex = s => Array.from(new TextEncoder().encode(s), b => b.toString(16).padStart(2, '0')).join('');
const unhex = h => { try { if (!/^([0-9a-f]{2})+$/.test(h)) return null; const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); return new TextDecoder().decode(a); } catch { return null; } };
/** key -> file name (a-z 0-9, max 120). Long keys get a hash name (still found by key, just not listed). */
export const nameOf = key => {
  const h = hex(String(key)), lone = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(String(key));   // BUG-347: a key with a lone surrogate is not reversible through UTF-8, so it gets its own hash name
  if (!lone && h.length <= 118) return 'k' + h;
  let x = 5381, y = 52711; for (const c of String(key)) { const n = c.codePointAt(0); x = ((x * 33) ^ n) >>> 0; y = (y * 31 + n) >>> 0; }
  return 'h' + x.toString(36) + y.toString(36) + h.slice(0, 40);
};
export const keyOfName = name => (String(name).startsWith('k') ? unhex(String(name).slice(1)) : null);

const b64Blob = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const t = String(r.result); res(t.slice(t.indexOf(',') + 1)); }; r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x2000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x2000)); return btoa(s); };

// A tiny list kept in localStorage (key -> file path) so the app can show every picture on the VERY FIRST frame, without waiting for any database:
// the file is simply opened from the app's own storage. It is only a shortcut: if a file turns out to be missing, the picture is loaded from IndexedDB as before.
const IDX = 'lf.picurls';
const readIdx = () => {   // BUG-341 / BUG-346: only a plain object, no inherited or "__proto__" keys
  const o = Object.create(null);
  try { const j = JSON.parse(localStorage.getItem(IDX)); if (j && typeof j === 'object' && !Array.isArray(j)) for (const k of Object.keys(j)) if (k !== '__proto__' && typeof j[k] === 'string') o[k] = j[k]; } catch { }
  return o;
};
const writeIdx = m => { try { localStorage.setItem(IDX, JSON.stringify(m)); } catch {} };
const idxSet = (key, path) => { const m = readIdx(); if (path) m[key] = path; else delete m[key]; writeIdx(m); };
/** WebView address of a saved copy, known instantly (no waiting). '' when unknown. */
export const mirrorUrlSync = key => { if (!P || mirrorTombed(key)) return ''; const p = readIdx()[key]; return p ? P.url(p) : ''; };
/** every key (starting with prefix) in the quick list */
/** raw file path of a saved copy ('' when unknown): used for the notification / lock screen artwork */
export const mirrorPathSync = key => (P ? readIdx()[key] || '' : '');
export const mirrorSyncKeys = prefix => Object.keys(readIdx()).filter(k => k.startsWith(prefix) && !mirrorTombed(k));
export const mirrorForget = key => idxSet(key, '');

// v154: "Back to default" must STICK. A removed picture is written to a small "deleted" list first; until its saved copies are really gone, nothing may show it or copy it back
// (the app being closed in the middle of a delete, or a database that refused to delete, used to bring the picture back at the next start).
const TOMB = 'lf.picdel';
const readTomb = () => { try { const j = JSON.parse(localStorage.getItem(TOMB)); return Array.isArray(j) ? j.filter(x => typeof x === 'string') : []; } catch { return []; } };   // BUG-346
const writeTomb = a => { try { localStorage.setItem(TOMB, JSON.stringify(a)); } catch {} };
export const mirrorTombed = key => readTomb().includes(key);
export const mirrorUntomb = key => { const a = readTomb(); if (a.includes(key)) writeTomb(a.filter(k => k !== key)); };
const tomb = key => { const a = readTomb(); if (!a.includes(key)) { a.push(key); writeTomb(a); } };
/** v151: read the folder ONCE and rebuild the quick list from the files themselves (one phone call for every picture, however many there are). Pictures whose file is gone are dropped from the list; the list in localStorage can no longer be out of date or lost.
 *  Resolves true when the folder could be read. */
export const mirrorSync = () => run(async () => {
  if (!P) return false;
  const r = await P.listPics(); if (!r || !Array.isArray(r.files)) return false;   // an older phone part answers without paths: keep the old way
  const m = {}; r.files.forEach(f => { const k = keyOfName(f.n); if (!k || !f.p) return; if (mirrorTombed(k)) { P.delPic({ name: f.n }).catch(() => {}); return; } m[k] = f.p; });   // a file whose delete never finished is deleted now, not shown
  const old = readIdx(); Object.keys(old).forEach(k => { if (!(k in m) && !String(nameOf(k)).startsWith('k')) m[k] = old[k]; });   // long keys are stored under a hashed name: not listable, keep what we know
  writeIdx(m); return true;
}).catch(() => false);

let q = Promise.resolve();   // one file operation at a time
const run = fn => { const p = q.then(fn); q = p.catch(() => {}); return p; };

/** Save a copy. Resolves true / false, never throws. */
const delGen = new Map();   // BUG-351: counts mirrorDel calls per key
export const mirrorPut = (key, blob) => { const g = delGen.get(key) || 0; return run(async () => {
  if (!P || !blob || blob.size === 0 || typeof blob.arrayBuffer !== 'function') return false;   // BUG-257: an empty picture is never saved
  if ((delGen.get(key) || 0) !== g) return false;   // a newer "Back to default" is queued behind this put: do not bring the picture back
  mirrorUntomb(key);   // a new picture for this key ends the 'deleted' state
  // v156: each piece is turned into base64 by the browser itself (FileReader: off the main thread, native speed) and sent in bigger pieces. Without FileReader (tests) the old way is used.
  const fast = typeof FileReader !== 'undefined' && typeof blob.slice === 'function' && typeof blob.size === 'number';
  const name = nameOf(key), buf = new Uint8Array(await (fast ? blob.slice(0, 16) : blob).arrayBuffer()), size = fast ? blob.size : buf.length, ext = extOf(blob.type) !== 'bin' ? extOf(blob.type) : sniffExt(buf);
  let o = 0, path = '';
  do { const end = Math.min(size, o + CH); const data = fast ? await b64Blob(blob.slice(o, end)) : b64(buf.subarray(o, end)); const r = await P.putPic({ name, ext, base64: data, append: o > 0, done: end >= size }); if (r && r.path) path = r.path; o = end; } while (o < size);
  if (path) idxSet(key, path);
  return path || true;
}).catch(() => false); };

const where = key => run(async () => { if (!P || mirrorTombed(key)) return null; const r = await P.picPath({ name: nameOf(key) }); const p = r && r.path ? r.path : null; if (p && readIdx()[key] !== p) idxSet(key, p); return p; }).catch(() => null);   // also fills the quick list for copies made by an older version
export const mirrorHas = key => where(key).then(p => !!p);

/** The saved copy as a Blob, or null. */
export const mirrorGet = key => where(key).then(async path => {
  if (!path) return null;
  try { const r = await fetch(P.url(path)); if (!r.ok) return null; const b = await r.blob(); const e = (/\.([a-z0-9]+)$/.exec(path) || [])[1]; return b.size ? new Blob([b], { type: b.type && b.type !== 'application/octet-stream' ? b.type : TYPE[e] || 'application/octet-stream' }) : null; } catch { return null; }
});

export const mirrorDel = key => { delGen.set(key, (delGen.get(key) || 0) + 1); tomb(key); idxSet(key, ''); return run(async () => { if (P) await P.delPic({ name: nameOf(key) }); return true; }).catch(() => false); };   // the 'deleted' mark stays until the caller has also emptied IndexedDB (mirrorUntomb)

/** Every key that has a saved copy and starts with prefix (to find pictures again even if the list in localStorage was lost). */
export const mirrorKeys = prefix => run(async () => {
  if (!P) return [];
  const r = await P.listPics(); return ((r && r.names) || []).map(keyOfName).filter(k => k && k.startsWith(prefix));
}).catch(() => []);
