import { A, tune, EDGE_WOBBLE_MAX, MAGNIFY_MAX } from './animcfg.js';
// Fluid glass lens for the tab bar (v53, copied from the user's screen recording).
// Press: the lens pops up under the finger, grows past the bar and MAGNIFIES the icons under it (a clone of the tabs scaled
// around the lens centre, with a thin colour fringe). Drag: it follows the finger and stretches with speed.
// Release: it springs (with overshoot) onto the nearest tab and shrinks back to a plain glass pill.
// Usage: glide(container, { onChange(index), initial, selector, persist, magnify })  -> { set(index, animate), destroy }
// persist:true (default) = a selection that stays (tab bar, segmented control): the pill rests on the chosen item and the items get an .on class.
// persist:false = a row of plain buttons (transport, Play / Shuffle, Cancel / Save): the pill only exists while a finger is down, it follows the
// finger from button to button and on release it clicks the button it ended on. magnify:false = no magnified clone of the items (default: same as persist).
// v80: a button row presses its button on pointerup. If that opens a sheet / overlay, the browser's own click (sent right after pointerup) would land on the
// NEW thing under the finger (the sheet's scrim closes it again at once: Canvas and Queue looked dead). So that one real click is eaten.
let eatClick = 0;
if (typeof document !== 'undefined') document.addEventListener('pointerdown', () => { eatClick = 0; }, true);   // BUG-308: a new touch means no trailing click is coming
if (typeof document !== 'undefined') document.addEventListener('click', e => { if (eatClick && performance.now() < eatClick && e.isTrusted && e.detail !== 0) { eatClick = 0; e.stopPropagation(); e.preventDefault(); } else if (eatClick && performance.now() >= eatClick) eatClick = 0; }, true);
export function glide(root, { onChange, initial = 0, selector = 'button', persist = true, magnify = persist } = {}) {
  const lens = document.createElement('div'); lens.className = 'lens'; lens.style.transition = 'none';
  const mag = document.createElement('div'); mag.className = 'lens-mag'; mag.setAttribute('aria-hidden', 'true'); lens.appendChild(mag);
  root.prepend(lens);
  const items = () => [...root.querySelectorAll(selector)].filter(b => !b.closest('.lens'));
  const pad = () => parseFloat(getComputedStyle(root).paddingLeft) || 0;
  const geo = i => {
    const b = items()[i]; if (!b) return null;
    const r = root.getBoundingClientRect(), br = b.getBoundingClientRect();
    return { left: br.left - r.left - pad(), w: br.width, top: br.top - r.top, h: br.height };
  };
  // Liquid pill: the two edges (l, r) are separate springs. While dragging, the edge that leads is stiff and the trailing edge lags and
  // wobbles, so the pill stretches out like a drop of liquid, squashes thinner while it is long (volume kept) and snaps back with a jiggle.
  // pop = 0 at rest, 1 while pressed (own underdamped spring).
  const S = { ot: 0, ob: 0, vot: 0, vob: 0, pvc: 0, l: 0, r: 0, vl: 0, vr: 0, tl: 0, tr: 0, it: 0, ih: 0, pop: 0, vp: 0, sq: 0, dir: 1, raf: 0 };   // sq = stretch from speed (0..0.85), dir = smoothed travel direction (-1..1)
  const force = e => { const a = Math.max(0, Math.min(1, (Math.max(e.width || 0, e.height || 0) - 12) / 42)), p = e.pointerType === 'touch' || e.pointerType === 'pen' ? e.pressure : 0; if (p > 0 && p !== 0.5) pNot = true; const real = p > 0 && (p !== 0.5 || pNot); return real ? Math.max(a * 0.6, Math.min(1, p * 1.25)) : a; };   // how hard / how big the finger is (0..1): pressure where the device reports it, else contact size
  S.f = 0.4; S.fv = 0; let lastX = 0, lastT = 0, pNot = false;   // BUG-311: pNot = this gesture has had a pressure other than 0.5, so a 0.5 reading is then real; a gesture of only 0.5 stays "unsupported"
  let pressAct = '', pressBtn = null, idx = initial, committed = initial, dragging = false, startX = 0, startLeft = 0, last = 0, cloneKey = '';

  const syncClone = () => {   // the clone is rebuilt only when the tab markup changes (labels / icons), the "on" class is copied every time
    if (!magnify) return;
    const its = items(), key = its.map(b => b.innerHTML).join('|');
    if (key !== cloneKey) { cloneKey = key; mag.innerHTML = its.map(b => `<span class="tab">${b.innerHTML}</span>`).join(''); }
    [...mag.children].forEach((c, k) => c.classList.toggle('on', k === idx));
  };
  const aim = g => { S.tl = g.left; S.tr = g.left + g.w; S.it = g.top; S.ih = g.h; };   // point the pill at an item (its x range + its own top / height)
  const contentH = () => { let h = 40; for (const b of items()) { const c = [...b.children]; if (c.length) { const t = c[0].getBoundingClientRect().top, bt = c[c.length - 1].getBoundingClientRect().bottom; h = Math.max(h, bt - t); } } return h; };
  const contentW = () => { let w = 40; for (const b of items()) for (const c of b.children) w = Math.max(w, c.getBoundingClientRect().width); return w; };
  // BUG-120: the layout is read once (at the start of a press, and after any change of size or tabs), not on every animation frame
  const itemMids = () => { const rr = root.getBoundingClientRect(); return items().map(b => { const br = b.getBoundingClientRect(); return br.left + br.width / 2 - rr.left; }); };
  let metricsC = null;
  const metrics = () => metricsC || (metricsC = { h: contentH(), w: contentW(), mids: itemMids(), p: pad() });
  const dropMetrics = () => { metricsC = null; };
  const paint = () => {
    const p = S.pop, pp = Math.max(0, p), pad0 = metrics().p, rh = root.clientHeight, rw = root.clientWidth;
    const big = persist && root.classList.contains('tabbar'), barIn = S.ih || rh - 2 * pad0, tabW = Math.max(1, S.tr - S.tl), cur = S.r - S.l;
    const ext = Math.max(-0.45, Math.min(1.2, (cur - tabW) / tabW));  // spring lag stretch (+) / squash (-)
    const Wb = Math.max(tabW * 0.6, rw * 0.19); let W = Math.max(Wb * 0.85, tabW + 4, Wb + (cur - tabW) + rw * ((big ? 0.03 : 0.02) * A.pillSize * pp + 0.12 * S.sq * A.pillStretch));   // v72: never narrower than the tab, so the label always fits
    W = Math.min(W * (1 + (persist ? 0.12 * Math.min(1, pp) * Math.min(A.pillSize, 3) : 0)), Math.max(tabW * 1.25, rw * 0.36) * (1 + 0.25 * Math.min(1, pp) * Math.min(A.pillSize, 3))); if (!persist) W = Math.min(W, rw - 2 * pad0);   // reference: held ~1/3 of the bar, fast drag ~1/2
    let T0 = 0; const full = persist ? rh : barIn; let H = full * (big ? 0.86 + 0.1 * A.pillSize * Math.min(pp, 1) : 0.84 + 0.06 * A.pillSize * Math.min(pp, 1)) * (1 - 0.1 * Math.min(ext, 1.2) - (ext < 0 ? 0.2 * ext : 0)) / (1 + 0.1 * S.sq * A.pillStretch);   // nearly the full bar height, only a little thinner while stretched
    let L = pad0 + (S.l + S.r) / 2 - W / 2 + S.dir * 0.15 * (W - Wb); const T = persist ? (rh - H) / 2 : (S.it || pad0) + (barIn - H) / 2; L = Math.max(persist ? 3 - 0.06 * rw * Math.min(1, pp) : 0, Math.min(rw - W - (persist ? 3 - 0.06 * rw * Math.min(1, pp) : 0), L));   // v72: the pill stays inside the bar   // the front edge gets the bigger share: it stretches FORWARD
    if (persist) { const ov = 0.22 * Math.min(1, pp) * Math.min(A.pillSize, 3) * rh; H = Math.min(rh - 4 + 2 * ov, Math.max(24, H + S.ob - S.ot + ov)); T0 = Math.max(2 - ov, Math.min(rh - H - 2 + ov, T + S.ot - ov / 2)); } else T0 = T;   // v74: top and bottom edges are their own springs: the pill wobbles up / down too
    lens.style.width = W + 'px'; lens.style.height = H + 'px';
    lens.style.transform = `translate3d(${L}px,${T0}px,0)`;
    const ch = metrics().h, k = Math.max(1, Math.min(1 + (big ? 0.35 : 0.25) * A.magnify * Math.min(1, pp), MAGNIFY_MAX, (H - 10) / ch, (W - 14) / metrics().w));   // v72: magnified icon + label always fit inside the pill                         // magnification
    if (!persist) lens.style.opacity = Math.min(1, pp * 3).toFixed(3);   // invisible at rest: it fades in under the finger and out after the release
    if (magnify) mag.style.cssText = `width:${rw}px;height:${rh}px;left:${-L}px;top:${-T0}px;transform-origin:${L + W / 2}px ${T0 + H / 2}px;transform:scale(${k});opacity:${Math.min(1, pp * 2.4)};`;
    lens.style.setProperty('--pop', Math.min(1, pp).toFixed(3));
    if (persist && pp > 0.05) {   // v74: every icon the pill is over turns red (real tab + magnified copy)
      const its = items(), mids = metrics().mids;
      its.forEach((b, k) => { const c = mids[k], on = c > L - 2 && c < L + W + 2; b.classList.toggle('hov', on); if (mag.children[k]) mag.children[k].classList.toggle('hov', on); });
    } else if (persist) { items().forEach(b => b.classList.remove('hov')); [...mag.children].forEach(c => c.classList.remove('hov')); }
  };
  let freeSince = 0;
  const frame = now => {
    const dt = Math.min(0.032, last ? (now - last) / 1000 : 0.016); last = now;
    if (dragging) freeSince = 0; else if (!freeSince) freeSince = now;   // v208: time since the finger left
    const vc = (S.vl + S.vr) / 2, fwd = vc >= 0;
    for (const e of ['l', 'r']) {
      const lead = fwd ? e === 'r' : e === 'l';
      const [k, c] = tune(dragging ? (lead ? 430 : 60) : 170, dragging ? (lead ? 32 : 7.5) : 12);   // trailing edge: soft + underdamped = liquid lag; release: bouncy jelly
      const v = 'v' + e, t = 't' + e, acc = k * (S[t] - S[e]) - c * S[v]; S[v] += acc * dt; S[e] += S[v] * dt;
    }
    { const dv = vc - S.pvc; S.pvc = vc; if (dragging) { S.vot -= dv * 0.35 * A.pillWobbleV; S.vob += dv * 0.25 * A.pillWobbleV; }   // speeding up / braking shakes the top and bottom edges (out of phase)
      for (const q of ['ot', 'ob']) { const v = 'v' + q, [kk, cc] = tune(190, dragging ? 9 : 7), acc = kk * (0 - S[q]) - cc * S[v]; S[v] += acc * dt; S[q] += S[v] * dt; const lim = 5 * Math.min(EDGE_WOBBLE_MAX, Math.max(1, A.pillWobbleV)); S[q] = Math.max(-lim, Math.min(lim, S[q])); } }
    { const sqT = Math.min(0.5, Math.max(Math.abs(vc), Math.abs(S.fv) * 0.8) / 1100); S.sq += (sqT - S.sq) * 0.24; if (Math.abs(vc) > 60) S.dir += (Math.max(-1, Math.min(1, vc / 300)) - S.dir) * 0.3; }
    { S.fv *= 0.92; const tgt = dragging ? 0.6 + 0.2 * S.f : 0, acc = tune(180, 16)[0] * (tgt - S.pop) - tune(180, 16)[1] * S.vp; S.vp += acc * dt; S.pop += S.vp * dt; }   // pop spring: bounces
    paint();
    const settled = !dragging && Math.abs(S.tl - S.l) < 0.2 && Math.abs(S.vl) < 3 && Math.abs(S.tr - S.r) < 0.2 && Math.abs(S.vr) < 3 && Math.abs(S.pop) < 0.004 && Math.abs(S.vp) < 0.05 && S.sq < 0.004 && Math.abs(S.ot) + Math.abs(S.ob) < 0.2 && Math.abs(S.vot) + Math.abs(S.vob) < 3;
    const stale = !dragging && now - freeSince > 3000;   // v208: the pill is still after 3 s, whatever the springs say
    if (settled || stale) { freeSince = 0; root.classList.remove('lensing'); S.l = S.tl; S.r = S.tr; S.vl = S.vr = S.pop = S.vp = S.sq = S.ot = S.ob = S.vot = S.vob = 0; paint(); S.raf = 0; last = 0; lens.classList.remove('drag'); return; }
    S.raf = requestAnimationFrame(frame);
  };
  const reduced = () => document.documentElement.dataset.motion === 'reduce';
  const kick = () => {
    if (reduced()) { S.l = S.tl; S.r = S.tr; S.vl = S.vr = S.vp = 0; S.pop = 0; paint(); return; }   // Reduce Motion: jump, no spring
    if (!S.raf) { last = 0; S.raf = requestAnimationFrame(frame); }
  };
  const mark = i => { if (!persist) return; items().forEach((b, k) => { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); [...mag.children].forEach((c, k) => c.classList.toggle('on', k === i)); };
  function set(i, animate = true) {
    dropMetrics();   // BUG-120
    idx = committed = i; syncClone(); mark(i);
    const g = geo(i); if (!g) return;
    aim(g);
    if (!animate) { S.l = S.tl; S.r = S.tr; S.vl = S.vr = 0; paint(); } else kick();
  }
  const itemAt = x => {   // the tab under a finger x (clamped to the first / last tab)
    const n = items().length; let best = 0, bd = Infinity;
    for (let k = 0; k < n; k++) { const g = geo(k), r = root.getBoundingClientRect(), d = Math.abs(r.left + pad() + g.left + g.w / 2 - x); if (d < bd) { bd = d; best = k; } }
    return best;
  };

  root.addEventListener('pointerdown', e => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;   // Bug 13: a second finger (or a right / middle click) must not restart the drag
    dragging = true; startX = e.clientX; lastX = e.clientX; lastT = e.timeStamp; pNot = false; S.f = force(e); S.fv = 0; root.setAttribute('data-down', ''); dropMetrics();   // BUG-120: measured again for this press   // renderNP() waits while a finger is on a row (it rebuilt the row mid-tap: sleep timer ticks!)
    syncClone();
    const i = itemAt(e.clientX), g = geo(i); if (!g) { dragging = false; root.removeAttribute('data-down'); return; }   // BUG-138 / 253
    pressBtn = items()[i] || null;
    pressAct = (items()[i] || {}).dataset ? items()[i].dataset.act || '' : '';
    addEventListener('pointerup', end, true); addEventListener('pointercancel', cancel, true);
    idx = i; mark(i);                                  // the lens pops up right under the finger (the colour switches on press, like the recording)
    aim(g); startLeft = S.tl;
    if (!persist) { S.l = S.tl; S.r = S.tr; S.vl = S.vr = 0; S.sq = 0; }   // a button row: the pill pops up right under the finger, it does not fly in from the first button
    lens.classList.add('drag'); if (persist) root.classList.add('lensing'); try { root.setPointerCapture(e.pointerId); } catch {}
    S.vp += 0.6 + 1.6 * S.f; { const V = A.pillWobbleV, H = A.pillWobbleH; S.vot -= (35 + 25 * S.f) * V; S.vob += (25 + 20 * S.f) * V; S.vl -= (20 + 15 * S.f) * H; S.vr += (20 + 15 * S.f) * H; } kick();   // a harder / bigger press pops the lens up with a bigger bounce
  });
  root.addEventListener('pointermove', e => {
    if (!dragging || !e.isPrimary) return;
    { const dt = Math.max(1, e.timeStamp - lastT) / 1000; S.fv += ((e.clientX - lastX) / dt - S.fv) * 0.4; lastX = e.clientX; lastT = e.timeStamp; S.f += (force(e) - S.f) * 0.3; }
    const dx = e.clientX - startX;
    const n = items().length, lastG = n ? geo(n - 1) : null; if (!lastG) return;
    const nx = Math.max(0, Math.min(lastG.left, startLeft + dx));
    let near = 0, best = Infinity;                      // nearest tab by position (tabs need not have equal widths)
    for (let k = 0; k < n; k++) { const g = geo(k), d = Math.abs(g.left + g.w / 2 - (nx + (S.tr - S.tl) / 2)); if (d < best) { best = d; near = k; } }
    if (near !== idx) { idx = near; mark(near); }
    const gn = geo(near); S.tl = nx; S.tr = nx + gn.w; S.it = gn.top; S.ih = gn.h; kick();
  });
  const end = e => {
    if (!dragging || (e && !e.isPrimary)) return; dragging = false;
    removeEventListener('pointerup', end, true); removeEventListener('pointercancel', cancel, true); root.removeAttribute('data-down'); root.classList.remove('lensing'); setTimeout(() => document.dispatchEvent(new Event('lf-release')), 500);
    if (!persist) {   // a button row: release on a button = press that button (a release far above / below the row = cancelled)
      const rr = root.getBoundingClientRect(), out = e && (e.clientY < rr.top - 48 || e.clientY > rr.bottom + 48), b = items()[idx] || (pressAct && root.querySelector(`[data-act="${pressAct}"]`));
      const tap = pressBtn && e && Math.abs(e.clientX - startX) < 10, hit = tap ? pressBtn : b;   // v79: a plain tap always presses the button that was touched
      if (items()[idx]) set(idx, true); if (!out && hit && !hit.disabled) { eatClick = performance.now() + 600; hit.click(); onChange && onChange(idx); }
      return;
    }
    S.vot += 25 * A.pillWobbleV; S.vob -= 30 * A.pillWobbleV; S.vl += 15 * A.pillWobbleH; S.vr -= 15 * A.pillWobbleH;   // v74: release jiggle on all four edges
    set(idx, true); onChange && onChange(idx);          // idx = the tab pressed (a tap) or the nearest one (a drag)
  };
  const cancel = e => {
    if (!dragging || (e && !e.isPrimary)) return; dragging = false;
    removeEventListener('pointerup', end, true); removeEventListener('pointercancel', cancel, true); root.removeAttribute('data-down'); root.classList.remove('lensing'); setTimeout(() => document.dispatchEvent(new Event('lf-release')), 500);
    if (!persist) { set(idx, true); return; }   // BUG-254: a system-cancelled touch is not a tap (no click, no swallowed next tap)   // a scroll-cancelled tap still counts as a tap
    set(committed, true);
  };   // an aborted gesture is not a tap: go back to the committed tab
  if (!persist) root.addEventListener('click', e => { if (e.isTrusted && e.detail !== 0 && e.target !== root) e.stopPropagation(); }, true);   // a real tap on a button is replaced by our own click on the button the pill ended on (never both); keyboard clicks (detail 0) pass
  if (persist) root.addEventListener('click', e => {   // D1: keyboard (Enter / Space), switch access and TalkBack "activate" send a click without any pointer events
    if (e.detail !== 0) return;
    const b = e.target.closest(selector), i = b ? items().indexOf(b) : -1; if (i < 0) return;
    set(i, true); onChange && onChange(i);
  });
  const onResize = () => { if (!root.isConnected) { destroy(); return; } set(idx, false); };   // BUG-136 / 255: a row that left the page drops its listener
  addEventListener('resize', onResize);
  if (!persist) set(initial, false);   // built on the first press: the geometry is already there
  const startRaf = requestAnimationFrame(() => { if (!dragging) set(committed, false); });   // BUG-307
  const destroy = () => { removeEventListener('resize', onResize); removeEventListener('pointerup', end, true); removeEventListener('pointercancel', cancel, true); root.removeAttribute('data-down'); root.classList.remove('lensing');   // BUG-309
    cancelAnimationFrame(startRaf); if (S.raf) cancelAnimationFrame(S.raf); S.raf = 0; lens.remove(); };
  return { set, destroy };
}
