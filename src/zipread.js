// Read a .zip in memory (stored or deflated), so a backup / data download can be picked as the .zip itself. Needs DecompressionStream('deflate-raw') (Chrome 103+ web view, Node 18+).
export const fromBase64 = b64 => { const s = atob(String(b64 || '').replace(/^data:[^,]*,/, '').replace(/-/g, '+').replace(/_/g, '/').replace(/[\s=]+$/g, '').replace(/\s+/g, '')); /* BUG-370: data: URL prefix and URL-safe base64 are accepted */ const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
export const isZip = b => !!b && b.length > 3 && b[0] === 0x50 && b[1] === 0x4b && ((b[2] === 3 && b[3] === 4) || (b[2] === 5 && b[3] === 6));   // BUG-371
const WANT = /\.(json|jsonl|csv|tsv|log|txt)$/i;
/** v159: the files a playlist import reads from a .zip (M3U / M3U8, PLS, XSPF, JSPF and the same data files as WANT). */
export const PLAYLIST_WANT = /\.(m3u8?|pls|xspf|jspf|json|csv|tsv|txt)$/i;
async function inflate(raw, limit = Infinity) {
  if (typeof DecompressionStream !== 'function') throw new Error('This phone cannot open .zip files here: unzip it and pick the .json / .csv inside');
  // BUG-64: count the REAL decompressed bytes and stop at the limit (the size in the zip header can lie)
  const rd = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = []; let n = 0;
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    n += value.length; if (n > limit) { try { await rd.cancel(); } catch {} throw new Error('This .zip file is too big'); }
    parts.push(value);
  }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
/** bytes -> [{ name, text }] for the data files inside (json, jsonl, csv, tsv, log, txt; folders, pictures and __MACOSX are skipped). Each file up to `max` bytes. */
export async function unzipText(bytes, opts = {}) {
  try { return await unzipText0(bytes, opts); } catch (e) { if (e instanceof RangeError) throw new Error('Damaged .zip file'); throw e; }   // BUG-65: a corrupt offset is a controlled error
}
async function unzipText0(bytes, { max = 200e6, want = WANT } = {}) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let e = -1; for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Not a valid .zip file');
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const out = [], dec = new TextDecoder('utf-8');
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Damaged .zip file');
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), usize = v.getUint32(p + 24, true), nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
    if (name.endsWith('/') || name.startsWith('__MACOSX/') || !want.test(name)) continue;
    if (csize === 0xFFFFFFFF || usize === 0xFFFFFFFF) throw new Error('This .zip is too big (zip64): unzip it first');
    if (usize > max) throw new Error(name + ' is too big');
    const ln = v.getUint16(off + 26, true), le = v.getUint16(off + 28, true), data = bytes.subarray(off + 30 + ln + le, off + 30 + ln + le + csize);
    out.push({ name, text: dec.decode(method === 0 ? data : method === 8 ? await inflate(data, max) : (() => { throw new Error('Unsupported .zip compression'); })()).replace(/^\uFEFF/, '') });
  }
  return out;
}
/** [{ name, text } | { name, bytes: Uint8Array }] -> [{ name, text, zip? }]: zips are opened, their data files listed as "zip name / file name". */
export async function expandFiles(files, { want = WANT } = {}) {
  const out = [];
  for (const f of files || []) {
    if (f && f.bytes instanceof Uint8Array) { const b = f.bytes; if (!isZip(b)) continue; for (const x of await unzipText(b, { want })) out.push({ name: x.name, text: x.text, zip: f.name }); }   /* BUG-48: the bytes are read from the file the phone wrote (no Base64) */
    else if (f) out.push(f);
  }
  return out;
}
