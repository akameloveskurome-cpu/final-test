/* v119: Home screen customisation (Settings > Home screen). Which sections show, in what order, how many cards per row, how big the cards are,
   your own pinned sections (a playlist, artist or album), a different Home for each part of the day, and your own names for sections and quick buttons. */
export const SECTIONS = [
  ['resume', 'Jump back in', 'The last song you played, one tap to continue'],
  ['playlists', 'Playlists', 'Your playlists'],
  ['daily', 'Recommended Today', 'A fresh mix every day'],
  ['lstats', 'Your Listening Stats', 'Listening time, top artist, streak and weekly activity'],
  ['recent', 'Recently Played', 'Songs you played lately'],
  ['artists', 'Your Top Artists', 'Artists you play most'],
  ['added', 'Recently Added', 'Newest albums in your library'],
  ['genres', 'Browse by Genre', 'Genre chips'],
  ['discover', 'Discover Albums', 'Albums you have not played yet'],
  ['heavy', 'Heavy Rotation', 'Albums you have been playing lately'],
  ['favmix', 'Favorites Mix', 'A fresh shuffle of your favorites every day'],
  ['newmix', 'New Music Mix', 'Songs from your newest albums, shuffled daily'],
  ['because', 'Because you listen to', 'More from the artist you play most'],
  ['top', 'Most Played', 'Your most played songs'],
  ['fav', 'Favorites', 'Songs you hearted'],
  ['forgot', 'Forgotten Favorites', 'Favorites you have not played for a month'],
  ['mystats', 'Your numbers', 'Plays, favorites and your top artist']
];
export const KEYS = SECTIONS.map(s => s[0]);
export const DEFAULT_HIDDEN = ['discover', 'heavy', 'favmix', 'newmix', 'because', 'top', 'fav', 'forgot', 'mystats'];   // v119: a calm default Home (8 rows, the Listening Stats row included); turn the rest on in Settings > Home screen
const OLD_HIDDEN = ['mystats'], DEFAULT_QHIDDEN = ['favs', 'top'];
export const COUNTS = [6, 12, 20];
export const CARDS = ['small', 'normal', 'large'];
export const PERIODS = [['morning', 'Morning', '5 AM to 12 PM'], ['afternoon', 'Afternoon', '12 to 5 PM'], ['evening', 'Evening', '5 to 9 PM'], ['night', 'Night', '9 PM to 5 AM']];
export const PIN_TYPES = ['playlist', 'artist', 'album'];
export const MAX_PINS = 12;
export const ITEM_TYPES = ['album', 'artist', 'song'];   // what a custom section (type 'custom') can hold
export const MAX_ITEMS = 40;
export const QUICK = [['shuffle', 'Shuffle all'], ['mix', "Today's mix"], ['recent', 'Play recent'], ['favs', 'Shuffle favorites'], ['top', 'Play most played']];
const QKEYS = QUICK.map(q => q[0]);
export const periodOf = hour => { const h = ((Math.floor(+hour) || 0) % 24 + 24) % 24; return h >= 5 && h < 12 ? 'morning' : h < 17 && h >= 12 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night'; };
export const pinKey = p => 'pin:' + p.id;
const clean = (s, n = 30) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const uniq = a => [...new Set(a)];
export function cleanItems(a) {   // the albums / artists / songs inside a custom section: valid kinds only, no repeats, at most MAX_ITEMS
  const seen = new Set(), out = [];
  for (const x of Array.isArray(a) ? a : []) {
    if (!x || typeof x !== 'object' || !ITEM_TYPES.includes(x.t) || (typeof x.v !== 'string' && typeof x.v !== 'number') || !String(x.v).trim() || out.length >= MAX_ITEMS) continue;
    const v = String(x.v).slice(0, 200), key = x.t + '|' + v; if (seen.has(key)) continue; seen.add(key);
    const item = { t: x.t, v }; if (x.label) item.label = clean(x.label, 160); if (x.by) item.by = clean(x.by, 160);   // v162: readable name, kept with the id
    out.push(item);
  }
  return out;
}
export function cleanHome(h) {
  h = h && typeof h === 'object' ? h : {};
  if (h.lv !== 2 && (!Array.isArray(h.hidden) || (h.hidden.length === 1 && h.hidden[0] === OLD_HIDDEN[0]))) h = { ...h, order: undefined, hidden: undefined, qhidden: Array.isArray(h.qhidden) && !(h.qhidden.length === 1 && h.qhidden[0] === 'top') ? h.qhidden : undefined, info: false, todHidden: undefined, tod: false };   // v119: Home you never customised gets the calm layout; customised Homes are left alone
  const pseen = new Set(), pins = [];
  for (const p of Array.isArray(h.pins) ? h.pins : []) {
    const cust = p && typeof p === 'object' && p.type === 'custom';
    if (!p || typeof p !== 'object' || !(PIN_TYPES.includes(p.type) || cust) || typeof p.id !== 'string' || !/^[a-z0-9]{3,12}$/.test(p.id) || (!cust && !String(p.ref || '').trim()) || pseen.has(p.id) || pins.length >= MAX_PINS) continue;
    pseen.add(p.id);
    const pin = cust ? { id: String(p.id), type: 'custom', ref: clean(p.ref) || 'My picks', items: cleanItems(p.items) } : { id: String(p.id), type: p.type, ref: String(p.ref).slice(0, 200) };
    if (!cust && p.name) pin.name = clean(p.name, 200);   // v162: readable name of a pinned playlist / album (see findPlaylist)
    if (!cust && p.by) pin.by = clean(p.by, 200);
    pins.push(pin);
  }
  const ALL = KEYS.concat(pins.map(pinKey)), seen = new Set(), order = [];
  for (const k of Array.isArray(h.order) ? h.order : []) if (ALL.includes(k) && !seen.has(k)) { seen.add(k); order.push(k); }
  for (const k of ALL) if (!seen.has(k)) order.push(k);   // sections added in a later version, and new pins, appear at the end
  const hid = a => uniq((Array.isArray(a) ? a : []).filter(k => ALL.includes(k)));
  const hidden = Array.isArray(h.hidden) ? hid(h.hidden) : DEFAULT_HIDDEN.slice();
  let todHidden = null;
  if (h.todHidden && typeof h.todHidden === 'object') { todHidden = {}; for (const [p] of PERIODS) todHidden[p] = Array.isArray(h.todHidden[p]) ? hid(h.todHidden[p]) : hidden.slice(); }
  const names = {}, qnames = {};
  if (h.names && typeof h.names === 'object') for (const k of ALL) { const v = clean(h.names[k]); if (v) names[k] = v; }
  if (h.qnames && typeof h.qnames === 'object') for (const k of QKEYS) { const v = clean(h.qnames[k]); if (v) qnames[k] = v; }
  const qseen = new Set(), qb = [];
  for (const k of Array.isArray(h.qb) ? h.qb : []) if (QKEYS.includes(k) && !qseen.has(k)) { qseen.add(k); qb.push(k); }
  for (const k of QKEYS) if (!qseen.has(k)) qb.push(k);
  const qhidden = uniq((Array.isArray(h.qhidden) ? h.qhidden : DEFAULT_QHIDDEN).filter(k => QKEYS.includes(k)));   // the new "Play most played" button is off until you turn it on
  return {
    lv: 2, order, hidden, pins, names, qnames, qb, qhidden, todHidden, tod: h.tod === true && !!todHidden,
    count: COUNTS.includes(+h.count) ? +h.count : 12,
    card: CARDS.includes(h.card) ? h.card : 'normal',
    greet: h.greet !== false, info: h.info === true, quick: h.quick !== false
  };
}
export function toggleSection(h, k) { const hidden = h.hidden.includes(k) ? h.hidden.filter(x => x !== k) : [...h.hidden, k]; return { ...h, hidden }; }
export function moveSection(h, k, dir) {
  const o = h.order.slice(), i = o.indexOf(k), j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= o.length) return h;
  [o[i], o[j]] = [o[j], o[i]]; return { ...h, order: o };
}
/* ---- a different Home for each part of the day ---- */
export const hiddenFor = (h, hour) => (h.tod && h.todHidden && h.todHidden[periodOf(hour)]) || h.hidden;
export function setTod(h, on) {
  if (!on) return { ...h, tod: false };
  const todHidden = h.todHidden || Object.fromEntries(PERIODS.map(([p]) => [p, h.hidden.slice()]));   // first time: every part of the day starts like the normal Home
  return { ...h, tod: true, todHidden };
}
export function toggleSectionFor(h, k, period) {
  if (!h.tod || !h.todHidden || !PERIODS.some(p => p[0] === period)) return toggleSection(h, k);
  const cur = h.todHidden[period] || [], next = cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k];
  return { ...h, todHidden: { ...h.todHidden, [period]: next } };
}
export const isHiddenFor = (h, k, period) => (h.tod && h.todHidden && h.todHidden[period] ? h.todHidden[period] : h.hidden).includes(k);
/* ---- your own sections ---- */
export const makeId = () => (Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5)).replace(/[^a-z0-9]/g, 'x');
export function addPin(h, type, ref, id = makeId()) {
  ref = String(ref || '');
  if (!PIN_TYPES.includes(type) || !ref || h.pins.length >= MAX_PINS || h.pins.some(p => p.type === type && p.ref === ref)) return h;
  const p = { id, type, ref: ref.slice(0, 200) };
  return cleanHome({ ...h, pins: [...h.pins, p], order: [...h.order, pinKey(p)] });
}
/* ---- your own custom sections: you name it, then fill it with any albums, artists and songs ---- */
export function addCustom(h, name, id = makeId()) {
  if (h.pins.length >= MAX_PINS) return h;
  const p = { id, type: 'custom', ref: clean(name) || 'My picks', items: [] };
  return cleanHome({ ...h, pins: [...h.pins, p], order: [...h.order, pinKey(p)] });
}
const editCustom = (h, id, fn) => cleanHome({ ...h, pins: h.pins.map(p => p.id === id && p.type === 'custom' ? { ...p, items: fn(p.items) } : p) });
export function addCustomItem(h, id, t, v) { const p = h.pins.find(x => x.id === id && x.type === 'custom'); if (!p || !ITEM_TYPES.includes(t) || !v || p.items.length >= MAX_ITEMS || p.items.some(i => i.t === t && i.v === String(v))) return h; return editCustom(h, id, a => [...a, { t, v: String(v) }]); }
export function removeCustomItem(h, id, t, v) { return editCustom(h, id, a => a.filter(i => !(i.t === t && i.v === String(v)))); }
export function moveCustomItem(h, id, t, v, dir) {
  return editCustom(h, id, a => { const o = a.slice(), i = o.findIndex(x => x.t === t && x.v === String(v)), j = i + (dir < 0 ? -1 : 1); if (i < 0 || j < 0 || j >= o.length) return a; [o[i], o[j]] = [o[j], o[i]]; return o; });
}
export function removePin(h, id) {
  const k = 'pin:' + id, drop = a => a.filter(x => x !== k), names = { ...h.names }; delete names[k];
  const todHidden = h.todHidden ? Object.fromEntries(Object.entries(h.todHidden).map(([p, a]) => [p, drop(a)])) : null;
  return { ...h, pins: h.pins.filter(p => p.id !== id), order: drop(h.order), hidden: drop(h.hidden), names, todHidden };
}
/* ---- your own names ---- */
export function renameSection(h, k, name) { const names = { ...h.names }, v = clean(name); if (v) names[k] = v; else delete names[k]; return { ...h, names }; }
export function renameQuick(h, k, name) { const qnames = { ...h.qnames }, v = clean(name); if (v) qnames[k] = v; else delete qnames[k]; return { ...h, qnames }; }
/* ---- quick buttons ---- */
export function toggleQuick(h, k) { const qhidden = h.qhidden.includes(k) ? h.qhidden.filter(x => x !== k) : [...h.qhidden, k]; return { ...h, qhidden }; }
export function moveQuick(h, k, dir) {
  const o = h.qb.slice(), i = o.indexOf(k), j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= o.length) return h;
  [o[i], o[j]] = [o[j], o[i]]; return { ...h, qb: o };
}

/* ---------- v162: Home references that survive a settings export / import ----------
 * Pins and custom songs/albums used to point only at internal ids (playlist p…, album a…, track t…). Those ids are made on each phone,
 * so an imported Home layout showed "Missing playlist" and dropped songs. Each reference now also keeps a readable name (and the artist
 * for albums / songs); the lookup uses the id first and the name second. */
const keyN = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** A playlist pin's playlist: by id, else by name. list items: { id, name }. name(x) reads the name of one item (e.g. unescapes it). */
/** BUG-445: a stored name is cut at its limit (cap); a name at the cap matches by prefix. */
const nameEq = (full, stored, cap) => { const a = keyN(full), b = keyN(stored); return a === b || (String(stored).length >= cap && a.startsWith(b)); };
export function findPlaylist(pin, list, name = s => s) {
  const byId = list.find(x => x.id === pin.ref); if (byId) return byId;
  if (!pin.name) return null;
  const same = list.filter(x => nameEq(name(x.name), pin.name, 200));   // BUG-304: the id is the identity; the name is only a fallback and only when exactly ONE playlist has that name (never guess between same-named playlists)
  return same.length === 1 ? same[0] : null;
}
/** An album pin's album: by id, else by title + artist. list items: { id, title, artist }. */
export function findAlbum(pin, list, name = s => s) {
  return list.find(x => x.id === pin.ref) || (pin.name ? list.find(x => nameEq(name(x.title), pin.name, 200) && (!pin.by || nameEq(name(x.artist), pin.by, 200))) : null) || null;
}
/** A custom section's song or album: by id, else by title + artist. list items: songs { id, title, trackArtist }, albums { id, title, artist }. */
export function findItem(item, list, name = s => s) {
  const artistOf = x => (x.trackArtist !== undefined ? x.trackArtist : x.artist);
  return list.find(x => x.id === item.v) || (item.label ? list.find(x => nameEq(name(x.title), item.label, 160) && (!item.by || nameEq(name(artistOf(x)), item.by, 160))) : null) || null;
}
/** Adds the readable name of every pin / song / album that does not have one yet. look = { playlist(id), album(id), track(id) } each -> { name, by? } or null.
 *  Returns the SAME object when nothing was added, so callers can compare cheaply. */
export function withNames(h, look) {
  if (!h || !Array.isArray(h.pins)) return h;
  let changed = false;
  const pins = h.pins.map(p => {
    if (!p || typeof p !== 'object') return p;
    if (p.type === 'custom') {
      let ch = false;
      const items = (Array.isArray(p.items) ? p.items : []).map(it => {
        if (!it || it.label || (it.t !== 'song' && it.t !== 'album')) return it;
        const f = it.t === 'song' ? look.track(it.v) : look.album(it.v);
        if (!f || !f.name) return it;
        ch = true; return { ...it, label: f.name, ...(f.by ? { by: f.by } : {}) };
      });
      if (!ch) return p;
      changed = true; return { ...p, items };
    }
    if (p.name || (p.type !== 'playlist' && p.type !== 'album')) return p;
    const f = p.type === 'playlist' ? look.playlist(p.ref) : look.album(p.ref);
    if (!f || !f.name) return p;
    changed = true; return { ...p, name: f.name, ...(f.by ? { by: f.by } : {}) };
  });
  return changed ? { ...h, pins } : h;
}
