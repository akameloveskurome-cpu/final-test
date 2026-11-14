import { A, tune } from './animcfg.js';
// v72: fluid glass for toggles and the scrub thumb (the same spring language as the tab-bar lens).
// (v79: the song progress line no longer wobbles.)
// Toggle: press = the knob swells into a glass drop (bigger with a harder / larger touch), drag = it follows the finger, the leading edge is stiff and the
// trailing edge lags (faster = longer stretch), release = it springs to the nearest side with a wobble. Scrub thumb: grows under the finger and stretches with speed.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const force = e => { const a = clamp((Math.max(e.width || 0, e.height || 0) - 12) / 42, 0, 1), p = e.pointerType === 'mouse' ? 0 : e.pressure, real = p > 0 && p !== 0.5; return e.pointerType === 'mouse' ? 0.4 : real ? Math.max(a * 0.6, Math.min(1, p * 1.25)) : a; };

export function initLiquidUI(doc = document) {
  const reduced = () => doc.documentElement.dataset.motion === 'reduce';
  // ---------- toggles ----------
  const T = new Map();   // element -> state
  let raf = 0, last = 0;
  const W = 52, KW = 26, LO = 3, HI = 23;
  const paintT = (el, s) => {
    if (![s.l, s.r, s.pop, s.sq].every(Number.isFinite)) { const [a, b] = sideEdges(!!s.on); Object.assign(s, { l: a, r: b, tl: a, tr: b, vl: 0, vr: 0, pop: 0, vp: 0, sq: 0 }); }
    s.l = clamp(s.l, LO - 2, HI + KW + 2); s.r = clamp(s.r, LO - 2, HI + KW + 2); s.pop = clamp(s.pop, -0.1, 1); s.sq = clamp(s.sq, 0, 1);
    const pp = Math.max(0, s.pop), grow = Math.min(9, (2.5 * pp + 1.5 * s.sq) * A.knob), l = Math.max(1, s.l - grow * 0.5 - (s.dir < 0 ? 1 * s.sq : 0)), r = Math.min(W - 1, s.r + grow * 0.5 + (s.dir > 0 ? 1 * s.sq : 0));
    const h = clamp(KW + (2.5 * Math.min(pp, 1) - 1.5 * s.sq) * A.knob, 22, 30);   // the knob never outgrows the 32px track (at most 30px tall, 1px to spare on each side)
    el.style.setProperty('--kl', l.toFixed(2) + 'px'); el.style.setProperty('--kr', (W - r).toFixed(2) + 'px');
    el.style.setProperty('--kt', (3 + (KW - h) / 2).toFixed(2) + 'px'); el.style.setProperty('--kh', h.toFixed(2) + 'px');
    el.style.setProperty('--pop', Math.min(1, pp).toFixed(3));
  };
  const stepT = now => {
    const dt = Math.min(0.032, last ? (now - last) / 1000 : 0.016); last = now;
    for (const [el, s] of T) {
      if (!s.down) { s.free = (s.free || 0) + dt; if (s.free > 1.2) { const [a, b] = sideEdges(!!s.want); s.l = s.tl = a; s.r = s.tr = b; s.vl = s.vr = s.pop = s.vp = s.sq = 0; } } else s.free = 0;
      const vc = (s.vl + s.vr) / 2, fwd = vc >= 0;
      for (const e of ['l', 'r']) {
        const lead = fwd ? e === 'r' : e === 'l';
        const [k, c] = tune(s.down ? (lead ? 430 : 70) : (lead ? 330 : 120), s.down ? (lead ? 32 : 8) : (lead ? 20 : 9));
        const v = 'v' + e, acc = k * (s['t' + e] - s[e]) - c * s[v]; s[v] += acc * dt; s[e] += s[v] * dt;
      }
      s.sq += (Math.min(1, Math.abs(vc) / 420) - s.sq) * 0.25; if (Math.abs(vc) > 40) s.dir += (clamp(vc / 200, -1, 1) - s.dir) * 0.3;
      { const tgt = s.down ? 0.6 + 0.2 * s.f : 0, acc = tune(180, 16)[0] * (tgt - s.pop) - tune(180, 16)[1] * s.vp; s.vp += acc * dt; s.pop += s.vp * dt; }
      paintT(el, s);
      if (!s.down && Math.abs(s.tl - s.l) < 0.1 && Math.abs(s.tr - s.r) < 0.1 && Math.abs(s.vl) + Math.abs(s.vr) < 2 && Math.abs(s.pop) < 0.01 && Math.abs(s.vp) < 0.05 && s.sq < 0.01) {
        el.classList.remove('tg-live'); for (const p of ['--kl', '--kr', '--kt', '--kh', '--pop']) el.style.removeProperty(p); T.delete(el);
      }
    }
    raf = T.size ? requestAnimationFrame(stepT) : 0; if (!raf) last = 0;
  };
  const kickT = () => { if (!raf) { last = 0; raf = requestAnimationFrame(stepT); } };
  const sideEdges = on => on ? [HI, HI + KW] : [LO, LO + KW];

  let cur = null, swallow = false;   // v73: swallow is decided at press time, so flipping Reduce Motion mid-tap cannot let the real click toggle it a second time
  doc.addEventListener('pointerdown', e => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || reduced()) return;
    const el = e.target.closest && e.target.closest('.toggle'); if (!el || el.disabled) return;
    swallow = true;
    const on = el.classList.contains('on'), [l, r] = sideEdges(on), rect = el.getBoundingClientRect(), sc = rect.width / W || 1;
    const s = T.get(el) || { l, r, vl: 0, vr: 0, tl: l, tr: r, pop: 0, vp: 0, sq: 0, dir: 1 };
    Object.assign(s, { down: true, f: force(e), x0: e.clientX, left: rect.left, sc, moved: false, on, grab: ((e.clientX - rect.left) / sc) - (s.l + KW / 2) });
    s.vp += (0.6 + 1.6 * s.f) * A.knob; el.classList.add('tg-live'); T.set(el, s); cur = el; kickT();
  }, { passive: true });
  doc.addEventListener('pointermove', e => {
    if (!cur || !e.isPrimary) return; const s = T.get(cur); if (!s || !s.down) return;
    s.f += (force(e) - s.f) * 0.3;
    if (Math.abs(e.clientX - s.x0) > 4) s.moved = true;
    if (s.moved) { const cx = (e.clientX - s.left) / s.sc - s.grab, L = clamp(cx - KW / 2, LO, HI); s.tl = L; s.tr = L + KW; }
  }, { passive: true });
  const up = e => {
    if (!cur || (e && !e.isPrimary)) return; const el = cur, s = T.get(el); cur = null; if (!s) return;
    s.down = false;
    const wantOn = s.moved ? (s.tl + KW / 2 > W / 2) : (e && e.type === 'pointercancel' ? s.on : !s.on),   // BUG-141: a cancelled touch springs back
      [l, r] = sideEdges(wantOn); s.tl = l; s.tr = r; s.want = wantOn;
    if (!e || e.type !== 'pointerup') swallow = false; else setTimeout(() => { swallow = false; }, 400);   // BUG-142: a flag whose click never came cannot eat a later one
    if (e && e.type === 'pointerup' && wantOn !== s.on) el.click();   // our own click: the real one is swallowed below
    kickT();
  };
  doc.addEventListener('pointerup', up, { passive: true }); doc.addEventListener('pointercancel', up, { passive: true });
  doc.addEventListener('scroll', () => { if (cur) up({ type: 'pointercancel', isPrimary: true }); }, { passive: true, capture: true });
  doc.addEventListener('click', e => { if (swallow && e.isTrusted && e.detail !== 0 && e.target.closest && e.target.closest('.toggle')) { swallow = false; e.stopPropagation(); e.preventDefault(); } }, true);
}
