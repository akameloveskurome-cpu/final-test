// v76: Animation studio. Every liquid / wobble feel is a multiplier the user can set in Settings > Animation.
// 100 % = the built-in feel. Every slider has a sensible ceiling so no setting can make the app look broken. The values are read live by glidebar.js (tab-bar pill), jelly.js (button squash) and liquidui.js (toggle knob, scrub thumb).
export const ANIM_DEFS = [
  { k: 'pillWobbleV', label: 'Pill wobble up / down', min: 0, max: 600, def: 100 },
  { k: 'pillWobbleH', label: 'Pill wobble left / right', min: 0, max: 600, def: 100 },
  { k: 'pillStretch', label: 'Liquid stretch while dragging', min: 0, max: 600, def: 100 },
  { k: 'pillSize', label: 'Pill size when pressed', min: 50, max: 450, def: 100 },
  { k: 'magnify', label: 'Magnification', min: 0, max: 600, def: 100 },
  { k: 'bounce', label: 'Bounciness (all springs)', min: 30, max: 600, def: 100 },
  { k: 'speed', label: 'Spring speed', min: 50, max: 600, def: 100 },
  { k: 'jelly', label: 'Button squash and jiggle', min: 0, max: 600, def: 100 },
  { k: 'knob', label: 'Toggle knob fluidity', min: 0, max: 600, def: 100 },
  { k: 'fringe', label: 'Glass edge colour fringe', min: 0, max: 750, def: 100 },
];
const D = Object.fromEntries(ANIM_DEFS.map(d => [d.k, d.def]));
export const PRESETS = {
  default: { ...D },
  watery: { pillWobbleV: 125, pillWobbleH: 120, pillStretch: 115, pillSize: 105, magnify: 110, bounce: 120, speed: 95, jelly: 105, knob: 105, fringe: 130 },
  max: { pillWobbleV: 150, pillWobbleH: 150, pillStretch: 130, pillSize: 110, magnify: 120, bounce: 140, speed: 100, jelly: 110, knob: 110, fringe: 150 },
  calm: { pillWobbleV: 40, pillWobbleH: 40, pillStretch: 50, pillSize: 90, magnify: 80, bounce: 60, speed: 110, jelly: 50, knob: 50, fringe: 60 },
};
export const A = {};   // live multipliers (1 = default)
export const cleanAnim = o => { const r = {}; for (const d of ANIM_DEFS) { const x = o && o[d.k], v = x == null || x === '' || typeof x === 'boolean' || Array.isArray(x) ? NaN : Number(x);
    /* BUG-139 */ r[d.k] = Number.isFinite(v) ? Math.max(d.min, Math.min(d.max, v)) : d.def; } return r; };
export const setAnim = o => { const c = cleanAnim(o); for (const d of ANIM_DEFS) A[d.k] = c[d.k] / 100; return c; };
setAnim({});
// spring constants (stiffness k, damping c) tuned by the Speed and Bounciness sliders: speed keeps the damping ratio, bounciness lowers / raises damping
export const tune = (k, c) => [k * A.speed * A.speed, c * A.speed * Math.pow(1 / Math.max(0.25, A.bounce), 0.7)];
/* ---------- v208: liquid glass CSS limits ----------
   Every CSS value the sliders drive goes through glassVars(), so no slider combination (the Max preset, all sliders at the
   top, a fast bouncy mix, a flat slow mix, or a value from an imported file) can push a spring past these limits. The
   ceilings are the largest values that kept buttons, toggles, text and the tab bar inside their boxes in the Chromium audit
   (tests/glass_extremes.py). */
export const GLASS_LIMITS = { lqAmp: 1.9, durMin: 0.3, durMax: 1.6, durK: [0.4, 2.4], springOver: 1.7, liqOver: 1.55, fringeMax: 5 };
/** Ceilings for the tab bar pill: how far its edges can wobble (x 5 px) and how much the icons magnify. Both are also limited by the fit check in glidebar.js. */
export const EDGE_WOBBLE_MAX = 2.6, MAGNIFY_MAX = 2.1;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
/** The CSS custom properties that follow Settings > Animation (and the Lens fringe). Pure: tested in Node. */
export function glassVars(anim) {
  const c = cleanAnim(anim), L = GLASS_LIMITS;
  const jl = c.jelly / 100, bn = c.bounce / 100, sp = c.speed / 100;
  const sp2 = clampN(Math.sqrt(bn), 0.6, 1.5);                      // the wobble strength follows Bounciness, within 0.6 .. 1.2
  return {
    '--lq-amp': clampN(jl * sp2, 0, L.lqAmp).toFixed(3),
    '--lq-dur': clampN(0.65 / sp, L.durMin, L.durMax).toFixed(3) + 's',
    '--dur-k': clampN(1 / sp, L.durK[0], L.durK[1]).toFixed(3),
    '--spring': 'cubic-bezier(.3,' + clampN(1 + 0.45 * bn, 1, L.springOver).toFixed(3) + ',.5,1)',
    '--liq': 'cubic-bezier(.3,' + clampN(1 + 0.3 * bn, 1, L.liqOver).toFixed(3) + ',.5,1)',
    '--fringe': clampN(1.2 * (c.fringe / 100), 0, L.fringeMax).toFixed(2) + 'px',
  };
}
