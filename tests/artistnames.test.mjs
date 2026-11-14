import test from 'node:test';
import assert from 'node:assert/strict';
import { splitArtists, featFromTitle, songArtists, isPlainName } from '../src/artistnames.js';

const known = new Set(['drake', 'tyler, the creator', 'simon & garfunkel', 'travis scott']);

test('feat. in the artist tag', () => {
  assert.deepEqual(splitArtists('Drake feat. Travis Scott', known), ['Drake', 'Travis Scott']);
  assert.deepEqual(splitArtists('Drake (feat. Travis Scott)', known), ['Drake', 'Travis Scott']);
  assert.deepEqual(splitArtists('Drake ft. Travis Scott', known), ['Drake', 'Travis Scott']);
});
test('separators ; / x and comma with a known artist', () => {
  assert.deepEqual(splitArtists('Drake; Travis Scott', known), ['Drake', 'Travis Scott']);
  assert.deepEqual(splitArtists('Drake, Travis Scott', known), ['Drake', 'Travis Scott']);
  assert.deepEqual(splitArtists('Drake & Future', known), ['Drake', 'Future']);
  assert.deepEqual(splitArtists('Drake x Future', known), ['Drake', 'Future']);
});
test('names that contain a separator stay whole', () => {
  assert.deepEqual(splitArtists('Tyler, The Creator', known), ['Tyler, The Creator']);
  assert.deepEqual(splitArtists('Simon & Garfunkel', known), ['Simon & Garfunkel']);
  assert.deepEqual(splitArtists('AC/DC', known), ['AC/DC']);
  assert.deepEqual(splitArtists('Earth, Wind & Fire', known), ['Earth, Wind & Fire']);   // nobody known: not split
});
test('feat. in the title', () => {
  assert.deepEqual(featFromTitle('SICKO MODE (feat. Drake & Swae Lee)'), ['Drake', 'Swae Lee']);
  assert.deepEqual(featFromTitle('Plain title'), []);
});
test('songArtists merges tag, title and album artist without duplicates', () => {
  assert.deepEqual(songArtists('Drake', 'Song [ft. Travis Scott]', 'Drake', known), ['Drake', 'Travis Scott']);
  assert.deepEqual(songArtists('Travis Scott', 'Song', 'Various Artists', known), ['Travis Scott', 'Various Artists']);
  assert.deepEqual(songArtists('Unknown Artist', 'Song', 'Mira Sol', known), ['Mira Sol']);
});
test('isPlainName', () => {
  assert.equal(isPlainName('Travis Scott'), true);
  assert.equal(isPlainName('Drake feat. Travis Scott'), false);
  assert.equal(isPlainName('A, B'), false);
});
