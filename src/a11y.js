// T26 accessibility: pure rules (labelFor, rowLabel) + one DOM pass (applyA11y) run after every render by a MutationObserver in main.js.
// Rule: icon-only buttons get an aria-label from data-act; toggles get role=switch; rows keep their visible text (no label needed).
export const LABELS = {
  back: 'Back', 'close-np': 'Close Now Playing', 'lyr-close': 'Close lyrics', settings: 'Settings', newpl: 'New playlist', plmenu: 'Playlist options',
  trackmenu: 'More options', next: 'Next song', prev: 'Previous song', shuf: 'Shuffle', rep: 'Repeat', fav: 'Favorite', queue: 'Up Next', lyrics: 'Lyrics',
  canvas: 'Canvas', sleep: 'Sleep timer', abloop: 'A-B loop', 'pl-up': 'Move up', 'pl-down': 'Move down', 'pl-rm': 'Remove from playlist', 'q-up': 'Move up', 'q-down': 'Move down',
  'q-rm': 'Remove from queue', 'open-np': 'Open Now Playing', 'log-close': 'Close',
};
/** Label for an icon-only control. `ctx` = { playing, repeat, shuffle, fav } (all optional). Returns null when the control needs none. */
export function labelFor(act, ctx = {}) {
  if (act === 'pp') return ctx.playing ? 'Pause' : 'Play';
  if (act === 'rep') return ctx.repeat === 'one' ? 'Repeat one' : ctx.repeat && ctx.repeat !== 'off' ? 'Repeat all' : 'Repeat off';
  if (act === 'fav') return ctx.fav ? 'Remove from Favorites' : 'Add to Favorites';
  return LABELS[act] || null;
}
/** One spoken sentence for a song row: "Title, Artist, 3:41". Strips tags and entities (strings are stored HTML-escaped). */
export function rowLabel(title, artist, dur) {
  const clean = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, (m, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[k])).trim();
  return [clean(title), clean(artist), clean(dur)].filter(Boolean).join(', ');
}
/** Walk `root` once. Never overwrites an aria-label that already exists (except pp / rep / fav which change with state). */
export function applyA11y(root, ctx = {}) {
  root.querySelectorAll('button, [role="button"]').forEach(b => {
    const act = b.dataset.act, hasText = (b.textContent || '').trim().length > 0;
    if (act === 'tg') {                                                   // settings switch: label = the row's bold text
      const tx = b.closest('.setrow')?.querySelector('.tx b'); b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', b.classList.contains('on') ? 'true' : 'false');
      if (tx && !b.hasAttribute('aria-label')) b.setAttribute('aria-label', tx.textContent);
      return;
    }
    if (act === 'shuf' || act === 'rep' || act === 'canvas' || act === 'abloop' || b.classList.contains('slbtn')) b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false');
    const dyn = act === 'pp' || act === 'rep' || act === 'fav';
    if ((dyn || (!hasText && !b.hasAttribute('aria-label'))) && act) {
      const l = labelFor(act, { ...ctx, fav: b.classList.contains('fav') }); if (l) b.setAttribute('aria-label', l);
    }
    if (b.classList.contains('playing')) b.setAttribute('aria-current', 'true'); else if (b.getAttribute('aria-current') !== 'page') b.removeAttribute('aria-current');   // BUG-119: keep the tab the lens selected
  });
  root.querySelectorAll('.sheetbox').forEach(bx => {   // D3: sheets are dialogs, named by their heading
    if (!bx.hasAttribute('role')) { bx.setAttribute('role', 'dialog'); bx.setAttribute('aria-modal', 'true'); }
    if (!bx.hasAttribute('aria-label')) { const h = bx.querySelector('b'); if (h && h.textContent.trim()) bx.setAttribute('aria-label', h.textContent.trim()); }
  });
  root.querySelectorAll('svg:not([aria-hidden])').forEach(s => s.setAttribute('aria-hidden', 'true'));     // icons are decoration; the button carries the name
  const scrub = root.querySelector('#scrub');
  if (scrub && !scrub.hasAttribute('role')) { scrub.setAttribute('role', 'slider'); scrub.setAttribute('aria-label', 'Song position'); scrub.tabIndex = 0; scrub.setAttribute('aria-valuemin', '0'); }
}
