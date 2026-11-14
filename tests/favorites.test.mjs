import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanFavs, isFav, toggleFav, favTracks } from '../src/favorites.js';

test('cleanFavs: keeps unique non-empty strings, drops junk, never throws', () => {
  assert.deepEqual(cleanFavs(['a', 'b', 'a', '', 5, null, 'c']), ['a', 'b', 'c']);
  for (const bad of [null, undefined, 'abc', 42, { a: 1 }]) assert.deepEqual(cleanFavs(bad), []);
});
test('toggleFav: adds on top, removes when present, leaves the input alone', () => {
  const a = ['x', 'y'];
  const b = toggleFav(a, 'z');
  assert.deepEqual(b, ['z', 'x', 'y']); assert.deepEqual(a, ['x', 'y']);
  assert.deepEqual(toggleFav(b, 'x'), ['z', 'y']);
  assert.deepEqual(toggleFav(toggleFav([], 'q'), 'q'), []);
});
test('isFav', () => { assert.equal(isFav(['a'], 'a'), true); assert.equal(isFav(['a'], 'b'), false); });
test('favTracks: library order = favorite order (newest first); songs gone from the library are skipped but not forgotten', () => {
  const lib = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const favs = ['c', 'gone', 'a'];
  assert.deepEqual(favTracks(favs, lib).map(t => t.id), ['c', 'a']);
  assert.deepEqual(favs, ['c', 'gone', 'a']);
  assert.deepEqual(favTracks([], lib), []);
});
