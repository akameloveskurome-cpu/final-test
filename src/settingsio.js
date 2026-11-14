// Settings backup: export / import everything under Settings (lyric size and style, liquid glass and wobble studio, lyrics animation, Home layout, glass bar size, background dim, ...). PURE.
// The settings live in ONE object (localStorage 'lf.settings'), plus a few small items stored beside it (EXTRA_KEYS). Big device files (background / playlist / artist / album pictures, GIFs, videos, profile GIF / video) are NOT part of the backup: NOT_INCLUDED lists them for the app to show.
import { stamp } from './transfer.js';
export const KIND = 'settings';
export const FILE_NAME = 'liquid-dark-settings.json';
/** v159: a new name each day, so an older backup is never overwritten by a new export. */
export const fileName = (now = new Date()) => `liquid-dark-settings-${stamp(now)}.json`;
export const SETTINGS_KEY = 'lf.settings';
const EXTRA_KEYS = ['lf.canvasOn'];                        // stored beside the settings object: the Canvas on/off switch only (v163: the profile photo is NOT exported; the owner adds it again)
const okExtra = (k, v) => k === 'lf.canvasOn' && typeof v === 'string' && (v === '0' || v === '1');
/** What a settings file does NOT hold (shown in the import / export sheets). */
export const NOT_INCLUDED = ['Background picture or GIF', 'Profile picture, GIF or video', 'Playlist, album, artist and genre pictures and GIFs', 'Canvas videos', 'Music folder choice (Android asks again)', 'Search history', 'Favorites, playlists and play history (they have their own export)'];
const SKIP = new Set(['recent', '__proto__', 'constructor', 'prototype']);   // recent searches are history, not settings

export function buildExport(set, extras = {}, appVersion = '', now = new Date()) {
  const settings = {}; for (const [k, v] of Object.entries(set || {})) if (!SKIP.has(k)) settings[k] = v;
  const ex = {}; for (const k of EXTRA_KEYS) if (okExtra(k, extras[k])) ex[k] = extras[k];
  return { app: 'liquid-dark', kind: KIND, version: 1, appVersion, exported: now.toISOString(), settings, extras: ex };
}
/** Number of single values in a settings object (an object counts its members, a list counts as one): a truer number than the count of top-level keys. */
export const countValues = o => Object.values(o || {}).reduce((n, v) => n + (v && typeof v === 'object' && !Array.isArray(v) ? Math.max(1, countValues(v)) : 1), 0);
export const exportText = o => JSON.stringify(o, null, 1);
// BUG-125: key order must not matter when two groups are compared
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x));

/** -> { settings, extras, count } or throws Error with a short message. The app cleans every value at start-up, so odd values are harmless; only the shape is checked here. */
// BUG-317: every value must have the same kind as the app's own default for that setting (checked against the real defaults).
// A value of the wrong kind is dropped, so the default is used. A key the app does not know is kept as before.
const isPlain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export const fits = (def, v) => {
  if (def === undefined) return true;
  if (def === null) return v === null || isPlain(v);
  if (Array.isArray(def)) return Array.isArray(v);
  if (isPlain(def)) return isPlain(v);
  return typeof v === typeof def && !(typeof v === 'number' && !Number.isFinite(v));
};
export function parseImport(text, known = null) {
  let o; try { o = JSON.parse(String(text ?? '').replace(/^\uFEFF/, '')); } catch { throw new Error('Not a settings file'); }
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.kind !== KIND || !o.settings || typeof o.settings !== 'object' || Array.isArray(o.settings)) throw new Error('Not a settings file');
  if (o.version != null && Number(o.version) > 1) throw new Error('File is from a newer version of the app');
  const settings = {}, dropped = []; for (const [k, v] of Object.entries(o.settings)) { if (SKIP.has(k)) continue; if (known && !fits(known[k], v)) { dropped.push(k); continue; } settings[k] = v; }
  const extras = {}; for (const k of EXTRA_KEYS) if (o.extras && okExtra(k, o.extras[k])) extras[k] = o.extras[k];
  const count = Object.keys(settings).length;
  if (!count) throw new Error('No settings in the file');
  return { settings, extras, count, dropped, values: countValues(settings) + Object.keys(extras).length, appVersion: typeof o.appVersion === 'string' ? o.appVersion : '', exported: typeof o.exported === 'string' ? o.exported : '' };
}
/** Imported values go ON TOP of the current ones, so a setting the file does not know keeps its value. `recent` (search history) is kept from the current settings. */
export const mergeSettings = (current, imported) => ({ ...(current || {}), ...imported, recent: (current || {}).recent || [] });
export { EXTRA_KEYS };

/* ---------- v160 (selective import) ---------- */
/** The group that holds the Canvas switch (stored beside the settings object). */
export const EXTRAS_GROUP = 'extras';
/** One row per setting group (top-level key) plus the extras: status is 'new' (not set yet), 'changed' or 'same'; values = how many single values it holds. */
export function groupDiffs(current, imported, importedExtras = {}, currentExtras = {}) {
  const out = [];
  for (const [k, v] of Object.entries(imported || {})) {
    if (SKIP.has(k)) continue;
    const status = !current || !Object.prototype.hasOwnProperty.call(current, k) ? 'new' : canon(current[k]) === canon(v) ? 'same' : 'changed';
    out.push({ key: k, status, values: Math.max(1, countValues({ [k]: v })) });
  }
  const ek = Object.keys(importedExtras || {});
  if (ek.length) {
    const changed = ek.some(k => (currentExtras || {})[k] !== importedExtras[k]), fresh = ek.some(k => !((currentExtras || {})[k] != null));
    out.push({ key: EXTRAS_GROUP, status: !changed ? 'same' : fresh ? 'new' : 'changed', values: ek.length });
  }
  return out;
}
/** Only the groups the person ticked (never the extras: those are applied by the app from the same file). */
export function pickSettings(imported, keys) {
  const want = new Set(keys || []), out = {};
  for (const [k, v] of Object.entries(imported || {})) if (want.has(k) && !SKIP.has(k)) out[k] = v;
  return out;
}
/* ---------- v208: plain names for the import sheet ----------
   The groups are the settings keys. Liquid glass and the animation studio (anim), the lyrics animation (lyAnim) and the
   lens refraction (refract) are named here so they are easy to find in the sheet. Unknown keys keep the split-name label. */
export const GROUP_LABELS = {
  anim: 'Liquid glass & wobble (animation studio)',
  lyAnim: 'Lyrics animation',
  refract: 'Lens refraction (tab bar)',
  lyricSize: 'Lyrics size', lyricPx: 'Lyrics text size', lyricStyle: 'Lyrics style', coverLyrics: 'Cover in lyrics',
  tabSize: 'Glass bar size (older Small / Medium / Large choice)', tabPct: 'Glass bar size', redHover: 'Red highlight on hover', motion: 'Reduce motion', contrast: 'Increase contrast',
  albumInfo: 'Album info', bigCovers: 'Big covers', userName: 'Your name', npCover: 'Player cover size', npImmersive: 'Immersive player', npTapOrig: 'Tap cover shows original',
  home: 'Home layout', bgDim: 'Background dim', bgFit: 'Background fit', autoplay: 'Autoplay', autoCheck: 'Check for updates',
  smartArtists: 'Smart artists', sort: 'Sort order', sleepCustom: 'Custom sleep timer',
};
/** The label shown for a settings group in the import sheet. */
export const groupLabel = k => GROUP_LABELS[k] || String(k).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
