// Playlists from / to OTHER apps. PURE (no DOM, no Native): covered by tests/plforeign.test.mjs.
// Export: Liquid Dark JSON (plexport.js), M3U8, XSPF, CSV (Exportify-style columns).
// Import: our JSON, M3U / M3U8, PLS, XSPF, JSPF, CSV / TSV (Spotify Exportify, Soundiiz, TuneMyMusic, Apple Music text export, most spreadsheets),
// Spotify's own data download (Playlist1.json), a plain list of "Artist - Title" lines. Songs are matched to the local library (path, tags, then looser name matching).
import { unesc, norm, parseImport, makeIndex, matchSong, freeName, nameKey } from './plexport.js';
import { csvParse, csvText, headerMap, xmlEsc, xmlUnesc, safeName, uniqueNames, stamp } from './transfer.js';

export const FORMATS = [
  { id: 'json', label: 'Liquid Dark backup (.json)', note: 'Best for moving between your own phones. Keeps every song.', ext: 'json', mime: 'application/json' },
  { id: 'm3u8', label: 'M3U8 playlist (.m3u8)', note: 'Works in VLC, Poweramp, foobar2000, Apple Music (Mac), most players. Several playlists = one .zip.', ext: 'm3u8', mime: 'audio/x-mpegurl' },
  { id: 'xspf', label: 'XSPF playlist (.xspf)', note: 'Open standard (VLC, Strawberry, Clementine). Several playlists = one .zip.', ext: 'xspf', mime: 'application/xspf+xml' },
  { id: 'csv', label: 'CSV spreadsheet (.csv)', note: 'Title, artist, album per row. For Soundiiz, TuneMyMusic-style converters and Spotify / Apple Music / YouTube Music transfers.', ext: 'csv', mime: 'text/csv' },
];

/* ---------- export ---------- */
/** [{ name, songs:[{ id, path, title, artist, album, dur(sec) }] }] with RAW strings; songs no longer in the library are left out. */
export function exportLists(lists, tracks, artistAlbumOf) {
  const byId = new Map(tracks.map(t => [t.id, t]));
  return lists.map(p => ({
    name: String(p.name),
    songs: p.ids.map(id => byId.get(id)).filter(Boolean).map(t => { const aa = artistAlbumOf(t) || {}; return { id: t.id, path: unesc(t.path), title: unesc(t.title), artist: unesc(t.trackArtist || aa.artist), album: unesc(aa.album), dur: Math.round(+t.dur || 0) }; }),
  }));
}
const oneLine = s => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
export function toM3u8(pl) {
  const out = ['#EXTM3U', '#PLAYLIST:' + oneLine(pl.name)];
  for (const s of pl.songs) { out.push(`#EXTINF:${s.dur || -1},${oneLine(s.artist) ? oneLine(s.artist) + ' - ' : ''}${oneLine(s.title)}`); if (!oneLine(s.artist)) out.push('#EXTART:');   /* BUG-300: marks "no artist", so a title with " - " is not split on re-import */
    if (s.album) out.push('#EXTALB:' + oneLine(s.album)); out.push(oneLine(s.path)); }
  return out.join('\n') + '\n';
}
const encPath = p => {   // BUG-305: XSPF <location> is a URI: an absolute path gets file:// (a Windows drive keeps its colon), a relative path stays a relative reference
  p = String(p); const w = /^([A-Za-z]:)(\/.*)?$/.exec(p);
  if (w) return 'file:///' + w[1] + String(w[2] || '').split('/').map(encodeURIComponent).join('/');
  const e = p.split('/').map(encodeURIComponent).join('/'); return p.startsWith('/') ? 'file://' + e : e;
};
export function toXspf(pl) {
  const t = pl.songs.map(s => `    <track>\n      <location>${xmlEsc(encPath(String(s.path).replace(/\\/g, '/')))}</location>\n      <title>${xmlEsc(s.title)}</title>\n      <creator>${xmlEsc(s.artist)}</creator>\n      <album>${xmlEsc(s.album)}</album>\n${s.dur ? `      <duration>${s.dur * 1000}</duration>\n` : ''}    </track>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<playlist version="1" xmlns="http://xspf.org/ns/0/">\n  <title>${xmlEsc(pl.name)}</title>\n  <creator>Liquid Dark</creator>\n  <trackList>\n${t}\n  </trackList>\n</playlist>\n`;
}
/** One CSV with every playlist. Columns follow Exportify so tools that read it keep working. */
export function toCsv(pls) {
  const rows = [['Playlist Name', 'Track Name', 'Artist Name(s)', 'Album Name', 'Duration (ms)', 'File Path']];
  // The app allows two playlists with the same name, but the CSV tells playlists apart only by name: give repeats " (2)", " (3)" so they do not merge when the file is imported.
  const seen = new Map(), used = new Set(pls.map(p => String(p.name).toLowerCase())), label = pls.map(p => {
    const k = String(p.name).toLowerCase(), c = (seen.get(k) || 0) + 1; seen.set(k, c); if (c === 1) return p.name;
    let n = c, nm; do { nm = `${p.name} (${n++})`; } while (used.has(nm.toLowerCase())); used.add(nm.toLowerCase()); return nm;
  });
  pls.forEach((p, i) => { for (const s of p.songs) rows.push([label[i], s.title, s.artist, s.album, s.dur ? s.dur * 1000 : '', s.path]); });
  return csvText(rows);
}
/** -> { name, mime, text } for one file, or { name, mime:'application/zip', files:[{name,text}] } when m3u8 / xspf has several playlists. */
export function buildFiles(fmt, pls, now = new Date()) {
  const f = FORMATS.find(x => x.id === fmt); if (!f) throw new Error('Unknown format');
  const d = stamp(now);
  if (fmt === 'csv') return { name: `liquid-dark-playlists-${d}.csv`, mime: f.mime, text: toCsv(pls) };
  const conv = fmt === 'm3u8' ? toM3u8 : toXspf;
  if (pls.length === 1) return { name: safeName(pls[0].name, 'playlist') + '.' + f.ext, mime: f.mime, text: conv(pls[0]) };
  const names = uniqueNames(pls.map(p => safeName(p.name, 'playlist') + '.' + f.ext));
  return { name: `liquid-dark-playlists-${fmt}-${d}.zip`, mime: 'application/zip', files: pls.map((p, i) => ({ name: names[i], text: conv(p) })) };
}

/* ---------- import: one parser per format. Each returns [{ name, songs:[{ id, path, title, artist, album }] }] ---------- */
const song = (o = {}) => ({ id: String(o.id ?? ''), path: String(o.path ?? ''), title: String(o.title ?? '').trim(), artist: String(o.artist ?? '').trim(), album: String(o.album ?? '').trim() });
const baseName = n => String(n ?? '').replace(/^.*[\\/]/, '').replace(/\.[a-z0-9]{1,6}$/i, '').trim();
const splitArtistTitle = s => { const m = /^(.+?)\s+[-\u2013\u2014]\s+(.+)$/.exec(s); return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: '', title: s.trim() }; };
const stripFile = p => String(p).replace(/^file:\/\/\/?/i, '/').replace(/^\/([A-Za-z]:)/, '$1');
const decodePath = p => { try { return decodeURIComponent(p); } catch { return p; } };
const isUrl = p => /^[a-z][a-z0-9+.-]*:\/\//i.test(p) && !/^file:/i.test(p);
const fileTitle = p => baseName(decodePath(p)).replace(/^\d{1,3}\s*[-._)]\s*/, '');

export function parseM3u(text, fileName) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
  let name = '', pend = null; const songs = [];
  for (const raw of lines) {
    const l = raw.trim(); if (!l) continue;
    if (/^#PLAYLIST:/i.test(l)) { name = l.slice(10).trim(); continue; }
    if (/^#EXTINF:/i.test(l)) { const m = /^#EXTINF:\s*-?\d*(?:\.\d+)?[^,]*,(.*)$/i.exec(l); pend = { ...splitArtistTitle(m ? m[1] : ''), album: '', raw: m ? m[1].trim() : '' }; continue; }
    if (/^#EXTALB:/i.test(l)) { pend = pend || {}; pend.album = l.slice(8).trim(); continue; }
    if (/^#EXTART:/i.test(l)) { pend = pend || {}; pend.artist = l.slice(8).trim(); if (!pend.artist && pend.raw) pend.title = pend.raw; continue; }
    if (l[0] === '#') continue;
    const p = isUrl(l) ? '' : pathOf(l);
    const s = song({ ...(pend || {}), raw: undefined, path: p });
    if (!s.title) s.title = fileTitle(l);
    songs.push(s); pend = null;
  }
  return [{ name: name || baseName(fileName) || 'Imported', songs }];
}
export function parsePls(text, fileName) {
  const f = {}, t = {}, ent = []; let name = '';
  for (const l of String(text).split(/\r?\n/)) { const m = /^\s*(File|Title)(\d+)\s*=\s*(.*)$/i.exec(l); if (m) (m[1].toLowerCase() === 'file' ? f : t)[+m[2]] = m[3].trim(); }
  for (const k of Object.keys(f).map(Number).sort((a, b) => a - b)) { const p = isUrl(f[k]) ? '' : pathOf(f[k]); const s = song({ ...splitArtistTitle(t[k] || ''), path: p }); if (!s.title) s.title = fileTitle(f[k]); ent.push(s); }
  return [{ name: name || baseName(fileName) || 'Imported', songs: ent }];
}
export function parseXspf(text, fileName) {
  const s = String(text), tag = (b, n) => { const m = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i').exec(b); return m ? xmlUnesc(m[1]).trim() : ''; };
  const head = s.split(/<trackList/i)[0], songs = [];
  for (const m of s.matchAll(/<track(?:\s[^>]*)?>([\s\S]*?)<\/track>/gi)) {
    const b = m[1], loc = tag(b, 'location');
    songs.push(song({ path: loc && !isUrl(loc) ? decodePath(stripFile(loc)) : '', title: tag(b, 'title') || (loc ? fileTitle(loc) : ''), artist: tag(b, 'creator'), album: tag(b, 'album') }));
  }
  return [{ name: tag(head, 'title') || baseName(fileName) || 'Imported', songs }];
}
const COLS = {
  title: ['track name', 'trackname', 'track', 'title', 'song name', 'song', 'name', 'track title'],
  artist: ['artist name s', 'artist names', 'artist name', 'artist', 'artists', 'artistname', 'album artist name', 'creator'],
  album: ['album name', 'album', 'albumname', 'release', 'release name'],
  list: ['playlist name', 'playlist', 'playlistname', 'list'],
  path: ['file path', 'path', 'location', 'file', 'filename', 'file name'],
};
export function parseCsvList(text, fileName) {
  const rows = csvParse(text); if (rows.length < 2) return [];
  const h = headerMap(rows[0], COLS); if (h.title < 0) return [];
  const by = new Map(), def = baseName(fileName) || 'Imported';
  for (const r of rows.slice(1)) {
    const g = k => (h[k] >= 0 ? String(r[h[k]] ?? '').trim() : '');
    const title = g('title'); if (!title && !g('path')) continue;
    const key = g('list') || def; if (!by.has(key)) by.set(key, []);
    by.get(key).push(song({ title: title || fileTitle(g('path')), artist: g('artist'), album: g('album'), path: isUrl(g('path')) ? '' : (g('path') ? pathOf(g('path')) : '') }));   // BUG-302
  }
  return [...by].map(([name, songs]) => ({ name, songs }));
}
const SP_KEYS = ['trackName', 'artistName'];
export function parseJsonList(o, fileName) {
  const def = baseName(fileName) || 'Imported';
  if (o && Array.isArray(o.playlists) && o.playlists.some(p => p && Array.isArray(p.items))) {   // Spotify "Download your data": Playlist1.json
    return o.playlists.map(p => ({ name: String(p.name || def), songs: (p.items || []).map(i => i && i.track).filter(Boolean).map(t => song({ title: t.trackName, artist: t.artistName, album: t.albumName })).filter(s => s.title) }));
  }
  if (o && o.playlist && (Array.isArray(o.playlist.track) || o.playlist.title)) {   // JSPF
    const p = o.playlist; return [{ name: String(p.title || def), songs: (p.track || []).map(t => song({ title: t.title, artist: t.creator, album: t.album, path: Array.isArray(t.location) && t.location[0] && !isUrl(t.location[0]) ? pathOf(t.location[0]) : '' })) }];
  }
  const arr = Array.isArray(o) ? o : null;   // a bare array of tracks
  if (arr && arr.length && arr.every(x => x && typeof x === 'object' && !Array.isArray(x)) && arr.some(x => SP_KEYS.every(k => k in x) || 'title' in x || 'track' in x)) {
    return [{ name: def, songs: arr.map(x => song({ title: x.title || x.trackName || (typeof x.track === 'string' ? x.track : x.track && x.track.name), artist: x.artist || x.artistName || (x.track && x.track.artist), album: x.album || x.albumName })).filter(s => s.title) }];
  }
  return null;
}
export function parseLines(text, fileName) {
  const songs = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(l => l && /\s[-\u2013\u2014]\s/.test(l)).map(l => song(splitArtistTitle(l)));
  return songs.length ? [{ name: baseName(fileName) || 'Imported', songs }] : [];
}

/** Detects the format of ONE file and returns its playlists. Throws Error('Not a playlist file') when nothing usable is in it. */
export function parseAny(text, fileName = '') {
  const t = String(text ?? '').replace(/^\uFEFF/, ''), head = t.trimStart().slice(0, 400), ext = (/\.([a-z0-9]+)$/i.exec(fileName) || [])[1]?.toLowerCase() || '';
  let out = null;
  let o = null; if (/^(?:\{|\[(?!playlist\]))/i.test(head)) { try { o = JSON.parse(t); } catch { } }   // BUG-298: text that only starts with "[" falls through to the other readers
  if (o) {
    {
      out = parseJsonList(o, fileName);
      if (!out) { try { out = parseImport(t); } catch (e) { if (/newer/.test(e.message)) throw e; } }
    }
  } else if (/^<\?xml|^<playlist/i.test(head) || ext === 'xspf') out = parseXspf(t, fileName);
  else if (/^\[playlist\]/i.test(head) || ext === 'pls') out = parsePls(t, fileName);
  else if (/^#EXTM3U/i.test(head) || ext === 'm3u' || ext === 'm3u8') out = parseM3u(t, fileName);
  else {
    out = parseCsvList(t, fileName);
    const rowsT = t.split(/\r?\n/).map(x => x.trim()).filter(x => x && x[0] !== '#');
    if (!out.length && rowsT.length && rowsT.every(x => /\.(flac|mp3|m4a|aac|ogg|opus|wav)$/i.test(x))) out = parseM3u(t, fileName);   // BUG-299: a bare list of file paths is read BEFORE "Artist - Title" lines
    if (!out.length) out = parseLines(t, fileName);
    if (!out.length && /\.(flac|mp3|m4a|aac|ogg|opus|wav)\s*$/im.test(t)) out = parseM3u(t, fileName);
  }
  out = (out || []).filter(p => p.songs && p.songs.length);
  if (!out.length) throw new Error('Not a playlist file');
  return out.map(p => ({ name: String(p.name || 'Imported').trim() || 'Imported', songs: p.songs }));
}

/* ---------- matching against the local library (stricter first, looser after) ---------- */
const loose0 = s => norm(String(s ?? '').replace(/[([{][^)\]}]*[)\]}]/g, ' ').replace(/\s[-\u2013]\s(?=.*\b(?:remaster\w*|mono|stereo|version|edit|live|deluxe|bonus|mix)\b).*$/i, '').replace(/\s(feat|ft|featuring)\.?\s.*$/i, '')).replace(/[^\p{L}\p{N}]+/gu, '') || norm(s).replace(/[^\p{L}\p{N}]+/gu, '');   // BUG-234: a bracket-only title keeps its bracket text
const loose = s => loose0(s) || String(norm(String(s ?? ''))).replace(/[^\p{L}\p{N}]+/gu, '');   // BUG-129 / 234: a title made only of a bracket keeps its text
const firstArtist = s => loose(String(s ?? '').split(/\s*(?:,|;|&|\/|\sx\s|\sand\s)\s*/i)[0]);
export function makeForeignIndex(tracks, artistAlbumOf) {
  const idx = makeIndex(tracks, artistAlbumOf), byTA = new Map(), byTitle = new Map(), byBase = new Map();
  for (const t of tracks) {
    const aa = artistAlbumOf(t) || {}, ti = loose(unesc(t.title)), ar = firstArtist(unesc(t.trackArtist || aa.artist));
    const k = ti + '\u0001' + ar; (byTA.get(k) || byTA.set(k, []).get(k)).push(t);
    (byTitle.get(ti) || byTitle.set(ti, []).get(ti)).push(t);
    const b = norm(unesc(t.path).replace(/^.*[\\/]/, '')); (byBase.get(b) || byBase.set(b, []).get(b)).push(t);
  }
  return { ...idx, byTA, byTitle, byBase };
}
export function matchForeign(s, idx, taken) {
  const hit = matchSong(s, idx, taken); if (hit) return hit;
  const pick = l => (l && l.length ? (taken && l.find(t => !taken.has(t.id))) || l[0] : null);
  if (s.path) {   // an absolute path from another phone / PC: the library path is its tail
    const full = norm(String(s.path).replace(/\\/g, '/')), l = idx.byBase.get(norm(String(s.path).replace(/^.*[\\/]/, '')));
    if (l && l.length) { const tail = l.filter(t => full.endsWith(norm(unesc(t.path).replace(/\\/g, '/')))).sort((a, b) => b.path.length - a.path.length); if (tail.length) return pick(tail); if (l.length === 1) return l[0]; }
  }
  if (s.title) {
    const ti = loose(s.title), a = pick(idx.byTA.get(ti + '\u0001' + firstArtist(s.artist))); if (a) return a;
    if (!s.artist) { const l = idx.byTitle.get(ti); if (l && l.length === 1) return l[0]; }
  }
  return null;
}
const sameIds = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
/** Like plexport.planImport but with the looser matching.
 *  v159: `existing` = [{ name, ids }] of the playlists already in the app. A list with the same name AND the same songs in the same order is not added again (it is listed in `already`), so importing the same file twice adds nothing.
 *  @returns {{ lists: { name: string, ids: string[], total: number, missing: number }[], matched: number, total: number, missing: { list: string, title: string, artist: string }[], already: { name: string, count: number }[] }} */
export function planForeign(imported, tracks, artistAlbumOf, existingNames, existing = []) {
  const idx = makeForeignIndex(tracks, artistAlbumOf), names = new Set(existingNames.map(nameKey));
  const sameName = new Map();
  for (const e of existing || []) { const k = norm(e.name); if (!sameName.has(k)) sameName.set(k, []); sameName.get(k).push(e.ids || []); }
  let matched = 0, total = 0; const missing = [], already = [], lists = [];
  for (const p of imported) {
    const ids = [], taken = new Set(), miss = [];
    for (const s of p.songs) { total++; const t = matchForeign(s, idx, taken); if (t) { matched++; ids.push(t.id); taken.add(t.id); } else miss.push({ list: p.name, title: s.title, artist: s.artist }); }
    missing.push(...miss);
    if (!ids.length) continue;   // BUG-303: a list with no matched song is not created as an empty playlist
    if ((sameName.get(norm(p.name)) || []).some(x => sameIds(x, ids))) { already.push({ name: p.name, count: ids.length }); continue; }
    lists.push({ name: freeName(p.name, names), raw: p.name, ids, total: p.songs.length, missing: miss.length });   // raw: the name in the file (the final name is chosen when the import is applied)
  }
  return { lists, matched, total, missing, already };
}
/** v159: an imported list merged INTO an existing playlist: its songs go to the end, in order; songs already in that playlist are not repeated. `added` = how many were new. */
export function mergeIds(existing, ids) {
  const have = new Set(existing), out = [...existing]; let added = 0;
  for (const id of ids) if (!have.has(id)) { have.add(id); out.push(id); added++; }
  return { ids: out, added };
}
/** v159: the songs that were not found in the library, as a CSV (playlist, title, artist) so they can be searched for or fixed later. */
export function missingCsv(missing, now = new Date()) {
  const rows = [['Playlist', 'Track', 'Artist']];
  for (const m of missing || []) rows.push([m.list, m.title, m.artist]);
  return { name: `liquid-dark-missing-songs-${stamp(now)}.csv`, mime: 'text/csv', text: csvText(rows) };
}
export const summaryForeign = ({ lists, matched, total, already = [] }) => `Imported ${lists.length} playlist${lists.length === 1 ? '' : 's'}: ${matched} of ${total} songs matched` + (already.length ? ` · ${already.length} already in the app` : '');

/** BUG-88 / 301: only file:// addresses are percent-encoded; a plain path is a literal name */
function pathOf(x) { return /^file:/i.test(String(x)) ? decodePath(stripFile(x)) : stripFile(x); }
