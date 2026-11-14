// Listening Snapshot: a shareable picture of the listening data of ONE period (day / week / month / year / all time).
// Two parts, both free of Native / app state so they can be tested:
//   buildSnapshot()      numbers from aggregate() (listenstats.js)  ->  a plain model (what is written on the picture)
//   makeSnapshotPng()    model -> canvas -> PNG blob (the real album covers are drawn; a missing cover gets a colour gradient)
// Nothing here is invented: every number, name and cover comes from the stored listening history. Works with any amount of data (a single 10 second listen is enough).
import { rank, streaks, dayNum, dayKey } from './listenstats.js';

export const SNAP_W = 1080;
export const PERIOD_INFO = {
  daily: { title: 'Daily Snapshot', now: 'TODAY', past: 'DAILY' },
  weekly: { title: 'Weekly Snapshot', now: 'THIS WEEK', past: 'WEEKLY' },
  monthly: { title: 'Monthly Snapshot', now: 'THIS MONTH', past: 'MONTHLY' },
  yearly: { title: 'Yearly Snapshot', now: 'THIS YEAR', past: 'YEARLY' },
  overall: { title: 'All-Time Snapshot', now: 'ALL TIME', past: 'ALL TIME' },
};
export const TOP_N = 5;   // albums / songs / artists shown on the picture

const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
/** Exact, short duration for the picture: "10 s", "4 min 20 s", "37 min", "3 h 05 min". Whole seconds, never rounds a real listen down to nothing. */
export function snapDur(ms) {
  ms = Number.isFinite(+ms) ? +ms : 0;   // BUG-374
  const t = Math.max(0, Math.round(ms / 1000));
  if (t < 60) return (t || (ms > 0 ? 1 : 0)) + ' s';
  const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  if (h) return h + ' h ' + String(m).padStart(2, '0') + ' min';
  return m < 10 && s ? m + ' min ' + s + ' s' : m + ' min';
}
const hourLabel = h => (h % 12 || 12) + (h < 12 ? ' AM' : ' PM');

/** File name for a saved snapshot, e.g. liquid-dark-weekly-2026-11-02.png (`from` = start of the period in ms, `now` used for all time). */
export function snapshotName(period, from, now = Date.now()) {
  if (!Number.isFinite(from)) from = now;   // BUG-375
  const d = ms => dayKey(ms);
  const tag = period === 'monthly' ? d(from).slice(0, 7) : period === 'yearly' ? d(from).slice(0, 4) : period === 'overall' ? d(now) : d(from);
  return `liquid-dark-${PERIOD_INFO[period] ? period : 'overall'}-${tag}.png`;
}

/**
 * Model of the picture, or null when nothing was listened to in the range (there is nothing to show).
 * A = aggregate() result. cover(kind, entry) -> { url, g, seed } | null for kind 'album' | 'song' | 'artist'. albumArtist(entry) -> album artist text or ''.
 * unesc turns the HTML-safe names of the app back into plain text (the picture is drawn, not HTML).
 */
export function buildSnapshot({ A, period, rangeText = '', current = false, now = Date.now(), unesc = x => String(x ?? ''), cover = () => null, albumArtist = () => '' }) {
  if (!A || !(A.totalMs > 0)) return null;
  const info = PERIOD_INFO[period] || PERIOD_INFO.overall, plain = x => unesc(String(x ?? ''));
  const stat = e => (e.plays > 0 ? plural(e.plays, 'play') + ' · ' : '') + snapDur(e.ms);
  const short = e => (e.plays > 0 ? plural(e.plays, 'play') : snapDur(e.ms));   // small tiles are narrow: plays only (time when nothing reached a full play)
  const top = map => rank(map, 'plays').slice(0, TOP_N);
  const derive = e => { const b = rank([...e.songs].map(id => A.songs.get(id)).filter(Boolean), 'time')[0]; return b ? b.artists.map(plain).join(', ') : ''; };

  const topAlbums = top(A.albums).map(e => ({ name: plain(e.name), sub: plain(albumArtist(e)) || derive(e), stat: stat(e), short: short(e), cover: cover('album', e) }));
  const topSongs = top(A.songs).map(e => ({ name: plain(e.name), sub: e.artists.map(plain).join(', '), stat: stat(e), cover: cover('song', e) }));
  const topArtists = top(A.artists).map(e => ({ name: plain(e.name), sub: plural(e.songs.size, 'song'), stat: stat(e), short: short(e), cover: cover('artist', e) }));

  // Small facts, only when they are real and say something the big numbers do not. First four that apply are shown.
  const facts = [], days = [...A.days.values()].filter(d => d.ms > 0), genre = rank(A.genres, 'time')[0];
  if (genre) facts.push(['Top genre', plain(genre.name)]);
  const pk = A.hours.reduce((b, v, h) => (v > A.hours[b] ? h : b), 0); if (A.hours[pk] > 0) facts.push(['Peak hour', hourLabel(pk)]);
  if (period !== 'daily' && days.length > 1) { const b = [...days].sort((x, y) => y.ms - x.ms || x.t - y.t)[0]; facts.push(['Busiest day', new Date(b.t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + snapDur(b.ms)]); }
  if (period !== 'daily' && days.length) facts.push(['Days with music', String(days.length)]);
  if (period !== 'daily' && days.length > 1) { const best = streaks(days.map(d => dayNum(d.t)), dayNum(now)).best; if (best >= 2) facts.push(['Best streak', plural(best, 'day')]); }
  if (A.sessions.size > 1 && A.longest) facts.push(['Longest session', snapDur(A.longest.ms)]);

  const one = (n, a, b) => (n === 1 ? a : b), counts = []; if (A.plays > 0) counts.push([one(A.plays, 'Play', 'Plays'), A.plays]);
  counts.push([one(A.songs.size, 'Song', 'Songs'), A.songs.size], [one(A.artists.size, 'Artist', 'Artists'), A.artists.size], [one(A.albums.size, 'Album', 'Albums'), A.albums.size]);
  return {
    period, tag: current ? info.now : info.past, title: info.title, rangeText, totalMs: A.totalMs, time: snapDur(A.totalMs),
    counts: counts.map(([l, v]) => [l, String(v)]), topAlbums, topSongs, topArtists, facts: facts.slice(0, 4),
    footer: 'Made with Liquid Dark · ' + new Date(now).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

/** Text that goes along with the picture when it is shared. */
export function shareText(m) {
  const a = m.topAlbums[0], s = m.topSongs[0];
  return `My ${m.title.toLowerCase()} on Liquid Dark (${m.rangeText}): ${m.time} of music` + (a ? `. Top album: ${a.name}` : '') + (s ? `. Top song: ${s.name}` : '') + '.';
}

/* ---------- colours ---------- */
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h >>> 0; };
const clamp8 = v => Math.max(0, Math.min(255, Math.round(+v)));
/** "#abc", "#aabbcc", "rgb(a,b,c)", "hsl(h,s%,l%)" -> [r,g,b] or null. */
export function parseColor(str) {
  const s = String(str || '').trim().toLowerCase(); let m;
  if ((m = s.match(/^#([0-9a-f]{3})$/))) return [...m[1]].map(c => parseInt(c + c, 16));
  if ((m = s.match(/^#([0-9a-f]{6})$/))) { const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  if ((m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/))) return [m[1], m[2], m[3]].map(clamp8);
  if ((m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/))) {
    const h = +m[1], sa = +m[2] / 100, l = +m[3] / 100, k = n => (n + h / 30) % 12, a = sa * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)].map(x => clamp8(x * 255));
  }
  return null;
}
/** Two colours for a cover that has no picture: taken from its CSS gradient (var(--x) is resolved with cssVar), else made from the name so the same album always gets the same colours. */
export function gradientColors(g, seed = '', cssVar = () => '') {
  const out = [], re = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|hsla?\([^)]*\)|rgba?\([^)]*\)|var\(\s*(--[\w-]+)/gi, s = String(g || '').replace(/url\([^)]*\)/gi, '');
  let m; while ((m = re.exec(s))) { const c = m[1] ? String(cssVar(m[1]) || '').trim() : m[0]; if (c && parseColor(c)) out.push(c); }
  if (!out.length) { const h = hash(String(seed)) % 360; return [`hsl(${h},70%,55%)`, `hsl(${(h + 40) % 360},70%,28%)`]; }
  return [out[0], out[1] || out[0]];
}

/* ---------- picture files ---------- */
export const loadImageDefault = url => new Promise(res => {
  let done = false, t = 0; const im = new Image(), fin = v => { if (!done) { done = true; clearTimeout(t); res(v); } };
  t = setTimeout(() => fin(null), 6000); im.crossOrigin = 'anonymous'; im.onload = () => fin(im); im.onerror = () => fin(null); im.src = url;
});
export const coverUrls = m => [...new Set([...m.topAlbums, ...m.topSongs, ...m.topArtists].map(i => i.cover && i.cover.url).filter(Boolean))];

/* ---------- drawing ---------- */
const PAD = 56, CW = SNAP_W - PAD * 2, GAP = 44, ACCENT = '#FA243C', WHITE = '#fff', DIM = 'rgba(255,255,255,.68)', FAINT = 'rgba(255,255,255,.42)';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const F = (w, px) => `${w} ${px}px ${FONT}`;
const rgb = (r, g, b) => `rgb(${clamp8(r)},${clamp8(g)},${clamp8(b)})`;

function rr(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
/** Text cut to maxW with an ellipsis (counts whole characters, so emoji are never cut in half). Uses the font that is set on c. */
export function fit(c, text, maxW) {
  const t = String(text ?? ''); if (c.measureText(t).width <= maxW) return t;
  const ch = Array.from(t); let lo = 0, hi = ch.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (c.measureText(ch.slice(0, mid).join('').trimEnd() + '…').width <= maxW) lo = mid; else hi = mid - 1; }
  return ch.slice(0, lo).join('').trimEnd() + '…';
}
/** Greedy word wrap into at most maxLines lines (the last line gets the ellipsis when the text is longer). */
export function wrap(c, text, maxW, maxLines) {
  let words = String(text ?? '').split(/\s+/).filter(Boolean); const lines = []; let cur = '';
  words = words.flatMap(w => c.measureText(w).width > maxW ? Array.from(w) : [w]);   // BUG-222: a word wider than the box is broken by characters
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (!cur || c.measureText(t).width <= maxW) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const rest = lines.slice(maxLines - 1).join(' '); lines.length = maxLines - 1; lines.push(rest); }
  return lines.map(l => fit(c, l, maxW));
}
function fitFont(c, text, weight, start, min, maxW) { let px = start; c.font = F(weight, px); while (px > min && c.measureText(text).width > maxW) { px = Math.max(min, px - 4); c.font = F(weight, px); } return px; }
function spaced(c, px) { try { c.letterSpacing = px + 'px'; } catch { /* older web views: no letter spacing, still readable */ } }

function drawCover(c, cov, imgs, x, y, size, mode, r = 22) {   // mode 'sq' | 'round'
  c.save();
  if (mode === 'round') { c.beginPath(); c.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); c.closePath(); } else rr(c, x, y, size, size, r);
  c.clip();
  const im = cov && cov.url ? imgs.get(cov.url) : null, iw = im && (im.naturalWidth || im.width), ih = im && (im.naturalHeight || im.height);
  if (im && iw > 0 && ih > 0) { const s = Math.max(size / iw, size / ih), dw = iw * s, dh = ih * s; c.drawImage(im, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh); }
  else { const [a, b] = (cov && cov._cols) || ['#2a2a2e', '#0a0a0b'], g = c.createLinearGradient(x, y, x + size, y + size); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(x, y, size, size); }
  c.restore();
  c.save(); if (mode === 'round') { c.beginPath(); c.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2); } else rr(c, x + 1, y + 1, size - 2, size - 2, r); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.28)'; c.stroke(); c.restore();
}
const heading = (c, text, y) => { c.font = F(800, 26); c.fillStyle = ACCENT; c.textAlign = 'left'; spaced(c, 3); c.fillText(text, PAD, y + 30); spaced(c, 0); };
const shelfTile = n => (n <= 1 ? 0 : Math.min(300, Math.floor((CW - (n - 1) * 20) / n)));
const shelfH = n => 56 + (n === 1 ? 340 : shelfTile(n) + 100);

function drawShelf(c, title, items, imgs, round, y) {
  heading(c, title, y); const n = items.length, cy = y + 56; c.textAlign = 'left';
  if (n === 1) {   // one item: big cover with the details beside it
    const it = items[0], tx = PAD + 340 + 36, tw = CW - 340 - 36;
    drawCover(c, it.cover, imgs, PAD, cy, 340, round ? 'round' : 'sq', 30);
    c.font = F(800, 52); const lines = wrap(c, it.name, tw, 3), textH = lines.length * 62 + (it.sub ? 46 : 0) + 44, top = cy + (340 - textH) / 2;
    c.fillStyle = WHITE; lines.forEach((l, i) => c.fillText(l, tx, top + 46 + i * 62));
    let by = top + lines.length * 62 + 4;
    if (it.sub) { c.font = F(600, 34); c.fillStyle = DIM; c.fillText(fit(c, it.sub, tw), tx, by + 32); by += 46; }
    c.font = F(700, 30); c.fillStyle = ACCENT; c.fillText(fit(c, it.stat, tw), tx, by + 34);
    return;
  }
  const tw = shelfTile(n);
  items.forEach((it, i) => {
    const x = PAD + i * (tw + 20);
    drawCover(c, it.cover, imgs, x, cy, tw, round ? 'round' : 'sq', 24);
    c.beginPath(); c.arc(x + 36, cy + 36, 22, 0, Math.PI * 2); c.fillStyle = ACCENT; c.fill();
    c.font = F(800, 24); c.fillStyle = WHITE; c.textAlign = 'center'; c.fillText(String(i + 1), x + 36, cy + 45); c.textAlign = 'left';
    c.font = F(700, 28); c.fillStyle = WHITE; c.fillText(fit(c, it.name, tw), x, cy + tw + 40);
    c.font = F(500, 24); c.fillStyle = DIM; c.fillText(fit(c, it.short || it.stat, tw), x, cy + tw + 78);
  });
}
function drawSongs(c, items, imgs, y) {
  heading(c, 'TOP SONGS', y); c.textAlign = 'left';
  items.forEach((it, i) => {
    const ry = y + 56 + i * 84, tx = PAD + 60 + 72 + 22;
    c.font = F(800, 32); c.fillStyle = ACCENT; c.fillText(String(i + 1), PAD, ry + 50);
    drawCover(c, it.cover, imgs, PAD + 60, ry + 6, 72, 'sq', 14);
    c.font = F(500, 24); const sw = c.measureText(it.stat).width, room = PAD + CW - tx;
    c.fillStyle = DIM; c.textAlign = 'right'; c.fillText(it.stat, PAD + CW, ry + 36); c.textAlign = 'left';
    c.font = F(700, 32); c.fillStyle = WHITE; c.fillText(fit(c, it.name, room - sw - 24), tx, ry + 36);
    c.font = F(500, 24); c.fillStyle = DIM; c.fillText(fit(c, it.sub, room), tx, ry + 68);
  });
}
function drawHeader(c, m, y) {
  c.fillStyle = ACCENT; c.beginPath(); c.arc(PAD + 12, y + 30, 12, 0, Math.PI * 2); c.fill();
  c.font = F(800, 26); c.fillStyle = WHITE; c.textAlign = 'left'; spaced(c, 3); c.fillText('LIQUID DARK', PAD + 36, y + 39);
  c.font = F(800, 22); spaced(c, 2); const pw = c.measureText(m.tag).width + 40; spaced(c, 0);
  rr(c, PAD + CW - pw, y + 8, pw, 44, 22); c.fillStyle = ACCENT; c.fill();
  c.font = F(800, 22); c.fillStyle = WHITE; spaced(c, 2); c.textAlign = 'center'; c.fillText(m.tag, PAD + CW - pw / 2 + 1, y + 38); spaced(c, 0); c.textAlign = 'left';
  fitFont(c, m.title, 800, 84, 44, CW); c.fillStyle = WHITE; c.fillText(m.title, PAD, y + 138);
  c.font = F(500, 32); c.fillStyle = DIM; c.fillText(fit(c, m.rangeText, CW), PAD, y + 186);
}
function drawHero(c, m, y) {
  glass(c, PAD, y, CW, 330, 40);
  const ix = PAD + 40, iw = CW - 80; c.textAlign = 'left';
  c.font = F(700, 24); c.fillStyle = DIM; spaced(c, 3); c.fillText('TOTAL LISTENING TIME', ix, y + 66); spaced(c, 0);
  fitFont(c, m.time, 800, 150, 56, iw); c.fillStyle = WHITE; c.fillText(m.time, ix, y + 205);
  const colW = iw / m.counts.length;
  m.counts.forEach(([l, v], i) => {
    const x = ix + i * colW; c.font = F(800, 46); c.fillStyle = WHITE; c.fillText(fit(c, v, colW - 12), x, y + 268);
    c.font = F(600, 24); c.fillStyle = DIM; c.fillText(l, x, y + 304);
  });
}
function drawFacts(c, facts, y) {
  const w = (CW - 20) / 2; c.textAlign = 'left';
  facts.forEach(([l, v], i) => {
    const x = PAD + (i % 2) * (w + 20), ty = y + Math.floor(i / 2) * (96 + 16);
    glass(c, x, ty, w, 96, 26);
    c.font = F(600, 22); c.fillStyle = DIM; c.fillText(fit(c, l.toUpperCase(), w - 48), x + 24, ty + 34);
    c.font = F(800, 34); c.fillStyle = WHITE; c.fillText(fit(c, v, w - 48), x + 24, ty + 74);
  });
}

/** Liquid glass panel on black: see-through (no blur), a faint light fill, a bright specular rim at the top left that fades out and ends in a red glint at the bottom right. */
function glass(c, x, y, w, h, r) {
  c.save(); rr(c, x, y, w, h, r);
  const f = c.createLinearGradient(x, y, x, y + h); f.addColorStop(0, 'rgba(255,255,255,.13)'); f.addColorStop(.5, 'rgba(255,255,255,.04)'); f.addColorStop(1, 'rgba(250,36,60,.07)');
  c.fillStyle = f; c.fill();
  const s = c.createLinearGradient(x, y, x + w, y + h); s.addColorStop(0, 'rgba(255,255,255,.60)'); s.addColorStop(.3, 'rgba(255,255,255,.12)'); s.addColorStop(.7, 'rgba(255,255,255,.07)'); s.addColorStop(1, 'rgba(250,36,60,.65)');
  c.lineWidth = 2; c.strokeStyle = s; c.stroke();
  rr(c, x + 5, y + 5, w - 10, h - 10, Math.max(0, r - 5)); const t = c.createLinearGradient(x, y, x, y + h * .5); t.addColorStop(0, 'rgba(255,255,255,.22)'); t.addColorStop(1, 'rgba(255,255,255,0)');
  c.lineWidth = 1.5; c.strokeStyle = t; c.stroke();
  c.restore();
}
function paintBackground(c, W, H) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); }

/**
 * Draws the model. env = { makeCanvas(w,h), loadImage(url) -> image | null, cssVar(name) -> string }.
 * Resolves { canvas, width, height }. A cover that cannot be loaded is drawn as a gradient; the rest of the picture is unaffected.
 */
export async function renderSnapshot(m, env) {
  const { makeCanvas, loadImage, cssVar = () => '' } = env, urls = coverUrls(m), imgs = new Map();
  await Promise.all(urls.map(async u => { let im = null; try { im = await loadImage(u); } catch { im = null; } imgs.set(u, im || null); }));
  for (const it of [...m.topAlbums, ...m.topSongs, ...m.topArtists]) if (it.cover) it.cover._cols = gradientColors(it.cover.g, it.cover.seed || it.name, cssVar);
  const blocks = [{ h: 200, draw: (c, y) => drawHeader(c, m, y) }, { h: 330, draw: (c, y) => drawHero(c, m, y) }];
  if (m.topAlbums.length) blocks.push({ h: shelfH(m.topAlbums.length), draw: (c, y) => drawShelf(c, 'TOP ALBUMS', m.topAlbums, imgs, false, y) });
  if (m.topSongs.length) blocks.push({ h: 56 + m.topSongs.length * 84, draw: (c, y) => drawSongs(c, m.topSongs, imgs, y) });
  if (m.topArtists.length) blocks.push({ h: shelfH(m.topArtists.length), draw: (c, y) => drawShelf(c, 'TOP ARTISTS', m.topArtists, imgs, true, y) });
  if (m.facts.length) { const rows = Math.ceil(m.facts.length / 2); blocks.push({ h: rows * 96 + (rows - 1) * 16, draw: (c, y) => drawFacts(c, m.facts, y) }); }
  blocks.push({ h: 34, draw: (c, y) => { c.font = F(500, 24); c.fillStyle = FAINT; c.textAlign = 'center'; c.fillText(fit(c, m.footer, CW), SNAP_W / 2, y + 26); c.textAlign = 'left'; } });

  const H = PAD + blocks.reduce((s, b) => s + b.h, 0) + GAP * (blocks.length - 1) + PAD;
  const canvas = makeCanvas(SNAP_W, H), c = canvas.getContext('2d');
  paintBackground(c, SNAP_W, H);
  let y = PAD; for (const b of blocks) { c.save(); b.draw(c, y); c.restore(); y += b.h + GAP; }
  return { canvas, width: SNAP_W, height: H };
}

export function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((res, rej) => {
    try {
      if (canvas.toBlob) return canvas.toBlob(b => (b ? res(b) : rej(new Error('Could not create the picture'))), type);
      const [head, b64] = canvas.toDataURL(type).split(','), bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      res(new Blob([u], { type: /:(.*?);/.exec(head)[1] }));
    } catch (e) { rej(e); }
  });
}

/** Model -> { blob (PNG), width, height, withCovers }. If the browser refuses to export a canvas that holds cover files (tainted), it draws again with colour gradients instead of covers. */
export async function makeSnapshotPng(m, env = {}) {
  const base = { makeCanvas: (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }, loadImage: loadImageDefault, cssVar: n => (typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement).getPropertyValue(n) : ''), ...env };
  let last;
  for (const withCovers of [true, false]) {
    try {
      const r = await renderSnapshot(m, { ...base, loadImage: withCovers ? base.loadImage : async () => null });
      return { blob: await canvasToBlob(r.canvas), width: r.width, height: r.height, withCovers };
    } catch (e) { last = e; }
  }
  throw last || new Error('Could not create the picture');
}
