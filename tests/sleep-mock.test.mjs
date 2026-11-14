// T22 in a browser (no plugin): the mock timer must pause playback when it runs out. Fake clock = no waiting.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

globalThis.__NATIVE__ = false;
mock.timers.enable({ apis: ['setInterval', 'Date'] });
const { Native, on } = await import('../src/native.js');
const { tracks } = await import('../src/data.js');
const events = []; on('onSleepTimer', e => events.push(e));
// Advance the fake clock in 1 s steps: one huge tick() runs callbacks that were already cancelled earlier in the same tick on some Node versions, a browser never does.
const advance = ms => { for (let t = 0; t < ms; t += 1000) mock.timers.tick(Math.min(1000, ms - t)); };

test('mock: minutes timer pauses at the end and reports fired; cancel stops it', async () => {
  await Native.setRepeat('all'); await Native.play(tracks.slice(0, 3), 0); assert.equal(Native.state.playing, true);   // repeat all: the queue must not run out by itself during the test
  await Native.setSleepTimer({ minutes: 15 });
  advance(14 * 60000); assert.equal(Native.state.playing, true); assert.equal(Native.sleepState().active, true);
  advance(61000);
  assert.equal(Native.state.playing, false, 'paused when the time is up'); assert.equal(Native.sleepState().active, false); assert.equal(events.at(-1).fired, true);
  await Native.resume(); await Native.setSleepTimer({ minutes: 15 }); await Native.cancelSleepTimer();
  advance(20 * 60000); assert.equal(Native.state.playing, true, 'cancelled timer must not pause'); assert.equal(events.at(-1).fired, false);
  await Native.pause();
});
test('mock: a new timer replaces the old one', async () => {
  await Native.resume(); await Native.setSleepTimer({ minutes: 15 }); await Native.setSleepTimer({ minutes: 45 });
  advance(16 * 60000); assert.equal(Native.state.playing, true, 'the 15 minute timer is gone');
  advance(30 * 60000); assert.equal(Native.state.playing, false);
});
