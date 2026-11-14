import test from 'node:test';
import assert from 'node:assert/strict';
import { smartShuffle, restoreOrder } from '../src/shuffle.js';

const song = (id, artist, album) => ({ id, artist, album });
const artistOf = t => t.artist, albumOf = t => t.album;
const maxRun = (list, key) => { let best = 0, run = 0, prev; for (const x of list) { run = key(x) === prev ? run + 1 : 1; prev = key(x); best = Math.max(best, run); } return best; };

test('smartShuffle returns every song exactly once and does not touch the input', () => {
  const src = Array.from({ length: 30 }, (_, i) => song('s' + i, 'A' + (i % 3), 'L' + (i % 6)));
  const copy = src.slice();
  const out = smartShuffle(src, artistOf, albumOf);
  assert.deepEqual(src, copy);
  assert.equal(out.length, 30);
  assert.deepEqual(out.map(x => x.id).sort(), src.map(x => x.id).sort());
});

test('smartShuffle handles empty and single-song lists', () => {
  assert.deepEqual(smartShuffle([], artistOf, albumOf), []);
  const one = [song('x', 'A', 'L')];
  assert.deepEqual(smartShuffle(one, artistOf, albumOf), one);
});

test('3 artists x 10 songs: never 3 songs of one artist in a row (500 runs)', () => {
  const src = [];
  for (const a of ['A', 'B', 'C']) for (let i = 0; i < 10; i++) src.push(song(a + i, a, a + (i % 2)));
  for (let r = 0; r < 500; r++) assert.ok(maxRun(smartShuffle(src, artistOf, albumOf), artistOf) <= 2);
});

test('one artist, 2 albums x 6 songs: albums alternate (no run above 2)', () => {
  const src = [];
  for (const al of ['X', 'Y']) for (let i = 0; i < 6; i++) src.push(song(al + i, 'A', al));
  for (let r = 0; r < 500; r++) assert.ok(maxRun(smartShuffle(src, artistOf, albumOf), albumOf) <= 2);
});

test('it is really random (not always the same order)', () => {
  const src = Array.from({ length: 12 }, (_, i) => song('s' + i, 'A' + (i % 4), 'L' + i));
  const seen = new Set();
  for (let r = 0; r < 40; r++) seen.add(smartShuffle(src, artistOf, albumOf).map(x => x.id).join());
  assert.ok(seen.size > 20);
});

test('restoreOrder puts a shuffled list back in its original order', () => {
  const orig = Array.from({ length: 10 }, (_, i) => song('s' + i, 'A', 'L'));
  const shuffled = smartShuffle(orig, artistOf, albumOf);
  assert.deepEqual(restoreOrder(shuffled, orig).map(x => x.id), orig.map(x => x.id));
});

test('restoreOrder: removed songs vanish, unknown songs keep their order at the end, duplicates stay', () => {
  const o = id => song(id, 'A', 'L');
  const orig = [o('a'), o('b'), o('c'), o('d')];
  assert.deepEqual(restoreOrder([o('d'), o('b'), o('a')], orig).map(x => x.id), ['a', 'b', 'd']);       // c was removed
  assert.deepEqual(restoreOrder([o('z1'), o('b'), o('z2'), o('a')], orig).map(x => x.id), ['a', 'b', 'z1', 'z2']);
  assert.deepEqual(restoreOrder([o('b'), o('a'), o('b')], orig).map(x => x.id), ['a', 'b', 'b']);
  assert.deepEqual(restoreOrder([], orig), []);
  assert.deepEqual(restoreOrder([o('q')], []).map(x => x.id), ['q']);
});
