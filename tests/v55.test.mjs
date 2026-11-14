import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLrc } from '../src/lrc.js';
import { featFromTitle, splitArtists } from '../src/artistnames.js';
import { letterOf } from '../src/sortlist.js';
import { setLibrary, albums, tracks, artists, genres, genreTracks, genreAlbums } from '../src/data.js';

const R = (o) => ({ uri: 'content://x/tree/p%3A/document/p%3AMusic%2F' + encodeURIComponent(o.dir || 'A') + '%2F' + o.title + '.flac', album: 'Hits', artist: 'A', albumArtist: '', aaTag: false, title: 'T', dur: 100, bits: 16, khz: 44.1, genre: '', lyric: '', ...o });

test('B8: repeated stamps shift the word times', () => {
  const l = parseLrc('[00:10.00][00:20.00]<00:10.00>Hi <00:11.00>you');
  assert.deepEqual(l.lines.map(x => x.words.map(w => w.t)), [[10, 11], [20, 21]]);
});
test('C1/C2: "(with X)" in a title is not a feature, real names stay whole', () => {
  assert.deepEqual(featFromTitle('Time (With You)'), []);
  assert.deepEqual(featFromTitle('Eleanor Rigby (with Strings)'), []);
  assert.deepEqual(splitArtists('Dance with the Dead', new Set()), ['Dance with the Dead']);
  assert.deepEqual(splitArtists('AC / DC', new Set()), ['AC / DC']);
  assert.deepEqual(splitArtists('Malcolm X Jones', new Set()), ['Malcolm X Jones']);
  assert.deepEqual(splitArtists('Earth, Wind & Fire', new Set(['earth'])), ['Earth, Wind & Fire']);
  assert.deepEqual(splitArtists('Drake x Future', new Set(['drake'])), ['Drake', 'Future']);
});
test('C9: other scripts get their own section, not #', () => {
  assert.equal(letterOf('Привет'), 'П'); assert.equal(letterOf('日本'), '漢'); assert.equal(letterOf('あい'), 'あ'); assert.equal(letterOf('99'), '#');
});
test('C4/C5/C6: album artist ignores "feat.", genres are per song, case-insensitive and split', () => {
  setLibrary([
    R({ title: 'a1', artist: 'A', genre: 'Rock' }),
    R({ title: 'a2', artist: 'A feat. B', genre: 'rock; Pop' }),
    R({ title: 'a3', artist: 'A feat. C', genre: 'Jazz' }),
  ]);
  assert.equal(albums.length, 1); assert.equal(albums[0].artist, 'A');
  assert.deepEqual(genres.map(g => g.n).sort(), ['Jazz', 'Pop', 'Rock']);
  assert.equal(genreTracks('Rock').length, 2); assert.equal(genreTracks('Jazz').length, 1); assert.equal(genreAlbums('Pop').length, 1);
});
test('C7: same album name in one folder splits only on real, different album-artist tags', () => {
  setLibrary([R({ title: 'x1', artist: 'P', albumArtist: 'P', aaTag: true }), R({ title: 'x2', artist: 'Q', albumArtist: 'Q', aaTag: true })]);
  assert.equal(albums.length, 2);
  setLibrary([R({ title: 'x1', artist: 'P', albumArtist: 'P', aaTag: true }), R({ title: 'x2', artist: 'P feat. Q', aaTag: false })]);
  assert.equal(albums.length, 1);
});
