import { songArtists, splitArtists, isPlainName, artistKey, PROTECTED_KEYS } from './artistnames.js';
import { normalizePics } from './plpics.js';
import { wide } from './idhash.js';
// DEMO LIBRARY. Replace with the real library from LiquidNative.scan() (see docs/HANDOFF.md, ticket T3).
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const UN = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
/** Inverse of esc(), in ONE pass (so stored "&amp;lt;" becomes "&lt;", not "<"). */
export const unesc = s => String(s ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (m, k) => UN[k]);
const g = (a, b) => `linear-gradient(145deg, var(${a}), var(${b}))`;   // demo colours live in styles/tokens.css
export let albums = [
  { id:'a1', title:'Quiet Engines',   artist:'Juno & the Reeds', year:2024, genre:'Indie',      g:g('--demo-1a','--demo-1b') },
  { id:'a2', title:'Northbound',      artist:'The Lantern Club', year:2022, genre:'Rock',       g:g('--demo-2a','--demo-2b') },
  { id:'a3', title:'Velvet Circuit',  artist:'Mira Sol',         year:2023, genre:'Electronic', g:g('--demo-3a','--demo-3b') },
  { id:'a4', title:'Afterglow Atlas', artist:'Orin Hale',        year:2021, genre:'Ambient',    g:g('--demo-4a','--demo-4b') },
  { id:'a5', title:'Red Room Sessions',artist:'Kira Vale',       year:2023, genre:'Jazz',       g:g('--demo-5a','--demo-5b') },
  { id:'a6', title:'Neon Harbor',     artist:'Kira Vale',        year:2024, genre:'Pop',        g:g('--demo-6a','--demo-6b') },
  { id:'a7', title:'Glass Hours',     artist:'Mira Sol',         year:2020, genre:'Electronic', g:g('--demo-7a','--demo-7b') },
  { id:'a8', title:'Paper Moons',     artist:'The Lantern Club', year:2019, genre:'Rock',       g:g('--demo-8a','--demo-8b') },
];
const T = (id, album, title, dur, bits=16, khz=44.1, lyric='') => ({ id, albumId:album, title, dur, bits, khz, lyric });
export let tracks = [
  T('t1','a1','Tidewater Lights',245,16,44.1,'Tidewater, carry us home'),
  T('t2','a1','Static Bloom',201), T('t3','a1','Paper Engine',253),
  T('t4','a2','North Bound',260,16,44.1,'Tidewater, carry us home'), T('t5','a2','Lamp Posts',188),
  T('t6','a3','Velvet Hours',199,24,96), T('t7','a3','Circuit Rain',231,24,96),
  T('t8','a4','Afterglow',312,24,192), T('t9','a4','Atlas Drift',274,24,192),
  T('t10','a5','Red Engine',208,24,96,'Red tail lamps along the avenue'), T('t11','a5','Paper Engine II',261,24,96),
  T('t12','a5','After Drift',204,24,96), T('t13','a5','Static Moon',257,24,96), T('t14','a5','Harbor Room',200,24,96),
  T('t15','a6','Tide Hours',223,24,96,'Windows down and the radio low'), T('t16','a6','Neon Glow',276,24,96,'Every mile a softer promise'),
  T('t17','a6','Satin Engine',243,24,96), T('t18','a7','Glass Hours',217,24,96), T('t19','a7','Glasswork',231,24,96),
  T('t20','a8','Paper Bound',216,16,44.1,'I keep your number in the static'),
];
albums = albums.map(a => ({ ...a, title: esc(a.title), artist: esc(a.artist), genre: esc(a.genre) }));
tracks = tracks.map(t => { const a = albums.find(x => x.id === t.albumId); const title = esc(t.title); return { ...t, title, lyric: esc(t.lyric), path: `Music/${a.artist}/${a.title}/${title}.flac` }; });
let albumById = new Map(), trackById = new Map(), albumTrackMap = new Map();
const trackOrder = (x, y) => (x.disc || 1) - (y.disc || 1) || (x.no || 0) - (y.no || 0);
/** Rebuilds the id lookups (call after albums / tracks change) so lookups inside loops are O(1). */
function reindex() {
  albumById = new Map(albums.map(a => [a.id, a])); trackById = new Map(tracks.map(t => [t.id, t])); albumTrackMap = new Map();
  tracks.forEach(t => { const l = albumTrackMap.get(t.albumId); if (l) l.push(t); else albumTrackMap.set(t.albumId, [t]); });
  albumTrackMap.forEach(l => l.sort(trackOrder));
}
reindex();
export const byAlbum = id => albumById.get(id);
export const albumTracks = id => (albumTrackMap.get(id) || []).slice();
export let artists = [...new Set(albums.map(a => a.artist))];
export let genres = [
  { n:'Pop', c:'--v-pink' }, { n:'Indie', c:'--v-blue' }, { n:'Ambient', c:'--v-orange' },
  { n:'Electronic', c:'--v-green' }, { n:'Jazz', c:'--v-yellow' }, { n:'Rock', c:'--v-magenta' },
].map(x => ({ ...x, count: tracks.filter(t => byAlbum(t.albumId).genre === x.n).length }));
export let playlists = [
  { id:'p1', name:'Late Night', ids:['t6','t8','t18','t10','t15','t7'] },
  { id:'p2', name:'Red Room Favorites', ids:['t10','t11','t12','t13','t14'] },
  { id:'p3', name:'Road Trip', ids:['t1','t4','t16','t20','t3','t5','t9','t2'] },
];
export const mmss = s => (s = Number.isFinite(s) && s > 0 ? s : 0, `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`);   // BUG-350
export const quality = t => t.fmt && t.fmt !== 'FLAC'
  ? `${t.fmt}${t.kbps ? ` ${t.kbps} kbps` : ''}${t.khz ? ` / ${t.khz} kHz` : ''}`   // MP3 / AAC: no bit depth
  : `FLAC${t.bits ? ` ${t.bits}-bit` : ''}${t.khz ? ` / ${t.khz} kHz` : ''}`;   // BUG-349

/* ---------- real library (T3): replaces the demo data with what LiquidNative.scan() returns ---------- */
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const hex = (h, s, l) => { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); };
export function relPath(uri) {
  try {
    const m = String(uri).match(/\/tree\/([^/]+)\/document\/(.+)$/); if (!m) return '';
    const tree = decodeURIComponent(m[1]), doc = decodeURIComponent(m[2]);
    const rel = doc.startsWith(tree) ? doc.slice(tree.length) : doc.split(':').slice(1).join(':');
    return rel.replace(/^\/+/, '');
  } catch { return ''; }
}
const discDir = d => d.replace(/\/(cd|disc|disk)\s*\d+[^/]*$/i, '');   // "Album/CD2" belongs to "Album"
const dirKey = uri => discDir(relPath(uri).split('/').slice(0, -1).join('/')).toLowerCase();
const mostCommon = (list, skip = '') => { const m = new Map(); list.forEach(x => { if (x && x !== skip) m.set(x, (m.get(x) || 0) + 1); }); let best = '', n = 0; m.forEach((c, k) => { if (c > n) { best = k; n = c; } }); return best; };
/** C4: "A feat. B" / "A (ft. B)" -> "A" (the main artist of a track artist or of an old cached album artist). */
const mainOf = s => String(s || '').replace(/\s*[(\[]\s*(?:feat\.?|ft\.?|featuring)\s[^)\]]*[)\]]?/gi, '').replace(/\s+(?:feat\.?|ft\.?|featuring)\s.*$/i, '').trim();
const pickMain = list => { const m = new Map(); list.forEach(x => { if (x) m.set(x, (m.get(x) || 0) + 1); }); let best = '', n = 0; m.forEach((c, k) => { if (c > n || (c === n && k.length < best.length)) { best = k; n = c; } }); return best; };
/** C6: "Rock; Pop" -> ['Rock', 'Pop'] (also " / "); nothing -> ['Unknown']. */
const splitGenre = raw => { const seen = new Set(), out = []; String(raw || '').split(/\s*;\s*|\s+\/\s+/).map(x => x.trim()).filter(Boolean).forEach(x => { const k = x.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(x); } }); return out.length ? out : ['Unknown']; };
/** v95: a song with no lyrics of its own borrows them from another copy of the same song (same title + main artist, length within 3 s), e.g. the FLAC and the MP3 of one track.
 *  Sets t.twinUri / t.twinLrc (to load the lyrics) and fills t.lyric (lyrics search). Copies that have their own lyrics or .lrc are never touched. */
const VERSION_WORDS = new Set(['remix', 'rmx', 'remixed', 'mix', 'live', 'acoustic', 'instrumental', 'inst', 'vip', 'demo', 'cover', 'sped', 'slowed', 'reverb', 'nightcore', 'karaoke', 'cappella', 'acapella', 'bootleg', 'rework', 'reworked', 'flip', 'unplugged', 'session', 'reprise', 'dub', 'edit', 'extended', 'stripped', 'piano', 'orchestral', 'mashup', 'interlude', 'skit', 'intro', 'outro']);
/** Version words of a title ("remix", "live" ...); "" = the plain recording. "Original Mix" / "Original Version" do not count. */
export const versionMarks = t => String(t || '').toLowerCase().replace(/original (mix|version)/g, ' ').split(/[^\p{L}\p{N}]+/u).filter(w => VERSION_WORDS.has(w)).sort().join(',');
/** Title without harmless extras: "(feat. X)", "(Remastered 2011)", "(Album Version)", " - 2011 Remaster". A bracket that names a real version (remix, live ...) stays. */
export function cleanTitle(t) {
  let r = String(t || '').replace(/\s*[(\[]([^)\]]*)[)\]]/g, (m, inner) => {
    const l = inner.toLowerCase();
    return !versionMarks(l) && (/^\s*(feat|ft|featuring|prod)\b/.test(l) || /\b(remaster(ed)?|album version|single version|original version|original mix|mono|stereo|explicit|deluxe)\b/.test(l)) ? '' : m;
  });
  if (!versionMarks(r)) r = r.replace(/\s+-\s+(\d{4}\s+)?(digital\s+)?remaster(ed)?(\s+\d{4})?\s*$/i, '').replace(/\s+-\s+(feat|ft)\.?\s.*$/i, '');
  return r.trim();
}
const nameKey = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
export function lyricTwins(list) {
  const groups = new Map();
  list.forEach(t => { const k = nameKey(cleanTitle(t.title)) + '|' + versionMarks(t.title) + '|' + nameKey(mainOf(String(t.trackArtist || '').split(/\s*;\s*/)[0])); if (nameKey(cleanTitle(t.title)).length < 2) return; let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(t); });
  groups.forEach(g => {
    if (g.length < 2) return;
    g.forEach(t => {
      if (t.lrc || t.lyric) return;
      const src = g.find(o => o !== t && (o.lrc || o.lyric) && Math.abs((o.dur || 0) - (t.dur || 0)) <= 3);
      if (src) { t.twinUri = src.uri; t.twinLrc = src.lrc || ''; t.lyric = src.lyric || t.lyric; }
    });
  });
}
export function setLibrary(raw) {
  raw = (raw || []).filter(r => r && typeof r === 'object');   // BUG-354: one bad row must not empty the whole library refresh
  // C7: two albums with the same name in one folder are split only when their album-artist TAGS really differ (a missing tag or a "feat." never splits)
  const gAA = new Map(), aaKey = r => r.aaTag === true ? mainOf((r.albumArtist || '').trim()).toLowerCase() : '';
  raw.forEach(r => { const gk = dirKey(r.uri) + '|' + esc(r.album).toLowerCase(), k = aaKey(r); if (!k) return; let m = gAA.get(gk); if (!m) gAA.set(gk, m = new Map()); m.set(k, (m.get(k) || 0) + 1); });
  const aaBest = gk => { let b = '', n = 0; (gAA.get(gk) || new Map()).forEach((c, k) => { if (c > n) { b = k; n = c; } }); return b; };
  const am = new Map(), ts = [], aIds = new Set(), tIds = new Set(), meta = new Map();
  const uniq = (used, id) => { let u = id, n = 1; while (used.has(u)) u = id + '_' + (n++); used.add(u); return u; };   // a 32-bit hash can collide: keep ids unique
  const idBase = uri => { const p = relPath(uri).replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase(); return p || String(uri); };   // BUG-123: the id comes from the folder-relative PATH, not the full URI: picking the same folder again (other provider id, re-mounted SD card) gives the SAME ids, so favourites, plays, playlists, custom pictures and listening history all stay attached
  const tidOf = new Map(); [...raw].sort((x, y) => { const a = idBase(x.uri), b = idBase(y.uri); return a < b ? -1 : a > b ? 1 : (x.uri < y.uri ? -1 : x.uri > y.uri ? 1 : 0); }).forEach(r => tidOf.set(r.uri, uniq(tIds, 't' + wide(idBase(r.uri)))));   // BUG-59: a hash collision is settled in path order, not scan order
  raw.forEach(r => {
    // ONE album = same album tag in the same folder: a "feat." artist or a missing album-artist tag no longer splits it in two
    const name = esc(r.album), gk = dirKey(r.uri) + '|' + name.toLowerCase(), key = (gAA.get(gk) || { size: 0 }).size > 1 ? gk + '|' + (aaKey(r) || aaBest(gk)) : gk;
    let a = am.get(key);
    if (!a) { const h = parseInt(hash(key), 36) % 360; a = { id: uniq(aIds, 'a' + wide(key)), title: name, artist: '', year: r.year || '', genre: esc(r.genre || 'Unknown'), g: `linear-gradient(145deg, ${hex(h, 80, 62)}, ${hex((h + 40) % 360, 70, 22)})`, added: 0, g0: '', cover: '', coverPath: '' }; a.g0 = a.g; am.set(key, a); meta.set(a, { aa: [], ar: [], cv: [], tr: [], yr: [] }); }
    const m = meta.get(a); m.aa.push(mainOf((r.albumArtist || '').trim())); m.ar.push((r.artist || '').trim()); m.yr.push(r.year || ''); if (r.cover) m.cv.push([r.cover, r.coverPath || '']);
    const t = { id: tidOf.get(r.uri), uri: r.uri, path: esc(relPath(r.uri)), albumId: a.id, title: esc(r.title), composer: esc((r.composer || '').trim()), trackArtist: esc((r.artist || '').trim() || 'Unknown Artist'), dur: r.dur, bits: r.bits, khz: r.khz, fmt: r.fmt || 'FLAC', kbps: r.kbps || 0, lyric: esc(r.lyric), no: r.track || 0, disc: r.disc || 1, discTag: r.disc || 0, year: r.year || 0, genre: '', gRaw: splitGenre(r.genre), added: r.added || 0, cover: r.cover || '', coverPath: r.coverPath || '', lrc: r.lrc || '' };
    if (t.added > a.added) a.added = t.added;
    m.tr.push(t); ts.push(t);
  });
  // C5 + C6: every song keeps ITS OWN genres (case-insensitive, "A; B" split); the album shows its most common one
  const gcase = new Map();
  ts.forEach(t => t.gRaw.forEach(n => { const k = n.toLowerCase(); let c = gcase.get(k); if (!c) gcase.set(k, c = new Map()); c.set(n, (c.get(n) || 0) + 1); }));
  const gname = new Map(); gcase.forEach((c, k) => { let b = '', n = 0; c.forEach((v, nm) => { if (v > n) { b = nm; n = v; } }); gname.set(k, esc(b)); });
  ts.forEach(t => { t.genres = [...new Set(t.gRaw.map(n => gname.get(n.toLowerCase())))]; t.genre = t.genres[0]; delete t.gRaw; });
  am.forEach(a => {   // album artist = most common album-artist tag, else the shortest track artist (the main one, without "feat.")
    const m = meta.get(a), aa = mostCommon(m.aa), ar = pickMain(m.ar.map(mainOf));
    a.genre = mostCommon(m.tr.map(t => t.genre)) || 'Unknown';
    a.year = mostCommon(m.yr) || '';   // Bug 8: the year most songs agree on (not just the first song read, which may have no year)
    a.artist = esc(aa || ar || 'Unknown Artist');
    a.trackArtist = esc((ar || aa || 'Unknown Artist').split(/\s*;\s*/)[0]);   // v64: the main performing artist (Sort albums by Artist), apart from the album-artist tag
    a.composer = mostCommon(m.tr.map(t => t.composer));   // v64: Sort albums by Composer ('' = no tag)
    // cover = the picture most of the album's songs share (so one odd song with a single's art cannot win); ties go to the first song
    const c = new Map(); m.cv.forEach(([u, p]) => { const e = c.get(u); if (e) e.n++; else c.set(u, { n: 1, p }); });
    let best = null; c.forEach((e, u) => { if (!best || e.n > best.n) best = { n: e.n, u, p: e.p }; });
    if (best) { a.cover = best.u; a.coverPath = best.p; a.g = `url('${String(best.u).replace(/['"()\\\s%]/g, ch => '%' + ch.charCodeAt(0).toString(16).padStart(2, '0'))}') center/cover no-repeat, ${a.g0}`; }
  });
  lyricTwins(ts);
  ts.sort((x, y) => x.title.localeCompare(y.title));
  albums = [...am.values()].sort((x, y) => x.title.localeCompare(y.title));
  tracks = ts; if (!plLoaded) playlists = []; reindex();   // v208: only the built-in demo playlists are dropped here. Playlists that were already loaded (or imported) are the person's own: the library loading AFTER them used to wipe them from memory (they were still in the file, but Library showed none, and the next save overwrote the file)
  buildArtistIndex();
  const gc = ['--v-pink', '--v-blue', '--v-orange', '--v-green', '--v-yellow', '--v-magenta'];
  const gcount = new Map(); tracks.forEach(t => t.genres.forEach(n => gcount.set(n, (gcount.get(n) || 0) + 1)));
  genres = [...gcount.keys()].sort((x, y) => x.localeCompare(y)).map(n => ({ n, c: gc[parseInt(hash(String(n).toLowerCase()), 36) % gc.length], count: gcount.get(n) }))   /* BUG-235: colour follows the name, not the alphabetical position */;
}

/* ---------- T5: genres, folders, artists ---------- */
export const genreTracks = n => tracks.filter(t => (t.genres || [(byAlbum(t.albumId) || {}).genre]).includes(n));   // the song's OWN genres (demo songs fall back to their album)
export const genreAlbums = n => { const ids = new Set(genreTracks(n).map(t => t.albumId)); return albums.filter(a => ids.has(a.id)); };
/* v54: artist index. An artist is every name in a song's tags (artist, "feat." in the title or artist tag, album artist), not only album artists. */
let artistMap = new Map();   // lower-case raw name -> { name (escaped), ids:Set, added }
let songNames = new Map();   // track id -> [escaped artist names]
/* Smart artist grouping (Settings > Smart artist grouping, on by default). On: spellings of one artist are ONE artist ("Lily Rose Depp" / "Lily-Rose Depp", "The Weeknd" / "Weeknd"),
 * and a collab credit ("Maluma, The Weeknd", "Metro Boomin, The Weeknd, Diddy, 21 Savage") is split into its artists instead of being listed as a made-up artist of its own.
 * Off: the old behaviour (exact names, case ignored). */
let smart = true;
export const smartArtists = () => smart;
/** v159: what the home screen stats widgets need to split "A, B" / "A & B" like the app (they cannot read the library): the grouping mode, the names known to be ONE artist (library + listening history, keys in the same mode), and the acts that are never split. */
export const widgetArtists = () => ({ smart, known: [...knownLib, ...histKnown], protect: [...PROTECTED_KEYS] });
export function setSmartArtists(on) { on = on !== false; if (on === smart) return false; smart = on; buildArtistIndex(); return true; }
let knownLib = new Set();   // v158: the `known` set of the last index build (history names are split with it too)
let histKnown = new Set(), snapCache = new Map(), knownAll = null;   // names seen as ONE plain artist in the listening history; snapshot -> artists cache
/** v158: listening history of songs that are NOT in this library (imported from Tempo, Last.fm, Spotify... or songs deleted since) used to show each raw tag as an artist of its own
 *  ("Sean Paul, Keyshia Cole", "The Weeknd feat. Ed Sheeran", "Weeknd" next to "The Weeknd"). learnArtists() lets the history teach which names are single artists;
 *  snapshotArtists() then applies the SAME rules as the library (split, merge spellings, shown spelling) to a stored tag. Smart grouping off: the tag stays as it is. Returns escaped names. */
export function learnArtists(raw) {
  const before = histKnown.size;
  for (const r of raw || []) { const n = String(r || '').trim(); if (n && isPlainName(n)) histKnown.add(artistKey(n)); }
  if (histKnown.size !== before) { snapCache.clear(); knownAll = null; }
}
export function snapshotArtists(artist, title, albumArtist) {
  const key = artist + '\u0001' + title + '\u0001' + albumArtist + (smart ? '1' : '0'), hit = snapCache.get(key); if (hit) return hit.slice();
  let out;
  if (!smart) out = [esc(String(artist || '').trim() || 'Unknown Artist')];
  else {
    if (!knownAll) knownAll = new Set([...knownLib, ...histKnown]);
    let known = knownAll;
    // a credit list whose first name is the album artist ("Eurythmics, Annie Lennox, Dave Stewart" on an album by Eurythmics) is a list of artists: every piece counts as known (Tempo's backups name the primary artist this way)
    const pieces = String(artist || '').split(/\s*,\s*/).filter(Boolean);
    if (pieces.length > 1 && albumArtist && isPlainName(albumArtist) && artistKey(albumArtist) === artistKey(pieces[0]) && !PROTECTED_KEYS.has(artistKey(artist))) { const ex = new Set(pieces.map(artistKey)); known = { has: k => knownAll.has(k) || ex.has(k) }; }
    out = []; const seen = new Set();
    if (PROTECTED_KEYS.has(artistKey(artist))) albumArtist = '';   // "Tyler, The Creator" is one act: an album artist of "Tyler" (a source that cut the name at the comma) is not a second artist
    for (const n of songArtists(artist, title, albumArtist, known, { keyOf: artistKey, protect: PROTECTED_KEYS })) {
      const k = artistKey(n); if (seen.has(k)) continue; seen.add(k);
      out.push((artistMap.get(k) || {}).name || esc(n));   // the library's shown spelling when the artist exists there
    }
    if (!out.length) out = [esc(String(artist || '').trim() || 'Unknown Artist')];
  }
  if (snapCache.size > 20000) snapCache.clear();
  snapCache.set(key, out); return out.slice();
}
let variants = new Map();   // key -> Set of escaped spellings that were merged into one artist (custom pictures saved under an old spelling are still found)
/** The artist's name as shown now (escaped), or '' when there is no such artist: an old spelling of a merged artist gives the shown spelling. */
export const artistName = n => (artistMap.get(akey(n)) || {}).name || '';
export const artistVariants = n => [...(variants.get(akey(n)) || [])];
const akey = n => (smart ? artistKey(unesc(n)) : unesc(n).trim().toLowerCase());
function buildArtistIndex() {
  artistMap = new Map(); songNames = new Map(); variants = new Map();
  const keyOf = smart ? artistKey : s => String(s).trim().toLowerCase(), opt = smart ? { keyOf, protect: PROTECTED_KEYS } : null;
  const known = new Set(); knownLib = known; knownAll = null; snapCache.clear();   // keys of names that are certainly ONE artist: plain tags (no separator) of albums and songs
  albums.forEach(a => { if (!smart || isPlainName(unesc(a.artist))) known.add(keyOf(unesc(a.artist))); });
  tracks.forEach(t => { if (t.trackArtist && isPlainName(unesc(t.trackArtist))) known.add(keyOf(unesc(t.trackArtist))); });
  const split = t => { const a = albumById.get(t.albumId) || {}; return songArtists(unesc(t.trackArtist), unesc(t.title), unesc(a.artist), known, opt); };
  if (smart) for (let pass = 0; pass < 2; pass++) tracks.forEach(t => { const n = split(t); if (n.length > 1) n.forEach(x => known.add(keyOf(x))); });   // every artist found on a collab becomes known for the next collab ("Maluma" after "Maluma, The Weeknd")
  const rows = tracks.map(t => { const a = albumById.get(t.albumId) || {}; const names = split(t).map(esc); if (!names.length) names.push(a.artist || 'Unknown Artist'); return [t, names]; });
  const spell = new Map();   // key -> Map(spelling -> songs): the most used spelling is the name shown
  if (smart) rows.forEach(([, names]) => names.forEach(n => { const k = akey(n); let m = spell.get(k); if (!m) spell.set(k, m = new Map()); m.set(n, (m.get(n) || 0) + 1); }));
  const shown = new Map();
  spell.forEach((m, k) => { let best = '', c = -1; m.forEach((v, n) => { if (v > c || (v === c && n.length > best.length)) { best = n; c = v; } }); shown.set(k, best); variants.set(k, new Set(m.keys())); });
  rows.forEach(([t, names]) => {
    const out = []; names.forEach(n => { const k = akey(n), nm = smart ? shown.get(k) : n; if (!out.some(x => akey(x) === k)) out.push(nm); });
    songNames.set(t.id, out);
    out.forEach(n => { const k = akey(n); let e = artistMap.get(k); if (!e) artistMap.set(k, e = { name: n, ids: new Set(), added: 0 }); e.ids.add(t.id); e.added = Math.max(e.added, t.added || 0); });
  });
  const withSongs = new Set(tracks.map(t => t.albumId));
  albums.forEach(a => {   // an album with no tagged songs still has its artist
    if (smart) { if (withSongs.has(a.id)) return; splitArtists(unesc(a.artist), known, keyOf, PROTECTED_KEYS).forEach(n => { const k = akey(n); if (!artistMap.has(k)) artistMap.set(k, { name: esc(n), ids: new Set(), added: 0 }); }); return; }
    const k = akey(a.artist); if (a.artist && !artistMap.has(k)) artistMap.set(k, { name: a.artist, ids: new Set(), added: 0 });
  });
  artists = [...artistMap.values()].map(e => e.name).sort((x, y) => x.localeCompare(y));
}
/** All artists on one song (escaped names): the first one is the main artist. */
export const trackArtists = t => (songNames.get(t.id) || [trackAlbumArtist(t)]).slice();
const trackAlbumArtist = t => (albumById.get(t.albumId) || {}).artist || 'Unknown Artist';
/** Number of songs and newest "added" time of an artist (for the Artists list). */
export const artistInfo = n => { const e = artistMap.get(akey(n)); return e ? { count: e.ids.size, added: e.added } : { count: 0, added: 0 }; };
/** Every song the artist is on (own albums AND features), newest album first. */
export const artistTracks = n => { const e = artistMap.get(akey(n)); if (!e) return [];
  return albums.filter(a => albumTrackMap.has(a.id)).slice().sort((x, y) => (y.year || 0) - (x.year || 0)).flatMap(a => albumTracks(a.id).filter(t => e.ids.has(t.id))); };
buildArtistIndex();   // demo library
export const dirOf = t => (t.path || '').split('/').filter(Boolean).slice(0, -1).join('/');   // BUG-353: "a//b/x.flac" is folder "a/b" (no unnamed sub-folder)
/** Immediate sub-folders (with song counts) and the songs directly inside `dir` ('' = the music folder). */
export function folderEntries(dir) {
  const subs = new Map(), files = [];
  tracks.forEach(t => {
    const d = dirOf(t);
    if (d === dir) files.push(t);
    else if (!dir || d.startsWith(dir + '/')) { const n = (dir ? d.slice(dir.length + 1) : d).split('/')[0]; if (n) subs.set(n, (subs.get(n) || 0) + 1); }
  });
  files.sort((x, y) => (x.disc || 1) - (y.disc || 1) || (x.no || 0) - (y.no || 0) || x.title.localeCompare(y.title));
  return { subs: [...subs].sort((x, y) => x[0].localeCompare(y[0])).map(([name, count]) => ({ name, count, path: dir ? dir + '/' + name : name })), files };
}

/* ---------- T4c step 4: Recently Added (newest file date first; demo data keeps its order) ---------- */
export const recentAlbums = n => (albums.some(a => a.added) ? albums.slice().sort((x, y) => (y.added || 0) - (x.added || 0)) : albums).slice(0, n);

/* ---------- T6: playlists. `playlists` is a live binding: main.js mutates it, then Native.savePlaylists() persists it ---------- */
let plLoaded = false;   // v208: true once setPlaylists() ran (the saved playlists are in memory)
export const setPlaylists = list => { plLoaded = true; playlists = (list || []).filter(p => p && typeof p === 'object').map(p => ({ id: String(p.id), name: esc(p.name ?? ''), ids: Array.isArray(p.ids) ? p.ids.slice() : [], pics: normalizePics(p.pics) })); };   // v132: pics = descriptions of the playlist's pictures / GIFs (the pictures live in IndexedDB, plpics.js)
export const plTracks = p => p.ids.map(i => trackById.get(i)).filter(Boolean);   // ids of deleted files are skipped, not crashed on
/** Bug 2: positions in p.ids of the rows plTracks(p) shows (same order). Row i of the screen = p.ids[plPositions(p)[i]], correct even when a song is in the list twice or an id was skipped. */
export const plPositions = p => { const out = []; p.ids.forEach((id, k) => { if (trackById.has(id)) out.push(k); }); return out; };
export const savablePlaylists = () => playlists.map(p => { const o = { id: p.id, name: unesc(p.name), ids: p.ids }; const pics = normalizePics(p.pics); if (pics.length) o.pics = pics; return o; });   // v132: pics only when there are some (older files stay identical)   // file stores RAW names
