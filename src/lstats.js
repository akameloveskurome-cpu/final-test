// Listening Statistics UI (home section, Daily/Weekly/Monthly/Yearly/Overall dashboard, lists, details, shareable Snapshot picture). All numbers come from listenstats.js over the stored segments.
import { rangeOf, shiftRef, isCurrent, isFuture, aggregate, rank, SORTS, bestDay, streaks, obsession, personality, dayNight, hoursOf, hourSummary, hour12, hour12s, fmtShort, discoveries, pctChange, sumMs, fmtDur, dayNum, dayKey, addDays } from './listenstats.js';
import { buildSnapshot, makeSnapshotPng, shareText, snapshotName } from './snapshot.js';
import { toBase64 } from './transfer.js';

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PERIODS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly'], ['overall', 'Overall']];

const fold = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();   // BUG-240: the filter ignores case AND accents (Beyonce finds Beyoncé)
export function initLStats(D) {
  const { Native, escH, pl, I, unesc } = D;
  const S = { period: 'daily', ref: Date.now(), follow: true, stale: false, scope: 'period', sort: { songs: 'plays', artists: 'plays', albums: 'plays', genres: 'plays' }, data: null, key: '', loading: false, all: null, home: null, homeAt: 0, homeBusy: false, homeFailAt: 0, hist: null };

  /* ---------- metadata: library first, the snapshot stored with the playback otherwise (never invented) ---------- */
  let idMap = null, idN = -1, idArr = null;
  const byId = id => { const arr = D.tracks(); if (!idMap || idArr !== arr || idN !== arr.length) { idMap = new Map(arr.map(t => [t.id, t])); idN = arr.length; idArr = arr; } return idMap.get(id); };   // BUG-244: a replaced library rebuilds the map too
  const meta = g => {
    const t = byId(g.i), al = t ? D.trackAlbum(t) : null;
    if (t) return { id: g.i, title: t.title, artists: D.trackArtists(t), albumKey: t.albumId || 'x:' + (g.al || ''), album: al && al.title || escH(g.al || 'Unknown Album'), genres: (t.genres || []).filter(n => n && !/^unknown$/i.test(n)) };
    return { id: g.i, title: escH(g.t || 'Unknown song'), artists: D.snapshotArtists ? D.snapshotArtists(g.a, g.t, g.aa) : [escH(g.a || 'Unknown Artist')], albumKey: 'x:' + (g.al || ''), album: escH(g.al || 'Unknown Album'), genres: [] };   // v158: same grouping rules as the library
  };
  const albumObj = (key, name) => (key && D.byAlbum(key)) || { g: 'var(--row-fill)', title: name };
  const songCover = id => { const t = byId(id); return t ? D.trackAlbum(t) : { g: 'var(--row-fill)' }; };
  /* Listening stats always show the ORIGINAL art (the song's / album's cover from the music files). The custom artist photos, GIFs and pictures are only for browsing the library and Home. */
  let artistFirst = null, artistFirstArr = null, artistFirstN = -1;   // BUG-112: one pass per library, not one scan per row
  const origArtistCov = (name, cls = '') => { const arr = D.tracks(); if (!artistFirst || artistFirstArr !== arr || artistFirstN !== arr.length) { artistFirst = new Map(); artistFirstArr = arr; artistFirstN = arr.length; for (const x of arr) for (const a of D.trackArtists(x)) if (!artistFirst.has(a)) artistFirst.set(a, x); } const t = artistFirst.get(name); return cov(t ? D.trackAlbum(t) : { g: 'var(--row-fill)' }, cls); };
  const cov = (a, cls = 'thumb') => `<span class="cover blk ${cls}" style="--g:${a.g}"></span>`;

  /* ---------- data ---------- */
  const fetchSegs = async (from, to) => { for (let i = 0; i < 2; i++) { try { const r = await Native.getListens({ from, to }); if (Array.isArray(r && r.segs)) { if (D.learnArtists) D.learnArtists(r.segs.flatMap(g => [g.a, g.aa])); return r.segs; } } catch { } } throw new Error('Could not read the listening history'); };   /* BUG-71 / 242: a failed read is not "no listening" */
  const seenCache = new Map();
  async function seenBefore(from) {
    if (seenCache.has(from)) return seenCache.get(from);
    let r = []; try { r = (await Native.getListenSeen(from)).seen || []; } catch { }
    const v = { songs: new Set(r.map(x => x.i)), artists: new Set(r.flatMap(x => meta({ i: x.i, a: x.a, al: x.al, aa: x.aa, t: x.t }).artists)) };
    seenCache.set(from, v); if (seenCache.size > 8) seenCache.delete(seenCache.keys().next().value); return v;
  }
  const keyOf = () => S.period + ':' + rangeOf(S.period, S.ref).from;
  async function load(force) {
    if (S.period === 'overall') return;
    const key = keyOf(); if (S.loading || (!force && S.key === key && S.data)) return;
    if (!force && S.failKey === key && Date.now() - S.failAt < 5000) return;   // v148: a failed read is not retried in a tight render loop
    S.loading = true; S.stale = false;
    try {
      const r = rangeOf(S.period, S.ref), prev = rangeOf(S.period, shiftRef(S.period, S.ref, -1));
      const wide = S.period === 'monthly' ? rangeOf('monthly', shiftRef('monthly', S.ref, -5)).from : prev.from;
      const [segs, dn] = await Promise.all([fetchSegs(Math.min(wide, prev.from), r.to), Native.getListenDays().then(x => x.days || []).catch(() => [])]);
      const A = aggregate(segs, r.from, r.to, meta), P = aggregate(segs, prev.from, isCurrent(S.period, S.ref) ? Math.min(prev.to, prev.from + Math.max(0, Date.now() - r.from)) : prev.to, meta);   // BUG-114: a running week / month is compared with the same stretch of the previous one
      const seen = S.period === 'monthly' || S.period === 'yearly' ? await seenBefore(r.from) : null;
      S.data = { key, r, A, P, segs, dn, seen, disc: seen ? discoveries(A, seen) : null }; S.key = key; S.failKey = '';
    } catch { S.data = null; S.failKey = key; S.failAt = Date.now(); }
    S.loading = false; D.rerender();
  }
  let allFlight = null;   // BUG-109: one full history read at a time, later callers share it
  const loadAll = () => { if (S.all && Date.now() - S.all.at < 20000) return Promise.resolve(S.all); if (!allFlight) allFlight = loadAllNow().finally(() => { allFlight = null; }); return allFlight; };
  async function loadAllNow() {
    if (S.all && Date.now() - S.all.at < 20000) return S.all;
    const segs = await fetchSegs(0, Date.now() + 864e5), now = Date.now();
    // Solar / lunar for today, this week, this month, this year and all time (always "now", whatever date the screen is browsing)
    const dn = [['Today', 'daily'], ['This week', 'weekly'], ['This month', 'monthly'], ['This year', 'yearly']].map(([name, p]) => { const r = rangeOf(p, now); return { name, n: dayNight(hoursOf(segs, r.from, r.to)) }; });
    S.all = { at: now, segs, A: aggregate(segs, 0, now + 864e5, meta), dn }; S.all.dn.push({ name: 'All time', n: dayNight(S.all.A) }); return S.all;
  }
  const ensureAll = () => { if (S.allBusy || (S.all && Date.now() - S.all.at < 20000)) return; S.allBusy = true; loadAll().catch(() => { }).finally(() => { S.allBusy = false; D.rerender(); }); };
  const scopeAgg = () => (S.scope === 'all' && S.all ? S.all.A : S.data && S.data.A);

  /* ---------- small HTML parts ---------- */
  const big = (b, s) => `<div><b>${b}</b><span>${s}</span></div>`;
  const stats = a => `<div class="mystats lsm">${a.join('')}</div>`;
  const head = (t, act = '', label = '') => `<div class="sechead"><h2 class="sec">${t}</h2>${act ? `<button class="seeall" data-act="${act}">${label}</button>` : ''}</div>`;
  const fdate = ms => ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';
  const ftime = ms => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const label = (p, ref) => {
    if (p === 'overall') return 'All time';
    const r = rangeOf(p, ref), d = new Date(r.from);
    if (p === 'daily') return isCurrent(p, ref) ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    if (p === 'weekly') { const e = new Date(r.to - 1); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' – ' + e.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    if (p === 'monthly') return MON[d.getMonth()] + ' ' + d.getFullYear();
    return String(d.getFullYear());
  };
  const bars = (vals, labels, acts, hi = -1) => { const mx = Math.max(1, ...vals); return `<div class="lsbars" style="--n:${vals.length}">${vals.map((v, i) => `<${acts ? 'button' : 'div'} class="lsbar${i === hi ? ' hi' : ''}" ${acts ? `data-act="${acts[i]}" ` : ''}title="${fmtDur(v)}"><i style="height:${Math.max(v ? 4 : 0, Math.round(v / mx * 100))}%"></i><em>${labels[i]}</em></${acts ? 'button' : 'div'}>`).join('')}</div>`; };
  /* v148: the hour-of-day chart, ALL 24 hours: one row 12 AM - 11 AM, one row 12 PM - 11 PM, same scale, every hour named (12 1 2 ... 11), minutes above every bar that has music.
     Solid red bars (the old ones were 18% red on black), the busiest hour brighter, the current hour marked with a dot, a sentence under it. `list` = also name every hour with music (one day only). */
  const hoursChart = (hrs, nowH = -1, list = false) => {
    const sm = hourSummary(hrs); if (!sm.total) return '';
    const row = (from, cap) => `<div class="lshcap">${cap}</div><div class="lshours">${Array.from({ length: 12 }, (_, k) => {
      const i = from + k, v = hrs[i] > 0 ? hrs[i] : 0, pct = v ? Math.max(6, Math.round(v / sm.max * 100)) : 0;
      return `<div class="lshb${i === sm.busiest ? ' pk' : ''}${i === nowH ? ' now' : ''}${v ? '' : ' z'}" title="${hour12(i)}: ${v ? fmtDur(v) : 'no listening'}"><i style="height:${pct}%"></i>${v ? `<b style="bottom:${pct}%">${fmtShort(v)}</b>` : ''}<em>${i % 12 || 12}</em></div>`;
    }).join('')}</div>`;
    const names = list && sm.active.length <= 12 ? `<div class="lsnote">${sm.active.map(x => `${hour12(x.h)} <b>${fmtDur(x.ms)}</b>`).join(' · ')}</div>` : '';
    return `${row(0, '12 AM – 11 AM')}${row(12, '12 PM – 11 PM')}<div class="lsnote">Busiest hour: <b>${hour12(sm.busiest)}</b> · ${fmtDur(sm.max)}. Both rows use the same scale. Times are your phone's local time.</div>${names}`;
  };
  const rowSong = (e, i) => { const t = byId(e.id), a = songCover(e.id); return `<button class="row lsrow" data-act="ls-song" data-id="${escH(e.id)}"><span class="lsrank">${i + 1}</span>${cov(a)}<span class="meta"><b>${e.name}</b><span>${e.artists.join(', ')}${t ? '' : ''}</span><span class="lsmini">${pl(e.plays, 'play')} · ${fmtDur(e.ms)} · ${fdate(e.last)}</span></span></button>`; };
  const rowArtist = (e, i) => `<button class="row lsrow" data-act="ls-artist" data-id="${escH(e.id)}"><span class="lsrank">${i + 1}</span>${origArtistCov(e.id)}<span class="meta"><b>${e.name}</b><span class="lsmini">${pl(e.plays, 'play')} · ${fmtDur(e.ms)} · ${pl(e.songs.size, 'song')} · ${fdate(e.last)}</span></span></button>`;
  const rowAlbum = (e, i) => `<button class="row lsrow" data-act="ls-album" data-id="${escH(e.id)}"><span class="lsrank">${i + 1}</span>${cov(albumObj(e.id, e.name))}<span class="meta"><b>${e.name}</b><span class="lsmini">${pl(e.plays, 'play')} · ${fmtDur(e.ms)} · ${fdate(e.last)}</span></span></button>`;
  const rowGenre = (e, i) => `<div class="row lsrow"><span class="lsrank">${i + 1}</span><span class="meta"><b>${e.name}</b><span class="lsmini">${pl(e.plays, 'play')} · ${fmtDur(e.ms)} · ${pl(e.songs.size, 'song')}</span></span></div>`;
  const ROWS = { songs: rowSong, artists: rowArtist, albums: rowAlbum, genres: rowGenre };
  const MAPS = { songs: 'songs', artists: 'artists', albums: 'albums', genres: 'genres' };
  const list = (kind, A, n, title) => { const r = rank(A[MAPS[kind]], 'plays'); if (!r.length) return ''; return `<div class="sechead"><h2 class="sec">${title}</h2><button class="seeall" data-act="ls-all" data-k="${kind}">View All</button></div><div class="lslist">${r.slice(0, n).map(ROWS[kind]).join('')}</div>`; };
  const topCard = (cap, kind, e) => !e ? '' : `<button class="lstop" data-act="${kind === 'songs' ? 'ls-song' : kind === 'artists' ? 'ls-artist' : 'ls-album'}" data-id="${escH(e.id)}">${kind === 'songs' ? cov(songCover(e.id), 'lsbigart') : kind === 'albums' ? cov(albumObj(e.id, e.name), 'lsbigart') : origArtistCov(e.id)}<span class="meta"><em>${cap}</em><b>${e.name}</b><span>${pl(e.plays, 'play')} · ${fmtDur(e.ms)}</span></span></button>`;
  const tops = (A, ap = 'Top') => `<div class="lstops">${topCard(ap + ' song', 'songs', rank(A.songs)[0])}${topCard(ap + ' artist', 'artists', rank(A.artists)[0])}${topCard(ap + ' album', 'albums', rank(A.albums)[0])}</div>`;
  const cmp = (cur, prev, what) => { const p = pctChange(cur, prev); return `<span class="lscmp ${p == null ? '' : p >= 0 ? 'up' : 'down'}">${p == null ? (cur ? `New: no ${what} before` : 'No listening') : (p >= 0 ? '▲ ' : '▼ ') + Math.abs(p) + '%'}</span>`; };
  const genreBlock = A => { const g = rank(A.genres, 'time'); if (!g.length) return `${head('Genres')}<div class="empty">No genre tags found for what you played.</div>`; const tot = g.reduce((n, x) => n + x.ms, 0) || 1; return `${head('Genres')}<div class="lslist">${g.slice(0, 8).map((x, i) => `<div class="row lsrow"><span class="lsrank">${i + 1}</span><span class="meta"><b>${x.name}</b><span class="lsmini">${Math.round(x.ms / tot * 100)}% · ${fmtDur(x.ms)} · ${pl(x.plays, 'play')}</span></span></div>`).join('')}</div>`; };

  const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>', MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';
  const SNAPIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  const dnMeter = n => `<div class="lsdnh"><span class="sun">${SUN}<b>${n.solar}%</b><em>Solar · day</em></span><span class="moon"><em>Lunar · night</em><b>${n.lunar}%</b>${MOON}</span></div><div class="lsdnbar"><i style="width:${n.solar}%"></i></div>`;
  const dnBlock = (A, onlyOverall) => {
    const n = dayNight(A); if (!n) return '';
    const all = S.all, ov = all && all.dn[4] && all.dn[4].n;
    const rows = all ? all.dn.map(r => r.n ? `<div class="lsdnrow"><span>${r.name}</span><div class="lsdnbar sm"><i style="width:${r.n.solar}%"></i></div><b>${r.n.solar}% day · ${r.n.lunar}% night</b></div>` : `<div class="lsdnrow"><span>${r.name}</span><em>No listening</em></div>`).join('') : '';
    return `${head('Day or night?')}<div class="lsdn">
      ${onlyOverall ? '' : `<div class="lsdncap">${label(S.period, S.ref)}</div>${dnMeter(n)}
      <div class="lsnote"><b>${n.name}</b>: ${n.text} Day = 6 AM to 6 PM, night = 6 PM to 6 AM.</div>`}
      <div class="lsdncap">Overall · all time</div>${ov ? dnMeter(ov) + `<div class="lsnote"><b>${ov.name}</b>: ${ov.text}</div>` : `<div class="lsnote">${all ? 'No listening recorded yet.' : 'Loading…'}</div>`}
      <div class="lsdncap">Today, week, month, year and overall</div>${rows || '<div class="lsnote">Loading…</div>'}</div>`;
  };

  /* ---------- Overall (everything ever recorded) ---------- */
  const dnRow = (name, h, act) => { const n = dayNight(h); return n ? `<div class="lsdnrow"><span>${name}</span><div class="lsdnbar sm"><i style="width:${n.solar}%"></i></div><b>${fmtDur(h.totalMs)} · ${n.solar}% day</b></div>` : ''; };
  function overallBody() {
    ensureAll(); const all = S.all;
    if (!all) return '<div class="empty">Loading…</div>';
    const A = all.A; if (!A.totalMs) return '<div class="empty">No listening recorded yet.<br>Play a song and it appears here, even with the app closed.</div>';
    const segs = all.segs, now = new Date(), y0 = new Date(A.first.at).getFullYear();
    const years = []; for (let y = now.getFullYear(); y >= y0; y--) years.push([String(y), hoursOf(segs, new Date(y, 0, 1).getTime(), new Date(y + 1, 0, 1).getTime())]);
    const months = []; for (let k = 0; k < 12; k++) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); months.push([MON[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear(), hoursOf(segs, d.getTime(), new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime())]); }
    const sk = streaks([...new Set(segs.map(g => dayNum(g.s)))], dayNum(Date.now()));
    let h = stats([big(Math.round(A.totalMs / 36e5 * 10) / 10 + ' h', 'listening'), big(A.plays, 'songs played'), big(A.songs.size, 'unique songs'), big(A.artists.size, 'artists'), big(A.albums.size, 'albums'), big(A.sessions.size, 'sessions')]); if (A.repeats) h += stats([big(A.repeats, A.repeats === 1 ? 'repeat (loop)' : 'repeats (loops)')]);
    h += `<div class="lsnote">Since <b>${fdate(A.first.at)}</b> · ${A.days.size} days with music · best streak <b>${sk.best} ${sk.best === 1 ? 'day' : 'days'}</b></div>`;
    h += dnBlock(A, true);
    h += `${head('Hour of day')}${hoursChart(A.hours)}<div class="lsnote">Weekday:</div>${bars(A.weekdays, WD, null)}`;
    h += `${head('Year by year')}<div class="lsdn">${years.map(([n, x]) => dnRow(n, x)).join('') || '<div class="lsnote">Nothing yet.</div>'}</div>`;
    h += `${head('Last 12 months')}<div class="lsdn">${months.map(([n, x]) => dnRow(n, x) || `<div class="lsdnrow"><span>${n}</span><em>No listening</em></div>`).join('')}</div>`;
    return h + tops(A) + list('songs', A, 10, 'Top songs') + list('artists', A, 10, 'Top artists') + list('albums', A, 10, 'Top albums') + genreBlock(A);
  }

  /* ---------- dashboard ---------- */
  function body() {
    const d = S.data; if (!d) return `<div class="empty">${S.loading ? 'Loading…' : 'Could not read listening history.'}</div>`;
    const { A, P, segs, r } = d, p = S.period;
    if (!A.totalMs) return `<div class="empty">No listening recorded ${p === 'daily' ? 'for this day' : p === 'weekly' ? 'for this week' : p === 'monthly' ? 'for this month' : 'for this year'}.<br>Play a song and it appears here, even with the app closed.</div>`;
    const nd = Math.ceil((Math.min(r.to, Date.now()) - r.from - 36e5) / 864e5 - 1e-9) || 1;
    const sk = streaks(d.dn, dayNum(Date.now()));
    let h = '';
    if (p === 'daily') {
      h += stats([big(fmtDur(A.totalMs), 'listening'), big(A.plays, 'songs played'), big(A.songs.size, 'unique songs'), big(A.artists.size, 'artists'), big(A.albums.size, 'albums'), big(fmtDur(A.longest ? A.longest.ms : 0), 'longest session')]); if (A.repeats) h += stats([big(A.repeats, A.repeats === 1 ? 'repeat (loop)' : 'repeats (loops)')]);
      h += tops(A);
      h += `${head('Hourly activity')}${hoursChart(A.hours, isCurrent('daily', S.ref) ? new Date().getHours() : -1, true)}`;
      h += dnBlock(A);
      h += stats([big(fmtDur(A.fgMs), 'in the app'), big(fmtDur(A.bgMs), 'in background'), big(A.first ? ftime(A.first.at) : '–', 'first song')]);
      h += `<div class="lsnote">First: <b>${A.first.name}</b> at ${ftime(A.first.at)}<br>Last: <b>${A.last.name}</b> at ${ftime(A.last.at)}</div>`;
      h += `${head('All songs today')}<div class="lslist">${rank(A.songs).map(rowSong).join('')}</div>`;
    } else if (p === 'weekly') {
      const bd = bestDay(A, 1), wd = bestDay(A, -1), dayVals = [], dayActs = [];
      for (let i = 0; i < 7; i++) { const t = addDays(new Date(r.from), i), e = A.days.get(dayKey(t.getTime())); dayVals.push(e ? e.ms : 0); dayActs.push('ls-day:' + t.getTime()); }
      const act = dayVals.filter((v, i) => r.from + i * 864e5 <= Date.now());
      h += stats([big(fmtDur(A.totalMs), 'listening'), big(fmtDur(A.totalMs / nd), 'daily average'), big(A.plays, 'songs played'), big(sk.current + (sk.current === 1 ? ' day' : ' days'), 'streak'), big(fmtDur(A.bgMs), 'in background'), big(cmp(A.totalMs, P.totalMs, 'week'), isCurrent(S.period, S.ref) ? 'vs same time last week' : 'vs last week')].map(x => x));
      h += `${head('Daily activity')}${bars(dayVals, WD, dayActs, bd ? new Date(bd.t).getDay() === 0 ? 6 : new Date(bd.t).getDay() - 1 : -1)}`;
      h += `<div class="lsnote">Most active: <b>${bd ? new Date(bd.t).toLocaleDateString(undefined, { weekday: 'long' }) : '–'}</b> (${bd ? fmtDur(bd.ms) : ''})<br>Quietest day with music: <b>${wd ? new Date(wd.t).toLocaleDateString(undefined, { weekday: 'long' }) : '–'}</b> (${wd ? fmtDur(wd.ms) : ''})</div>`;
      h += dnBlock(A) + list('songs', A, 10, 'Top songs') + list('artists', A, 10, 'Top artists') + list('albums', A, 10, 'Top albums');
    } else if (p === 'monthly') {
      const first = new Date(r.from), lead = (first.getDay() + 6) % 7, nDays = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), mx = Math.max(1, ...[...A.days.values()].map(x => x.ms));
      const cells = '<i></i>'.repeat(lead) + Array.from({ length: nDays }, (_, i) => { const t = new Date(first.getFullYear(), first.getMonth(), i + 1), e = A.days.get(dayKey(t.getTime())); return `<button class="lscell" data-act="ls-day:${t.getTime()}" style="--v:${e ? Math.max(.12, e.ms / mx) : 0}" title="${e ? fmtDur(e.ms) : 'No listening'}"><b>${i + 1}</b></button>`; }).join('');
      const weeks = []; for (let w = rangeOf('weekly', r.from).from; w < r.to; w = addDays(new Date(w), 7).getTime()) weeks.push(sumMs(segs, Math.max(w, r.from), Math.min(addDays(new Date(w), 7).getTime(), r.to)));
      const hist = []; for (let k = 5; k >= 0; k--) { const rr = rangeOf('monthly', shiftRef('monthly', S.ref, -k)); hist.push([MON[new Date(rr.from).getMonth()].slice(0, 3), sumMs(segs, rr.from, rr.to)]); }
      const ob = obsession(A), per = personality(A), ts = rank(A.songs)[0], ta = rank(A.artists)[0], tb = rank(A.albums)[0], dsc = d.disc;
      h += stats([big(fmtDur(A.totalMs), 'listening'), big(A.plays, 'songs played'), big(A.songs.size, 'unique songs'), big(fmtDur(A.totalMs / nd), 'daily average'), big(A.artists.size, 'artists'), big(cmp(A.totalMs, P.totalMs, 'month'), isCurrent(S.period, S.ref, Date.now()) ? 'vs same time last month' : 'vs last month')]);
      h += `<div class="lshl">${[['Song of the Month', ts && ts.name, ts && pl(ts.plays, 'play')], ['Artist of the Month', ta && ta.name, ta && fmtDur(ta.ms)], ['Album of the Month', tb && tb.name, tb && fmtDur(tb.ms)], ['Biggest Obsession', ob && (byId(ob.id) ? byId(ob.id).title : (A.songs.get(ob.id) || {}).name), ob && `${pl(ob.plays, 'play')} on ${fdate(ob.t)}`], ['Listening Personality', per && per.name, per && per.text]].filter(x => x[1]).map(x => `<div class="lshlc"><em>${x[0]}</em><b>${x[1]}</b><span>${x[2]}</span></div>`).join('')}</div>`;
      h += `${head('Calendar')}<div class="lscal">${WD.map(x => `<em>${x[0]}</em>`).join('')}${cells}</div>`;
      h += `${head('Weekly breakdown')}${bars(weeks, weeks.map((_, i) => 'W' + (i + 1)), null)}`;
      h += dnBlock(A);
      h += `${head('Last 6 months')}${bars(hist.map(x => x[1]), hist.map(x => x[0]), null, 5)}`;
      h += list('songs', A, 20, 'Top songs') + list('artists', A, 10, 'Top artists') + list('albums', A, 10, 'Top albums') + genreBlock(A);
      if (dsc) h += `${head('New discoveries')}<div class="lsnote">${pl(dsc.songs.length, 'new song')} and ${pl(dsc.artists.length, 'new artist')} you had never played before this month.</div><div class="lslist">${dsc.songs.slice(0, 5).map(rowSong).join('')}</div>`;
    } else {
      const ml = Array.from({ length: 12 }, (_, m) => aggregate(segs, new Date(new Date(r.from).getFullYear(), m, 1).getTime(), new Date(new Date(r.from).getFullYear(), m + 1, 1).getTime(), meta));
      const best = ml.reduce((b, x, i) => (x.totalMs > ml[b].totalMs ? i : b), 0), dsc = d.disc;
      h += stats([big(Math.round(A.totalMs / 36e5 * 10) / 10 + ' h', 'listening'), big(A.plays, 'songs played'), big(A.songs.size, 'unique songs'), big(A.artists.size, 'artists'), big(A.albums.size, 'albums'), big(A.sessions.size, 'sessions')]); if (A.repeats) h += stats([big(A.repeats, A.repeats === 1 ? 'repeat (loop)' : 'repeats (loops)')]);
      h += `${head('Month by month')}${bars(ml.map(x => x.totalMs), MON.map(x => x[0]), MON.map((_, i) => 'ls-month:' + new Date(new Date(r.from).getFullYear(), i, 15).getTime()), best)}`;
      h += `<div class="lsnote">Busiest month: <b>${MON[best]}</b> (${fmtDur(ml[best].totalMs)}). Listening by weekday and hour:</div>${bars(A.weekdays, WD, null)}${hoursChart(A.hours)}`;
      h += dnBlock(A) + tops(A, 'Top') + list('songs', A, 100, 'Top 100 songs') + list('artists', A, 20, 'Top 20 artists') + list('albums', A, 20, 'Top 20 albums') + genreBlock(A);
      if (dsc) h += `${head('Discoveries')}<div class="lsnote">${pl(dsc.songs.length, 'new song')} and ${pl(dsc.artists.length, 'new artist')} first heard this year.</div>`;
    }
    return h;
  }
  const screenLStats = () => {
    if (S.follow) S.ref = Date.now();   // showing "now": the day / week / month rolls over by itself (midnight) while the screen is open
    const key = keyOf(); if (S.period !== 'overall' && (!S.data || S.key !== key || S.stale)) load(S.stale); ensureAll();
    const ov = S.period === 'overall', cur = ov || isCurrent(S.period, S.ref), fut = ov || isFuture(S.period, shiftRef(S.period, S.ref, 1));
    return `${D.header({ back: 1, right: 'none' })}<h1 class="large">Listening Stats</h1>
    <div class="hsseg lsper">${PERIODS.map(([v, l]) => `<button class="chip ${S.period === v ? 'sel' : ''}" data-act="ls-period" data-v="${v}">${l}</button>`).join('')}</div>
    ${ov ? '' : `<div class="lsnav"><button class="gbtn sm" data-act="ls-prev" aria-label="Previous">${I.back}</button><b>${label(S.period, S.ref)}</b><button class="gbtn sm" data-act="ls-next" aria-label="Next" ${fut ? 'disabled' : ''}>${I.chev}</button></div>`}
    ${cur ? '' : `<button class="chip lstoday" data-act="ls-today">Back to today</button>`}
    <button class="lssnap" data-act="ls-snap"><span class="lssnapic">${SNAPIC}</span><span class="meta"><b>Share snapshot</b><span>${ov ? 'All time' : label(S.period, S.ref)} · your top albums, songs and artists as a picture</span></span></button>
    ${ov ? overallBody() : S.data && S.key === key ? body() : '<div class="empty">Loading…</div>'}
    <div class="lsclrwrap"><button class="chip lsclr" data-act="ls-clear-menu">Clear data…</button></div>`;
  };

  /* ---------- View All (songs / artists / albums / genres) ---------- */
  const screenAll = kind => {
    if (S.scope === 'all' && (!S.all || Date.now() - S.all.at > 20000)) loadAll().then(() => D.rerender()).catch(() => {});
    const A = scopeAgg(); if (!A) return `${D.header({ back: 1, right: 'none' })}<div class="empty">Loading…</div>`;
    const sort = S.sort[kind], items = rank(A[MAPS[kind]], sort), name = { songs: 'Songs', artists: 'Artists', albums: 'Albums', genres: 'Genres' }[kind];
    const sub = S.scope === 'all' ? 'All time' : label(S.period, S.ref);
    return `${D.header({ back: 1, right: 'none' })}<h1 class="large">${name}</h1><div class="detail-t" style="text-align:left"><div class="m">${sub} · ${pl(items.length, kind.slice(0, -1))}</div></div>
    <div class="hsseg">${[['period', label(S.period, S.ref)], ['all', 'All time']].map(([v, l]) => `<button class="chip ${S.scope === v ? 'sel' : ''}" data-act="ls-scope" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="hsseg">${SORTS.map(([v, l]) => `<button class="chip ${sort === v ? 'sel' : ''}" data-act="ls-sort" data-k="${kind}" data-v="${v}">${l}</button>`).join('')}</div>
    <input id="lsfilter" class="lsfilter" type="search" placeholder="Filter ${name.toLowerCase()}" autocomplete="off">
    ${items.length ? `<div class="lslist" id="lsitems">${items.map((e, i) => `<div data-n="${escH(fold(unesc(String(e.name))))}">${ROWS[kind](e, i)}</div>`).join('')}</div>` : '<div class="empty">Nothing listened to in this range.</div>'}`;
  };

  /* ---------- details with listening history ---------- */
  const histRows = segs => { const plays = new Map(); for (const g of segs) { const e = plays.get(g.pid) || { s: g.s, d: 0, f: 0, b: 0, t: g.t, a: g.a, i: g.i }; e.d += g.d; if (g.f) e.f += g.d; else e.b += g.d; e.s = Math.min(e.s, g.s); plays.set(g.pid, e); } return [...plays.values()].sort((a, b) => b.s - a.s).slice(0, 60).map(e => `<div class="row lsh"><span class="meta"><b>${new Date(e.s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ${ftime(e.s)}</b><span>${fmtDur(e.d)} · ${e.b >= e.f && e.b ? 'background' : 'in the app'}${e.i && S.hk !== 'song' ? ' · ' + escH(e.t || '') : ''}</span></span></div>`).join(''); };
  const screenDetail = id => {
    const c = id.indexOf(':'), kind = id.slice(0, c), key = id.slice(c + 1);
    if (!S.hist || S.hist.id !== id || (S.hist.err && Date.now() - S.hist.errAt > 5000)) { S.hist = { id, segs: null }; loadAll().then(a => { if (S.hist && S.hist.id === id) { S.hist = { id, segs: a.segs, A: a.A }; D.rerender(); } }).catch(() => { if (S.hist && S.hist.id === id) { S.hist = { id, segs: [], A: null, err: true, errAt: Date.now() }; D.rerender(); } }); }   // BUG-110 / 245
    if (!S.hist.segs) return `${D.header({ back: 1, right: 'none' })}<div class="empty">Loading…</div>`;
    if (S.hist.err) return `${D.header({ back: 1, right: 'none' })}<div class="empty">Could not read your listening history. Go back and try again.</div>`;   // BUG #6: a failed read is not 'no listening'
    S.hk = kind;
    const mine = S.hist.segs.filter(g => { const m = meta(g); return kind === 'song' ? m.id === key : kind === 'artist' ? m.artists.includes(key) : m.albumKey === key; });
    const A = aggregate(mine, 0, Date.now() + 864e5, meta), title = kind === 'song' ? (A.songs.get(key) || {}).name : kind === 'artist' ? key : (A.albums.get(key) || {}).name;
    const sk = kind === 'song' ? A.songs.get(key) : kind === 'artist' ? A.artists.get(key) : A.albums.get(key);
    const art = kind === 'song' ? cov(songCover(key), 'lsbigart') : kind === 'album' ? cov(albumObj(key, title), 'lsbigart') : origArtistCov(key);
    const t = kind === 'song' ? byId(key) : null;
    return `${D.header({ back: 1, right: 'none' })}<div class="detail-art">${art}</div><div class="detail-t"><b>${title || key}</b><div class="m">${kind === 'song' ? (A.songs.get(key) ? A.songs.get(key).artists.join(', ') : '') : ''}</div></div>
    ${t ? `<div class="actions"><button data-act="play" data-list="all" data-i="${D.tracks().indexOf(t)}">${I.play}Play</button></div>` : ''}
    ${A.totalMs ? stats([big(sk ? sk.plays : 0, 'plays'), big(fmtDur(A.totalMs), 'listening'), big(fmtDur(A.fgMs), 'in the app'), big(fmtDur(A.bgMs), 'background'), big(fdate(sk && sk.first), 'first listened'), big(fdate(sk && sk.last), 'last listened')]) : '<div class="empty">No listening history yet.</div>'}
    ${kind !== 'song' && A.songs.size ? head('Most played') + `<div class="lslist">${rank(A.songs).slice(0, 10).map(rowSong).join('')}</div>` : ''}
    ${kind === 'song' ? '' : `<div class="actions"><button data-act="${kind}" data-id="${escH(key)}">Open in library</button></div>`}
    ${A.totalMs ? `<div class="actions"><button data-act="ls-clear-one" data-kind="${kind}" data-id="${escH(key)}">Clear this ${kind}'s history</button></div>` : ''}
    ${A.totalMs ? head('Listening history') + `<div class="lslist">${histRows(mine)}</div>` : ''}`;
  };

  /* ---------- Home section ---------- */
  async function homeLoad() {
    if (S.homeBusy) return; S.homeBusy = true;
    try {
      const w = rangeOf('weekly', Date.now()), [segs, dn] = await Promise.all([fetchSegs(w.from, w.to), Native.getListenDays().then(x => x.days || []).catch(() => [])]);
      S.home = { A: aggregate(segs, w.from, w.to, meta), sk: streaks(dn, dayNum(Date.now())), w }; S.homeAt = Date.now(); S.homeFailAt = 0;
    } catch { S.homeFailAt = Date.now(); }   // BUG #5: a failed read is remembered, so homeSection does not start another one at once
    S.homeBusy = false; D.refreshHome();
  }
  const homeSection = () => {
    if ((!S.home || Date.now() - S.homeAt > 20000) && Date.now() - S.homeFailAt >= 5000) homeLoad();   // BUG #5: 5 s back-off after a failed read (same idea as load())
    const H = S.home, hd = head('Your Listening Stats', 'ls-open', 'View All Stats');
    if (!H) return `${hd}<div class="lshome"><div class="lsnote">Loading…</div></div>`;
    const { A, sk, w } = H;
    if (!A.totalMs) return `${hd}<button class="empty lsempty" data-act="ls-open">Nothing listened to this week yet. Your listening time, top artist and streak appear here as you play music.</button>`;
    const ts = rank(A.songs)[0], ta = rank(A.artists)[0], tb = rank(A.albums)[0], vals = [];
    for (let i = 0; i < 7; i++) { const e = A.days.get(dayKey(addDays(new Date(w.from), i).getTime())); vals.push(e ? e.ms : 0); }
    const tdy = (new Date().getDay() + 6) % 7;
    return `${hd}<div class="lshome" data-act="ls-open">
      <div class="lsh3">${big(fmtDur(A.totalMs), 'listening this week')}${big(A.plays, 'songs played')}${big(sk.current + (sk.current === 1 ? ' day' : ' days'), 'streak')}</div>
      <div class="lshl2">${[['Top artist', ta && ta.name], ['Top album', tb && tb.name], ['Most-played song', ts && ts.name]].map(x => `<div><em>${x[0]}</em><b>${x[1] || '–'}</b></div>`).join('')}</div>
      ${bars(vals, WD, null, tdy)}</div>`;
  };
  const dirty = () => { S.homeAt = 0; if (S.all) S.all.at = 0; S.stale = true; seenCache.clear(); };   // v149: the old all-time numbers stay on screen (marked expired) until the new ones arrive: no "Loading…" flash   // BUG-113   // new listening: the next draw of the stats screen re-reads the history (old numbers stay on screen until the new ones arrive)
  const fresh = () => { S.ref = Date.now(); S.follow = true; S.key = ''; S.stale = true; S.all = null; };   // opening Listening Stats always starts on the current day / week / month / year
  let wasPlaying = false;
  const liveRefresh = () => {
    const playing = !!(Native.state && Native.state.playing);
    if (document.hidden || (!playing && !wasPlaying)) { wasPlaying = playing; return; }
    wasPlaying = playing;   // playing -> paused: one last refresh so the screen shows the final saved numbers
    const top = D.stack()[D.stack().length - 1];
    if (!top && D.tab() === 'home') { S.homeAt = 0; homeLoad(); }
    else if (top && top.t === 'lstats' && S.period === 'overall' && Date.now() - overallAt > 60000) { overallAt = Date.now(); if (S.all) S.all.at = 0; ensureAll(); }   // BUG-243: the whole history is re-read at most once a minute
    else if (top && (top.t === 'lstats' || top.t === 'lall') && S.period !== 'overall' && isCurrent(S.period, S.ref) && !filterBusy(top) && Date.now() - periodAt > 15000) { periodAt = Date.now(); if (S.all) S.all.at = 0; load(true); }   // v149: the shown numbers stay until the new ones are ready (S.key / S.all are no longer wiped)   // BUG-108: the open period is re-read at most every 15 s   // BUG-107: a typed filter is kept
  };
  const filterBusy = top => { if (!top || top.t !== 'lall') return false; const f = document.getElementById('lsfilter'); return !!f && (!!f.value || document.activeElement === f); };   // BUG-107
  let overallAt = 0, periodAt = 0;
  const liveTimer = setInterval(liveRefresh, 5000); if (liveTimer && liveTimer.unref) liveTimer.unref();   // live refresh while music plays: the tracker saves a heartbeat every 5 s
  document.addEventListener('input', e => { if (e.target && e.target.id === 'lsfilter') { const q = fold(e.target.value.trim()); document.querySelectorAll('#lsitems>[data-n]').forEach(n => { n.style.display = !q || n.dataset.n.includes(q) ? '' : 'none'; }); } });

  /* ---------- Snapshot: a shareable picture of the period on screen (day / week / month / year / all time) ---------- */
  // The numbers are read FRESH from the history database at the moment of the tap (not from the screen's cached copy) and go through the same aggregate() + meta() as the dashboard,
  // so the picture always agrees with the screen. Any amount of listening works: one song heard for 10 seconds is enough. No listening in the range = nothing to share (said plainly).
  const readSegs = async (from, to) => { let err; for (let i = 0; i < 2; i++) { try { const r = await Native.getListens({ from, to }); if (Array.isArray(r && r.segs)) return r.segs; err = new Error('The listening history gave no answer'); } catch (e) { err = e; } } throw err; };   // unlike fetchSegs(): a failed read is an error, never "no listening"
  const snapCover = (kind, e) => {   // always the ORIGINAL cover from the music files (like every stats screen); no cover = the picture gets colours made from the album
    let a = null;
    if (kind === 'album') a = D.byAlbum(e.id);
    else if (kind === 'song') { const t = byId(e.id); a = t ? D.trackAlbum(t) : null; }
    else { const t = D.tracks().find(x => D.trackArtists(x).includes(e.id)); a = t ? D.trackAlbum(t) : null; }
    return { url: (a && a.cover) || '', g: (a && (a.g0 || a.g)) || '', seed: String(e.name || e.id || '') };
  };
  const snapRange = (period, ref, A) => {
    if (period === 'overall') return 'Since ' + fdate(A.first.at);
    const r = rangeOf(period, ref), t = period === 'daily' ? new Date(r.from).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : label(period, ref);
    return isCurrent(period, ref) ? t + ' · so far' : t;
  };
  /** { model, from, now } for the period, or null when nothing was listened to. Throws when the history cannot be read. */
  async function snapshotModel(period, ref) {
    const now = Date.now(), r = period === 'overall' ? { from: 0, to: now + 864e5 } : rangeOf(period, ref);
    const A = aggregate(await readSegs(r.from, r.to), r.from, r.to, meta);
    if (!A.totalMs) return null;
    const model = buildSnapshot({ A, period, rangeText: snapRange(period, ref, A), current: period !== 'overall' && isCurrent(period, ref, now), now, unesc, cover: snapCover, albumArtist: e => { const a = D.byAlbum(e.id); return (a && a.artist) || ''; } });
    return { model, from: r.from, now };
  }
  let snapJob = 0, snapOut = null;
  const WORD = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };
  const snapBox = inner => D.sheet(`<div id="snapbox">${inner}</div>`);
  const snapAlive = job => job === snapJob && !!document.getElementById('snapbox');   // false once the sheet was closed or replaced: a late result must not pop it open again
  async function openSnap() {
    const job = ++snapJob, period = S.period, ref = S.ref;
    snapBox(`<b>Snapshot</b><p>Building your ${(PERIODS.find(x => x[0] === period) || [, ''])[1].toLowerCase()} snapshot…</p><div class="actions"><button data-act="sheet-close">Cancel</button></div>`);
    try {
      const r = await snapshotModel(period, ref);
      if (!snapAlive(job)) return;
      if (!r) { snapBox(`<b>Nothing to share yet</b><p>${WORD[period] ? 'No listening is recorded for this ' + WORD[period] + ' yet.' : 'No listening is recorded yet.'} Play a song, even for a few seconds, and it appears here.</p><div class="actions"><button data-act="sheet-close">OK</button></div>`); return; }
      const png = await makeSnapshotPng(r.model);
      if (!snapAlive(job)) return;
      if (snapOut && snapOut.url) { try { URL.revokeObjectURL(snapOut.url); } catch { } }
      snapOut = { blob: png.blob, url: URL.createObjectURL(png.blob), name: snapshotName(period, r.from, r.now), text: shareText(r.model), title: r.model.title };
      snapBox(`<b>${escH(r.model.title)}</b><p>${escH(r.model.rangeText)}</p><img class="snapimg" src="${snapOut.url}" alt="${escH(r.model.title)}"><div class="actions"><button data-act="ls-snap-save">Save image</button><button data-act="ls-snap-share">Share</button></div><div class="actions"><button data-act="sheet-close">Close</button></div>`);
    } catch (e) {
      if (snapAlive(job)) snapBox(`<b>Could not create the snapshot</b><p>${escH((e && e.message) || 'Unknown error')}</p><div class="actions"><button data-act="sheet-close">Close</button><button data-act="ls-snap">Try again</button></div>`);
    }
  }
  const snapCancel = e => e === 'cancelled' || (e && (e.message === 'cancelled' || e.name === 'AbortError'));
  const snapBytes = async () => new Uint8Array(await snapOut.blob.arrayBuffer());
  async function snapShare() {   // phone: Android share sheet (friends, stories, chats). Browser: the share sheet when it can send files, else a download.
    const s = snapOut; if (!s) return D.toast('Create the snapshot first');
    try {
      if (Native.isNative) { await Native.shareImage(toBase64(await snapBytes()), s.text, s.name); return; }
      const file = new File([s.blob], s.name, { type: 'image/png' });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: s.text, title: s.title }); return; }
      await Native.saveFile({ name: s.name, mime: 'image/png', bytes: await snapBytes() }); D.toast('Snapshot saved');
    } catch (e) { if (!snapCancel(e)) D.toast('Could not share: ' + ((e && e.message) || (typeof e === 'string' && e) || 'unknown error')); }
  }
  async function snapSave() {   // the system "save as" dialog: the PNG goes wherever the person picks (Downloads, Pictures, ...)
    const s = snapOut; if (!s) return D.toast('Create the snapshot first');
    try { await Native.saveFile({ name: s.name, mime: 'image/png', bytes: await snapBytes() }); D.toast('Snapshot saved'); }
    catch (e) { if (!snapCancel(e)) D.toast('Could not save: ' + ((e && e.message) || (typeof e === 'string' && e) || 'unknown error')); }
  }

  /* ---------- clearing statistics ---------- */
  let pending = null;
  const clearMenu = () => D.sheet(`<b>Clear listening data</b><p>Choose what to delete. This cannot be undone.</p><div class="actions lsmenu">${S.period === 'overall' ? '' : `<button data-act="ls-clear-period">This ${S.period === 'daily' ? 'day' : S.period.replace('ly', '')} (${label(S.period, S.ref)})</button>`}<button data-act="ls-clear-range">A time frame…</button><button data-act="ls-clear-all">Everything</button><button data-act="sheet-close">Cancel</button></div>`);
  const rangeSheet = () => { const iso = ms => dayKey(ms), t = iso(Date.now()), firstAt = S.period === 'overall' && S.all && S.all.A && S.all.A.first ? S.all.A.first.at : 0; /* BUG-408: Overall = from the first listened day (it used to show this calendar year) */ D.sheet(`<b>Clear a time frame</b><p>First and last day to delete (both included).</p><div class="lsdates"><input id="lsfrom" type="date" value="${iso(firstAt || Math.min(rangeOf(S.period, S.ref).from, Date.now()))}" max="${t}"><input id="lsto" type="date" value="${iso(Math.min(rangeOf(S.period, S.ref).to - 1, Date.now()))}" max="${t}"></div><div class="actions"><button data-act="sheet-close">Cancel</button><button data-act="ls-clear-range-ok">Next</button></div>`); };
  const askClear = (req, title, text) => { pending = req; D.sheet(`<b>${title}</b><p>${text}</p><p><b>This cannot be undone.</b> Are you sure?</p><div class="actions"><button data-act="sheet-close">No, keep it</button><button data-act="ls-clear-do">Yes, delete</button></div>`); };
  async function askClearOne(kind, key) {
    const a = await loadAll(), ids = [...new Set(a.segs.filter(g => { const m = meta(g); return kind === 'song' ? m.id === key : kind === 'artist' ? m.artists.includes(key) : m.albumKey === key; }).map(g => g.i))];
    askClear({ ids }, `Clear this ${kind}'s history?`, `All listening history of this ${kind} (${pl(ids.length, 'song')}) will be deleted from every period.`);
  }
  async function doClear() {
    const req = pending; pending = null; D.closeSheet(); if (!req) return;
    try {
      const r = await Native.clearListens(req); S.all = null; S.data = null; S.key = ''; S.hist = null; S.home = null; seenCache.clear();
      D.toast(r && r.removed ? 'Deleted ' + pl(r.removed, 'record') : 'Nothing to delete'); D.rerender(); D.refreshHome();
    } catch { D.toast('Could not clear the data'); }
  }

  /* ---------- actions ---------- */
  function action(act, d) {
    if ((act.startsWith('ls-day:') && !Number.isFinite(+act.slice(7))) || (act.startsWith('ls-month:') && !Number.isFinite(+act.slice(9)))) return true;   // BUG-359: a damaged action is ignored
    if (act.startsWith('ls-day:')) { S.period = 'daily'; S.ref = +act.slice(7); S.follow = isCurrent('daily', S.ref); S.key = ''; D.rerender(); load(); return true; }
    if (act.startsWith('ls-month:')) { S.period = 'monthly'; S.ref = +act.slice(9); S.follow = isCurrent('monthly', S.ref); S.key = ''; D.rerender(); load(); return true; }
    switch (act) {
      case 'ls-open': fresh(); D.push('lstats'); return true;
      case 'ls-period': S.period = d.v; S.ref = Date.now(); S.follow = true; S.key = ''; D.rerender(); load(); return true;
      case 'ls-prev': case 'ls-next': { const n = shiftRef(S.period, S.ref, act === 'ls-prev' ? -1 : 1); if (isFuture(S.period, n)) return true; S.ref = n; S.follow = isCurrent(S.period, n); S.key = ''; D.rerender(); load(); return true; }
      case 'ls-today': S.ref = Date.now(); S.follow = true; S.key = ''; D.rerender(); load(); return true;
      case 'ls-all': S.scope = 'period'; D.push('lall', d.k); return true;
      case 'ls-scope': S.scope = d.v; D.rerender(); return true;
      case 'ls-sort': S.sort[d.k] = d.v; D.rerender(); return true;
      case 'ls-song': D.push('ldetail', 'song:' + d.id); return true;
      case 'ls-artist': D.push('ldetail', 'artist:' + d.id); return true;
      case 'ls-album': D.push('ldetail', 'album:' + d.id); return true;
      case 'ls-snap': openSnap(); return true;
      case 'ls-snap-share': snapShare(); return true;
      case 'ls-snap-save': snapSave(); return true;
      case 'ls-clear-menu': clearMenu(); return true;
      case 'ls-clear-period': askClear({ from: rangeOf(S.period, S.ref).from, to: rangeOf(S.period, S.ref).to }, 'Clear ' + label(S.period, S.ref) + '?', 'Listening history for this period will be deleted. A session that crosses midnight is removed completely, also its part on the neighbouring day.'); return true;
      case 'ls-clear-all': askClear({}, 'Clear all listening statistics?', 'The whole listening history database will be emptied. Favorites, playlists and play counts stay.'); return true;
      case 'ls-clear-range': rangeSheet(); return true;
      case 'ls-clear-range-ok': { const a = document.getElementById('lsfrom').value, b = document.getElementById('lsto').value; if (!a || !b) { D.toast('Pick both dates'); return true; } const f = new Date(a + 'T00:00:00').getTime(), t = addDays(new Date(b + 'T00:00:00'), 1).getTime(); if (!(t > f)) { D.toast('The end date is before the start'); return true; } askClear({ from: f, to: t }, 'Clear ' + a + ' to ' + b + '?', 'Listening history in this time frame will be deleted.'); return true; }
      case 'ls-clear-one': askClearOne(d.kind, d.id); return true;
      case 'ls-clear-do': doClear(); return true;
    }
    return false;
  }
  const releaseSnap = () => { if (snapOut && snapOut.url) { try { URL.revokeObjectURL(snapOut.url); } catch { } } snapOut = null; };   // BUG-261: the picture is released when its sheet closes
  return { releaseSnap, homeSection, screens: { lstats: screenLStats, lall: screenAll, ldetail: screenDetail }, action, dirty, fresh, state: S, _test: { load, snapshotModel, openSnap, snapShare, snapSave } };
}
