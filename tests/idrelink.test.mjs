import test from 'node:test';
import assert from 'node:assert/strict';
import { keyOf, cleanKeys, relinkIds } from '../src/idrelink.js';

const T = (id, path) => ({ id, path });
const lib = [T('t1', 'Album A/01 One.flac'), T('t2', 'Album A/02 Two.flac'), T('t3', 'Album B/01 One.flac')];

test('keyOf / cleanKeys', () => {
  assert.equal(keyOf({ path: '\\Album A\\01 One.FLAC' }), 'album a/01 one.flac');
  assert.equal(keyOf({}), ''); assert.equal(keyOf(null), '');
  assert.deepEqual(cleanKeys({ a: 'x', b: '', c: 5, '': 'z' }), { a: 'x' });
  for (const bad of [null, undefined, 'x', 3, ['a']]) assert.deepEqual(cleanKeys(bad), {});
});

test('first run: records the path of saved ids that are in the library, moves nothing', () => {
  const r = relinkIds({ favs: ['t2'], stats: { t1: { plays: 2, last: 5 } }, playlists: [{ id: 'p', ids: ['t3'] }], keys: {} }, lib);
  assert.deepEqual(r.keys, { t2: 'album a/02 two.flac', t1: 'album a/01 one.flac', t3: 'album b/01 one.flac' });
  assert.equal(r.keysChanged, true); assert.equal(r.favsChanged || r.statsChanged || r.playlistsChanged, false); assert.equal(r.moved, 0);
});

test('re-picked folder gave new ids: favorites, play counts and playlists follow the same files', () => {
  const keys = { old1: 'album a/01 one.flac', old2: 'album a/02 two.flac', old3: 'album b/01 one.flac' };
  const r = relinkIds({
    favs: ['old2', 'old1', 'gone'], stats: { old1: { plays: 3, last: 10 }, old3: { plays: 1, last: 99 } },
    playlists: [{ id: 'p', name: 'x', ids: ['old3', 'old1', 'old3'] }], keys,
  }, lib);
  assert.deepEqual(r.favs, ['t2', 't1', 'gone']);
  assert.deepEqual(r.stats, { t1: { plays: 3, last: 10 }, t3: { plays: 1, last: 99 } });
  assert.deepEqual(r.playlists[0].ids, ['t3', 't1', 't3']); assert.equal(r.playlists[0].name, 'x');
  assert.equal(r.moved, 3);
  assert.deepEqual(r.keys, { t2: 'album a/02 two.flac', t1: 'album a/01 one.flac', t3: 'album b/01 one.flac' });   // 'gone' has no key: kept as a dead id, no key entry
});

test('does not change its input', () => {
  const inp = { favs: ['old1'], stats: { old1: { plays: 1, last: 1 } }, playlists: [{ id: 'p', ids: ['old1'] }], keys: { old1: 'album a/01 one.flac' } };
  const snap = JSON.stringify(inp); relinkIds(inp, lib); assert.equal(JSON.stringify(inp), snap);
});

test('two old ids that now point at the same song are merged (plays added, latest time kept, favorite once)', () => {
  const r = relinkIds({ favs: ['t1', 'old1'], stats: { t1: { plays: 2, last: 50 }, old1: { plays: 3, last: 20 } }, playlists: [], keys: { old1: 'album a/01 one.flac' } }, lib);
  assert.deepEqual(r.favs, ['t1']); assert.deepEqual(r.stats, { t1: { plays: 5, last: 50 } });
});

test('picked folder level changed: unique path suffix still matches, both directions', () => {
  const deeper = [T('n1', 'Album A/01 One.flac'), T('n2', 'Album A/02 Two.flac')];
  let r = relinkIds({ favs: ['o'], stats: {}, playlists: [], keys: { o: 'music/album a/01 one.flac' } }, deeper);
  assert.deepEqual(r.favs, ['n1']);
  const higher = [T('m1', 'Music/Album A/01 One.flac')];
  r = relinkIds({ favs: ['o'], stats: {}, playlists: [], keys: { o: 'album a/01 one.flac' } }, higher);
  assert.deepEqual(r.favs, ['m1']);
});

test('BUG-104: a deeper unrelated path with the same tail is not relinked', () => {
  const other = [T('z1', 'Other Artist/Other Album/disc 1/track 01.flac')];
  const r = relinkIds({ favs: ['o'], stats: {}, playlists: [], keys: { o: 'disc 1/track 01.flac' } }, other);
  assert.deepEqual(r.favs, ['o']); assert.equal(r.moved, 0);
});

test('ambiguous or unknown: never guesses', () => {
  const dup = [T('a', 'X/Album/01 One.flac'), T('b', 'Y/Album/01 One.flac')];
  let r = relinkIds({ favs: ['o'], stats: {}, playlists: [], keys: { o: 'album/01 one.flac' } }, dup);
  assert.deepEqual(r.favs, ['o']); assert.equal(r.moved, 0);
  r = relinkIds({ favs: ['o'], stats: {}, playlists: [], keys: { o: '01 one.flac' } }, dup);   // single-segment key: exact only
  assert.deepEqual(r.favs, ['o']);
  r = relinkIds({ favs: ['o'], stats: {}, playlists: [], keys: {} }, lib);                       // no key was ever saved
  assert.deepEqual(r.favs, ['o']);
});

test('empty library (folder missing, SD card out): nothing changes, nothing is forgotten', () => {
  const inp = { favs: ['old1'], stats: { old1: { plays: 1, last: 1 } }, playlists: [], keys: { old1: 'k/a.flac' } };
  const r = relinkIds(inp, []);
  assert.deepEqual(r.favs, ['old1']); assert.deepEqual(r.keys, { old1: 'k/a.flac' }); assert.equal(r.keysChanged, false);
});

test('keys of ids that are no longer saved anywhere are dropped', () => {
  const r = relinkIds({ favs: ['t1'], stats: {}, playlists: [], keys: { t1: 'album a/01 one.flac', stale: 'x/y.flac' } }, lib);
  assert.deepEqual(r.keys, { t1: 'album a/01 one.flac' }); assert.equal(r.keysChanged, true);
});
