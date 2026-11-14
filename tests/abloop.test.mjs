import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyLoop, loopFor, tapLoop, jumpTo, loopState, markPct } from '../src/abloop.js';

test('three taps: set A, set B, clear', () => {
  let r = tapLoop(emptyLoop('s1'), 's1', 10); assert.deepEqual(r.loop, { id: 's1', a: 10, b: null }); assert.equal(loopState(r.loop), 'a');
  r = tapLoop(r.loop, 's1', 25); assert.deepEqual(r.loop, { id: 's1', a: 10, b: 25 }); assert.equal(loopState(r.loop), 'ab');
  r = tapLoop(r.loop, 's1', 30); assert.deepEqual(r.loop, emptyLoop('s1')); assert.equal(loopState(r.loop), 'off');
});
test('B must be at least 1 s after A (loop stays as it was)', () => {
  const a = tapLoop(emptyLoop('s'), 's', 10).loop;
  for (const p of [10, 10.5, 5, 0]) { const r = tapLoop(a, 's', p); assert.deepEqual(r.loop, a); assert.match(r.msg, /at least 1 s/); }
  assert.equal(tapLoop(a, 's', 11).loop.b, 11);
});
test('a loop of another song is ignored and replaced', () => {
  const old = { id: 'x', a: 1, b: 5 };
  assert.deepEqual(loopFor(old, 'y'), emptyLoop('y'));
  assert.deepEqual(tapLoop(old, 'y', 7).loop, { id: 'y', a: 7, b: null });
  assert.equal(jumpTo(old, 'y', 99), null);
});
test('jumpTo: only when both points exist and pos reached B', () => {
  const l = { id: 's', a: 10, b: 20 };
  assert.equal(jumpTo(l, 's', 19.9), null); assert.equal(jumpTo(l, 's', 20), 10); assert.equal(jumpTo(l, 's', 25), 10);
  assert.equal(jumpTo({ id: 's', a: 10, b: null }, 's', 99), null); assert.equal(jumpTo(emptyLoop('s'), 's', 99), null);
  assert.equal(jumpTo(l, 's', NaN), null); assert.equal(jumpTo(null, 's', 5), null);
});
test('bad positions never make NaN points', () => {
  assert.equal(tapLoop(emptyLoop('s'), 's', NaN).loop.a, null); assert.equal(tapLoop(emptyLoop('s'), 's', -4).loop.a, 0);
});
test('markPct', () => {
  assert.deepEqual(markPct({ id: 's', a: 30, b: 60 }, 120), [25, 50]);
  assert.deepEqual(markPct({ id: 's', a: 30, b: null }, 120), [25, null]);
  assert.deepEqual(markPct(emptyLoop('s'), 120), [null, null]); assert.deepEqual(markPct({ id: 's', a: 5, b: 9 }, 0), [null, null]);
  assert.equal(markPct({ id: 's', a: 500, b: 600 }, 120)[1], 100);
});

// from v35: toast texts carry the times
import { tapLoop as _tap, fmtT } from '../src/abloop.js';
test('toasts show m:ss (v35 extra)', () => {
  assert.equal(fmtT(65), '1:05');
  const r1 = _tap(null, 's', 65); assert.match(r1.msg, /1:05/);
  const r2 = _tap(r1.loop, 's', 130); assert.match(r2.msg, /1:05 - 2:10/);
  assert.equal(_tap(r2.loop, 's', 140).msg, 'Loop off');
});
test('A = 0 is a valid loop start (v35 case)', () => {
  const r = _tap(null, 's', 0); assert.equal(r.loop.a, 0);
  const r2 = _tap(r.loop, 's', 6); assert.equal(jumpTo(r2.loop, 's', 6.5), 0);
});
