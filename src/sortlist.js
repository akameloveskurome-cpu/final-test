/* T23: sorting + A-Z index. Pure (no DOM). Library strings are HTML-escaped, so they are unescaped before comparing. */
export const SORT_OPTS = {
  songs: [['title', 'Title'], ['artist', 'Artist'], ['year', 'Year'], ['added', 'Date Added'], ['dur', 'Duration']],
  albums: [['name_asc', 'Name - ascending'], ['name_desc', 'Name - descending'], ['songs_asc', 'Number of songs - ascending'], ['songs_desc', 'Number of songs - descending'], ['dur_asc', 'Duration - ascending'], ['dur_desc', 'Duration - descending'], ['year_asc', 'Year - ascending'], ['year_desc', 'Year - descending'], ['updated_asc', 'Date updated - ascending'], ['updated_desc', 'Date updated - descending'], ['artist_asc', 'Artist - ascending'], ['artist_desc', 'Artist - descending'], ['aartist_asc', 'Album-Artist - ascending'], ['aartist_desc', 'Album-Artist - descending'], ['composer_asc', 'Composer - ascending'], ['composer_desc', 'Composer - descending']],
  artists: [['name', 'Name'], ['added', 'Date Added']],
};
export const SORT_DEF = { songs: 'title', albums: 'name_asc', artists: 'name' };
/** Album sort keys saved before v64 (old key -> the same order under its new key). */
const LEGACY_ALBUMS = { title: 'name_asc', artist: 'aartist_asc', year: 'year_desc', added: 'updated_desc' };
export const cleanSort = (list, v) => { if (list === 'albums' && LEGACY_ALBUMS[v]) v = LEGACY_ALBUMS[v]; return (SORT_OPTS[list] || []).some(o => o[0] === v) ? v : SORT_DEF[list]; };
export const cleanSortSet = o => ({ songs: cleanSort('songs', o && o.songs), albums: cleanSort('albums', o && o.albums), artists: cleanSort('artists', o && o.artists) });
export const sortLabel = (list, v) => ((SORT_OPTS[list] || []).find(o => o[0] === v) || [0, ''])[1];
/** Modes that group under letter headers + the A-Z rail. */
export const isLettered = v => v === 'title' || v === 'artist' || v === 'name' || /^(name|artist|aartist|composer)_(asc|desc)$/.test(v);

const unesc = s => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const col = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
export const key = (s, the = false) => { let k = unesc(s).trim(); if (the) k = k.replace(/^the\s+/i, ''); return k; };
const cmp = (a, b, the) => col.compare(key(a, the), key(b, the));
/** C9: A-Z for Latin, the capital itself for other cased alphabets (Cyrillic, Greek...), one section per script for kana / Han / Hangul, '#' for digits and symbols. */
// Bug 5: letters that do not split into base + accent, folded to the section the collator sorts them in (Ø beside O, Ł beside L, Æ as "AE" inside A, ß as "ss" inside S ...)
const FOLD = { 'Ł': 'L', 'ł': 'l', 'Ø': 'O', 'ø': 'o', 'Đ': 'D', 'đ': 'd', 'Ð': 'D', 'ð': 'd', 'Æ': 'A', 'æ': 'a', 'Œ': 'O', 'œ': 'o', 'ß': 's', 'Ħ': 'H', 'ħ': 'h', 'Ŧ': 'T', 'ŧ': 't', 'ı': 'i' };
export const letterOf = (s, the = false) => {
  const o = Array.from(key(s, the))[0] || '';
  if (/\p{Script=Latin}/u.test(o) && !/^[A-Za-z]$/.test(o) && col.compare(o, 'z') > 0) return o.toUpperCase();   // BUG-218: a letter this collation sorts AFTER Z (Å Ä Ö Æ Ø in Nordic locales) gets its own header, so no letter repeats
  let c = Array.from(key(s, the).normalize('NFKD').replace(/[\u0300-\u036f]/g, ''))[0] || '';
  c = FOLD[c] || c;
  const u = c.toUpperCase();
  if (u >= 'A' && u <= 'Z' && u.length === 1) return u;
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(c)) return 'あ';
  if (/\p{Script=Han}/u.test(c)) return '漢';
  if (/\p{Script=Hangul}/u.test(c)) return '한';
  return /\p{L}/u.test(c) ? u : '#';
};
const num = n => +n || 0;

/** `al(t)` returns the album of a song. Returns a NEW array. */
export function sortTracks(ts, mode, al) {
  const inAlbum = (x, y) => cmp(al(x).title, al(y).title) || (x.disc || 1) - (y.disc || 1) || num(x.no) - num(y.no);
  const f = {
    title: (x, y) => cmp(x.title, y.title),
    artist: (x, y) => cmp(x.trackArtist || al(x).artist, y.trackArtist || al(y).artist, true) || inAlbum(x, y),
    year: (x, y) => num(al(y).year) - num(al(x).year) || inAlbum(x, y),
    added: (x, y) => num(y.added) - num(x.added) || cmp(x.title, y.title),
    dur: (x, y) => num(y.dur) - num(x.dur) || cmp(x.title, y.title),
  }[mode] || ((x, y) => cmp(x.title, y.title));
  return ts.slice().sort(f);
}
/** Albums. `countOf(album)` = number of songs, `durOf(album)` = total seconds (each is only called for its own sort mode, once per album).
 *  Modes are `<field>_asc` / `<field>_desc`: name, songs, dur, year, updated, artist (track artist), aartist (album artist), composer. Albums with no year / no composer always go last. */
export function sortAlbums(as, mode, countOf = a => a.count, durOf = a => a.dur) {
  mode = LEGACY_ALBUMS[mode] || mode;
  const m = /^(name|songs|dur|year|updated|artist|aartist|composer)_(asc|desc)$/.exec(mode), field = m ? m[1] : 'name', sign = m && m[2] === 'desc' ? -1 : 1;
  const byTitle = (x, y) => cmp(x.title, y.title);
  const memo = fn => { const c = new Map(); as.forEach(a => c.set(a, num(fn(a)))); return (x, y) => c.get(x) - c.get(y); };
  const emptyLast = (get, f) => (x, y) => { const ex = !get(x), ey = !get(y); return ex || ey ? (ex ? 1 : 0) - (ey ? 1 : 0) : sign * f(x, y); };
  const f = {
    name: (x, y) => sign * byTitle(x, y),
    songs: (() => { const d = memo(countOf); return (x, y) => sign * d(x, y) || byTitle(x, y); })(),
    dur: (() => { const d = memo(durOf); return (x, y) => sign * d(x, y) || byTitle(x, y); })(),
    year: (x, y) => emptyLast(a => num(a.year), (p, q) => num(p.year) - num(q.year))(x, y) || byTitle(x, y),
    updated: (x, y) => sign * (num(x.added) - num(y.added)) || byTitle(x, y),
    artist: (x, y) => sign * cmp(x.trackArtist || x.artist, y.trackArtist || y.artist, true) || num(y.year) - num(x.year) || byTitle(x, y),
    aartist: (x, y) => sign * cmp(x.artist, y.artist, true) || num(y.year) - num(x.year) || byTitle(x, y),
    composer: (x, y) => emptyLast(a => String(a.composer || '').trim(), (p, q) => cmp(p.composer, q.composer))(x, y) || byTitle(x, y),
  }[field];
  return as.slice().sort(f);
}
/** `addedOf(name)` = newest file date of that artist. */
export function sortArtists(names, mode, addedOf) {
  const f = mode === 'added' ? (x, y) => num(addedOf(y)) - num(addedOf(x)) || cmp(x, y, true) : (x, y) => cmp(x, y, true);
  return names.slice().sort(f);
}
/** Groups an already sorted list into [[letter, items]] runs (a letter only appears once per run). */
export function groupLetters(items, letterFn) {
  const out = []; let last = null;
  items.forEach(x => { const L = letterFn(x); if (!last || last[0] !== L) { last = [L, []]; out.push(last); } last[1].push(x); });
  return out;
}
/** Rail helper: the present letter nearest to the touched slot (`i` of `all.length`), preferring the next one. */
export function pickLetter(all, present, i) {
  const has = new Set(present); if (!has.size) return '';
  for (let d = 0; d < all.length; d++) { if (has.has(all[i + d])) return all[i + d]; if (has.has(all[i - d])) return all[i - d]; }
  return '';
}
export const RAIL = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
