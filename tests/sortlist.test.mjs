import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSort, cleanSortSet, sortTracks, sortAlbums, sortArtists, letterOf, groupLetters, pickLetter, RAIL, isLettered } from '../src/sortlist.js';
import { addRecent, cleanRecent } from '../src/recent.js';

const al = { a1: { title: 'Zed', artist: 'The Beta', year: 2001 }, a2: { title: 'alpha', artist: 'Alpha &amp; Co', year: 2020 } };
const al2 = t => al[t.albumId];
const T = (id, albumId, title, o = {}) => ({ id, albumId, title, dur: 100, added: 0, no: 1, disc: 1, ...o });

test('cleanSort falls back to the default', () => {
  assert.equal(cleanSort('songs', 'dur'), 'dur'); assert.equal(cleanSort('songs', 'bogus'), 'title'); assert.equal(cleanSort('artists', 'year'), 'name');
  assert.deepEqual(cleanSortSet(null), { songs: 'title', albums: 'name_asc', artists: 'name' });
  // sort choices saved by older versions keep their order
  assert.equal(cleanSort('albums', 'title'), 'name_asc'); assert.equal(cleanSort('albums', 'artist'), 'aartist_asc'); assert.equal(cleanSort('albums', 'year'), 'year_desc'); assert.equal(cleanSort('albums', 'added'), 'updated_desc'); assert.equal(cleanSort('albums', 'composer_desc'), 'composer_desc');
});
test('letters: A-Z, accents, # for the rest, leading The ignored when asked', () => {
  assert.equal(letterOf('élan'), 'E'); assert.equal(letterOf('99 Luftballons'), '#'); assert.equal(letterOf('&quot;Hi&quot;'), '#');
  assert.equal(letterOf('The Beta', true), 'B'); assert.equal(letterOf('The Beta'), 'T');
});
test('songs sort by title (case-insensitive, numeric), duration, year, added', () => {
  const ts = [T('1', 'a1', 'track 10'), T('2', 'a1', 'Track 2'), T('3', 'a2', 'beta', { dur: 300, added: 5 })];
  assert.deepEqual(sortTracks(ts, 'title', al2).map(t => t.id), ['3', '2', '1']);
  assert.deepEqual(sortTracks(ts, 'dur', al2)[0].id, '3');
  assert.deepEqual(sortTracks(ts, 'year', al2)[0].id, '3');
  assert.deepEqual(sortTracks(ts, 'added', al2)[0].id, '3');
  assert.equal(ts[0].id, '1');   // input is not mutated
});
test('songs by artist: The is ignored, album order inside', () => {
  const ts = [T('1', 'a1', 'x'), T('2', 'a2', 'y')];
  assert.deepEqual(sortTracks(ts, 'artist', al2).map(t => t.id), ['2', '1']);   // "Alpha & Co" before "The Beta" (= Beta)
});
test('albums and artists', () => {
  const as = [{ title: 'Zed', artist: 'B', year: 2001, added: 9 }, { title: 'alpha', artist: 'A', year: 2020, added: 1 }];
  assert.deepEqual(sortAlbums(as, 'name_asc').map(a => a.title), ['alpha', 'Zed']);
  assert.deepEqual(sortAlbums(as, 'year_desc').map(a => a.title), ['alpha', 'Zed']);
  assert.deepEqual(sortAlbums(as, 'updated_desc').map(a => a.title), ['Zed', 'alpha']);
  assert.deepEqual(sortAlbums(as, 'title').map(a => a.title), ['alpha', 'Zed']);   // old saved keys still work
  assert.deepEqual(sortArtists(['The Zoo', 'Abba', 'Cher'], 'name', () => 0), ['Abba', 'Cher', 'The Zoo']);
  assert.deepEqual(sortArtists(['x', 'y'], 'added', n => ({ x: 1, y: 2 }[n])), ['y', 'x']);
  assert.ok(isLettered('title') && !isLettered('year'));
});
test('groupLetters + pickLetter (rail)', () => {
  assert.deepEqual(groupLetters(['a1', 'a2', 'b1'], s => s[0].toUpperCase()), [['A', ['a1', 'a2']], ['B', ['b1']]]);
  assert.equal(pickLetter(RAIL, ['A', 'M'], 0), 'A'); assert.equal(pickLetter(RAIL, ['A', 'M'], 12), 'M');
  assert.equal(pickLetter(RAIL, ['A', 'M'], 25), 'M'); assert.equal(pickLetter(RAIL, ['#'], 5), '#'); assert.equal(pickLetter(RAIL, [], 5), '');
});
test('recent searches: newest first, dedupe, no limit, ignores short', () => {
  let r = []; for (const q of ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh', 'ii']) r = addRecent(r, q);
  assert.equal(r.length, 9); assert.equal(r[0], 'ii'); assert.ok(r.includes('aa'));
  r = addRecent(r, '  DD  '); assert.equal(r[0], 'DD'); assert.equal(r.filter(x => x.toLowerCase() === 'dd').length, 1);
  assert.deepEqual(addRecent(['x1'], 'a'), ['x1']); assert.deepEqual(cleanRecent('no'), []);
});

test('albums: every sort has an ascending and a descending order (Name, Songs, Duration, Year, Date updated, Artist, Album-Artist, Composer)', () => {
  const as = [
    { title: 'B', artist: 'Zed', trackArtist: 'Amy', year: 2001, added: 5, composer: 'Mozart', n: 3, d: 900 },
    { title: 'a', artist: 'The Abe', trackArtist: 'Zoe', year: 0, added: 9, composer: '', n: 10, d: 300 },
    { title: 'C', artist: 'Mid', trackArtist: 'Max', year: 1999, added: 1, composer: 'Bach', n: 1, d: 3000 },
  ];
  const t = (m) => sortAlbums(as, m, a => a.n, a => a.d).map(a => a.title).join('');
  assert.equal(t('name_asc'), 'aBC'); assert.equal(t('name_desc'), 'CBa');
  assert.equal(t('songs_asc'), 'CBa'); assert.equal(t('songs_desc'), 'aBC');
  assert.equal(t('dur_asc'), 'aBC'); assert.equal(t('dur_desc'), 'CBa');
  assert.equal(t('year_asc'), 'CBa'); assert.equal(t('year_desc'), 'BCa');   // no year = always last
  assert.equal(t('updated_asc'), 'CBa'); assert.equal(t('updated_desc'), 'aBC');
  assert.equal(t('artist_asc'), 'BCa'); assert.equal(t('artist_desc'), 'aCB');   // track artist: Amy, Max, Zoe
  assert.equal(t('aartist_asc'), 'aCB'); assert.equal(t('aartist_desc'), 'BCa');   // album artist, "The" ignored: Abe, Mid, Zed
  assert.equal(t('composer_asc'), 'CBa'); assert.equal(t('composer_desc'), 'BCa');   // no composer = always last
  assert.ok(isLettered('name_desc') && isLettered('composer_asc') && !isLettered('dur_asc') && !isLettered('songs_desc'));
});
