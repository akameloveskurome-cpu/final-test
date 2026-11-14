// T12 part 2: drag-to-reorder helpers. Pure (no DOM), tested in Node (tests/reorder.test.mjs). The DOM side lives in main.js ("T12 part 2").
/** Copy of `arr` with the item at `from` moved so it ends at index `to` (same meaning as Native.moveItem). Out-of-range or equal = plain copy. */
export function moveIn(arr, from, to) {
  const a = arr.slice();
  if (from === to || from < 0 || to < 0 || from >= a.length || to >= a.length) return a;
  const [x] = a.splice(from, 1); a.splice(to, 0, x); return a;
}
/** Auto-scroll speed (px per frame, negative = up) while a finger at `y` is near the top / bottom edge of the scrolling box. */
export function edgeSpeed(y, top, bottom, zone = 48, max = 14) {
  zone = Math.min(zone, Math.max(0, (bottom - top) / 2)); if (!(zone > 0)) return 0;   // BUG-338: a short box no longer scrolls UP for a finger in the middle
  if (y < top + zone) return -Math.ceil(max * Math.min(1, (top + zone - y) / zone));
  if (y > bottom - zone) return Math.ceil(max * Math.min(1, (y - (bottom - zone)) / zone));
  return 0;
}
