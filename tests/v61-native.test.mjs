// v61 bug fixes that need the Android-mode native.js (against the fake plugin).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakePlugin } from './fake-plugin.js';

globalThis.__NATIVE__ = true;
const fake = makeFakePlugin();
globalThis.__PLUGIN__ = fake;
const { Native, on } = await import('../src/native.js');
const { tracks } = await import('../src/data.js');
const S = Native.state;
const ids = () => S.queue.map(t => t.id);
function reset() {
  Object.assign(S, { queue: [], index: -1, playing: false, pos: 0, repeat: 'off', shuffle: false, orig: [] });
  Object.assign(fake.P, { ids: [], index: 0, pos: 0, playing: false, repeat: 'off', exoShuffle: false }); fake.P.log.length = 0;
}

test('Bug 1: songs added by an onTrackChanged listener (autoplay fill) reach the player AFTER play, so queue == playlist', async () => {
  reset();
  const extra = tracks.slice(10, 12);
  let filled = false;
  on('onTrackChanged', () => {   // what autoFill() in main.js does: fewer than 3 songs left -> addToQueue
    if (filled || S.queue.length - S.index - 1 >= 3) return;
    filled = true; extra.forEach(t => Native.addToQueue(t));
  });
  await Native.play([tracks[0]], 0);
  await new Promise(r => setTimeout(r, 10));
  const order = fake.P.log.filter(x => x === 'play' || x === 'addToQueue');
  assert.deepEqual(order, ['play', 'addToQueue', 'addToQueue'], 'play must come first');
  assert.deepEqual(ids(), [tracks[0].id, ...extra.map(t => t.id)]);
  assert.deepEqual(fake.P.ids, ids(), 'JS queue == ExoPlayer playlist');
});

test('Bug 10: when the player refuses to play, the state does not stay "playing"', async () => {
  reset();
  const orig = fake.play; fake.play = () => Promise.reject(new Error('player down'));
  try {
    await assert.rejects(() => Native.play(tracks.slice(0, 3), 0), /player down/);
    assert.equal(S.playing, false);
  } finally { fake.play = orig; }
});
