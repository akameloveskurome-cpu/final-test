// Start-up: Home must not say "No music yet" before the saved library has been read (it used to for ~2 s: the first draw happens before loadLib() runs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

function emptyBoxWith({ isNative, tracks, libLoading }) {
  const lines = src.split('\n');
  const get = name => lines.find(l => l.startsWith('const ' + name + ' = '));
  const code = [get('loadingBox'), get('emptyBox')].join('\n');
  return new Function('Native', 'tracks', 'libLoading', 'I', `${code}\nreturn emptyBox();`)({ isNative }, tracks, libLoading, { folder: '' });
}

test('while the library is loading: a loading animation, not "No music yet"', () => {
  const h = emptyBoxWith({ isNative: true, tracks: [], libLoading: true });
  assert.match(h, /libload/); assert.doesNotMatch(h, /No music yet/);
});
test('after loading with no songs: the "No music yet" box and the folder button', () => {
  const h = emptyBoxWith({ isNative: true, tracks: [], libLoading: false });
  assert.match(h, /No music yet/); assert.match(h, /pickfolder/);
});
test('with songs, or in a browser: nothing', () => {
  assert.equal(emptyBoxWith({ isNative: true, tracks: [1], libLoading: false }), '');
  assert.equal(emptyBoxWith({ isNative: false, tracks: [], libLoading: false }), '');
});
test('libLoading starts true on Android, so the very first Home draw is already the loading state', () => {
  assert.match(src, /^let libLoading = !!Native\.isNative;/m);
});
