// BUG #75: Settings > Refresh art must also reload the profile picture and the background picture (online pictures stay untouched).
import test from 'node:test';
import assert from 'node:assert/strict';
import { extract } from './extract.mjs';

const run = (bgSaved, pfSaved, restoreOk = true) => {
  const log = [];
  const deps = {
    bgSaved: () => bgSaved, pfSaved: () => pfSaved, bgQuick: true, pfQuick: true,
    restoreBg: () => log.push('restoreBg'),
    restorePf: () => { log.push('restorePf'); return restoreOk ? Promise.resolve() : Promise.reject(new Error('x')).catch(() => {}); },
    repaintAll: () => log.push('repaintAll'),
  };
  extract('src/main.js', 'refreshProfileBg', deps, '}')();
  return new Promise(r => setTimeout(() => r(log), 10));
};

test('both saved: background and profile are reloaded, then everything is repainted', async () => {
  assert.deepEqual(await run(true, true), ['restoreBg', 'restorePf', 'repaintAll']);
});
test('nothing saved: nothing is touched', async () => {
  assert.deepEqual(await run(false, false), []);
});
test('only the background saved', async () => {
  assert.deepEqual(await run(true, false), ['restoreBg']);
});

test('refreshAllPics calls refreshProfileBg and does not touch the online pictures', () => {
  const calls = [];
  const deps = { alpUrls: new Map(), spUrls: new Map(), ppUrl: new Map(), agUrls: {}, gpUrls: {}, ppBad: new Set(), quickKeys: new Set(), playlists: [], ppEnsure: () => Promise.resolve(),
    loadAllPics: () => calls.push('loadAllPics'), npSoon: () => {}, repaintPics: () => {}, toast: () => {}, refreshProfileBg: () => calls.push('refreshProfileBg') };
  extract('src/main.js', 'refreshAllPics', deps, '}')();
  assert.deepEqual(calls, ['loadAllPics', 'refreshProfileBg']);
});
