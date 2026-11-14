// Playlist import into an existing playlist (merge), missing songs saved to a CSV, and the raw name kept for each imported list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planForeign, parseAny, mergeIds, missingCsv } from '../src/plforeign.js';
import { parseCsvList } from '../src/plforeign.js';

const tracks = [
  { id: 't1', title: 'Alpha', trackArtist: 'Ann', path: 'Ann/Alpha.flac', albumId: 'a1', dur: 200 },
  { id: 't2', title: 'Beta', trackArtist: 'Ben', path: 'Ben/Beta.flac', albumId: 'a2', dur: 180 },
  { id: 't3', title: 'Gamma', trackArtist: 'Cy', path: 'Cy/Gamma.flac', albumId: 'a3', dur: 0 },
];
const aa = t => ({ artist: t.trackArtist, album: 'Album ' + t.albumId });
const M3U = (name, songs) => `#EXTM3U\n#PLAYLIST:${name}\n` + songs.map(s => `#EXTINF:200,${s.a} - ${s.t}\n${s.p}`).join('\n') + '\n';

test('merge: the imported songs go to the end of the existing playlist, in order, and songs already there are not repeated', () => {
  assert.deepEqual(mergeIds(['t1'], ['t2', 't1', 't3']), { ids: ['t1', 't2', 't3'], added: 2 });
  assert.deepEqual(mergeIds([], ['t2', 't2']), { ids: ['t2'], added: 1 });   // a repeat inside the list counts once in a merge
  assert.deepEqual(mergeIds(['t1', 't1'], []), { ids: ['t1', 't1'], added: 0 });   // the existing playlist is never changed by an empty merge
});

test('each imported list keeps its raw name, so the final name can be chosen when the import is applied', () => {
  const imp = parseAny(M3U('Road', [{ t: 'Alpha', a: 'Ann', p: 'Ann/Alpha.flac' }]), 'Road.m3u8');
  const p1 = planForeign(imp, tracks, aa, ['Road']);
  assert.equal(p1.lists[0].raw, 'Road'); assert.equal(p1.lists[0].name, 'Road (2)');
  const p2 = planForeign(imp, tracks, aa, []);
  assert.equal(p2.lists[0].name, 'Road'); assert.equal(p2.lists[0].raw, 'Road');
});

test('missing songs become a CSV: playlist, track, artist, dated name; a list with no missing songs gives just the header', () => {
  const imp = parseAny(M3U('Mix', [{ t: 'Alpha', a: 'Ann', p: 'Ann/Alpha.flac' }, { t: 'Nope', a: 'Nobody', p: 'x/Nope.flac' }]), 'Mix.m3u8');
  const plan = planForeign(imp, tracks, aa, []);
  const f = missingCsv(plan.missing, new Date(2026, 10, 8));
  assert.equal(f.name, 'liquid-dark-missing-songs-20261108.csv'); assert.equal(f.mime, 'text/csv');
  const rows = parseCsvList(f.text, 'x.csv');   // read back with the same CSV reader the importer uses
  assert.deepEqual(rows, [{ name: 'Mix', songs: [{ id: '', path: '', title: 'Nope', artist: 'Nobody', album: '' }] }]);
  assert.equal(missingCsv([], new Date(2026, 10, 8)).text, 'Playlist,Track,Artist\r\n');
});

test('the same name AND the same songs in another order is not a duplicate for merge purposes (it is a different playlist)', () => {
  const imp = parseAny(M3U('Road', [{ t: 'Alpha', a: 'Ann', p: 'Ann/Alpha.flac' }, { t: 'Beta', a: 'Ben', p: 'Ben/Beta.flac' }]), 'Road.m3u8');
  const p = planForeign(imp, tracks, aa, ['Road'], [{ name: 'Road', ids: ['t2', 't1'] }]);
  assert.equal(p.lists.length, 1); assert.equal(p.lists[0].name, 'Road (2)');
});
