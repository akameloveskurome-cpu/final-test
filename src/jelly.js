import { A, tune } from './animcfg.js';
// Liquid "jelly" press for buttons, chips and the mini player. Press: the element squashes and bulges; hold + drag: it stretches toward the
// finger like a drop of liquid; release: it springs back with a wobble. Pure transform (scale + translate), so layout never moves.
// Skipped under Reduce Motion. The inline transform is removed again when the spring has settled, so the CSS rules take over.
const SEL = '.gbtn,.sbtn,.chip,.mini,.mini .mb,.cluster button,.np .bottom button,.actions button,.gtile,.card,.row,.setrow,.mini-open,.lyr-now,.searchpill,.lshome,.statban,.lstop,.lscell,.resume,.lsempty,.lssnap,.profile .pfmain,.btbanner,.itile[data-act],.jelly,[data-act]:not(.scrim):not(.toggle):not(input),button';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function initJelly(doc = document) {
  const live = new Map();   // element -> state
  let raf = 0, last = 0;
  const reduced = () => doc.documentElement.dataset.motion === 'reduce';

  const step = now => {
    const dt = Math.min(0.032, last ? (now - last) / 1000 : 0.016); last = now;
    for (const [el, s] of live) {
      const sp = Math.min(1, s.sp || 0); s.sp = (s.sp || 0) * 0.9;
      const bigK = s.big ? 0 : 1; const a = bigK * (s.down ? Math.min(0.55, Math.abs(s.dx) / s.w * 0.15 + sp * 0.05 * Math.abs(s.ux || 0)) : 0), b = bigK * (s.down ? Math.min(0.55, Math.abs(s.dy) / s.h * 0.15 + sp * 0.05 * Math.abs(s.uy || 0)) : 0);
      const base = s.down ? s.pressAmt : 0;
      const tgt = { sx: 1 + (base + a - b * 0.4) * A.jelly, sy: 1 + (-base + b - a * 0.4) * A.jelly, ox: s.down && !s.big ? s.dx * 0.06 : 0, oy: s.down && !s.big ? s.dy * 0.06 : 0 };
      tgt.sx = clamp(tgt.sx, 0.9, 1.12); tgt.sy = clamp(tgt.sy, 0.9, 1.12);   // never grow past 112 % or shrink below 90 %, whatever the sliders say
      const k = s.down ? 300 + 260 * sp : 300 + 80 * (s.f || 0), c = s.down ? 24 - 6 * sp : 16 - 3 * (s.f || 0);   // release is underdamped on purpose: that is the jiggle
      const [k2, c2] = tune(k, c); for (const q of ['sx', 'sy', 'ox', 'oy']) { const v = 'v' + q, acc = k2 * (tgt[q] - s[q]) - c2 * s[v]; s[v] += acc * dt; s[q] += s[v] * dt; }
      if (!isFinite(s.sx + s.sy + s.ox + s.oy)) { s.sx = s.sy = 1; s.ox = s.oy = 0; s.vsx = s.vsy = s.vox = s.voy = 0; }
      s.sx = clamp(s.sx, 0.9, 1.12); s.sy = clamp(s.sy, 0.9, 1.12);
      el.style.transform = `translate(${s.ox.toFixed(2)}px,${s.oy.toFixed(2)}px) scale(${s.sx.toFixed(4)},${s.sy.toFixed(4)})`;
      if (!s.down && s.rel == null) s.rel = now;
      const stale = !s.down && s.rel != null && now - s.rel > 3000;   // v208: never wobble longer than 3 s after release
      const rest = stale || !s.down && Math.abs(s.sx - 1) < 0.002 && Math.abs(s.sy - 1) < 0.002 && Math.abs(s.ox) < 0.05 && Math.abs(s.oy) < 0.05 && Math.abs(s.vsx) + Math.abs(s.vsy) < 0.05;
      if (rest) { el.style.transform = ''; el.style.transition = ''; el.style.willChange = ''; el.classList.remove('jy-down'); live.delete(el); }
    }
    raf = live.size ? requestAnimationFrame(step) : 0; if (!raf) last = 0;
  };
  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(step); } };

  let cur = null;   // the element under the finger
  doc.addEventListener('pointerdown', e => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || reduced()) return;
    const el = e.target.closest && e.target.closest(SEL); if (!el || el.disabled || e.target.closest('input,.toggle,.scrub,.tabbar,.lens') || el.closest('[data-liquid]') || el.closest('.tabbar,.lens,.toggle,.scrub')) return;   // rows with the liquid pill (liquidgroups.js) do not squash
    const r = el.getBoundingClientRect(), s = live.get(el) || { sx: 1, sy: 1, ox: 0, oy: 0, vsx: 0, vsy: 0, vox: 0, voy: 0 };
    Object.assign(s, { f: (e.pointerType === 'mouse' ? 0.4 : Math.max(Math.min(1, (Math.max(e.width || 0, e.height || 0) - 12) / 42), e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : 0)), sp: 0, ux: 0, uy: 0, t: 0, px: undefined, py: undefined, rel: null, down: true, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, w: Math.max(1, r.width), h: Math.max(1, r.height), big: r.width > 160 || r.height > 90, pressAmt: (r.width > 160 ? 0.02 : 0.06) * (0.7 + 0.9 * (e.pointerType === 'mouse' ? 0.4 : Math.max(Math.min(1, (Math.max(e.width || 0, e.height || 0) - 12) / 42), e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : 0))) });
    el.style.transition = 'none'; el.style.willChange = 'transform'; el.classList.add('jy-down');
    live.set(el, s); cur = el; kick();
  }, { passive: true });
  doc.addEventListener('pointermove', e => {
    if (!cur || !e.isPrimary) return; const s = live.get(cur); if (!s || !s.down) return;
    { const t = e.timeStamp, dt = Math.max(1, t - (s.t || t - 16)) / 1000, vx = (e.clientX - (s.px ?? e.clientX)) / dt, vy = (e.clientY - (s.py ?? e.clientY)) / dt, v = Math.hypot(vx, vy); s.sp = Math.max(s.sp || 0, Math.min(1, v / 1800)); if (v > 30) { s.ux = vx / v; s.uy = vy / v; } s.t = t; s.px = e.clientX; s.py = e.clientY; }
    s.dx = clamp(e.clientX - s.x0, -s.w * 0.9, s.w * 0.9); s.dy = clamp(e.clientY - s.y0, -s.h * 0.9, s.h * 0.9);
  }, { passive: true });
  doc.addEventListener('scroll', () => { if (cur) { const s = live.get(cur); if (s) s.down = false; cur.classList.remove('jy-down'); cur = null; kick(); } }, { passive: true, capture: true });
  const up = e => { if (!cur || (e && !e.isPrimary)) return; const s = live.get(cur); if (s) { s.down = false; cur.classList.remove('jy-down'); } cur = null; kick(); };
  doc.addEventListener('pointerup', up, { passive: true }); doc.addEventListener('pointercancel', up, { passive: true });
}
