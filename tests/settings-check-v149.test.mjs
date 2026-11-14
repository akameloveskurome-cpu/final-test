import test from 'node:test';
import assert from 'node:assert/strict';
import { parseImport } from '../src/settingsio.js';

// BUG-317: a value of the wrong kind is dropped; the app's default is used instead.
const known = { lyricSize: 'Medium', bgDim: 40, home: null, anim: {}, sort: {}, recent: [], smartArtists: true };
const file = settings => JSON.stringify({ app: 'liquid-dark', kind: 'settings', version: 1, settings });

test('a wrong-kind value is dropped and reported', () => {
  const r = parseImport(file({ bgDim: 'lots', lyricSize: 'Large', anim: 5 }), known);
  assert.deepEqual(r.settings, { lyricSize: 'Large' });
  assert.deepEqual(r.dropped.sort(), ['anim', 'bgDim']);
});
test('right-kind values pass, including home (null or object) and arrays', () => {
  const r = parseImport(file({ home: { count: 4 }, sort: { a: 1 }, recent: ['x'], smartArtists: false }), known);
  assert.equal(r.dropped.length, 0);
  assert.equal(parseImport(file({ home: null }), known).dropped.length, 0);
});
test('a key the app does not know is kept as before', () => {
  const r = parseImport(file({ someNewThing: 3 }), known);
  assert.deepEqual(r.settings, { someNewThing: 3 });
});
test('without known defaults nothing is checked (old behaviour)', () => {
  assert.deepEqual(parseImport(file({ bgDim: 'lots' })).settings, { bgDim: 'lots' });
});
