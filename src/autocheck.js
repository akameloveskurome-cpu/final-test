// T18: pure helpers for scan progress + the automatic "new music" check. No DOM, no Native (tested in tests/autocheck.test.mjs).
export const MIN_GAP_MS = 10 * 60 * 1000;   // auto-check at most once per 10 minutes

/** Should an automatic check run now? `last` = ms timestamp of the last finished scan/check (0 = never this run). */
export function shouldCheck({ enabled, hasFolder, busy, now, last, gap = MIN_GAP_MS }) {
  if (!enabled || !hasFolder || busy) return false;
  return !last || now - last >= gap || now < last;   // clock moved back = check again
}

/** "Scanning 120 / 4,310" (or "Scanning…" while the total is not known). */
export function progressText(done, total) {
  const n = x => Math.max(0, Math.floor(+x || 0)).toLocaleString('en-US');
  const T = Math.floor(+total || 0);   // BUG-368: fractional / infinite totals
  return T > 0 && isFinite(T) ? `Scanning ${n(Math.min(done, T))} / ${n(T)}` : 'Scanning…';
}

/** Toast text after an AUTOMATIC check; '' = nothing changed, so stay silent. */
export function changeText(o) {
  const c = x => Math.max(0, Math.floor(+x || 0)), added = c(o && o.added), removed = c(o && o.removed);   // BUG-369: null / fractional / text counts
  const w = (n, s) => `${n} ${s}${n === 1 ? '' : 's'}`;
  const parts = [];
  if (added > 0) parts.push(`${w(added, 'new song')} added`);
  if (removed > 0) parts.push(`${w(removed, 'song')} removed`);
  return parts.join(', ');
}
