// The tab bar's liquid pill, for every other row of buttons: the transport cluster (prev / play / next), the Now Playing bottom row,
// and the Play / Shuffle, Cancel / Save ... rows. Press: the pill pops up under the finger; drag: it flows from button to button
// like the tab-bar lens; release: it presses the button it ended on. Built lazily on the first press of a row (the screens are re-rendered
// all the time, so nothing is wired up front). A row with one button keeps the plain jelly press. Off under Reduce Motion.
import { glide } from './glidebar.js';

const GROUPS = '.cluster,.np .bottom,.actions';

export function initLiquidGroups(doc = document) {
  const made = new WeakSet();
  const live = new Map();   // root -> destroy(): BUG-136, rows that left the page drop their resize listener
  doc.addEventListener('pointerdown', e => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || doc.documentElement.dataset.motion === 'reduce') return;
    const root = e.target.closest && e.target.closest(GROUPS);
    if (!root || made.has(root)) return;
    const btns = [...root.querySelectorAll(':scope > button')];
    if (btns.length < 2) return;
    const top0 = btns[0].getBoundingClientRect().top;
    if (btns.some(b => Math.abs(b.getBoundingClientRect().top - top0) > 8)) return;   // BUG-137: every button must share the line, not only the first two   // stacked vertically (e.g. the Clear data menu): the pill only slides sideways and would press the first button, so plain taps are used
    for (const [r, h] of live) if (!r.isConnected) { try { h.destroy(); } catch {} live.delete(r); }   // BUG-136
    made.add(root); root.setAttribute('data-liquid', '');   // data-liquid: jelly.js and the :active squash step aside, the pill is the feedback
    const h = glide(root, { selector: ':scope > button', persist: false }); if (h && h.destroy) live.set(root, h);   // capture phase: its own pointerdown listener is added before the event reaches the row
  }, true);
}
