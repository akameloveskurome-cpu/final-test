// Backup & transfer helpers shared by playlist / listening-data / settings import and export. PURE (no DOM, no Native): covered by tests/transfer.test.mjs.
// CSV reading + writing, a store-only ZIP writer (several playlist files in ONE download) and base64.

/** Splits CSV / TSV text into rows of fields. Delimiter is detected from the first line unless given. Handles quotes, "" escapes, CRLF, BOM. */
export function csvParse(text, delim) {
  const s = String(text ?? '').replace(/^\uFEFF/, '');
  if (!delim) {
    const first = s.split(/\r\n|\r|\n/, 1)[0] || '';
    let best = ',', n = -1;
    for (const d of [',', ';', '\t', '|']) { let c = 0, q = false; for (const ch of first) { if (ch === '"') q = !q; else if (ch === d && !q) c++; } if (c > n) { n = c; best = d; } }
    delim = best;
  }
  const rows = []; let row = [], f = '', q = false, i = 0;
  const fld = v => (/^'[\s\x00-\x1f]*[=+\-@]/.test(v) ? v.slice(1) : v);   // csvText puts ' in front of a value that starts with = + - @ (spreadsheet formula guard): reading our own file back removes it again
  const endRow = () => { row.push(fld(f)); f = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; };
  while (i < s.length) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; }
      f += ch; i++; continue;
    }
    if (ch === '"' && f === '') { q = true; i++; continue; }
    if (ch === delim) { row.push(fld(f)); f = ''; i++; continue; }
    if (ch === '\r') { i++; if (s[i] === '\n') continue; endRow(); continue; }   // BUG-87: a lone CR ends the row too
    if (ch === '\n') { endRow(); i++; continue; }
    f += ch; i++;
  }
  if (f !== '' || row.length) endRow();
  return rows;
}

/** Rows (arrays of values) -> CSV text (CRLF, quotes only where needed, so every spreadsheet / importer reads it). */
export function csvText(rows) {
  const cell = v => {
    let x = v == null ? '' : String(v);
    if (/^[\s\x00-\x1f]*[=+\-@]/.test(x) && !/^-?\d+([.,]\d+)?$/.test(x)) x = "'" + x;   // BUG-77: neutralise spreadsheet formulas
    return /[",\r\n;\t]/.test(x) || /^\s|\s$/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x;
  };
  return rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** Header names -> column index, matching by normalised alias lists: aliases = { key: ['track name','title',...] }. Missing keys are -1. */
export function headerMap(header, aliases) {
  const clean = h => String(h ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const cols = header.map(clean), out = {};
  for (const [key, list] of Object.entries(aliases)) {
    let at = -1;
    for (const a of list) { const k = cols.indexOf(clean(a)); if (k >= 0) { at = k; break; } }
    out[key] = at;
  }
  return out;
}

/* ---------- ZIP (store only, no compression: playlist files are tiny) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export const crc32 = bytes => { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

/** files: [{ name, text }] -> Uint8Array of a valid .zip (UTF-8 names). */
export function zipFiles(files, now = new Date()) {
  const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
  const dt = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(), tm = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const u16 = n => [n & 255, (n >>> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
    const head = Uint8Array.from([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(tm), ...u16(dt), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    parts.push(head, name, data);
    central.push(Uint8Array.from([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(tm), ...u16(dt), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
    offset += head.length + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = Uint8Array.from([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

export function toBase64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }

/** A file name that every file system accepts. */
export const safeName = (s, fallback = 'file') => (String(s ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)) || fallback;
/** Same name twice in one zip -> " (2)". */
export function uniqueNames(names) {   // BUG-297: a generated " (2)" is checked against every real name too
  const used = new Set(names.map(n => n.toLowerCase())), seen = new Set(), counts = new Map();
  return names.map(n => {
    const k = n.toLowerCase(); if (!seen.has(k)) { seen.add(k); return n; }
    const dot = n.lastIndexOf('.'), base = dot > 0 ? n.slice(0, dot) : n, ext = dot > 0 ? n.slice(dot) : '';
    let c = counts.get(k) || 1, cand; do { c++; cand = `${base} (${c})${ext}`; } while (used.has(cand.toLowerCase()) || seen.has(cand.toLowerCase()));
    counts.set(k, c); seen.add(cand.toLowerCase()); return cand;
  });
}
export const stamp = (d = new Date()) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
export const xmlEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const cp = n => (Number.isInteger(n) && n >= 0 && n <= 0x10FFFF ? String.fromCodePoint(n) : '\uFFFD');   // BUG-296: an out-of-range entity is not fatal
export const xmlUnesc = s => String(s ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => cp(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => cp(parseInt(n, 16))).replace(/&amp;/g, '&');
