// T19: favorites = a list of track ids (newest first). Pure helpers; persistence is `store` ('favorites') in native.js.
export const FAV_FILE = 'favorites';

/** Clean a value read from disk: array of unique non-empty strings. Anything else = []. */
export function cleanFavs(x) {
  if (!Array.isArray(x)) return [];
  const seen = new Set(), out = [];
  for (const id of x) if (typeof id === 'string' && id && !seen.has(id)) { seen.add(id); out.push(id); }
  return out;
}

export const isFav = (favs, id) => favs.includes(id);

/** New list with `id` added at the top, or removed if it was there. Never changes the input. */
export const toggleFav = (favs, id) => (favs.includes(id) ? favs.filter(x => x !== id) : [id, ...favs]);

/** Favorite songs that are still in the library, in favorite order (newest first). Dead ids stay in the file (the folder may be re-picked later). */
export function favTracks(favs, tracks) {
  const by = new Map(tracks.map(t => [t.id, t]));
  return favs.map(id => by.get(id)).filter(Boolean);
}
