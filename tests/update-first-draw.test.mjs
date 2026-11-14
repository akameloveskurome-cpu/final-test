// BUG-362: behaviour tests (no source text). The update box opens only after its picture is confirmed (max wait), and a finished update resets that.
import test from 'node:test'; import assert from 'node:assert/strict';
import { newFirstDraw, resetFirstDraw, deferFirstDraw } from '../src/updgate.js';
const mk = (o = {}) => { const log = { redraws: 0, loads: 0 }; let pending = { id: 'u1' }, open = false;
  const d = { pendingId: () => pending && pending.id, loadPicture: async () => { log.loads++; }, stillPending: id => !!pending && pending.id === id,
    sheetOpen: () => open, redraw: () => { log.redraws++; }, waitMs: 20, ...o };
  return { d, log, setPending: p => { pending = p; }, setOpen: v => { open = v; } }; };
const tick = ms => new Promise(r => setTimeout(r, ms));
test('picture confirmed: first draw is settled and the box is drawn once', async () => {
  const s = newFirstDraw(), { d, log } = mk(); deferFirstDraw(s, d); deferFirstDraw(s, d);   // second call while waiting is ignored
  await s.deferP; assert.equal(s.settled, true); assert.equal(s.deferP, null); assert.equal(log.loads, 1); assert.equal(log.redraws, 1);
});
test('a picture that never answers is waited for only waitMs, then the plain box is drawn', async () => {
  const s = newFirstDraw(), { d, log } = mk({ loadPicture: () => new Promise(() => {}), waitMs: 30 }); const t0 = Date.now();
  deferFirstDraw(s, d); await s.deferP; assert.ok(Date.now() - t0 < 1000); assert.equal(s.settled, true); assert.equal(log.redraws, 1);
});
test('a failing picture load still settles and draws', async () => {
  const s = newFirstDraw(), { d, log } = mk({ loadPicture: async () => { throw new Error('boom'); } }); deferFirstDraw(s, d); await s.deferP;
  assert.equal(s.settled, true); assert.equal(log.redraws, 1);
});
test('no redraw when the sheet is already open or the update was replaced', async () => {
  let s = newFirstDraw(), x = mk(); x.setOpen(true); deferFirstDraw(s, x.d); await s.deferP; assert.equal(x.log.redraws, 0);
  s = newFirstDraw(); x = mk({ loadPicture: async () => { await tick(5); } }); deferFirstDraw(s, x.d); x.setPending({ id: 'u2' }); await s.deferP; assert.equal(x.log.redraws, 0);
});
test('update finished while waiting: reset clears the state and the old wait cannot settle or redraw', async () => {
  const s = newFirstDraw(), x = mk({ loadPicture: async () => { await tick(5); } }); deferFirstDraw(s, x.d); const p = s.deferP;
  resetFirstDraw(s); assert.equal(s.settled, false); assert.equal(s.deferP, null); assert.equal(s.gen, 1);
  await p; assert.equal(s.settled, false); assert.equal(x.log.redraws, 0);
  deferFirstDraw(s, x.d); await s.deferP; assert.equal(s.settled, true);   // the next update starts fresh
});
test('reset after a settled draw makes the next update wait for its picture again', async () => {
  const s = newFirstDraw(), x = mk(); deferFirstDraw(s, x.d); await s.deferP; assert.equal(s.settled, true);
  resetFirstDraw(s); assert.equal(s.settled, false); assert.equal(s.deferP, null);
});
