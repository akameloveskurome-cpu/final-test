// v61: pure-logic bug fixes (library data, sections, playlist positions).
import test from 'node:test';
import assert from 'node:assert/strict';
import { sortArtists, groupLetters, letterOf } from '../src/sortlist.js';
import { setLibrary, albums, tracks, plTracks, plPositions } from '../src/data.js';

const R = o => ({ uri: 'content://x/tree/p%3A/document/p%3AMusic%2FA%2F' + o.title + '.flac', album: 'Hits', artist: 'A', albumArtist: '', aaTag: false, title: 'T', dur: 100, bits: 16, khz: 44.1, genre: '', lyric: '', ...o });

test('Bug 5: Ł Ø Đ Æ Œ ß are filed under the letter the collator sorts them in, so each section appears once', () => {
  const names = ['Lana', 'Łukasz', 'Lorde', 'Olly', 'Øyvind', 'Oasis', 'Østen', 'Æon', 'Ana', 'Straße', 'Soap', 'Đorđe', 'Dua', 'Œuvre'];
  const letters = groupLetters(sortArtists(names, 'name'), letterOf).map(g => g[0]);
  assert.equal(new Set(letters).size, letters.length, 'no letter repeats: ' + letters.join(''));
  assert.ok(letters.every(l => /^[A-Z]$/.test(l)));
  assert.equal(letterOf('ßeta'), 'S');
});

test('Bug 8: the album year is the one most songs share, not the first song read', () => {
  setLibrary([R({ title: 'a', year: 0 }), R({ title: 'b', year: 1999 }), R({ title: 'c', year: 1999 }), R({ title: 'd', year: 2005 })]);
  assert.equal(albums[0].year, 1999);
  setLibrary([R({ title: 'a', year: 0 })]);
  assert.equal(albums[0].year, '');
});

test('Bug 2: plPositions maps screen rows to the real place in p.ids even with duplicates and missing songs', () => {
  setLibrary([R({ title: 'a' }), R({ title: 'b' })]);
  const [x, y] = tracks, p = { ids: [x.id, 'gone', y.id, x.id] };
  assert.deepEqual(plTracks(p).map(t => t.id), [x.id, y.id, x.id]);
  assert.deepEqual(plPositions(p), [0, 2, 3]);                  // row 2 (the 2nd copy of x) is p.ids[3], not indexOf(x.id) = 0
});
