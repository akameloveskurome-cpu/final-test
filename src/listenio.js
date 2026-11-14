// Listening data import / export. PURE (no DOM, no Native): covered by tests/listenio.test.mjs.
// A stored segment (see listenstats.js): { i:songId, t,a,al,aa:title/artist/album/albumArtist snapshot, s:startMs, d:playedMs, f:1 foreground, q:1 qualified, sid:session, pid:play, n:seq, p0,p1:position }.
// A PLAY = all segments with the same pid. Other apps only know plays (start time + title + artist [+ album, + time played]), so that is what every non-Liquid format holds.
// Export: Liquid Dark JSON (lossless), ListenBrainz JSON, Spotify "extended streaming history" JSON, Last.fm CSV, Audioscrobbler .scrobbler.log, Tempo backup zip, CSV.
// Import: all of those + Tempo backup, Last.fm API JSON, Maloja, YouTube Music takeout, .scrobbler.log, ListenBrainz JSON Lines (see listensrc.js; .zip files are opened by zipread.js) + Spotify's older StreamingHistory JSON, Last.fm / Pano Scrobbler / scrobbler-tool CSV, Apple Music "Play Activity" CSV, and any CSV with recognisable column names.
import { unesc, norm } from './plexport.js';
import { csvParse, csvText, headerMap, stamp } from './transfer.js';
import { wide } from './idhash.js';
import * as SRC from './listensrc.js';
export { SOURCE_NAMES } from './listensrc.js';

export const KIND = 'listening';
export const QUALIFY_MS = 10000;
export const SESSION_GAP = 30 * 60000;
export const FORMATS = [
  { id: 'liquid', label: 'Liquid Dark backup (.json)', note: 'Everything, exactly as recorded. Best for moving to another phone with this app.', ext: 'json', mime: 'application/json' },
  { id: 'listenbrainz', label: 'ListenBrainz (.json)', note: 'Open scrobble format. Import it on listenbrainz.org, or into tools that read ListenBrainz files.', ext: 'json', mime: 'application/json' },
  { id: 'spotify', label: 'Spotify streaming history (.json)', note: 'Same fields as Spotify’s own data download, for tools that read that (stats sites, importers).', ext: 'json', mime: 'application/json' },
  { id: 'lastfmcsv', label: 'Last.fm scrobbles (.csv)', note: 'uts, artist, album, track columns: the layout Last.fm importers, Libre.fm and Universal Scrobbler tools read.', ext: 'csv', mime: 'text/csv' },
  { id: 'scrobblerlog', label: 'Scrobbler log (.scrobbler.log)', note: 'The Audioscrobbler log format (Rockbox and others). Scrobble it to Last.fm / Libre.fm / ListenBrainz with Universal Scrobbler or Open Scrobbler.', ext: 'scrobbler.log', mime: 'text/plain' },
  { id: 'tempo', label: 'Tempo backup (.zip)', note: 'Same layout as the Tempo app’s own backup (data.json in a zip). Every play, with the skipped ones marked.', ext: 'zip', mime: 'application/zip' },
  { id: 'csv', label: 'CSV spreadsheet (.csv)', note: 'Date, artist, track, album, minutes. Opens in Excel / Sheets; most scrobble importers read it.', ext: 'csv', mime: 'text/csv' },
];

/** Segments -> plays [{ pid, start, ms, q, title, artist, album, albumArtist, dur }] oldest first. Only real listening (ms > 0). */
export function toPlays(segs) {
  const m = new Map();
  for (const g of segs) {
    if (!g || !(g.d > 0)) continue;
    const k = g.pid || ('s' + g.s);
    let p = m.get(k);
    if (!p) { p = { pid: k, start: g.s, ms: 0, q: 0, title: g.t || '', artist: g.a || '', album: g.al || '', albumArtist: g.aa || '', dur: 0, tz: Number.isFinite(g.tz) && g.tz != null ? g.tz : null }; m.set(k, p); }
    p.ms += g.d; p.start = Math.min(p.start, g.s); if (g.q) p.q = 1; if (g.l > 0) p.dur = Math.max(p.dur, g.l);   // BUG-290: song length in ms, so exports (scrobbler log, Tempo, ListenBrainz) carry the real length
  }
  return [...m.values()].sort((a, b) => a.start - b.start);
}
const named = p => p.title && p.artist;
const iso = ms => new Date(ms).toISOString();

export function buildExport(fmt, segs, now = new Date(), userName = '') {
  const f = FORMATS.find(x => x.id === fmt); if (!f) throw new Error('Unknown format');
  if (fmt === 'liquid') {
    return { name: `liquid-dark-listening-${stamp(now)}.json`, mime: f.mime, count: segs.filter(g => g && g.d > 0).length, text: JSON.stringify({ app: 'liquid-dark', kind: KIND, version: 1, exported: now.toISOString(), segments: segs.filter(g => g && g.d > 0) }) };
  }
  if (fmt === 'tempo') { const all = toPlays(segs).filter(named); return { name: `liquid-dark-listening-tempo-${stamp(now)}.zip`, mime: f.mime, count: all.length, files: [{ name: 'data.json', text: JSON.stringify(SRC.tempoBackup(all, userName, now)) }] }; }
  const plays = toPlays(segs).filter(p => p.q && named(p));   // the same rule the player uses (10 s, or half a short song)
  if (fmt === 'lastfmcsv') return { name: `liquid-dark-listening-lastfm-${stamp(now)}.csv`, mime: f.mime, count: plays.length, text: SRC.lastfmCsv(plays) };
  if (fmt === 'scrobblerlog') return { name: `liquid-dark-listening-${stamp(now)}.scrobbler.log`, mime: f.mime, count: plays.length, text: SRC.scrobblerLog(plays) };
  let text;
  if (fmt === 'listenbrainz') text = JSON.stringify(plays.map(p => ({ listened_at: Math.floor(p.start / 1000), track_metadata: { artist_name: p.artist, track_name: p.title, release_name: p.album || undefined, additional_info: { media_player: 'Liquid Dark', submission_client: 'Liquid Dark', duration_ms: p.dur ? Math.round(p.dur) : undefined, liquid_listened_ms: Math.round(p.ms) } } })), null, 1);
  else if (fmt === 'spotify') text = JSON.stringify(plays.map(p => ({ ts: iso(p.start + Math.round(p.ms)), platform: 'android', ms_played: Math.round(p.ms), conn_country: 'ZZ', master_metadata_track_name: p.title, master_metadata_album_artist_name: p.artist || p.albumArtist, master_metadata_album_album_name: p.album || null, spotify_track_uri: null, reason_start: 'trackdone', reason_end: 'trackdone', shuffle: false, skipped: false, offline: true, incognito_mode: false })), null, 1);
  else text = csvText([['Timestamp (UTC)', 'Unix time', 'Artist', 'Track', 'Album', 'Album artist', 'Minutes played']].concat(plays.map(p => [iso(p.start), Math.floor(p.start / 1000), p.artist, p.title, p.album, p.albumArtist, (p.ms / 60000).toFixed(4)])));
  return { name: `liquid-dark-listening-${fmt === 'csv' ? 'scrobbles' : fmt}-${stamp(now)}.${f.ext}`, mime: f.mime, count: plays.length, text };
}

/* ---------- import ---------- */
/** A date in any common form -> ms (or 0): unix seconds / ms, ISO, "01 Jan 2020, 12:00", "2020-01-01 12:00". */
export function parseTime(v) {
  if (v == null || v === '') return 0;
  const sane = ms => (ms >= 946684800e3 && ms <= Date.now() + 864e5 ? ms : 0);   // BUG-423 / BUG-414: only 2000 .. tomorrow counts as a date
  if (typeof v === 'number') return sane(v > 1e11 ? Math.round(v) : Math.round(v * 1000));
  const s = String(v).trim(); if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return parseTime(+s);
  if (!/\d{4}/.test(s)) return 0;   // BUG-416: text without a year is not a date (V8 would invent 2001)
  let t = Date.parse(s);
  if (Number.isNaN(t)) t = Date.parse(s.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T'));
  if (Number.isNaN(t)) { const m = /^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/.exec(s); if (m) t = Date.parse(`${m[2]} ${m[1]}, ${m[3]} ${m[4]}:${m[5]}`); }
  return Number.isNaN(t) ? 0 : sane(t);
}
const num = v => { const n = +v; return Number.isFinite(n) && n > 0 ? n : 0; };
const play = (o) => ({ src: o.src || '', start: o.start, ms: o.ms || 0, title: String(o.title ?? '').trim(), artist: String(o.artist ?? '').trim(), album: String(o.album ?? '').trim(), albumArtist: String(o.albumArtist ?? '').trim(), dur: o.dur || 0, pid: o.pid || '', q: o.q, sid: o.sid || '', tz: Number.isFinite(o.tz) ? o.tz : null, rawArtist: o.rawArtist, rawTitle: o.rawTitle });

const ALIASES = {
  title: ['track', 'track name', 'trackname', 'title', 'song', 'song name', 'master metadata track name', 'content name', 'name'],
  artist: ['artist', 'artist name', 'artistname', 'artists', 'master metadata album artist name', 'album artist name'],
  album: ['album', 'album name', 'albumname', 'master metadata album album name', 'release', 'release name'],
  time: ['timestamp utc', 'unix time', 'timestamp', 'uts', 'date', 'datetime', 'date time', 'played at', 'time', 'listened at', 'ts', 'end time', 'endtime', 'event start timestamp', 'start time', 'utc date', 'scrobbled at'],
  ms: ['ms played', 'msplayed', 'play duration milliseconds', 'duration ms', 'time played ms', 'played ms'],
  mins: ['minutes played', 'minutes'],
  dur: ['media duration in milliseconds', 'track duration ms', 'length ms'],
};
function fromCsv(text) {
  const rows = csvParse(text); if (rows.length < 2) return null;
  const h = headerMap(rows[0], ALIASES); if (h.title < 0 || h.time < 0) return null;
  const endStamp = /end ?time/i.test(rows[0][h.time] || '') || /^ts$/i.test(String(rows[0][h.time] || '').trim());
  const tod = rows[0].findIndex((c, i) => i !== h.time && /^\s*(time|time of day|play time|listened time)\s*$/i.test(c || ''));   // BUG-419: a separate time-of-day column
  const evC = rows[0].findIndex(c => /^\s*event type\s*$/i.test(c || '')), mdC = rows[0].findIndex(c => /^\s*media type\s*$/i.test(c || '')), enC = rows[0].findIndex(c => /^\s*event end timestamp\s*$/i.test(c || ''));
  const hasEnd = evC >= 0 && rows.slice(1).some(r => /^\s*PLAY_END\s*$/i.test(r[evC] || ''));   // BUG-427: Apple-style files: only PLAY_END rows of audio media are plays
  const out = [];
  for (const r of rows.slice(1)) {
    if (hasEnd && !/^\s*PLAY_END\s*$/i.test(r[evC] || '')) continue;
    if (mdC >= 0 && /video/i.test(r[mdC] || '')) continue;
    const g = k => (h[k] >= 0 ? r[h[k]] : '');
    let ms = num(g('ms')) || (num(g('mins')) ? num(g('mins')) * 60000 : 0), dv = String(g('time') ?? '').trim();
    if (tod >= 0 && dv && !dv.includes(':') && /\d{4}/.test(dv) && String(r[tod] || '').includes(':')) dv += ' ' + String(r[tod]).trim();
    let t = parseTime(dv), fromEnd = false;
    if (!t && enC >= 0 && enC !== h.time) { t = parseTime(String(r[enC] || '').trim()); fromEnd = !!t; }   // BUG-428: empty start stamp, filled end stamp
    if (!t) continue;
    if ((endStamp || fromEnd) && ms) t -= ms;
    let artist = g('artist'), title = g('title');
    if (!artist && /\s-\s/.test(title)) { const m = /^(.+?)\s-\s(.+)$/.exec(title); if (m) { artist = m[1]; title = m[2]; } }
    out.push(play({ start: t, ms, title, artist, album: g('album'), dur: num(g('dur')) }));
  }
  return out;
}
function fromJson(o) {
  if (o && o.kind === KIND && Array.isArray(o.segments)) {
    if (Number(o.version) > 1) throw new Error('File is from a newer version of the app');
    return { liquid: o.segments };
  }
  const arr = Array.isArray(o) ? o : o && Array.isArray(o.payload) ? o.payload : o && o.payload && Array.isArray(o.payload.listens) ? o.payload.listens : null;
  if (!arr) return null;
  const out = [];
  for (const x of arr) {
    if (!x || typeof x !== 'object') continue;
    if (x.track_metadata) {   // ListenBrainz
      const m = x.track_metadata, ai = m.additional_info || {};
      out.push(play({ start: parseTime(x.listened_at), ms: num(ai.liquid_listened_ms) || (num(ai.duration) * 1000), title: m.track_name, artist: m.artist_name, album: m.release_name, dur: num(ai.duration_ms) }));
    } else if ('master_metadata_track_name' in x || ('ms_played' in x && 'ts' in x)) {   // Spotify extended history: ts = when it ENDED
      if (!x.master_metadata_track_name) continue;   // podcasts / audiobooks / unresolved rows
      const ms = num(x.ms_played), end = parseTime(x.ts);
      if ('ms_played' in x && !ms) continue;   // BUG-128 / 285: an explicit 0 ms is an instant skip, not a 3-minute play
      out.push(play({ src: 'spotify', start: end - ms, ms, title: x.master_metadata_track_name, artist: x.master_metadata_album_artist_name, album: x.master_metadata_album_album_name }));
    } else if ('trackName' in x && 'artistName' in x) {   // Spotify StreamingHistory0.json (endTime is local, minute precision)
      const ms = num(x.msPlayed), end = parseTime(x.endTime);
      out.push(play({ src: 'spotify', start: end - ms, ms, title: x.trackName, artist: x.artistName }));
    } else if ('track' in x && 'artist' in x) {   // loose scrobble objects
      const tn = x.track && typeof x.track === 'object' ? x.track['#text'] || x.track.name : x.track, ar = x.artist && typeof x.artist === 'object' ? x.artist['#text'] || x.artist.name : x.artist, al = x.album && typeof x.album === 'object' ? x.album['#text'] : x.album;
      out.push(play({ start: parseTime(x.date && x.date.uts ? +x.date.uts : x.timestamp || x.date || x.listened_at), title: tn, artist: ar, album: al }));
    }
  }
  return out;
}

/** One file -> { format, plays } or { format:'liquid', segs }. Throws Error('Not a listening-history file') for anything else. */
export function parseListens(text, fileName = '') {
  const t = String(text ?? '').replace(/^\uFEFF/, '');
  let plays = null, format = '';
  if (/^\s*[\[{]/.test(t)) {
    let o = null; try { o = JSON.parse(t); } catch { o = SRC.jsonLines(t); }
    if (o && !Array.isArray(o) && typeof o === 'object' && o.track_metadata) o = [o];   // BUG-78: a one-line ListenBrainz JSONL file   // a ListenBrainz export holds JSON Lines
    const src = o && SRC.fromObject(o);
    if (src) { plays = src.plays.map(play); format = src.format; }
    else if (o) { const r = fromJson(o); if (r && r.liquid) return { format: 'liquid', segs: r.liquid.filter(g => g && typeof g === 'object' && g.d > 0 && g.s > 0).map(g => ({ i: String(g.i ?? ''), t: String(g.t ?? ''), a: String(g.a ?? ''), al: String(g.al ?? ''), aa: String(g.aa ?? ''), s: +g.s, d: +g.d, f: g.f ? 1 : 0, q: g.q ? 1 : 0, sid: String(g.sid ?? ''), pid: String(g.pid ?? ''), n: Number.isFinite(+g.n) ? +g.n : null, p0: +g.p0 || 0, p1: +g.p1 || 0, l: +g.l > 0 ? +g.l : 0, tz: g.tz == null || !Number.isFinite(+g.tz) ? null : +g.tz })) }; if (r) { plays = r; format = 'json'; } }
  } else if (SRC.looksScrobblerLog(t, fileName)) { plays = SRC.fromScrobblerLog(t).map(play); format = 'scrobblerlog'; }
  else { const r = fromCsv(t); if (r) { plays = r; format = 'csv'; } }
  plays = (plays || []).filter(p => p.start > 0 && p.title && p.artist);
  if (!plays.length) throw new Error('Not a listening-history file');
  return { format, plays };
}

/* ---------- plan: turn imported plays into database rows ---------- */
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
// BUG-424: a bracket that names a numbered part ("(Part 1)", "(Pt. 2)", "(Act II)", "(Disc 2)") is a different song and stays in the key; decorations (remaster, live, mono, feat ...) are still stripped.
const DECOR = /\b(?:remaster\w*|live|mono|stereo|version|edit|deluxe|bonus|mix|feat\w*|ft|featuring|demo|acoustic|radio|single|album|explicit|clean|instrumental)\b/i;
const PART = /\b(?:part|pt|act|disc|disk|vol|volume|chapter|side|book)\b\.?\s*(?:\d+|[ivxl]+)\b/i;
const keepPart = m => (PART.test(m) && !DECOR.test(m)) ? ' ' + m.replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ' : ' ';
const loose0 = s => norm(String(s ?? '').replace(/[([{][^)\]}]*[)\]}]/g, keepPart).replace(/\s[-\u2013]\s(?=.*\b(?:remaster\w*|mono|stereo|version|edit|live|deluxe|bonus|mix)\b).*$/i, '').replace(/\s(feat|ft|featuring)\.?\s.*$/i, '')).replace(/[^\p{L}\p{N}]+/gu, '');
const loose = s => loose0(s) || String(norm(String(s ?? ''))).replace(/[^\p{L}\p{N}]+/gu, '');   // BUG-129 / 234: a title made only of a bracket keeps its text
const first = s => loose(String(s ?? '').split(/\s*(?:,|;|&|\/)\s*/)[0]);
/** Library lookup by title + first artist (+ album when several). */
export function makeLookup(tracks, artistAlbumOf) {
  const m = new Map();
  for (const t of tracks) { const aa = artistAlbumOf(t) || {}, k = loose(unesc(t.title)) + '\u0001' + first(unesc(t.trackArtist || aa.artist)); (m.get(k) || m.set(k, []).get(k)).push({ t, album: loose(unesc(aa.album)) }); }
  const mf = new Map();   // BUG-131: the whole cleaned artist text is tried first ("Simon & Garfunkel" is not "Simon")
  for (const t of tracks) { const aa = artistAlbumOf(t) || {}, k = loose(unesc(t.title)) + '\u0001' + loose(unesc(t.trackArtist || aa.artist)); (mf.get(k) || mf.set(k, []).get(k)).push({ t, album: loose(unesc(aa.album)) }); }
  return (p) => { const l = mf.get(loose(p.title) + '\u0001' + loose(p.artist)) || m.get(loose(p.title) + '\u0001' + first(p.artist)); if (!l) return null; const al = loose(p.album); return (l.find(x => al && x.album === al) || l[0]).t; };
}
const tzMin = ms => -new Date(ms).getTimezoneOffset();

/**
 * Plays from another app -> rows for ListenDb (JS side of Native.importListens). Deterministic ids (play_id) make a second import of the same file a no-op.
 * @returns {{ rows: Object[], matched: number, total: number }} each row is { i, t, a, al, aa, s, d, f, q, sid, pid, n, p0, p1, dur, tz }
 */
/** v159: the natural key of a play: start + title + artist as the history stores them (cleaned). Two files holding the same play give the same key even when their raw tags differ. */
export const playKey = (start, title, artist) => start + '|' + norm(title) + '|' + norm(artist);
/** v159: keys of every play already in the history (segments carry the cleaned names, so a re-imported export matches). */
export function playKeysOf(segs) { const out = new Set(); for (const g of segs || []) out.add(playKey(g.s, g.t, g.a)); return out; }
/** `have` (optional, Set from playKeysOf): plays already in the history are skipped. Needed because a play whose artist was cleaned on import gets a different play id than the same play re-exported with the cleaned name (v158 duplicates). */
export function planPlays(plays, tracks, artistAlbumOf, have = null) {
  if (have) have = new Set(have);   // BUG-284: plan on a copy, the caller's Set must keep meaning "already in the history"
  const find = makeLookup(tracks, artistAlbumOf), rows = [];
  let matched = 0, sid = '', lastEnd = 0;
  const sorted = plays.slice().sort((a, b) => a.start - b.start);
  for (const p of sorted) {
    const nk = playKey(p.start, p.title, p.artist);
    if (have && have.has(nk)) continue;
    if (p.src === 'spotify' && !(p.ms > 0)) continue;   // BUG-128: Spotify's own rule, an explicit 0 ms is a skip (no song-length fallback)
    if (have) have.add(nk);
    const t = find(p), aa = t ? artistAlbumOf(t) || {} : {};
    const dur = t && t.dur ? Math.round(t.dur * 1000) : p.dur || 0;
    const ms = Math.min(216e5, Math.max(1000, Math.round(p.src === 'spotify' ? p.ms : (p.ms || dur || 180000))));   // BUG-318: one play can not last more than 6 h   // other apps often hold no listening time: use the song length (or 3 min), never 0
    if (t) matched++;
    if (!sid || p.start - lastEnd > SESSION_GAP) sid = 'imp-' + wide(String(p.start));
    lastEnd = Math.max(lastEnd, p.start + ms);
    const key = p.start + '|' + norm(p.rawArtist ?? p.artist) + '|' + norm(p.rawTitle ?? p.title);   // v158: the id comes from the tags exactly as the source file had them, so cleaning a name never makes a re-import count twice
    rows.push({ i: t ? t.id : 'x' + wide(norm(p.artist) + '|' + norm(p.title) + '|' + norm(p.album)), t: p.title, a: p.artist, al: p.album || (t ? unesc(aa.album) : ''), aa: p.albumArtist || (t ? unesc(aa.artist) : p.artist), s: p.start, d: ms, f: 1, q: ms >= QUALIFY_MS || (dur > 0 && ms >= dur / 2) ? 1 : 0, sid, pid: 'imp:' + hash(key) + ':' + p.start.toString(36), n: 0, p0: 0, p1: 0, dur, tz: p.tz != null ? p.tz : tzMin(p.start) });   // v158: a source that knows the zone of the play (Tempo) keeps it: days / hours of the stats follow where you really were
  }
  return { rows, matched, total: plays.length };
}
/** Our own file: keep ids / play ids / sessions as they were (the database ignores rows it already has). Songs that exist in this library under another id are linked by tags. */
export function planLiquid(segs, tracks, artistAlbumOf) {
  const find = makeLookup(tracks, artistAlbumOf), ids = new Set(tracks.map(t => t.id)), bySeq = new Map();
  let matched = 0;
  const rows = segs.map(g => {
    let i = g.i; if (!ids.has(i)) { const t = find({ title: g.t, artist: g.a, album: g.al }); if (t) { i = t.id; matched++; } } else matched++;
    let n = g.n; if (n == null) { const c = bySeq.get(g.pid) || 0; bySeq.set(g.pid, c + 1); n = c; }   // old exports had no seq: order within the play
    return { i, t: g.t, a: g.a, al: g.al, aa: g.aa, s: g.s, d: g.d, f: g.f, q: g.q, sid: g.sid || 'imp-' + hash(String(g.s)), pid: g.pid || 'imp:' + hash(g.s + g.i), n, p0: g.p0, p1: g.p1, dur: g.l > 0 ? g.l : 0, tz: g.tz == null ? tzMin(g.s) : g.tz };   // v148: keep the zone the listening happened in (old backups have none: this phone's zone)
  });
  return { rows, matched, total: segs.length };
}
export const summary = (added, total, matched) => added ? `Imported ${added.toLocaleString()} listening record${added === 1 ? '' : 's'}${matched ? ` · ${matched.toLocaleString()} matched to songs in your library` : ''}${total > added ? ` · ${(total - added).toLocaleString()} already there` : ''}` : 'Nothing new: all of it was already in your history';

/* ---------- v160 (export period, import preview counts) ---------- */
/** Export periods (chips in the listening export sheet). */
export const PERIODS = [{ id: 'all', label: 'All time' }, { id: 'year', label: 'This year' }, { id: '12m', label: 'Last 12 months' }];
/** The segments that started inside the period. 'all' (or anything unknown) keeps every segment. */
export function inPeriod(segs, period = 'all', now = new Date()) {
  let from = null;
  if (period === 'year') from = new Date(now.getFullYear(), 0, 1).getTime();
  else if (period === '12m') { const y = now.getFullYear() - 1, last = new Date(y, now.getMonth() + 1, 0).getDate(); from = new Date(y, now.getMonth(), Math.min(now.getDate(), last)).getTime(); }   // BUG-402: 29 Feb -> 28 Feb
  return from == null ? segs.slice() : segs.filter(g => g && g.s >= from);
}
/** How many records of one parsed file are already in the history (by start + title + artist), out of how many it holds. */
export function countInHistory(parsed, haveKeys) {
  const list = parsed.segs ? parsed.segs.map(g => [g.s, g.t, g.a]) : (parsed.plays || []).map(p => [p.start, p.title, p.artist]);
  let already = 0;
  for (const [s, t, a] of list) if (haveKeys && haveKeys.has(playKey(s, t, a))) already++;
  return { total: list.length, already };
}
