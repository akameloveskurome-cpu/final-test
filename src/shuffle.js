// Smart shuffle (pure, tested in tests/shuffle.test.mjs). Random order, but songs of one artist / album are spread out
// instead of playing back to back. Each group of k songs is placed at slots (i + random) / k over the whole list.
const group = (arr, key) => { const m = new Map(); arr.forEach(x => { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return [...m.values()]; };
const fisher = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const spread = groups => groups.flatMap(g => g.map((x, i) => ({ x, p: (i + Math.random()) / g.length }))).sort((a, b) => a.p - b.p).map(o => o.x);

/** artistOf / albumOf: song -> key. Returns a new array. */
export function smartShuffle(items, artistOf, albumOf) {
  return spread(group(items, artistOf).map(g => spread(group(fisher(g.slice()), albumOf))));
}

/** Shuffle turned off: put `tail` back in the order it had in `orig` (songs not in orig keep their order, at the end). */
export function restoreOrder(tail, orig) {
  const at = new Map(); orig.forEach((t, i) => { if (!at.has(t.id)) at.set(t.id, i); });
  return tail.map((t, i) => [at.has(t.id) ? at.get(t.id) : 1e9 + i, t]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
}
