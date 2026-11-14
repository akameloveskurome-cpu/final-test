// BUG-277: behaviour test (runs the real Native.play in the browser/mock mode). OWNER RULE: Shuffle is the person's own setting.
// Shuffle ON = a list they start is shuffled (chosen song first); Shuffle OFF = it plays in its own order. Play / row taps never switch the setting.
import test from 'node:test';
import assert from 'node:assert/strict';
const { Native } = await import('../src/native.js');
const S = Native.state;
const song = i => ({ id: 's' + i, title: 'T' + i, artist: 'A' + (i % 3), artists: ['A' + (i % 3)], albumId: 'al' + (i % 4), album: 'AL', duration: 100, uri: 'x' + i });
const list = Array.from({ length: 12 }, (_, i) => song(i));
const ids = q => q.map(t => t.id);
const stop = () => { try { Native.pause && Native.pause(); } catch {} };
test.afterEach?.(stop);

test('shuffle OFF: the list plays in its own order from the chosen song, and the setting is untouched', async () => {
  S.shuffle = false; await Native.play(list, 4);
  assert.deepEqual(ids(S.queue), ids(list)); assert.equal(S.index, 4); assert.equal(S.shuffle, false); assert.deepEqual(S.orig, []);
  stop();
});
test('shuffle ON: the chosen song is first, the rest are the same songs, the setting stays on, the original order is kept for un-shuffling', async () => {
  S.shuffle = true; await Native.play(list, 4);
  assert.equal(S.queue[0].id, 's4'); assert.equal(S.index, 0); assert.equal(S.shuffle, true);
  assert.deepEqual(ids(S.queue).sort(), ids(list).sort(), 'nothing lost or duplicated');
  assert.deepEqual(ids(S.orig), ids(list.filter((_, k) => k !== 4)), 'orig = the rest in their own order');
  stop();
});
test('keep=true plays exactly as given even with shuffle on (Up Next tap)', async () => {
  S.shuffle = true; await Native.play(list, 7, true);
  assert.deepEqual(ids(S.queue), ids(list)); assert.equal(S.index, 7);
  stop();
});
test('a one-song list and bad indexes are safe; an empty list changes nothing', async () => {
  S.shuffle = true; await Native.play([song(1)], 0); assert.deepEqual(ids(S.queue), ['s1']);
  await Native.play(list, 999, true); assert.equal(S.index, list.length - 1);
  await Native.play(list, -5, true); assert.equal(S.index, 0);
  const before = ids(S.queue); await Native.play([], 0); assert.deepEqual(ids(S.queue), before);
  stop();
});
test('Shuffle All turns shuffle on and starts a list that contains every song', async () => {
  S.shuffle = false; await Native.playShuffled(list);
  assert.equal(S.shuffle, true); assert.deepEqual(ids(S.queue).sort(), ids(list).sort());
  stop();
});
