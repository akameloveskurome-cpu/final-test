// v119: Lyrics animation. Every value is a percent the user sets in Settings > Lyrics > Lyrics animation. The defaults are the built-in feel.
export const LYA_DEFS = [
  { k: 'glide', label: 'Glide speed', hint: 'How long a line takes to slide up. Lower = quicker, higher = slower and softer.', min: 30, max: 250, def: 100 },
  { k: 'fade', label: 'Fade speed', hint: 'How fast a line turns bright / dim.', min: 30, max: 250, def: 100 },
  { k: 'zoom', label: 'Playing line size', hint: 'How much the line that is playing grows.', min: 90, max: 125, def: 102 },
  { k: 'small', label: 'Other lines size', hint: 'How small the lines that are not playing are.', min: 80, max: 100, def: 94 },
  { k: 'dim', label: 'Other lines brightness', hint: 'How bright the lines that are not playing are.', min: 10, max: 100, def: 58 },
  { k: 'blur', label: 'Blur on far lines', hint: 'Lines get blurrier the further they are from the playing line. 0 = no blur.', min: 0, max: 200, def: 0 },
  { k: 'anchor', label: 'Playing line height', hint: 'Where the playing line rests on the screen. Low = near the top.', min: 5, max: 50, def: 16 },
];
const D = Object.fromEntries(LYA_DEFS.map(d => [d.k, d.def]));
export const LYA_PRESETS = {
  default: { ...D },
  smooth: { ...D, glide: 170, fade: 150 },
  snappy: { ...D, glide: 55, fade: 60 },
  blurry: { ...D, glide: 120, zoom: 105, small: 92, dim: 45, blur: 100 },
  still: { ...D, glide: 30, fade: 30, zoom: 100, small: 100 },
};
export const cleanLya = o => { const r = {}; for (const d of LYA_DEFS) { const v = o && o[d.k] != null && o[d.k] !== '' && typeof o[d.k] !== 'boolean' && !Array.isArray(o[d.k]) ? Number(o[d.k]) : NaN; r[d.k] = Number.isFinite(v) ? Math.max(d.min, Math.min(d.max, v)) : d.def; } return r; };
// CSS variables the lyrics styles read (see app.css, "Apple Music style lyrics")
export const lyaVars = o => { const c = cleanLya(o); return {
  '--ly-glide': (c.glide / 100).toFixed(2), '--ly-fade': (c.fade / 100).toFixed(2), '--ly-zoom': (c.zoom / 100).toFixed(3), '--ly-small': (c.small / 100).toFixed(3),
  '--ly-op': (c.dim / 100).toFixed(2), '--ly-blur': (c.blur / 100 * .5).toFixed(2) + 'px' }; };
