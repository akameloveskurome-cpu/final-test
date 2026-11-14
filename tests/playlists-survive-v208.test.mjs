// v208: imported / saved playlists must survive the library loading AFTER them (cold start). setLibrary() used to wipe them from memory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setLibrary, setPlaylists, playlists, savablePlaylists, tracks } from '../src/data.js';
const row = (rel, title) => ({ uri: `content://com.android.externalstorage.documents/tree/primary%3AMusic/document/${encodeURIComponent('primary:Music/' + rel)}`, album: 'Hits', artist: 'A', albumArtist: '', aaTag: false, title, dur: 200, bits: 16, khz: 44.1 });
const LIB = () => [row('A/Hits/01 One.flac', 'One'), row('A/Hits/02 Two.flac', 'Two')];

test('before any playlist was loaded the built-in demo playlists are dropped when the real library arrives', () => {
  assert.ok(playlists.length > 0);   // the demo list of the browser preview
  setLibrary(LIB());
  assert.equal(playlists.length, 0);
});

test('playlists loaded from the file are KEPT when the library loads after them (the race that made imported playlists vanish)', () => {
  setLibrary(LIB());
  const ids = tracks.map(t => t.id);
  setPlaylists([{ id: 'p1', name: 'Imported', ids }, { id: 'p2', name: 'Second', ids: [ids[0]] }]);
  setLibrary(LIB());   // the library arrives AFTER the playlists were read
  assert.deepEqual(savablePlaylists().map(p => p.name), ['Imported', 'Second']);
  assert.deepEqual(savablePlaylists()[0].ids, ids);
  setLibrary(LIB()); setLibrary([]);   // a rescan or an empty scan never clears them either
  assert.equal(playlists.length, 2);
});

test('a playlist added by an import stays in memory through a later setLibrary and is what gets saved', () => {
  setPlaylists([]);
  playlists.push({ id: 'pimp0', name: 'From file', ids: ['x'] });
  setLibrary(LIB());
  assert.deepEqual(savablePlaylists().map(p => p.id), ['pimp0']);
});

test('source: loadPlaylists / import still save through Native.savePlaylists and setLibrary keeps loaded playlists', () => {
  const D = readFileSync(new URL('../src/data.js', import.meta.url), 'utf8');
  assert.ok(D.includes('if (!plLoaded) playlists = [];') && D.includes('plLoaded = true; playlists ='));
  const M = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(M.includes('const savePl = () => Native.savePlaylists({ playlists: savablePlaylists() })'));
});
