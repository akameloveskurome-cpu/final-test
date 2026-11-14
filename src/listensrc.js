import { artistKey, PROTECTED_KEYS } from './artistnames.js';   // BUG-124 / BUG-208
// More listening-history sources and export formats (Tempo, Last.fm JSON, Maloja, YouTube Music takeout, Audioscrobbler .scrobbler.log, ListenBrainz JSON Lines). PURE: tests/listensrc.test.mjs.
// Readers return RAW plays { start, ms, title, artist, album, albumArtist, dur } (ms since 1970); listenio.js cleans them with its own play().
import { csvText } from './transfer.js';

const num = v => { const n = +v; return Number.isFinite(n) && n > 0 ? n : 0; };
const ts = v => { if (v == null || v === '') return 0; if (typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v).trim())) { const n = +v; if (n > 1e11) return Math.round(n); if (n < 9.46e8) return 0; return Math.round(n * 1000);   /* BUG-211: a short number such as 20240105 is not a unix time */ } const t = Date.parse(String(v)); return Number.isNaN(t) ? 0 : t; };
const txt = v => (v && typeof v === 'object' ? v['#text'] ?? v.name ?? '' : v ?? '');

export const SOURCE_NAMES = { liquid: 'Liquid Dark backup', json: 'JSON history', csv: 'CSV history', tempo: 'Tempo backup', lastfm: 'Last.fm JSON', maloja: 'Maloja', ytmusic: 'YouTube Music', scrobblerlog: 'Scrobbler log' };

/** JSON Lines (one JSON object per line, e.g. a ListenBrainz export's listens/*.jsonl) -> array of objects, or null. */
export function jsonLines(text) {
  const lines = String(text ?? '').split(/\r?\n/).filter(l => l.trim()); if (lines.length < 2) return null;
  const out = []; for (const l of lines) { if (!/^\s*\{/.test(l)) return null; try { out.push(JSON.parse(l)); } catch { return null; } }
  return out;
}

/** Text Tempo's notification reader picked up that is NOT a song: library-scan progress, social notifications, ads, YouTube "Recommended for you" / view counts, temp file names. */
const JUNK_TITLE = /^(?:scan|applying changes|building the song library\u2026?|downloading|updating library\u2026?|a little something extra for you!?|hear more\. feel more\.?)$|^\d+ (?:likes?|person|people)\b|^\d+ person\b|=tmp$/i;
const JUNK_ARTIST = /audio-files? found|\u203a|updating library|premium rewards|brand offers|elevate the way you listen|<unknown>|missed message|^[-\s,]*$|^\d[\d.,]*\s?[kmb]?\s+views$|=tmp$|^on your /i;
const FILE_EXT = /\.(?:flac|mp3|m4a|wav|ogg|opus|aac)$/i;   // a file name in the artist field: some players swap the two (artist = "Song.mp3", title = the real artist)
// BUG-422: these short patterns can also be a real title / artist; they apply only when the track has no album metadata.
const SOFT_TITLE = /^(?:scan|downloading)$|^\d+ (?:likes?|person|people)\b/i, SOFT_ARTIST = /^on your /i;
export const isJunkSong = (title, artist, hasAlbum = false) => {
  const t = String(title ?? '').trim(), a = String(artist ?? '').trim();
  if (!t) return true;
  if (hasAlbum && (SOFT_TITLE.test(t) || SOFT_ARTIST.test(a)) && !JUNK_TITLE.test(t.replace(SOFT_TITLE, '')) && !JUNK_ARTIST.test(a.replace(SOFT_ARTIST, ''))) return false;
  return JUNK_TITLE.test(t) || JUNK_ARTIST.test(a);
};
/** "isq \u2022 Recommended for you" -> "isq" (YouTube Music notification text glued to the artist). */
const cleanArtist = a => String(a ?? '').replace(/\s+\u2022\s+.*$/, '').trim();

/** Tempo (me.avinas.tempo) backup data.json: listeningEvents point at tracks by track_id. Skipped / short plays are kept (our own 30 s rule decides what counts).
 *  v158: junk "songs" (scan / notification / ad text) are dropped, the artist of a YouTube Music row is cleaned, the track's PRIMARY artist is the album artist, the time zone of each play is kept,
 *  and one play heard by two apps at once (same song, overlapping time, different source app) is counted once. Tempo's sessionId is one per play, so it is NOT used (our 30 minute rule builds sessions).
 *  The play id is made from the raw artist + title exactly as before (rawArtist), so importing a file that was imported by an older version adds nothing twice. */
export function fromTempo(o) {
  const tr = new Map(), alb = new Map(), art = new Map();
  for (const t of o.tracks || []) if (t && t.id != null) tr.set(t.id, t);
  for (const a of o.artists || []) if (a && a.id != null) art.set(a.id, a);
  for (const m of o.enrichedMetadata || []) if (m && m.trackId != null && m.albumTitle) alb.set(m.trackId, m.albumTitle);
  const evs = [];
  for (const e of o.listeningEvents || []) {
    const t = e && tr.get(e.track_id); if (!t || (t.contentType && t.contentType !== 'MUSIC')) continue;
    const start = ts(e.timestamp), ms = num(e.playDuration); if (!start || !ms) continue;
    let title = String(t.title ?? ''), artist = String(t.artist ?? '');
    if (FILE_EXT.test(artist.trim()) && title.trim() && !FILE_EXT.test(title.trim())) { const x = title; title = artist.trim().replace(FILE_EXT, ''); artist = x; }   // swapped fields: file name in the artist
    if (isJunkSong(title, artist, alb.has(t.id))) continue;   // BUG-422
    evs.push({ e, t, start, ms, title, artist });
  }
  evs.sort((a, b) => a.start - b.start);
  const out = [], lastOf = new Map();   // track id -> last kept play { play, end, src }
  for (const { e, t, start, ms, title, artist: art0 } of evs) {
    const end = Math.max(start + ms, Math.min(ts(e.endTimestamp) || 0, start + ms + 216e5)), src = e.source || '', prev = lastOf.get(t.id);
    if (prev && src !== prev.src && start < prev.end + 5000) {   // the same play seen by two apps: keep the longer record
      if (ms > prev.play.ms) { Object.assign(prev.play, { start, ms }); prev.end = end; }
      continue;
    }
    const pa = art.get(t.primaryArtistId), artist = cleanArtist(art0);
    const p = { start, ms, title, artist, album: t.album || alb.get(t.id) || '', albumArtist: pa && !isJunkSong('x', pa.name) ? cleanArtist(pa.name) : '', dur: num(e.estimatedDurationMs) || num(t.duration), tz: e.tzOffsetMinutes != null && e.tzOffsetMinutes !== '' && Number.isFinite(+e.tzOffsetMinutes) ? +e.tzOffsetMinutes : undefined };
    if (artist !== String(t.artist ?? '').trim()) p.rawArtist = String(t.artist ?? '').trim();   // ids stay what an older import made them
    if (title !== String(t.title ?? '')) p.rawTitle = String(t.title ?? '');
    out.push(p); lastOf.set(t.id, { play: p, end, src });
  }
  return out;
}

/** Last.fm API JSON (user.getRecentTracks): { recenttracks: { track: [...] } }, a list of such pages, or a bare list of track objects. Now-playing rows have no date and are skipped. */
export function fromLastfm(o) {
  const pages = Array.isArray(o) ? o : [o], items = [];
  for (const p of pages) {
    if (p && p.recenttracks) { const t = p.recenttracks.track; for (const x of Array.isArray(t) ? t : t ? [t] : []) if (x && typeof x === 'object') items.push(x); }   // BUG-417
    else if (p && typeof p === 'object' && p.name && p.artist && p.date) items.push(p);
  }
  if (!items.length) return null;
  const out = [];
  for (const x of items) { /* BUG-292: Last.fm "#text" is UTC */ const dt = x.date && !x.date.uts && typeof x.date['#text'] === 'string' ? x.date['#text'].trim() : '', start = ts(x.date && (x.date.uts || (dt && !/(?:Z|UTC|GMT|[+-]\d\d:?\d\d)$/i.test(dt) ? dt + ' UTC' : dt))); if (!start) continue; out.push({ start, ms: 0, title: x.name, artist: txt(x.artist), album: txt(x.album), dur: 0 }); }
  return out;
}

/** Maloja export: { scrobbles: [{ time, duration, track: { artists: [...], title, album: { albumtitle } } }] }. */
export function fromMaloja(o) {
  if (!o || !Array.isArray(o.scrobbles) || !o.scrobbles.some(s => s && s.track && s.track.title)) return null;
  const out = [];
  for (const s of o.scrobbles) {
    const t = s && s.track; if (!t || !t.title) continue; const start = ts(s.time); if (!start) continue;
    const al = t.album && typeof t.album === 'object' ? t.album.albumtitle || t.album.name : t.album;
    out.push({ start, ms: num(s.duration) * 1000, title: t.title, artist: Array.isArray(t.artists) ? t.artists.join(', ') : String(t.artist || ''), album: al || '', dur: num(t.length) * 1000 });
  }
  return out;
}

/** Google Takeout > YouTube > history > watch-history.json, YouTube Music rows only. */
export function fromYtMusic(arr) {
  if (!Array.isArray(arr) || !arr.some(x => x && x.header === 'YouTube Music')) return null;
  const out = [];
  for (const x of arr) {
    if (!x || x.header !== 'YouTube Music' || !x.title) continue;
    const start = ts(x.time); if (!start) continue;
    const title = String(x.title).replace(/^(Watched|Listened to|Angesehen:|Visto:|Regardé|Écouté|Ascoltato|Gehört|Escuchado|Ouvido|Bekeken|Oglądano|Просмотрено)\s*:?\s+/i, '')   // BUG-209: common Takeout languages
   .trim();
    const artist = String((x.subtitles && x.subtitles[0] && x.subtitles[0].name) || '').replace(/\s+-\s+Topic$/i, '').trim();
    if (title && artist) out.push({ start, ms: 0, title, artist, album: '', dur: 0 });   // no listening time in this file: the importer uses the song length
  }
  return out;
}

/** Whole-object detector: -> { format, plays } or null (then listenio.js tries ListenBrainz / Spotify / loose scrobbles). */
export function fromObject(o) {
  if (o && !Array.isArray(o) && Array.isArray(o.listeningEvents) && Array.isArray(o.tracks)) return { format: 'tempo', plays: fromTempo(o) };
  const lf = fromLastfm(o); if (lf) return { format: 'lastfm', plays: lf };
  const ma = fromMaloja(o); if (ma) return { format: 'maloja', plays: ma };
  const yt = fromYtMusic(o); if (yt) return { format: 'ytmusic', plays: yt };
  return null;
}

/** Audioscrobbler log (Rockbox, many players): tab separated artist, album, title, track no, seconds, L (listened) or S (skipped), unix time, [mbid]. */
export const looksScrobblerLog = (text, name = '') => /\.scrobbler\.log$/i.test(name) || /^#AUDIOSCROBBLER\/\d/.test(String(text ?? '').trimStart());
export function fromScrobblerLog(text) {
  const out = [], local = /^#TZ\/(?!UTC\b)/im.test(String(text ?? ''));   // BUG-210: #TZ/UNKNOWN = device local time
  const fix = t => local ? t + new Date(t).getTimezoneOffset() * 60000 : t;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (!line || line[0] === '#') continue;
    const f = line.split('\t'); if (f.length < 7 || String(f[5]).trim().toUpperCase() !== 'L') continue;
    const start0 = ts(f[6]); if (!start0) continue; const start = fix(start0);
    out.push({ start, ms: 0, title: f[2], artist: f[0], album: f[1], dur: num(f[4]) * 1000 });
  }
  return out;
}

/* ---------- export ---------- */
/** plays: [{ start, ms, title, artist, album, albumArtist }] */
export const lastfmCsv = plays => csvText([['uts', 'utc_time', 'artist', 'artist_mbid', 'album', 'album_mbid', 'track', 'track_mbid']].concat(plays.map(p => {
  const d = new Date(p.start), m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]   /* BUG-207: fixed English month names (en-GB says "Sept") */, z = n => String(n).padStart(2, '0');
  return [Math.floor(p.start / 1000), `${z(d.getUTCDate())} ${m} ${d.getUTCFullYear()}, ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}`, p.artist, '', p.album, '', p.title, ''];
})));

export const scrobblerLog = (plays, client = 'Liquid Dark') => ['#AUDIOSCROBBLER/1.1', '#TZ/UTC', `#CLIENT/${client}`].concat(plays.map(p => [p.artist, p.album || '', p.title, '', Math.round((p.dur || p.ms || 0) / 1000), 'L', Math.floor(p.start / 1000), ''].map(x => String(x).replace(/[\t\r\n]+/g, ' ')).join('\t'))).join('\n') + '\n';

/** Tempo's built-in badge list (id, name, description, icon, category, goal), all "not earned yet": a backup without it would leave Tempo with no badges. */
const TEMPO_BADGES = [["first_play","First Note","Your musical journey begins","music_note","MILESTONE",1],["plays_100","Century","Play 100 songs","century","MILESTONE",100],["plays_500","Sound Pilgrim","Journey through 500 tracks","star_half","MILESTONE",500],["plays_1000","Grand Maestro","Master 1,000 tracks","star","MILESTONE",1000],["plays_5000","Virtuoso","Conquer 5,000 tracks","diamond","MILESTONE",5000],["plays_10000","Legendary","Transcend 10,000 tracks","emoji_events","MILESTONE",10000],["time_1h","First Hour","Your first hour of music","timer","TIME",1],["time_24h","Day Tripper","A full day's worth of music","schedule","TIME",24],["time_100h","Centurion","100 hours of listening","hourglass_full","TIME",100],["time_500h","Sound Sage","500 hours of listening","headphones","TIME",500],["streak_7","Week Warrior","7-day listening streak","local_fire_department","STREAK",7],["streak_30","Monthly Maven","30-day listening streak","whatshot","STREAK",30],["streak_100","Ironclad","100-day listening streak","military_tech","STREAK",100],["streak_365","Year-Round","365-day listening streak","auto_awesome","STREAK",365],["artists_10","Explorer","Discover unique artists","explore","DISCOVERY",10],["artists_50","Curator","Discover 50 unique artists","collections","DISCOVERY",50],["artists_100","Connoisseur","Discover 100 unique artists","public","DISCOVERY",100],["genres_10","Genre Hopper","Explore different genres","category","DISCOVERY",10],["genres_25","Eclectic","Explore 25+ genres","palette","DISCOVERY",25],["night_owl","Night Owl","Late-night plays (12–5 AM)","nightlight","ENGAGEMENT",100],["early_bird","Early Bird","Early morning plays (5–8 AM)","wb_sunny","ENGAGEMENT",100],["marathon","Marathon","Complete marathon listening sessions (3+ hours each)","directions_run","ENGAGEMENT",5],["level_5","Rising Star","Reach Level 5","grade","LEVEL",5],["level_10","Double Digits","Reach Level 10","looks_one","LEVEL",10],["level_25","Quarter Century","Reach Level 25","military_tech","LEVEL",25],["level_50","Halfway There","Reach Level 50","workspace_premium","LEVEL",50],["level_75","Elite Listener","Reach Level 75","shield","LEVEL",75],["level_100","The Centennial","Reach Level 100","emoji_events","LEVEL",100]];
const FEAT_SPLIT = /\s+(?:feat\.?|ft\.?|featuring)\s+/i;
/** "A, B feat. C" -> [{ name, role }]: Tempo lists every comma name as PRIMARY and the names after "feat." as FEATURED. */
const creditsOf = artist => { const [main, ...rest] = String(artist).split(FEAT_SPLIT), out = []; (PROTECTED_KEYS.has(artistKey(main)) ? [main.trim()] : main.split(/\s*,\s*/)).filter(Boolean).forEach(n => out.push({ name: n, role: 'PRIMARY' })); rest.join(', ').split(/\s*,\s*/).filter(Boolean).forEach(n => out.push({ name: n, role: 'FEATURED' })); return out; };

/** Same layout as a Tempo backup's data.json (schema 58, checked against a real 4.8.15 backup: same keys, same roles, same defaults). Only what a listening history needs is filled
 *  (songs, artists with their PRIMARY / FEATURED credits, albums, plays); XP, badge progress, app lists and enrichment stay empty / not earned. NOT tested inside Tempo itself. */
export function tempoBackup(plays, userName = '', now = new Date()) {
  const tid = new Map(), aid = new Map(), alid = new Map(), tracks = [], artists = [], albums = [], trackArtists = [], events = [];
  const artistId = n => { const k = n.toLowerCase(); let a = aid.get(k); if (!a) { a = aid.size + 1; aid.set(k, a); artists.push({ id: a, name: n, normalizedName: k, genres: [] }); } return a; };
  for (const p of plays) {
    const kt = (p.artist + '\u0001' + p.title + '\u0001' + (p.album || '')).toLowerCase(); let id = tid.get(kt);
    if (!id) {
      id = tid.size + 1; tid.set(kt, id);
      const cr = creditsOf(p.artist), ids = cr.map(c => artistId(c.name));
      const t = { id, title: p.title, artist: p.artist, primaryArtistId: ids[0] ?? null, contentType: 'MUSIC' };
      if (p.album) t.album = p.album;
      if (p.dur) t.duration = Math.round(p.dur);
      tracks.push(t);
      cr.forEach((c, i) => trackArtists.push({ trackId: id, artistId: ids[i], role: c.role, creditOrder: i }));
      if (p.album && ids[0] != null) { const ka = ids[0] + '\u0001' + p.album.toLowerCase(); if (!alid.has(ka)) { alid.set(ka, albums.length + 1); albums.push({ id: albums.length + 1, title: p.album, artistId: ids[0] }); } }
    }
    const est = Math.max(p.dur || 0, p.ms), q = p.q ? 1 : 0;
    events.push({ id: events.length + 1, track_id: id, timestamp: p.start, playDuration: Math.round(p.ms), completionPercentage: est ? Math.min(100, Math.round(p.ms / est * 100)) : 0, source: 'com.liquid.flacplayer', wasSkipped: !q, isReplay: false, estimatedDurationMs: Math.round(est), pauseCount: 0, sessionId: 'lf' + (p.start / 1800000 | 0).toString(36), endTimestamp: Math.round(p.start + p.ms), totalPauseDurationMs: 0, seekCount: 0, positionUpdatesCount: 0, wasInterrupted: false, volumeLevel: 0, tzOffsetMinutes: p.tz != null ? p.tz : -new Date(p.start).getTimezoneOffset() });
  }
  const T = now.getTime(), day = now.toISOString().slice(0, 10);
  return { version: 9, exportedAt: T, appVersion: '4.8.15', schemaVersion: 58, userName: userName || '', tracks, artists, albums, trackArtists, listeningEvents: events, enrichedMetadata: [],
    userPreferences: { id: 0, theme: 'system', notifications: true, spotifyLinked: false, extendedAudioAnalysis: false, mergeAlternateVersions: false, filterPodcasts: true, filterAudiobooks: true, hasSeenHistoryCoachMark: true, hasSeenSpotlightTutorial: true, hasSeenStatsSortTutorial: true, hasSeenStatsItemClickTutorial: true, lastWeeklyReminderShown: day, lastMonthlyReminderShown: day, spotifyApiOnlyMode: false, lastfmConnected: false, lastfmSyncFrequency: 'NONE', isGamificationEnabled: false, pauseTrackingOnLowBattery: false, hideStreaks: false },
    userLevel: { id: 1, totalXp: 0, currentLevel: 0, xpForCurrentLevel: 0, xpForNextLevel: 130, lastXpAwardedAt: T, currentStreak: 0, longestStreak: 0, lastStreakDate: '', bankedChallengeXp: 0 },
    badges: TEMPO_BADGES.map(([badgeId, name, description, iconName, category, maxProgress], i) => ({ id: i + 1, badgeId, name, description, iconName, category, earnedAt: 0, progress: 0, maxProgress, isEarned: false, stars: 0, isAcknowledged: false })),
    userKnownArtists: [], dailyChallenges: [], artistAliases: [], trackAliases: [], manualContentMarks: [], appPreferences: [], scrobbleArchive: [], lastFmImportMetadata: [], localImageManifest: {}, hotlinkedUrls: [], imageManifest: {} };
}
