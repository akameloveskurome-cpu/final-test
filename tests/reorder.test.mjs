import test from 'node:test';
import assert from 'node:assert/strict';
import { moveIn, edgeSpeed } from '../src/reorder.js';

test('moveIn: down, up, same place, out of range, input untouched', () => {
  const a = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveIn(a, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveIn(a, 3, 1), ['a', 'd', 'b', 'c']);
  assert.deepEqual(moveIn(a, 1, 1), a);
  assert.deepEqual(moveIn(a, 1, 9), a); assert.deepEqual(moveIn(a, -1, 2), a); assert.deepEqual(moveIn(a, 9, 0), a);
  assert.deepEqual(a, ['a', 'b', 'c', 'd']);
});
test('moveIn matches what the up / down arrows do (swap with a neighbour)', () => {
  assert.deepEqual(moveIn(['a', 'b', 'c'], 1, 0), ['b', 'a', 'c']);
  assert.deepEqual(moveIn(['a', 'b', 'c'], 1, 2), ['a', 'c', 'b']);
});
test('edgeSpeed: 0 in the middle, scrolls up near the top, down near the bottom, faster at the very edge', () => {
  assert.equal(edgeSpeed(300, 100, 500), 0);
  assert.ok(edgeSpeed(110, 100, 500) < 0); assert.ok(edgeSpeed(490, 100, 500) > 0);
  assert.ok(edgeSpeed(100, 100, 500) < edgeSpeed(130, 100, 500));
  assert.equal(edgeSpeed(0, 100, 500), -14); assert.equal(edgeSpeed(900, 100, 500), 14);
});
