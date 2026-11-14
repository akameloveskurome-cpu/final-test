// T20: play counts. Pure (no DOM, no Native). Persistence = store 'stats' (native.js): { trackId: { plays, last } }, `last` = ms timestamp of the latest counted play.
export const STATS_FILE = 'stats';
export const TOP_N = Infinity;   // no limit
const MAX_STEP = 5;   // seconds. A progress step bigger than this is a seek, not listening (events normally come every 0.15 s)

/** Clean a value read from disk. Anything unusable becomes {}. */
export function cleanStats(x) {
  const out = {};
  if (!x || typeof x !== 'object' || Array.isArray(x)) return out;
  for (const [id, v] of Object.entries(x)) {
    if (!id || id === '__proto__' || id === 'constructor' || id === 'prototype' || !v || typeof v !== 'object') continue;   // BUG-149
    const plays = Math.floor(+v.plays), last = +v.last;
    if (plays >= 1 && Number.isFinite(plays) && Number.isFinite(last) && last >= 0) {
      const e = { plays, last };
      if (Number.isFinite(+v.pg) && +v.pg >= 0) e.pg = +v.pg;   // BUG-322 / 150: when the PAGE last counted this song
      if (Array.isArray(v.nat)) { const n = v.nat.map(Number).filter(t => Number.isFinite(t) && t > 0).slice(-10); if (n.length) e.nat = n; }   // the last native play times already merged (a re-delivery is the same time)
      out[id] = e;
    }
  }
  return out;
}

/** New stats object with one more play for `id` at time `now` (the input is not changed). */
export const bump = (stats, id, now) => ({ ...stats, [id]: { ...(stats[id] || {}), plays: (stats[id] ? stats[id].plays : 0) + 1, last: Math.max(now, stats[id] ? stats[id].last : 0), pg: now } });

const DUP_MS = 2500;   // BUG-322 / 150: the page and the background service count the SAME play within about a second of each other (each at its own 30 s mark). Two native plays of a song are never this close unless the song is shorter than about 5 s.
/**
 * Plays counted natively (LiquidNative takePlays(): [{ id, ts }]) while the page was not running. Same idea as Last.fm's scrobble rule (a play is identified by song + time):
 *  - a native play at the exact time already merged is a re-delivery (failed save): skipped;
 *  - a native play within DUP_MS of the moment the PAGE counted the same song is the same play counted twice: skipped;
 *  - everything else counts, even when it is OLDER than the page's last count (nothing real is lost). Returns { stats, added }; the input is not changed.
 */
export function mergePlays(stats, plays) {
  const list = (Array.isArray(plays) ? plays : [])
    .filter(p => p && typeof p.id === 'string' && p.id && Number.isFinite(+p.ts) && +p.ts > 0)
    .map(p => ({ id: p.id, ts: +p.ts })).sort((a, b) => a.ts - b.ts);
  let out = stats, added = 0;
  for (const { id, ts } of list) {
    const cur = out[id];
    if (cur) {
      const seen = Array.isArray(cur.nat) ? cur.nat : [];
      if (seen.includes(ts)) continue;
      const pg = Number.isFinite(cur.pg) ? cur.pg : (seen.length ? null : cur.last);   // old data has no pg: its last was the page's (or an older native play)
      if (pg != null && Math.abs(pg - ts) <= DUP_MS) continue;
      if (pg == null && !seen.length && cur.last >= ts - DUP_MS) continue;
    }
    out = { ...out, [id]: { ...(cur || {}), plays: (cur ? cur.plays : 0) + 1, last: Math.max(ts, cur ? cur.last : 0), nat: [...((cur && cur.nat) || []), ts].slice(-10) } }; added++;
  }
  return { stats: out, added };
}

const present = (stats, tracks) => tracks.map((t, i) => ({ t, i, s: stats[t.id] })).filter(x => x.s);
/** Recently played songs still in the library, newest first. */
export const recentList = (stats, tracks, n = TOP_N) => present(stats, tracks).sort((a, b) => b.s.last - a.s.last || a.i - b.i).slice(0, n).map(x => x.t);
/** Most played songs still in the library: plays desc, then most recent, then library order. Top `n` (default: all). */
export const topList = (stats, tracks, n = TOP_N) => present(stats, tracks).sort((a, b) => b.s.plays - a.s.plays || b.s.last - a.s.last || a.i - b.i).slice(0, n).map(x => x.t);

/** When does a listen count as a play? After 10 s of real listening or half the song, whichever comes first. */
export const threshold = dur => (dur > 0 ? Math.min(10, dur / 2) : 10);

/**
 * Counts listening time of the CURRENT song. Use: `c.track(id)` when the song changes, `c.tick(pos, dur)` on every progress event.
 * tick() returns true exactly once per play. Seeking does not count (steps > 5 s or backwards are ignored). Repeat-one (position wraps from the end back to the start) starts a new play.
 */
export function makeCounter() {
  let id = null, last = null, heard = 0, counted = false;
  return {
    track(newId) { if (newId !== id) { id = newId; last = null; heard = 0; counted = false; } },
    tick(pos, dur) {
      if (id == null || !Number.isFinite(pos)) return false;
      if (last != null) {
        const d = pos - last;
        if (d < 0 && counted && dur > 0 && last > dur - 5 && pos < 3) { heard = 0; counted = false; }   // repeat-one wrapped around
        else if (d > 0 && d <= MAX_STEP) heard += d;
      }
      last = pos;
      if (!counted && heard >= threshold(dur)) { counted = true; return true; }
      return false;
    },
  };
}
