import test from 'node:test';
import assert from 'node:assert/strict';
import { relinkIds } from '../src/idrelink.js';

// BUG-123: a custom song picture follows its song when the song's id changes, like favourites and play counts do.
test('a song picture moves to the new id when the same file has a new id', () => {
  const r = relinkIds({ favs: [], stats: {}, playlists: [], keys: { tOLD: 'a/x.flac' }, pics: ['tOLD'] }, [{ id: 'tNEW', path: 'a/x.flac' }]);
  assert.deepEqual(r.picMoves, [['tOLD', 'tNEW']]);
});
test('a song picture follows the song across one extra folder level', () => {
  const r = relinkIds({ favs: [], stats: {}, playlists: [], keys: { tOLD: 'Music/a/x.flac' }, pics: ['tOLD'] }, [{ id: 'tNEW', path: 'a/x.flac' }]);
  assert.deepEqual(r.picMoves, [['tOLD', 'tNEW']]);
});
test('the path of a song that has a picture is recorded, so it can be found later', () => {
  const r = relinkIds({ favs: [], stats: {}, playlists: [], keys: {}, pics: ['tNEW'] }, [{ id: 'tNEW', path: 'a/x.flac' }]);
  assert.equal(r.keys.tNEW, 'a/x.flac');
  assert.deepEqual(r.picMoves, []);
});
test('a picture whose song is missing is kept (its path is still remembered)', () => {
  const r = relinkIds({ favs: [], stats: {}, playlists: [], keys: { tOLD: 'z/q.flac' }, pics: ['tOLD'] }, [{ id: 'tNEW', path: 'a/x.flac' }]);
  assert.deepEqual(r.picMoves, []);
  assert.equal(r.keys.tOLD, 'z/q.flac');
});
test('a picture is not moved when the match is ambiguous', () => {
  const trs = [{ id: 'tA', path: 'a/x.flac' }, { id: 'tB', path: 'a/x.flac' }];
  const r = relinkIds({ favs: [], stats: {}, playlists: [], keys: { tOLD: 'Q/a/x.flac' }, pics: ['tOLD'] }, trs);
  assert.deepEqual(r.picMoves, []);
});
