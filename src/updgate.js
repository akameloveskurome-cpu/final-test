// BUG-362: the update gate / first-draw logic, moved out of main.js (behaviour unchanged) so tests can drive it with fakes.

// Restores the saved update gate. Returns the gate that must lock the app, or null (nothing to lock; junk / installed gates are deleted from the store).
// d: { isNative, store, ls (localStorage-like), key, myCodeId, getInstalledBuild(), isInstalled(gate, myCodeId, installedBuild) }
export async function restoreGate(d) {
  if (!d.isNative) return null;
  let g = null;
  try { const saved = await d.store.get('updgate'); if (saved && typeof saved.id === 'string') g = saved; } catch {}
  // v144 migration: import the previous localStorage gate once, then retire it.
  if (!g) {
    try { g = JSON.parse(d.ls.getItem(d.key) || 'null'); } catch {}
    if (g && typeof g.id === 'string') {
      try { await d.store.set('updgate', g); d.ls.removeItem(d.key); } catch {}
    }
  } else {
    try { d.ls.removeItem(d.key); } catch {}
  }
  if (!g || typeof g.id !== 'string') return null;
  const installedBuild = await d.getInstalledBuild();
  if (!d.myCodeId) { try { d.ls.removeItem(d.key); } catch {} return null; }   // no code id in this build: the gate cannot be judged, leave the saved record alone
  // v146 tidy-up: a junk gate (no build number) or an already-installed update is deleted from the saved store too.
  if (!(Number(g.build) > 0) || d.isInstalled(g, d.myCodeId, installedBuild)) { d.store.set('updgate', null).catch(() => {}); try { d.ls.removeItem(d.key); } catch {} return null; }
  return g;
}

// First-draw state of the update box. BUG-08: gen ignores a draw-wait that started before the update was released.
export const newFirstDraw = () => ({ settled: false, deferP: null, gen: 0 });
export function resetFirstDraw(s) { s.settled = false; s.gen++; s.deferP = null; }   // an update finished: forget everything
// The box opens only after its picture is confirmed, but never waits longer than waitMs.
// d: { pendingId(), loadPicture(), stillPending(id), sheetOpen(), redraw(), waitMs?, timer? }
export function deferFirstDraw(s, d) {
  if (s.deferP) return;
  const id = d.pendingId(), gen = s.gen;
  s.deferP = (async () => {
    try {
      await Promise.race([
        Promise.resolve().then(() => d.loadPicture()).catch(() => {}),
        new Promise(r => (d.timer || setTimeout)(r, d.waitMs ?? 20000)),
      ]);
    } finally {
      if (gen === s.gen) { s.settled = true; s.deferP = null; }
      if (gen === s.gen && d.stillPending(id) && !d.sheetOpen()) d.redraw();
    }
  })();
}
