// Library model: DEMO data (browser) until setLibrary() swaps in the real scan result from LiquidNative.scan().
// Strings are stored HTML-escaped (esc); un() reverses it. Tracks: id 't'+hash(uri); albums: id 'a'+hash(albumArtist|album).
import { E as esc, un } from './text.js';
const g = (a, b) => `linear-gradient(145deg, ${a}, ${b})`;
export let albums = [
  { id:'a1', title:'Quiet Engines',   artist:'Juno & the Reeds', year:2024, genre:'Indie',      g:g('#5b73ff','#2a1a8a'), hires:false },
  { id:'a2', title:'Northbound',      artist:'The Lantern Club', year:2022, genre:'Rock',       g:g('#6dffa0','#0b7a5a'), hires:false },
  { id:'a3', title:'Velvet Circuit',  artist:'Mira Sol',         year:2023, genre:'Electronic', g:g('#f55be8','#4a1190'), hires:true  },
  { id:'a4', title:'Afterglow Atlas', artist:'Orin Hale',        year:2021, genre:'Ambient',    g:g('#f8c76a','#8a1d1d'), hires:true  },
  { id:'a5', title:'Red Room Sessions',artist:'Kira Vale',       year:2023, genre:'Jazz',       g:g('#ff4d6a','#7a0f2a'), hires:true  },
  { id:'a6', title:'Neon Harbor',     artist:'Kira Vale',        year:2024, genre:'Pop',        g:g('#ff7a59','#a31a54'), hires:true  },
  { id:'a7', title:'Glass Hours',     artist:'Mira Sol',         year:2020, genre:'Electronic', g:g('#b05bff','#3a1580'), hires:true  },
  { id:'a8', title:'Paper Moons',     artist:'The Lantern Club', year:2019, genre:'Rock',       g:g('#ff9a5a','#8a3a14'), hires:false },
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
export const byAlbum = id => albums.find(a => a.id === id);
export const albumTracks = id => tracks.filter(t => t.albumId === id).sort((x, y) => (x.disc || 1) - (y.disc || 1) || (x.no || 0) - (y.no || 0));
export let artists = [...new Set(albums.map(a => a.artist))];
export let genres = [
  { n:'Pop', c:'--v-pink' }, { n:'Indie', c:'--v-blue' }, { n:'Ambient', c:'--v-orange' },
  { n:'Electronic', c:'--v-green' }, { n:'Jazz', c:'--v-yellow' }, { n:'Rock', c:'--v-magenta' },
].map(x => ({ ...x, count: tracks.filter(t => byAlbum(t.albumId).genre === x.n).length }));
export let playlists = [
  { id:'p1', name:'Late Night Hi-Res', ids:['t6','t8','t18','t10','t15','t7'] },
  { id:'p2', name:'Red Room Favorites', ids:['t10','t11','t12','t13','t14'] },
  { id:'p3', name:'Road Trip', ids:['t1','t4','t16','t20','t3','t5','t9','t2'] },
];
export const mmss = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
export const quality = t => `FLAC ${t.bits}-bit / ${t.khz} kHz`;
export const isHires = t => t.bits >= 24 || t.khz > 48;

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
export function setLibrary(raw) {
  const am = new Map(), ts = [];
  raw.forEach(r => {
    const artist = esc(r.albumArtist || r.artist), name = esc(r.album), key = artist + '|' + name;
    let a = am.get(key);
    if (!a) { const h = parseInt(hash(key), 36) % 360; a = { id: 'a' + hash(key), title: name, artist, year: r.year || '', genre: esc(r.genre || 'Unknown'), g: `linear-gradient(145deg, ${hex(h, 80, 62)}, ${hex((h + 40) % 360, 70, 22)})`, hires: false, added: 0, g0: '', cover: '', coverPath: '' }; a.g0 = a.g; am.set(key, a); }
    const t = { id: 't' + hash(r.uri), uri: r.uri, path: esc(relPath(r.uri)), albumId: a.id, title: esc(r.title), trackArtist: esc(r.artist), dur: r.dur, bits: r.bits, khz: r.khz, lyric: esc(r.lyric), no: r.track || 0, disc: r.disc || 1, added: r.added || 0, cover: r.cover || '', coverPath: r.coverPath || '', lrc: r.lrc || '' };
    // T4c step 3: the image goes on top of the generated gradient (`--g` is a CSS background, so a failed image falls back to the gradient)
    if (t.cover && !a.cover) { a.cover = t.cover; a.coverPath = t.coverPath; a.g = `url('${String(t.cover).replace(/['"()\\\s]/g, c => '%' + c.charCodeAt(0).toString(16))}') center/cover no-repeat, ${a.g0}`; }
    if (isHires(t)) a.hires = true;
    if (t.added > a.added) a.added = t.added;
    ts.push(t);
  });
  ts.sort((x, y) => x.title.localeCompare(y.title));
  albums = [...am.values()].sort((x, y) => x.title.localeCompare(y.title));
  tracks = ts; playlists = [];
  artists = [...new Set(albums.map(a => a.artist))].sort((x, y) => x.localeCompare(y));
  const gc = ['--v-pink', '--v-blue', '--v-orange', '--v-green', '--v-yellow', '--v-magenta'];
  genres = [...new Set(albums.map(a => a.genre))].sort().map((n, i) => ({ n, c: gc[i % gc.length], count: tracks.filter(t => byAlbum(t.albumId).genre === n).length }));
}

/* ---------- T5: genres, folders, artists ---------- */
export const genreTracks = n => tracks.filter(t => byAlbum(t.albumId).genre === n);
export const artistTracks = n => albums.filter(a => a.artist === n).sort((x, y) => (y.year || 0) - (x.year || 0)).flatMap(a => albumTracks(a.id));
export const dirOf = t => (t.path || '').split('/').slice(0, -1).join('/');
/** Immediate sub-folders (with song counts) and the songs directly inside `dir` ('' = the music folder). */
export function folderEntries(dir) {
  const subs = new Map(), files = [];
  tracks.forEach(t => {
    const d = dirOf(t);
    if (d === dir) files.push(t);
    else if (!dir || d.startsWith(dir + '/')) { const n = (dir ? d.slice(dir.length + 1) : d).split('/')[0]; subs.set(n, (subs.get(n) || 0) + 1); }
  });
  files.sort((x, y) => (x.disc || 1) - (y.disc || 1) || (x.no || 0) - (y.no || 0) || x.title.localeCompare(y.title));
  return { subs: [...subs].sort((x, y) => x[0].localeCompare(y[0])).map(([name, count]) => ({ name, count, path: dir ? dir + '/' + name : name })), files };
}

/* ---------- T4c step 4: Recently Added (newest file date first; demo data keeps its order) ---------- */
export const recentAlbums = n => (albums.some(a => a.added) ? albums.slice().sort((x, y) => (y.added || 0) - (x.added || 0)) : albums).slice(0, n);

/* ---------- T6: playlists. `playlists` is a live binding: main.js mutates it, then Native.savePlaylists() persists it ---------- */
export const setPlaylists = list => { playlists = (list || []).map(p => ({ id: String(p.id), name: esc(p.name ?? ''), ids: Array.isArray(p.ids) ? p.ids.slice() : [] })); };
export const plTracks = p => p.ids.map(i => tracks.find(t => t.id === i)).filter(Boolean);   // ids of deleted files are skipped, not crashed on
export const savablePlaylists = () => playlists.map(p => ({ id: p.id, name: un(p.name), ids: p.ids }));   // file stores RAW names

/* ---------- helpers used by the UI ---------- */
/** Case-insensitive "contains" on a stored (escaped) string; q must be lower-case. Makes searching "&" work. */
export const match = (s, q) => un(s).toLowerCase().includes(q);
/** Song list behind a data-list key: 'all' | 'album:<id>' | 'pl:<id>' | 'artist:<name>' | 'genre:<name>' | 'folder:<path>'. Names are escaped (see esc). */
export const listOf = key => {
  if (key === 'all') return tracks;
  const c = key.indexOf(':'), k = key.slice(0, c), id = key.slice(c + 1);   // split on the FIRST colon only (names can contain ':')
  if (k === 'album') return albumTracks(id);
  if (k === 'pl') { const p = playlists.find(x => x.id === id); return p ? plTracks(p) : []; }
  if (k === 'artist') return artistTracks(esc(id));
  if (k === 'genre') return genreTracks(esc(id));
  if (k === 'folder') return folderEntries(esc(id)).files;
  return tracks;
};
