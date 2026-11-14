// Gliding lens bubble for any pill with .tab / button children (tab bar, Color switch).
// v20: a real spring (rAF) instead of CSS transitions. The lens follows the finger with a slight lag,
// overshoots a little when it lands (liquid feel) and stretches with its speed, then settles.
// Usage: glide(container, { onChange(index), initial })  -> { set(index, animate) }
export function glide(root, { onChange, initial = 0, selector = 'button' } = {}) {
  const lens = document.createElement('div'); lens.className = 'lens'; lens.style.transition = 'none'; root.prepend(lens);
  const items = () => [...root.querySelectorAll(selector)];
  const pad = () => parseFloat(getComputedStyle(root).paddingLeft) || 0;
  const geo = i => {
    const b = items()[i]; if (!b) return null;
    const r = root.getBoundingClientRect(), br = b.getBoundingClientRect();
    return { left: br.left - r.left - pad(), w: br.width };
  };
  const S = { x: 0, w: 0, vx: 0, vw: 0, tx: 0, tw: 0, sq: 0, raf: 0 };
  let idx = initial, dragging = false, startX = 0, startLeft = 0, moved = false, downItem = null, last = 0;

  const paint = () => {
    lens.style.width = S.w + 'px';
    lens.style.transform = `translate3d(${S.x}px,0,0) scale(${1 + S.sq}, ${1 - S.sq * 0.6})`;
  };
  const frame = now => {
    const dt = Math.min(0.032, last ? (now - last) / 1000 : 0.016); last = now;
    // dragging: stiff spring (close to the finger). release: softer spring with a little overshoot.
    const k = dragging ? 700 : 240, c = dragging ? 48 : 24;
    for (const p of ['x', 'w']) {
      const v = 'v' + p, t = 't' + p;
      const acc = k * (S[t] - S[p]) - c * S[v];
      S[v] += acc * dt; S[p] += S[v] * dt;
    }
    // stretch with speed (the "liquid" part), then ease back to round
    const target = Math.min(0.13, Math.abs(S.vx) / 2600);
    S.sq += (target - S.sq) * 0.22;
    paint();
    const settled = !dragging && Math.abs(S.tx - S.x) < 0.2 && Math.abs(S.vx) < 3 && Math.abs(S.tw - S.w) < 0.2 && Math.abs(S.vw) < 3 && S.sq < 0.002;
    if (settled) { S.x = S.tx; S.w = S.tw; S.vx = S.vw = S.sq = 0; paint(); S.raf = 0; last = 0; return; }
    S.raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!S.raf) { last = 0; S.raf = requestAnimationFrame(frame); } };
  const mark = i => items().forEach((b, k) => b.classList.toggle('on', k === i));
  function set(i, animate = true) {
    idx = i; mark(i);
    const g = geo(i); if (!g) return;
    S.tx = g.left; S.tw = g.w;
    if (!animate) { S.x = S.tx; S.w = S.tw; S.vx = S.vw = 0; paint(); }
    else kick();
  }

  root.addEventListener('pointerdown', e => {
    dragging = true; moved = false; downItem = e.target.closest(selector); startX = e.clientX;   // remember the pressed item: pointer capture retargets pointerup to the bar itself
    startLeft = S.x; lens.classList.add('drag'); root.setPointerCapture(e.pointerId); kick();
  });
  root.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX; if (Math.abs(dx) > 6) moved = true; if (!moved) return;
    const max = geo(items().length - 1).left;
    const nx = Math.max(0, Math.min(max, startLeft + dx));
    const near = Math.max(0, Math.min(items().length - 1, Math.round(nx / (geo(0).w || 1))));
    if (near !== idx) { idx = near; mark(near); }
    S.tx = nx; S.tw = geo(near).w; kick();
  });
  const end = () => {
    if (!dragging) return; dragging = false; lens.classList.remove('drag');
    let target = idx;
    if (!moved && downItem) target = items().indexOf(downItem);
    set(target, true); onChange && onChange(target);
  };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
  addEventListener('resize', () => set(idx, false));
  requestAnimationFrame(() => set(initial, false));
  return { set };
}
