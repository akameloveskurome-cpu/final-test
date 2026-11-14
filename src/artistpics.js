// Custom artist pictures / GIFs and Smart artist grouping (pure helpers, no DOM; used by main.js).
// A picture is saved under ONE key, the artist's shown name. With grouping on, the other spellings of the same artist are the same artist:
//   * a picture saved under an old spelling is still found (canonical name first),
//   * setting, replacing or removing a picture deletes the saved picture of EVERY other spelling (markers AND the stored bytes, even when the marker was lost),
//     so only one picture is ever kept and a removed picture can never come back from a forgotten spelling.
// With grouping off the artist has no other spellings: exact names only.

/** Every key a picture of this artist could be saved under: the shown name first, then merged spellings, each as escaped and plain text. */
export function picNames(shown, variants = [], unesc = x => x) {
  const out = [], add = k => { if (k && !out.includes(k)) out.push(k); };
  for (const v of [shown, ...variants]) { add(v); add(unesc(v)); }
  return out;
}
/** The key whose picture is shown: the first spelling that has one (shown name first), else `shown`. */
export const picKey = (map, names, shown) => names.find(k => map[k]) || shown;
/** Keys whose stored picture must be deleted: all spellings except `keep` (pass null to remove the picture altogether). */
export const picDrop = (names, keep) => names.filter(k => k !== keep);

/** v157: every stored key (marker, GIF bytes, photo) that belongs to the same artist as `shown` under the CURRENT identity rule (`idOf`):
 *  smart grouping on = artistKey (case, accents, "The", punctuation), off = trim + lower-case. Spellings are found even when the artist index no longer lists
 *  them (grouping was switched, or the shown casing changed), so replacing / removing a photo can never leave a hidden copy that comes back later. */
export function picAliases(stored, shown, idOf, unesc = x => x) {
  const id = idOf(unesc(shown)), out = [];
  for (const k of stored) if (k && idOf(unesc(k)) === id && !out.includes(k)) out.push(k);
  return out;
}
