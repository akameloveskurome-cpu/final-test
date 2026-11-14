// v61: browser-mock player behaves like the real one at the end of the queue (Bug 17).
import test from 'node:test';
import assert from 'node:assert/strict';
const { Native } = await import('../src/native.js');
const { tracks } = await import('../src/data.js');

test('Bug 17: Next on the last song does nothing (repeat off); Repeat All wraps; a song that ENDS stops playback', async () => {
  await Native.play(tracks.slice(0, 3), 2);
  await Native.setRepeat('off');
  await Native.next();
  assert.equal(Native.state.index, 2); assert.equal(Native.state.playing, true);          // same as ExoPlayer seekToNextMediaItem
  await Native.next(true);
  assert.equal(Native.state.playing, false); assert.equal(Native.state.pos, 0);           // natural end of the queue
  await Native.play(tracks.slice(0, 3), 2);
  await Native.setRepeat('all'); await Native.next();
  assert.equal(Native.state.index, 0);
  await Native.pause();
});
