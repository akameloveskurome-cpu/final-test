// T17: playlist export / import. PURE (no DOM, no Native): everything here is covered by tests/plexport.test.mjs.
// File format (version 1): { app:'liquid-dark', kind:'playlists', version:1, exported:'<ISO date>', playlists:[ { name, songs:[ { id, path, title, artist, album } ] } ] }
// All strings in the file are RAW (not HTML-escaped). Song ids are 't'+hash(uri) and can change after a reinstall with a re-picked folder,
// so import matches by folder-relative path first, then by title+artist+album, and only then by id.

export const KIND = 'playlists';
export const FILE_NAME = 'liquid-dark-playlists.json';

/** Library strings are stored HTML-escaped (data.js); the file must hold raw text. */
export const unesc = s => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Case / accent / spacing-insensitive key for comparing text. */
export const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const normPath = p => norm(String(p ?? '').replace(/\\/g, '/').replace(/^\/+/, ''));
const tagKey = (title, artist, album) => norm(title) + '\u0001' + norm(artist) + '\u0001' + norm(album);

/**
 * Build the export object.
 * @param lists   [{ id, name (RAW), ids:[trackId] }]            (savablePlaylists())
 * @param tracks  library tracks (escaped strings, as in data.js)
 * @param artistAlbumOf  t => ({ artist, album }) for a track (escaped strings)
 */
export function buildExport(lists, tracks, artistAlbumOf, now = new Date()) {
  const byId = new Map(tracks.map(t => [t.id, t]));
  return {
    app: 'liquid-dark', kind: KIND, version: 1, exported: now.toISOString(),
    playlists: lists.map(p => ({
      name: String(p.name),
      songs: p.ids.map(id => {
        const t = byId.get(id);
        if (!t) return { id };   // song no longer in the library: nothing else is known
        const aa = artistAlbumOf(t) || {};
        const s = { id, path: unesc(t.path), title: unesc(t.title), artist: unesc(t.trackArtist || aa.artist), album: unesc(aa.album) };
        if (+t.dur > 0) s.dur = Math.round(+t.dur);   // v159: seconds, so other tools / a later export keep the length
        return s;
      }),
    })),
  };
}

/** Text of an export file (pretty enough to read, small enough to share). */
export const exportText = obj => JSON.stringify(obj, null, 1);

/** Parse + validate an import file. Returns [{ name, songs:[{id,path,title,artist,album}] }] or throws Error with a short user-facing message. */
export function parseImport(text) {
  let o;
  try { o = JSON.parse(String(text).replace(/^\uFEFF/, '')); } catch { throw new Error('Not a playlist file'); }
  const arr = Array.isArray(o) ? o : o && o.kind === KIND ? o.playlists : o && Array.isArray(o.playlists) ? o.playlists : null;   // also accepts the app's own playlists.json
  if (!Array.isArray(arr)) throw new Error('Not a playlist file');
  if (o && !Array.isArray(o) && o.version != null && Number(o.version) > 1) throw new Error('File is from a newer version of the app');
  const out = [];
  for (const p of arr) {
    if (!p || typeof p !== 'object') continue;
    const name = String(p.name ?? '').trim();
    const src = Array.isArray(p.songs) ? p.songs : Array.isArray(p.ids) ? p.ids.map(id => ({ id })) : [];   // playlists.json style: ids only
    const songs = [];
    for (const s of src) {
      if (typeof s === 'string') { songs.push({ id: s, path: '', title: '', artist: '', album: '' }); continue; }
      if (!s || typeof s !== 'object') continue;
      songs.push({ id: String(s.id ?? ''), path: String(s.path ?? ''), title: String(s.title ?? ''), artist: String(s.artist ?? ''), album: String(s.album ?? ''), ...(+s.dur > 0 ? { dur: Math.round(+s.dur) } : {}) });
    }
    out.push({ name: name || 'Imported', songs });
  }
  if (!out.length) throw new Error('No playlists in the file');
  return out;
}

/** Lookup tables over the current library. */
export function makeIndex(tracks, artistAlbumOf) {
  const byPath = new Map(), byTags = new Map(), byId = new Map(), byExact = new Map();
  for (const t of tracks) {
    byId.set(t.id, t);
    const p = normPath(unesc(t.path)); if (p && !byPath.has(p)) byPath.set(p, t);
    const ex = unesc(t.path); if (ex && !byExact.has(ex)) byExact.set(ex, t);   // BUG-219: exact path, case-sensitive
    const aa = artistAlbumOf(t) || {};
    const k = tagKey(unesc(t.title), unesc(t.trackArtist || aa.artist), unesc(aa.album));
    const l = byTags.get(k); if (l) l.push(t); else byTags.set(k, [t]);
  }
  return { byPath, byTags, byId, byExact };
}

/** Find the library song for one imported song. `taken` (Set of ids) prefers a not-yet-used copy when several songs share the same tags. */
export function matchSong(s, idx, taken) {
  if (s.path && idx.byExact && idx.byExact.has(unesc(s.path))) return idx.byExact.get(unesc(s.path));   // BUG-219: exact match first
  const p = normPath(s.path);
  if (p && idx.byPath.has(p)) return idx.byPath.get(p);
  if (s.title) {
    const l = idx.byTags.get(tagKey(s.title, s.artist, s.album));
    if (l && l.length) return (taken && l.find(t => !taken.has(t.id))) || l[0];
  }
  if (s.id && idx.byId.has(s.id)) return idx.byId.get(s.id);
  return null;
}

/** " (2)", " (3)" ... until the name is free (case-insensitive). `names` = Set of norm()ed names in use; the chosen name is added to it. */
/** BUG-220: a name clashes only with the same name in another case / spacing (accents count as different letters). */
export const nameKey = s => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
export function freeName(raw, names) {
  let n = raw, k = 2;
  while (names.has(nameKey(n))) n = `${raw} (${k++})`;
  names.add(nameKey(n));
  return n;
}

/**
 * Match every imported playlist against the library.
 * @returns {{ lists: { name: string, ids: string[] }[], matched: number, total: number }} each name is RAW (already de-clashed), ids are track ids
 * existingNames = RAW names of the playlists already in the app. Never touches them (import only ADDS).
 */
export function planImport(imported, tracks, artistAlbumOf, existingNames) {
  const idx = makeIndex(tracks, artistAlbumOf);
  const names = new Set(existingNames.map(nameKey));
  let matched = 0, total = 0;
  const lists = imported.map(p => {
    const ids = [], taken = new Set();
    for (const s of p.songs) {
      total++;
      const t = matchSong(s, idx, taken);
      if (t) { matched++; ids.push(t.id); taken.add(t.id); }
    }
    return { name: freeName(p.name, names), ids };
  });
  return { lists, matched, total };
}

/** One-line result for the toast. */
export const summary = ({ lists, matched, total }) => `Imported ${lists.length} playlist${lists.length === 1 ? '' : 's'}: ${matched} of ${total} songs matched`;
