// Track ids are a hash of the document URI (data.js). If Android returns different URIs when the music folder is picked
// again (another provider id, a parent or sub folder, a re-mounted SD card), saved ids no longer match any song.
// Fix: remember each saved id's folder-relative PATH in store 'idkeys' ({ trackId: "album/01 song.flac" }); when an id is
// dead but its path matches exactly one song now, move the favorite / play count / playlist entry to that song's new id.
// Pure (no DOM, no Native): main.js does the loading and saving.
export const IDKEYS_FILE = 'idkeys';

/** The URI-independent identity of a track: its path inside the picked folder, lower-case, "/" separated. '' = unknown. */
export const keyOf = t => String((t && t.path) || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();

/** Clean a value read from disk: { id: non-empty key string }. Anything else = {}. */
export function cleanKeys(x) {
  const out = {};
  if (!x || typeof x !== 'object' || Array.isArray(x)) return out;
  for (const [id, k] of Object.entries(x)) if (id && typeof k === 'string' && k) out[id] = k;
  return out;
}

const hasSlash = k => k.includes('/');

/** Find the one current track that is the same file as `oldKey`: exact path first, else a path that differs only by the picked
 *  folder level ("Music/A/x.flac" <-> "A/x.flac"). More than one candidate = ambiguous = no match (never guess). */
function findTarget(oldKey, byKey) {
  const exact = byKey.get(oldKey);
  if (exact) return exact.length === 1 ? exact[0] : null;
  if (!hasSlash(oldKey)) return null;
  let hit = null, n = 0;
  for (const [k, list] of byKey) {
    if (!hasSlash(k)) continue;
    const longer = oldKey.endsWith('/' + k), shorter = k.endsWith('/' + oldKey);
    if (!longer && !shorter) continue;
    const extra = longer ? oldKey.slice(0, oldKey.length - k.length - 1) : k.slice(0, k.length - oldKey.length - 1);
    if (extra.includes('/')) continue;   // BUG-104: only one extra folder level ("Music/A/x" <-> "A/x"), never "Other Artist/Other Album/x"
    n += list.length; hit = list[0]; if (n > 1) return null;
  }
  return n === 1 ? hit : null;
}

/**
 * inp = { favs: [id], stats: { id: {plays, last} }, playlists: [{ ids: [id] }], keys: { id: key } }.
 * Returns new objects (the input is not changed) plus flags saying what changed:
 * { favs, stats, playlists, keys, favsChanged, statsChanged, playlistsChanged, keysChanged, moved }.
 */
export function relinkIds(inp, tracks) {
  const favs0 = inp.favs || [], stats0 = inp.stats || {}, pls0 = inp.playlists || [], keys0 = inp.keys || {};
  const pics0 = Array.isArray(inp.pics) ? inp.pics : [];   // BUG-123: ids that have a custom song picture
  const res = { favs: favs0, stats: stats0, playlists: pls0, keys: keys0, favsChanged: false, statsChanged: false, playlistsChanged: false, keysChanged: false, moved: 0, picMoves: [] };
  if (!tracks || !tracks.length) return res;   // nothing scanned (folder missing / SD card out): change nothing

  const live = new Map(), byKey = new Map();
  for (const t of tracks) { live.set(t.id, t); const k = keyOf(t); if (k) { const l = byKey.get(k); if (l) l.push(t); else byKey.set(k, [t]); } }

  const used = new Set(favs0);
  for (const id of pics0) used.add(id);   // song pictures follow the song like favourites do
  for (const id of Object.keys(stats0)) used.add(id);
  for (const p of pls0) for (const id of (p.ids || [])) used.add(id);

  // 1) remember the path of every saved id that is in the library right now; 2) work out where dead ids moved to
  const keys = { ...keys0 }, remap = new Map();
  for (const id of used) {
    const t = live.get(id);
    if (t) { const k = keyOf(t); if (k && keys[id] !== k) { keys[id] = k; res.keysChanged = true; } continue; }
    const old = keys0[id]; if (!old) continue;
    const target = findTarget(old, byKey);
    if (target && target.id !== id) remap.set(id, target);
  }

  if (remap.size) {
    const to = id => (remap.has(id) ? remap.get(id).id : id);
    const favs = []; const seen = new Set();
    for (const id of favs0) { const n = to(id); if (!seen.has(n)) { seen.add(n); favs.push(n); } }
    if (favs.length !== favs0.length || favs.some((id, i) => id !== favs0[i])) { res.favs = favs; res.favsChanged = true; }

    const stats = {};
    for (const [id, v0] of Object.entries(stats0)) {
      if (id === '__proto__' || !v0 || typeof v0 !== 'object') continue;   // BUG-376 / BUG-377
      const v = { ...v0, plays: +v0.plays || 0, last: +v0.last || 0 };   // keeps pg / nat (stats.js bookkeeping)
      const n = to(id), c = stats[n];
      stats[n] = c ? { ...c, plays: c.plays + v.plays, last: Math.max(c.last, v.last) } : v;
    }
    if (Object.keys(stats).some(id => !stats0[id]) || Object.keys(stats).length !== Object.keys(stats0).length) { res.stats = stats; res.statsChanged = true; }

    const pls = pls0.map(p => { if (!p || !Array.isArray(p.ids)) return p; const ids = (p.ids || []).map(to); return ids.some((id, i) => id !== p.ids[i]) ? { ...p, ids } : p; });
    if (pls.some((p, i) => p !== pls0[i])) { res.playlists = pls; res.playlistsChanged = true; }

    for (const [id, t] of remap) { delete keys[id]; keys[t.id] = keyOf(t); }
    res.keysChanged = true; res.moved = remap.size;
    const picSet = new Set(pics0);
    res.picMoves = [...remap].filter(([id]) => picSet.has(id)).map(([id, t]) => [id, t.id]);
  }

  // keep the key file small: only ids that are still saved somewhere
  const stillUsed = new Set([...res.favs, ...pics0]); for (const id of Object.keys(res.stats)) stillUsed.add(id); for (const p of res.playlists) for (const id of (p.ids || [])) stillUsed.add(id);
  for (const id of Object.keys(keys)) if (!stillUsed.has(id)) { delete keys[id]; res.keysChanged = true; }
  res.keys = keys;
  return res;
}
