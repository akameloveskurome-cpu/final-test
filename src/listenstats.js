// Listening statistics: pure calculations over stored playback segments (no DOM, no Native). A segment = { i:songId, t,a,al,aa:snapshot, s:startMs, d:playedMs, f:1 foreground, q:1 qualified, sid:session, pid:play }.
// Everything on every screen comes from aggregate(), so rankings, totals and percentages agree across Daily / Weekly / Monthly / Yearly.
export const QUALIFY_MS = 10000;
export const DAY = 864e5;

export const startOfDay = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };   // calendar arithmetic: DST / month lengths / leap years are handled by Date
export const dayNum = ms => Math.floor((ms / 60000 - new Date(ms).getTimezoneOffset()) / 1440);   // local day number, same formula the database uses
export const dayKey = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/** [from,to) in ms for the calendar day / Monday-to-Sunday week / calendar month / calendar year containing `ref` (ms). */
export function rangeOf(period, ref) {
  const d = startOfDay(ref);
  if (period === 'daily') return { from: d.getTime(), to: addDays(d, 1).getTime() };
  if (period === 'weekly') { const s = addDays(d, -((d.getDay() + 6) % 7)); return { from: s.getTime(), to: addDays(s, 7).getTime() }; }
  if (period === 'monthly') return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() };
  return { from: new Date(d.getFullYear(), 0, 1).getTime(), to: new Date(d.getFullYear() + 1, 0, 1).getTime() };
}
/** ms inside the previous (-1) or next (+1) period. */
export function shiftRef(period, ref, dir) {
  const d = new Date(ref);
  if (period === 'daily') d.setDate(d.getDate() + dir);
  else if (period === 'weekly') d.setDate(d.getDate() + 7 * dir);
  else {   // month / year: keep the day of the month (clamped to the target month's length). It used to jump to the 1st, so switching back to Daily showed the 1st.
    const day = d.getDate(); d.setDate(1);
    if (period === 'monthly') d.setMonth(d.getMonth() + dir); else d.setFullYear(d.getFullYear() + dir);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  return d.getTime();
}
export const isCurrent = (period, ref, now = Date.now()) => rangeOf(period, ref).from === rangeOf(period, now).from;
export const isFuture = (period, ref, now = Date.now()) => rangeOf(period, ref).from > now;

/** Splits [a,b) at local hour boundaries and calls cb(dateAtPieceStart, ms). */
function walkHours(a, b, cb) {
  let cur = a;
  while (cur < b) {
    const d = new Date(cur), nx = new Date(cur); nx.setMinutes(0, 0, 0); nx.setHours(nx.getHours() + 1);
    const end = Math.min(b, Math.max(nx.getTime(), cur + 1));
    cb(d, end - cur); cur = end;
  }
}

const bump = (m, k, init) => { let e = m.get(k); if (!e) { e = init(); m.set(k, e); } return e; };

/**
 * Statistics for [from,to). Time is clipped to the range, so playback across midnight is split between the days. A play is counted in the period where its qualified segment started.
 * meta(seg) -> { id, title, artists:[], albumKey, album, genres:[] } (titles/names already HTML-safe).
 */
export function aggregate(segs, from, to, meta) {
  const A = { from, to, totalMs: 0, fgMs: 0, bgMs: 0, plays: 0, songs: new Map(), artists: new Map(), albums: new Map(), genres: new Map(), hours: new Array(24).fill(0), weekdays: new Array(7).fill(0), days: new Map(), sessions: new Map(), songDay: new Map(), first: null, last: null, repeats: 0 };
  const qplays = [];   // v149: every counted play, to find repeats (the same song played again right after itself in one session = a loop / replay)
  for (const g of segs) {
    if (!g || typeof g.s !== 'number' || typeof g.d !== 'number' || !isFinite(g.s) || !isFinite(g.d)) continue;   // BUG-356 / BUG-357: one bad row must not blank the whole period
    const s0 = Math.max(g.s, from), e0 = Math.min(g.s + g.d, to); if (e0 <= s0) continue;
    const ms = e0 - s0, inStart = g.s >= from && g.s < to, q = g.q && inStart ? 1 : 0, m = meta(g);
    A.totalMs += ms; if (g.f) A.fgMs += ms; else A.bgMs += ms; A.plays += q;
    walkHours(s0, e0, (d, x) => { A.hours[d.getHours()] += x; A.weekdays[(d.getDay() + 6) % 7] += x; const k = dayKey(d.getTime()); const e = bump(A.days, k, () => ({ ms: 0, plays: 0, t: startOfDay(d.getTime()).getTime() })); e.ms += x; });
    if (q) { qplays.push({ s: g.s, sid: g.sid, id: m.id }); A.days.get(dayKey(g.s)).plays++; const sd = bump(A.songDay, m.id + '|' + dayKey(g.s), () => ({ id: m.id, day: dayKey(g.s), t: startOfDay(g.s).getTime(), plays: 0 })); sd.plays++; }
    const song = bump(A.songs, m.id, () => ({ id: m.id, name: m.title, artists: m.artists, albumKey: m.albumKey, album: m.album, plays: 0, ms: 0, last: 0, first: Infinity }));
    song.ms += ms; song.plays += q; song.last = Math.max(song.last, e0); song.first = Math.min(song.first, s0);
    for (const a of m.artists) { const e = bump(A.artists, a, () => ({ id: a, name: a, plays: 0, ms: 0, last: 0, songs: new Set() })); e.ms += ms; e.plays += q; e.last = Math.max(e.last, e0); e.songs.add(m.id); }
    const al = bump(A.albums, m.albumKey, () => ({ id: m.albumKey, name: m.album, plays: 0, ms: 0, last: 0, songs: new Set() })); al.ms += ms; al.plays += q; al.last = Math.max(al.last, e0); al.songs.add(m.id);
    for (const n of m.genres) { const e = bump(A.genres, n, () => ({ id: n, name: n, plays: 0, ms: 0, last: 0, songs: new Set() })); e.ms += ms; e.plays += q; e.last = Math.max(e.last, e0); e.songs.add(m.id); }
    const se = bump(A.sessions, g.sid, () => ({ id: g.sid, ms: 0, start: s0, end: e0, songs: new Set() })); se.ms += ms; se.start = Math.min(se.start, s0); se.end = Math.max(se.end, e0); se.songs.add(m.id);
    if (!A.first || s0 < A.first.at) A.first = { at: s0, id: m.id, name: m.title };
    if (!A.last || e0 > A.last.at) A.last = { at: e0, id: m.id, name: m.title };
  }
  qplays.sort((a, b) => a.s - b.s);
  for (let i = 1; i < qplays.length; i++) if (qplays[i].id === qplays[i - 1].id && qplays[i].sid === qplays[i - 1].sid) { A.repeats++; const so = A.songs.get(qplays[i].id); if (so) so.loops = (so.loops || 0) + 1; }
  A.longest = [...A.sessions.values()].sort((a, b) => b.ms - a.ms)[0] || null;
  return A;
}

const cmpName = (a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' });
export const SORTS = [['plays', 'Most played'], ['least', 'Least played'], ['time', 'Listening time'], ['recent', 'Recently played'], ['alpha', 'A to Z']];
/** Ranked array (new array). Ties always fall back to listening time, then recency, then name, so the order is stable. */
export function rank(map, mode = 'plays') {
  const a = [...(map instanceof Map ? map.values() : map)];
  const tie = (x, y) => y.ms - x.ms || y.last - x.last || cmpName(x, y);
  const f = { plays: (x, y) => y.plays - x.plays || tie(x, y), least: (x, y) => x.plays - y.plays || x.ms - y.ms || cmpName(x, y), time: (x, y) => y.ms - x.ms || y.plays - x.plays || cmpName(x, y), recent: (x, y) => y.last - x.last || cmpName(x, y), alpha: cmpName }[mode] || (() => 0);
  return a.sort(f);
}
export const bestDay = (A, dir = 1) => { const d = [...A.days.values()].filter(x => x.ms > 0); if (!d.length) return null; return d.sort((a, b) => dir * (b.ms - a.ms) || a.t - b.t)[0]; };

/** Streak from local day numbers (any order). current = consecutive days ending today (or yesterday), best = longest run ever. */
export function streaks(dayNums, today) {
  const set = new Set(dayNums); if (!set.size) return { current: 0, best: 0 };
  let cur = 0, d = set.has(today) ? today : today - 1; while (set.has(d)) { cur++; d--; }
  let best = 0; for (const n of set) { if (set.has(n - 1)) continue; let l = 0; while (set.has(n + l)) l++; best = Math.max(best, l); }
  return { current: cur, best };
}

/** Biggest obsession: the song played most times in one day. */
export const obsession = A => [...A.songDay.values()].sort((a, b) => b.plays - a.plays || a.t - b.t)[0] || null;

/** Listening personality from real numbers only. */
export function personality(A) {
  if (A.totalMs < 10 * 60000) return null;
  const night = (A.hours[22] + A.hours[23] + A.hours[0] + A.hours[1] + A.hours[2] + A.hours[3]) / A.totalMs, early = (A.hours[5] + A.hours[6] + A.hours[7] + A.hours[8]) / A.totalMs;
  const songs = rank(A.songs, 'plays'), top = songs[0], ta = rank(A.artists, 'time')[0];
  const uniqRatio = A.plays ? A.songs.size / A.plays : 0, artShare = ta ? ta.ms / A.totalMs : 0, topShare = A.plays && top ? top.plays / A.plays : 0;
  if (topShare >= .12 && top.plays >= 5) return { name: 'The Repeater', text: 'When you love a song you play it again and again.' };
  if (artShare >= .4) return { name: 'The Loyalist', text: 'One artist owns your headphones.' };
  if (uniqRatio >= .75 && A.songs.size >= 15) return { name: 'The Explorer', text: 'You rarely play the same song twice.' };
  if (night >= .35) return { name: 'The Night Owl', text: 'Your music comes alive after dark.' };
  if (early >= .3) return { name: 'The Early Bird', text: 'You start the day with music.' };
  return { name: 'The Steady Listener', text: 'A balanced mix of favorites and variety.' };
}

/** New discoveries: songs / artists heard in the range that were never heard before it. `seen` = { songs:Set, artists:Set } of everything before `from`. */
export function discoveries(A, seen) {
  const songs = rank([...A.songs.values()].filter(s => !seen.songs.has(s.id)), 'plays');
  const artists = rank([...A.artists.values()].filter(a => !seen.artists.has(a.id)), 'plays');
  return { songs, artists };
}

export const pctChange = (cur, prev) => (prev > 0 ? Math.round((cur - prev) / prev * 100) : null);
/** Total ms in [from,to) without building the full aggregate (cheap comparisons). */
export const sumMs = (segs, from, to) => { let t = 0; for (const g of segs) { if (!g || !isFinite(g.s) || !isFinite(g.d)) continue; const a = Math.max(g.s, from), b = Math.min(g.s + g.d, to); if (b > a) t += b - a; } return t; };

export function fmtDur(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;   // BUG-358
  const s = Math.round(ms / 1000);
  if (s < 60) return s + ' s';
  const m = Math.round(s / 60); if (m < 60) return m + ' min';
  const h = Math.floor(m / 60); return h + ' h ' + String(m % 60).padStart(2, '0') + ' min';
}

/** Hourly listening totals for [from,to) straight from the segments (cheap: no per-song maths). Returns { hours:[24], totalMs } so dayNight() accepts it like an aggregate. */
export function hoursOf(segs, from, to) {
  const hours = new Array(24).fill(0); let totalMs = 0;
  for (const g of segs) { if (!g || !isFinite(g.s) || !isFinite(g.d)) continue; const s0 = Math.max(g.s, from), e0 = Math.min(g.s + g.d, to); if (e0 <= s0) continue; totalMs += e0 - s0; walkHours(s0, e0, (d, x) => { hours[d.getHours()] += x; }); }
  return { hours, totalMs };
}

/** Solar (day, 06:00-17:59) vs lunar (night, 18:00-05:59) share of listening time, from the real hourly totals. Percentages always add up to 100. Works on an aggregate or on hoursOf(). */
export function dayNight(A) {
  if (!A.totalMs) return null;
  let day = 0; for (let h = 6; h < 18; h++) day += A.hours[h];
  const solar = Math.round(day / A.totalMs * 100), lunar = 100 - solar;
  const kind = Math.abs(solar - lunar) <= 10 ? 'balanced' : solar > lunar ? 'solar' : 'lunar';
  return { solar, lunar, kind, name: kind === 'solar' ? 'Solar listener' : kind === 'lunar' ? 'Lunar listener' : 'Balanced listener', text: kind === 'solar' ? 'Your music belongs to the daytime.' : kind === 'lunar' ? 'Your music comes alive after dark.' : 'You listen about equally by day and by night.' };
}

/** v148: "11 AM", "12 PM", "12 AM" for an hour 0-23. */
export const hour12 = h => (h % 12 || 12) + (h < 12 ? ' AM' : ' PM');
/** v148: short axis label: 12a 3a 6a 9a 12p 3p 6p 9p. */
export const hour12s = h => (h % 12 || 12) + (h < 12 ? 'a' : 'p');
/** v148: tiny label above a bar: 5m, 52m, 1h05. */
export const fmtShort = ms => { const m = Math.round((Number.isFinite(ms) ? ms : 0) / 60000); if (m < 1) return '<1m'; if (m < 60) return m + 'm'; return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); };
/** v148: what the hour chart says in words. hours = 24 totals in ms. busiest = the hour with the most listening (first one on a tie), active = every hour with music, in clock order. */
export function hourSummary(hours) {
  const hs = Array.from({ length: 24 }, (_, i) => (Number.isFinite(hours && hours[i]) && hours[i] > 0 ? hours[i] : 0));
  const total = hs.reduce((a, b) => a + b, 0), mx = Math.max(...hs);
  return { total, max: mx, busiest: mx > 0 ? hs.indexOf(mx) : -1, active: hs.map((ms, h) => ({ h, ms })).filter(x => x.ms > 0) };
}
