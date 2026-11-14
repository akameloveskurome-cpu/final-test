// T12 A-B loop (pure). A loop belongs to ONE song (id). Tap 1 sets A, tap 2 sets B (>= 1 s after A), tap 3 clears.
export const MIN_GAP = 1;
/** m:ss (from v35's abText). */
export const fmtT = s => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);   // BUG-216
export const emptyLoop = id => ({ id: id || '', a: null, b: null });
const num = v => typeof v === 'number' && isFinite(v);
/** The loop for song `id`: the same object when it is already that song's, else a fresh empty one. */
export const loopFor = (l, id) => (l && l.id === (id || '') ? l : emptyLoop(id));
/** One tap of the A-B button at position `pos` (seconds). Returns { loop, msg } (loop is a NEW object). */
export function tapLoop(l, id, pos) {
  const c = loopFor(l, id), p = num(pos) ? Math.max(0, pos) : 0;
  if (!num(pos) && !(num(c.a) && num(c.b))) return { loop: c, msg: 'Position not ready yet' };   // BUG-217
  if (num(c.a) && num(c.b)) return { loop: emptyLoop(id), msg: 'Loop off' };
  if (num(c.a)) {
    if (p < c.a + MIN_GAP) return { loop: c, msg: 'Pick B at least 1 s after A' };
    return { loop: { id: c.id, a: c.a, b: p }, msg: `Looping ${fmtT(c.a)} - ${fmtT(p)}` };
  }
  return { loop: { id: c.id, a: p, b: null }, msg: `Loop start ${fmtT(p)}: tap again for the end` };
}
/** Called with every progress event: the position to jump back to (A), or null. */
export const jumpTo = (l, id, pos) => (l && l.id === (id || '') && num(l.a) && num(l.b) && num(pos) && pos >= l.b ? l.a : null);
/** 'off' (no points) | 'a' (only A) | 'ab' (looping). */
export const loopState = l => (l && num(l.a) ? (num(l.b) ? 'ab' : 'a') : 'off');
/** Marker positions in percent of the song, [aPct, bPct] (null = not set). */
export const markPct = (l, dur) => [l && num(l.a) && dur > 0 ? Math.min(100, (l.a / dur) * 100) : null, l && num(l.b) && dur > 0 ? Math.min(100, (l.b / dur) * 100) : null];
