// BUG #11: "Refresh art" must forget quickKeys so pictures shown from their saved file are reloaded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extract } from './extract.mjs';

test('refreshAllPics clears quickKeys before reloading', () => {
  const quickKeys = new Set(['lf-albumpics:a', 'lf-songpics:b']);
  let seenAtLoad = null;
  const deps = {
    alpUrls: new Map([['a', 'x']]), spUrls: new Map(), ppUrl: new Map(), agUrls: {}, gpUrls: {},
    ppBad: new Set(), quickKeys, unwarm: () => {}, playlists: [], ppEnsure: () => Promise.resolve(),
    loadAllPics: () => { seenAtLoad = quickKeys.size; }, npSoon: () => {}, repaintPics: () => {}, toast: () => {}, refreshProfileBg: () => {},
  };
  const f = extract('src/main.js', 'refreshAllPics', deps, '}');
  f();
  assert.equal(seenAtLoad, 0, 'quickKeys must be empty when loadAllPics runs');
  assert.equal(deps.alpUrls.size, 0);
});
