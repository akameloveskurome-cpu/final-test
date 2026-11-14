import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPicFile, picType, isGif, fmtSize, normalizePics, newPicId, describe, removePic, movePic, makeCover, memoryBackend, MAX_PICS } from '../src/plpics.js';
import { setPlaylists, savablePlaylists, playlists } from '../src/data.js';

test('isPicFile: by type or by extension, nothing else', () => {
  assert.ok(isPicFile({ type: 'image/gif', name: 'a' }));
  assert.ok(isPicFile({ type: '', name: 'party.GIF' }));
  assert.ok(isPicFile({ type: 'image/png', name: 'x' }));
  assert.ok(!isPicFile({ type: 'audio/flac', name: 'x.flac' }));
  assert.ok(!isPicFile({ type: 'video/mp4', name: 'x.mp4' }));
  assert.ok(!isPicFile(null));
});

test('picType and isGif', () => {
  assert.equal(picType({ type: 'image/WEBP', name: 'a' }), 'image/webp');
  assert.equal(picType({ type: '', name: 'a.jpeg' }), 'image/jpeg');
  assert.equal(picType({ type: '', name: 'a.gif' }), 'image/gif');
  assert.equal(picType({ type: '', name: 'noext' }), 'image/*');
  assert.ok(isGif({ type: 'image/gif' })); assert.ok(isGif({ type: 'image/*', name: 'x.gif' })); assert.ok(!isGif({ type: 'image/png', name: 'x.png' }));
});

test('fmtSize: any size, from bytes to gigabytes', () => {
  assert.equal(fmtSize(0), '0 B'); assert.equal(fmtSize(840), '840 B'); assert.equal(fmtSize(1536), '1.5 KB');
  assert.equal(fmtSize(3.1 * 1024 * 1024), '3.1 MB'); assert.equal(fmtSize(25 * 1024 * 1024), '25.0 MB');
  assert.equal(fmtSize(1.2 * 1024 ** 3), '1.2 GB'); assert.equal(fmtSize(-1), ''); assert.equal(fmtSize('x'), '');
});

test('normalizePics keeps good entries, drops junk and duplicates', () => {
  const r = normalizePics([{ id: 'a', name: 'n', type: 'image/gif', size: 5 }, { id: 'a' }, null, 7, { name: 'no id' }, { id: 'b' }]);
  assert.deepEqual(r.map(p => p.id), ['a', 'b']);
  assert.deepEqual(r[0], { id: 'a', name: 'n', type: 'image/gif', size: 5 });
  assert.deepEqual(r[1], { id: 'b', name: 'picture', type: 'image/*', size: 0 });
  assert.deepEqual(normalizePics(undefined), []); assert.deepEqual(normalizePics('x'), []);
  assert.equal(normalizePics(Array.from({ length: MAX_PICS + 20 }, (_, i) => ({ id: 'k' + i }))).length, MAX_PICS);
});

test('newPicId never repeats; describe copies the file facts', () => {
  assert.equal(newPicId(new Set(), 'z', 0), 'iz0');
  assert.equal(newPicId(new Set(['iz0']), 'z', 0), 'iz0x');
  assert.deepEqual(describe({ name: 'big.png', type: 'image/png', size: 123456789 }, 'i1'), { id: 'i1', name: 'big.png', type: 'image/png', size: 123456789 });
});

test('remove / move / cover', () => {
  const l = ['a', 'b', 'c'].map(id => ({ id }));
  assert.deepEqual(removePic(l, 'b').map(p => p.id), ['a', 'c']);
  assert.deepEqual(movePic(l, 'a', 1).map(p => p.id), ['b', 'a', 'c']);
  assert.deepEqual(movePic(l, 'a', -1).map(p => p.id), ['a', 'b', 'c']);
  assert.deepEqual(movePic(l, 'zzz', 1).map(p => p.id), ['a', 'b', 'c']);
  assert.deepEqual(makeCover(l, 'c').map(p => p.id), ['c', 'a', 'b']);
  assert.deepEqual(makeCover(l, 'nope').map(p => p.id), ['a', 'b', 'c']);
});

test('storage backend keeps the exact bytes of a big picture', async () => {
  const b = memoryBackend(), big = new Blob([new Uint8Array(6 * 1024 * 1024).fill(7)], { type: 'image/gif' });
  await b.put('i1', big);
  const back = await b.get('i1');
  assert.equal(back.size, 6 * 1024 * 1024); assert.equal(back.type, 'image/gif');
  await b.del('i1'); assert.equal(await b.get('i1'), undefined);
});

test('playlists file: pictures survive save + load, old files still work', () => {
  setPlaylists([{ id: 'p1', name: 'A', ids: ['t1'] }, { id: 'p2', name: 'B', ids: [], pics: [{ id: 'i1', name: 'x.gif', type: 'image/gif', size: 9 }] }]);
  assert.deepEqual(playlists[0].pics, []);
  const out = savablePlaylists();
  assert.equal('pics' in out[0], false);                       // no pictures: the file looks exactly like before v132
  assert.deepEqual(out[1].pics, [{ id: 'i1', name: 'x.gif', type: 'image/gif', size: 9 }]);
  setPlaylists(out);
  assert.equal(playlists[1].pics.length, 1);
});
