import test from 'node:test';
import assert from 'node:assert/strict';
import { setLibrary, tracks } from '../src/data.js';
import { relinkIds } from '../src/idrelink.js';

// BUG-123: a song id comes from the folder-relative path, not from the full URI.
const row = (tree, rel, title) => ({ uri: `content://com.android.externalstorage.documents/tree/${encodeURIComponent(tree)}/document/${encodeURIComponent(tree + '/' + rel)}`, album: 'Hits', artist: 'A', albumArtist: '', aaTag: false, title, dur: 200, bits: 16, khz: 44.1 });
const ids = tree => { setLibrary([row(tree, 'A/Hits/01 One.flac', 'One'), row(tree, 'A/Hits/02 Two.flac', 'Two')]); return tracks.map(t => t.id + '|' + t.albumId).sort(); };

test('picking the same folder again from another provider / SD card gives the SAME song and album ids', () => {
  assert.deepEqual(ids('primary:Music'), ids('1234-ABCD:Music'));
});
test('adding a song does not change the ids of the others', () => {
  const before = ids('primary:Music');
  setLibrary([row('primary:Music', 'A/Hits/01 One.flac', 'One'), row('primary:Music', 'A/Hits/02 Two.flac', 'Two'), row('primary:Music', 'A/Hits/03 Three.flac', 'Three')]);
  const after = tracks.map(t => t.id + '|' + t.albumId);
  for (const b of before) assert.ok(after.includes(b));
});
test('different files get different ids (even when only the case of a letter differs)', () => {
  setLibrary([row('primary:Music', 'A/x.flac', 'x'), row('primary:Music', 'a/x.flac', 'x2'), row('primary:Music', 'B/x.flac', 'x3')]);
  assert.equal(new Set(tracks.map(t => t.id)).size, 3);
});
test('relinkIds keeps pg / nat when it moves a play count to a new id', () => {
  const trs = [{ id: 'tNEW', path: 'a/x.flac' }];
  const r = relinkIds({ favs: [], stats: { tOLD: { plays: 3, last: 50, pg: 40, nat: [10, 20] } }, playlists: [], keys: { tOLD: 'a/x.flac' } }, trs);
  assert.deepEqual(r.stats.tNEW, { plays: 3, last: 50, pg: 40, nat: [10, 20] });
});
