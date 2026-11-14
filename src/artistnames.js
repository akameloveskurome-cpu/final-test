// v54: who is "on" a song. A song tagged "Drake feat. Travis Scott", "Drake, Travis Scott", "Drake; Travis Scott" or titled
// "Song (feat. Travis Scott)" belongs to BOTH artists, so Travis Scott's page lists every song he is on, not only his own albums.
// Pure (no DOM, no escaping): works on RAW strings. data.js escapes the results.
const STRONG = /\s*;\s*|\s+(?:feat\.?|ft\.?|featuring)\s+/i;   // only these are CERTAIN separators
const WEAK = /\s*,\s*|\s+&\s+|\s+and\s+|\s+\/\s+|\s+(?:with|vs\.?)\s+|\s+(?:x|×)\s+/i;   // C2: split only when a piece is a known artist (\"Dance with the Dead\", \"AC / DC\", \"Malcolm X Jones\" stay whole)
const FEAT_OPEN = /\s*[(\[]\s*(?:feat\.?|ft\.?|featuring)\s+/ig;   // "Drake (feat. Travis)" -> "Drake feat. Travis)"
const lc = s => String(s).trim().toLowerCase();

/** Smart grouping: the key two spellings of the SAME artist share. Ignores case, accents (Latin / Greek / Cyrillic combining marks only), punctuation, spaces and a leading "The":
 *  "Lily Rose Depp" = "Lily-Rose Depp", "The Weeknd" = "Weeknd", "Beyoncé" = "Beyonce", "A$AP Rocky" = "ASAP Rocky", "Jay-Z" = "JAY Z".
 *  Only these safe differences are merged (no guessing from similar letters), so two different artists are never joined.
 *  v158: vowel signs / voiced marks of Hindi, Tamil, Telugu, Thai, Arabic, Hebrew and Japanese (dakuten) are PART of the letters, not accents: they used to be stripped, so different artists got one key (and one shared picture that was deleted when the other got a new one). */
export function artistKey(name) {
  let t = String(name ?? '').normalize('NFD').replace(/([\p{Script=Latin}\p{Script=Greek}])[\u0300-\u036f]+/gu, '$1').normalize('NFC')   /* BUG-403: only Latin / Greek accents are dropped (Cyrillic й ё ї are letters) */.toLowerCase().replace(/\$/g, 's').replace(/&/g, ' and ');
  const noThe = t.replace(/^\s*the\s+/, '');
  if (/[\p{L}\p{N}]/u.test(noThe)) t = noThe;   // "The The" / "The" keep their "the"
  const k = t.replace(/[^\p{L}\p{M}\p{N}]+/gu, '');   // \p{M}: the marks left are part of non-Latin letters
  return k || lc(name);
}
/** Acts whose name contains a separator but is ONE act. Never split, even when a piece is also a known artist. */
const PROTECTED = ['Tyler, The Creator', 'Earth, Wind & Fire', 'Simon & Garfunkel', 'Crosby, Stills, Nash & Young', 'Crosby, Stills & Nash', 'Hall & Oates', 'Florence + The Machine', 'Mumford & Sons', 'Salt-N-Pepa', 'Sly & The Family Stone', 'Kool & The Gang', 'Belle and Sebastian', 'Brooks & Dunn', 'Ike & Tina Turner', 'Years & Years', 'Big & Rich', 'Bone Thugs-N-Harmony', 'Peter, Paul and Mary', 'Emerson, Lake & Palmer', 'Blood, Sweat & Tears', 'Gladys Knight & The Pips', 'Diana Ross & The Supremes', 'Martha and the Vandellas', 'Huey Lewis and the News', 'Marina and the Diamonds', 'Echo & the Bunnymen', 'Iron & Wine', 'Of Monsters and Men', 'Black Eyed Peas', 'AC/DC', 'Tom Petty and the Heartbreakers', 'Bob Marley & The Wailers', 'Prince and The Revolution', 'Katrina and the Waves', 'Axwell /\\ Ingrosso'];
export const PROTECTED_KEYS = new Set(PROTECTED.map(artistKey));

/** Names after a "feat." marker inside a title: "Song (feat. A & B)" -> ['A', 'B']. */
export function featFromTitle(title) {
  const out = [], re = /[(\[]\s*(?:feat\.?|ft\.?|featuring)\s+([^)\]]+)[)\]]/ig;   // C1: \"(with ...)\" is not a feature marker
  let m; while ((m = re.exec(String(title || '')))) out.push(...String(m[1]).split(WEAK).map(s => s.trim()).filter(Boolean));
  return out;
}

/** Splits a tag value into artists. `known` = Set of lower-case names that are certainly ONE artist (album artists, plain track artists):
 *  a part is only split on "," "&" "and" when one of the pieces is a known artist, so "Tyler, The Creator" and "Simon & Garfunkel" stay whole. */
export function splitArtists(raw, known = new Set(), keyOf = lc, protect = null) {   // keyOf: how a name is compared with `known` (smart grouping passes artistKey); protect: Set of keys that are never split
  const r0 = String(raw || ''); FEAT_OPEN.lastIndex = 0; const hadOpen = FEAT_OPEN.test(r0); FEAT_OPEN.lastIndex = 0;   // BUG-105: strip a closing bracket only when a "(feat." opener was replaced
  const s = (hadOpen ? r0.replace(FEAT_OPEN, ' feat. ').replace(/[)\]]\s*$/, '') : r0).trim();
  if (!s || lc(s) === 'unknown artist') return [];
  const out = [], seen = new Set();
  const add = n => { n = String(n).replace(/\s+/g, ' ').trim(); if (n && !seen.has(lc(n))) { seen.add(lc(n)); out.push(n); } };
  for (const part of s.split(STRONG).filter(Boolean)) {
    const pieces = part.split(WEAK).map(p => p.trim()).filter(Boolean);
    const kn = pieces.filter(p => known.has(keyOf(p))).length;   // at least half of the pieces must be known artists ("Earth, Wind & Fire" is not 3 artists because "Earth" exists)
    if (pieces.length > 1 && !known.has(keyOf(part)) && !(protect && protect.has(artistKey(part))) && kn > 0 && kn * 2 >= pieces.length) pieces.forEach(add); else add(part);
  }
  return out;
}

/** True when a tag value has no separator at all (so it is certainly one artist). */
export const isPlainName = s => { const t = String(s || '').trim(); return !!t && !STRONG.test(t) && !WEAK.test(t) && !/[(\[]/.test(t); };

const VARIOUS = /^(various artists?|various|va|v\.a\.|unknown artist)$/i;
/** Every artist of one song, in display order: tag artists, "feat." names from the title, then the album artist.
 *  smart = { keyOf, protect }: the album artist is split too ("Maluma, The Weeknd" on a single is two artists, not a third made-up one) and "Various Artists" is not an artist. */
export function songArtists(trackArtist, title, albumArtist, known = new Set(), smart = null) {
  const out = [], seen = new Set(), keyOf = smart ? smart.keyOf : lc;
  const aa = !albumArtist || lc(albumArtist) === 'unknown artist' ? [] : smart ? (VARIOUS.test(String(albumArtist).trim()) ? [] : splitArtists(albumArtist, known, keyOf, smart.protect)) : [albumArtist];
  for (const n of [...splitArtists(trackArtist, known, keyOf, smart && smart.protect), ...featFromTitle(title), ...aa]) {
    const k = keyOf(n);
    if (!seen.has(k)) { seen.add(k); out.push(n); }
  }
  return out;
}
