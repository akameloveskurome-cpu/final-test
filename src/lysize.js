// v148: lyrics text size is a free slider (any whole number of pixels), not just Small / Medium / Large. PURE.
// Medium (23 px) is the default. An older saved Small / Medium / Large keeps its old size (20 / 23 / 26 px).
export const LY_MIN = 14, LY_MAX = 48, LY_DEF = 23;
export const LY_LABELS = { Small: 20, Medium: 23, Large: 26 };
/** -> a whole number of px between LY_MIN and LY_MAX. v = the saved pixel size (anything), label = the older Small / Medium / Large value. */
export function cleanLyPx(v, label) {
  const n = v == null || (typeof v === 'string' && v.trim() === '') || typeof v === 'boolean' || Array.isArray(v) ? NaN : Number(v);
  if (Number.isFinite(n)) return Math.min(LY_MAX, Math.max(LY_MIN, Math.round(n)));
  return typeof label === 'string' && Object.hasOwn(LY_LABELS, label) ? LY_LABELS[label] : LY_DEF;   // BUG-139
}
/** Short name for the Settings row: the three old sizes keep their name, anything else shows its pixels. */
export const lyName = px => { const k = Object.keys(LY_LABELS).find(x => LY_LABELS[x] === px); return k ? `${k} (${px} px)` : `${px} px`; };
