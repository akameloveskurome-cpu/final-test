// Red "Scroll down ↓" hint for the popup cards only (owner's order v216, no version change). Was every card, sheet, list and page before v216.
// One fixed hint per scroller, placed at the bottom of its VISIBLE part (above the mini player / tab bar on pages). It shows only while more content is below,
// hides at the bottom, never blocks taps (pointer-events:none), and is removed with its scroller. The accessibility cards (assist.js) use addScrollHint() too.
// v216 (owner): the hint is ONLY for the popup cards (notification / update picture popups and the accessibility instruction cards). Pages, lists, sheets and grids have no hint.
const SEL = '#sheet .popcard, #lf-assist > div';
const MORE_PX = 24, TICK_MS = 400;
const tracked = new Map();   // scroller -> hint element
const css = 'position:fixed;z-index:100000;display:none;text-align:center;color:#ff3b30;font:700 16px system-ui,sans-serif;padding:20px 0 9px;pointer-events:none;background:linear-gradient(to top,rgba(0,0,0,.92),rgba(0,0,0,0));';
const vis = e => { if (!e || !e.isConnected) return false; const r = e.getBoundingClientRect(); if (r.width < 40 || r.height < 40) return false; const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0'; };
const canScroll = e => { const o = getComputedStyle(e).overflowY; return (o === 'auto' || o === 'scroll') && e.scrollHeight - e.clientHeight > 2; };
const covered = e => {   // a page under an open sheet / Now Playing / lyrics: no hint (the top layer has its own)
  if (!e.matches('.screen')) return false;
  const sh = document.getElementById('sheet'); if (sh && sh.children.length) return true;
  return !!document.querySelector('.np.open, .lyr.open, .ppv.open, #lf-assist, #lf-bgallow');
};
function bottomLimit(e, r) {   // lowest pixel the hint may use: pages end above the mini player / tab bar
  let b = Math.min(r.bottom, innerHeight);
  if (e.matches('.screen')) for (const q of ['.mini', '.tabbar']) { const m = document.querySelector(q); if (m && vis(m)) { b = Math.min(b, m.getBoundingClientRect().top - 4); break; } }
  return b;
}
function update(e, h) {
  if (!vis(e) || covered(e) || !canScroll(e) || e.scrollHeight - e.scrollTop - e.clientHeight <= MORE_PX) { h.style.display = 'none'; return; }
  const r = e.getBoundingClientRect(), b = bottomLimit(e, r);
  h.style.left = Math.max(0, r.left) + 'px'; h.style.width = Math.min(r.width, innerWidth - Math.max(0, r.left)) + 'px';
  h.style.top = 'auto'; h.style.bottom = Math.max(0, innerHeight - b) + 'px'; h.style.display = 'block';
}
export function addScrollHint(e) {
  if (!e || tracked.has(e)) return;
  const h = document.createElement('div'); h.className = 'lf-scrollhint'; h.setAttribute('aria-hidden', 'true'); h.textContent = 'Scroll down \u2193'; h.style.cssText = css;
  document.body.appendChild(h); tracked.set(e, h);
  try { e.addEventListener('scroll', () => update(e, h), { passive: true }); } catch {}
  update(e, h);
}
function sweep() {
  try { document.querySelectorAll(SEL).forEach(e => { if (!tracked.has(e)) addScrollHint(e); }); } catch {}
  for (const [e, h] of tracked) { if (!e.isConnected) { h.remove(); tracked.delete(e); } else update(e, h); }
}
export function startScrollHints() {
  if (startScrollHints.on) return; startScrollHints.on = true;
  sweep(); setInterval(sweep, TICK_MS);
  try { addEventListener('resize', sweep); document.addEventListener('load', sweep, true); } catch {}
}
