// native.js in "Android" mode, against a fake plugin that mimics ExoPlayer's playlist. Key invariant: JS queue == player playlist.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakePlugin } from './fake-plugin.js';

globalThis.__NATIVE__ = true;
const fake = makeFakePlugin();
globalThis.__PLUGIN__ = fake;
const { Native } = await import('../src/native.js');
const { tracks } = await import('../src/data.js');

const S = Native.state;
const ids = () => S.queue.map(t => t.id);
const calls = name => fake.P.log.filter(x => x === name).length;
const inSync = msg => { assert.deepEqual(ids(), fake.P.ids, 'queue ids ' + (msg || '')); assert.equal(S.index, fake.P.index, 'index ' + (msg || '')); };
function reset() {
  Object.assign(S, { queue: [], index: -1, playing: false, pos: 0, repeat: 'off', shuffle: false, orig: [] });
  Object.assign(fake.P, { ids: [], index: 0, pos: 0, playing: false, repeat: 'off', exoShuffle: false }); fake.P.log.length = 0; fake.P.files.clear();
  fake.hangRestore = false; fake.failRestore = false;
}
const all = tracks.slice(0, 12);

test('play: JS queue and player playlist are identical', async () => {
  reset(); await Native.play(all, 4);
  inSync(); assert.equal(S.queue[S.index].id, all[4].id); assert.deepEqual(S.orig, []);
});

test('shuffle ON reorders only the songs after the current one; the current song does not restart; ExoPlayer shuffle stays off', async () => {
  reset(); await Native.play(all, 3);
  const before = ids(); fake.P.log.length = 0;
  await Native.setShuffle(true);
  inSync('after shuffle on');
  assert.deepEqual(ids().slice(0, 4), before.slice(0, 4));                           // played songs + current: untouched
  assert.deepEqual(ids().slice(4).sort(), before.slice(4).sort());                   // same upcoming songs, new order
  assert.deepEqual(S.orig.map(t => t.id), before.slice(4));                          // original order remembered for undo
  assert.equal(calls('play'), 0, 'current song must not be re-played');
  assert.equal(calls('setShuffle'), 0, 'ExoPlayer shuffle must never be used');
  assert.equal(fake.P.exoShuffle, false);
  assert.equal(calls('replaceTail'), 1);
});

test('shuffle OFF puts the upcoming songs back in their original order', async () => {
  reset(); await Native.play(all, 3);
  const before = ids();
  await Native.setShuffle(true); await Native.setShuffle(false);
  inSync(); assert.deepEqual(ids(), before); assert.deepEqual(S.orig, []); assert.equal(S.shuffle, false);
});

test('shuffle toggled when nothing plays only sets the flag', async () => {
  reset(); await Native.setShuffle(true);
  assert.equal(S.shuffle, true); assert.equal(calls('replaceTail'), 0);
});

test('shuffle with an empty tail (last song) does not call the plugin', async () => {
  reset(); await Native.play(all, all.length - 1); fake.P.log.length = 0;
  await Native.setShuffle(true); assert.equal(calls('replaceTail'), 0); inSync();
});

test('play with shuffle ON: chosen song first, the rest smart-shuffled; keep=true does not reshuffle', async () => {
  reset(); S.shuffle = true;
  await Native.play(all, 5);
  inSync(); assert.equal(S.index, 0); assert.equal(S.queue[0].id, all[5].id);
  assert.deepEqual(ids().sort(), all.map(t => t.id).sort());
  const order = ids(); fake.P.log.length = 0;
  await Native.play(S.queue, 3, true);                                              // Up Next: tap the 4th song
  inSync(); assert.deepEqual(ids(), order); assert.equal(S.index, 3);
});

test('playShuffled: shuffle on, every song once, starts anywhere in the list; empty list is a no-op', async () => {
  reset(); await Native.playShuffled(all);
  inSync(); assert.equal(S.shuffle, true); assert.equal(S.index, 0);
  assert.deepEqual(ids().sort(), all.map(t => t.id).sort());
  reset(); await Native.playShuffled([]); assert.equal(S.queue.length, 0); assert.equal(calls('play'), 0);
});

test('addNext / addToQueue while shuffle is on, then shuffle off: added songs land in the right place', async () => {
  reset(); await Native.play(all.slice(0, 8), 0);
  const [a, b, c] = [tracks[14], tracks[15], tracks[16]];
  await Native.setShuffle(true);
  await Native.addNext(a); await Native.addToQueue(b);
  inSync(); assert.equal(S.queue[1].id, a.id); assert.equal(S.queue.at(-1).id, b.id);
  await Native.setShuffle(false);
  inSync(); assert.deepEqual(ids(), [all[0].id, a.id, ...all.slice(1, 8).map(t => t.id), b.id]);
  await Native.addNext(c); inSync(); assert.equal(S.queue[1].id, c.id);
});

test('clearQueue keeps ONLY the current song (also the ones before it), indexes stay in step', async () => {
  reset(); await Native.play(all, 6);
  await Native.clearQueue();
  inSync(); assert.deepEqual(ids(), [all[6].id]); assert.equal(S.index, 0);
  await Native.addToQueue(tracks[15]); inSync();
});

test('clearQueue with nothing playing is safe', async () => {
  reset(); await Native.clearQueue(); assert.equal(S.index, -1); assert.deepEqual(S.queue, []);
});

test('moveItem / removeItem keep both sides in sync', async () => {
  reset(); await Native.play(all, 1);
  await Native.moveItem(5, 2); inSync();
  await Native.removeItem(3); inSync();
  await Native.moveItem(2, 6); inSync();
});

test('player events: next / prev follow the playlist; onTrackChanged for the same index keeps the position', async () => {
  reset(); await Native.play(all, 0);
  await Native.next(); assert.equal(S.index, 1);
  S.pos = 42; fake.emit('onTrackChanged', { index: 1 }); assert.equal(S.pos, 42);   // restore / repeat-one
  fake.emit('onTrackChanged', { index: 2 }); assert.equal(S.pos, 0); assert.equal(S.index, 2);
});

test('FUZZ: 400 random operations, queue always equals the player playlist', async () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const realRandom = Math.random; Math.random = rnd;
  try {
    reset(); await Native.play(all, 0);
    for (let n = 0; n < 400; n++) {
      const up = S.queue.length - S.index - 1, pick = Math.floor(rnd() * 11);
      if (pick === 0) await Native.setShuffle(!S.shuffle);
      else if (pick === 1) await Native.addNext(tracks[Math.floor(rnd() * tracks.length)]);
      else if (pick === 2) await Native.addToQueue(tracks[Math.floor(rnd() * tracks.length)]);
      else if (pick === 3 && up > 1) { const f = S.index + 1 + Math.floor(rnd() * up), t = S.index + 1 + Math.floor(rnd() * up); await Native.moveItem(f, t); }
      else if (pick === 4 && up > 0) await Native.removeItem(S.index + 1 + Math.floor(rnd() * up));
      else if (pick === 5 && rnd() < 0.3) await Native.clearQueue();
      else if (pick === 6) await Native.next();
      else if (pick === 7) await Native.prev();
      else if (pick === 8) await Native.play(S.queue.length ? S.queue : all, Math.floor(rnd() * Math.max(1, S.queue.length)), rnd() < 0.5);
      else if (pick === 9) await Native.playShuffled(all);
      else await Native.setRepeat(['off', 'all', 'one'][Math.floor(rnd() * 3)]);
      inSync('op ' + n + ' pick ' + pick);
    }
    assert.equal(calls('setShuffle'), 0);
    assert.equal(fake.P.exoShuffle, false);
  } finally { Math.random = realRandom; }
});

/* ---------- restore ---------- */
const sn = (idList, o = {}) => ({ ids: idList, index: 0, pos: 0, shuffle: false, repeat: 'off', orig: [], ...o });

test('restore: queue, index, position, repeat and shuffle come back PAUSED, player is loaded but not started', async () => {
  reset();
  const want = all.slice(0, 6).map(t => t.id);
  const ok = await Native.restore(sn(want, { index: 2, pos: 61.5, repeat: 'all', shuffle: true, orig: want.slice(3).reverse() }));
  assert.equal(ok, true);
  inSync(); assert.equal(S.index, 2); assert.equal(S.pos, 61.5); assert.equal(S.playing, false);
  assert.equal(S.repeat, 'all'); assert.equal(fake.P.repeat, 'all'); assert.equal(S.shuffle, true);
  assert.deepEqual(S.orig.map(t => t.id), want.slice(3).reverse());
  assert.equal(fake.P.pos, 61.5); assert.equal(fake.P.playing, false); assert.equal(calls('play'), 0);
  await Native.resume(); assert.equal(fake.P.playing, true); assert.equal(calls('play'), 0);   // resume just plays what is loaded
});

test('restore with deleted songs: skipped; a missing song BEFORE the current one shifts the index', async () => {
  reset();
  const [a, c, d] = [all[0].id, all[2].id, all[3].id];
  assert.equal(await Native.restore(sn([a, 'gone-1', c, d], { index: 2, pos: 30 })), true);
  assert.deepEqual(ids(), [a, c, d]); assert.equal(S.queue[S.index].id, c); assert.equal(S.pos, 30); inSync();
});

test('restore when the saved CURRENT song is gone: next surviving song, position 0', async () => {
  reset();
  const [a, b, d] = [all[0].id, all[1].id, all[3].id];
  await Native.restore(sn([a, b, 'gone', d], { index: 2, pos: 99 }));
  assert.deepEqual(ids(), [a, b, d]); assert.equal(S.queue[S.index].id, d); assert.equal(S.pos, 0); inSync();
});

test('restore when the saved current song is the LAST one and gone: clamps to the new last song', async () => {
  reset();
  await Native.restore(sn([all[0].id, all[1].id, 'gone'], { index: 2, pos: 10 }));
  assert.equal(S.index, 1); assert.equal(S.pos, 0); inSync();
});

test('restore with no known songs / empty / garbage: returns false and changes nothing', async () => {
  reset();
  assert.equal(await Native.restore(sn(['x', 'y'])), false);
  assert.equal(await Native.restore(sn([])), false);
  assert.equal(await Native.restore({}), false);
  assert.equal(await Native.restore({ ids: 'nope' }), false);
  assert.equal(S.queue.length, 0); assert.equal(calls('restore'), 0);
});

test('restore with a bad index / pos / repeat value is clamped', async () => {
  reset();
  await Native.restore(sn(all.slice(0, 3).map(t => t.id), { index: 99, pos: -5, repeat: 'banana' }));
  assert.equal(S.index, 2); assert.equal(S.pos, 0); assert.equal(S.repeat, 'off'); inSync();
});

test('restore: the Android service outlived the app -> its queue and state are adopted, nothing is reloaded', async () => {
  reset();
  Object.assign(fake.P, { ids: [all[5].id, all[6].id, all[7].id], index: 1, pos: 33.5, playing: true, repeat: 'one' });
  const ok = await Native.restore(sn(all.slice(0, 3).map(t => t.id), { index: 0, pos: 5 }));
  assert.equal(ok, true);
  assert.deepEqual(ids(), [all[5].id, all[6].id, all[7].id]); assert.equal(S.index, 1); assert.equal(S.pos, 33.5);
  assert.equal(S.playing, true); assert.equal(S.repeat, 'one');
  assert.deepEqual(fake.P.ids, ids()); assert.equal(calls('play'), 0); assert.equal(calls('setRepeat'), 0);
});

test('restore: service queue holds songs the library does not know -> it is replaced by the saved session (paused)', async () => {
  reset();
  Object.assign(fake.P, { ids: ['zzz1', 'zzz2'], index: 0, playing: true });
  const want = all.slice(0, 4).map(t => t.id);
  await Native.restore(sn(want, { index: 1, pos: 7 }));
  assert.deepEqual(fake.P.ids, want); assert.equal(fake.P.index, 1); assert.equal(fake.P.playing, false); inSync();
});

test('restore: service does not answer (8 s) -> UI still shows the session; the first Resume loads it and seeks', async () => {
  reset(); fake.hangRestore = true; mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const want = all.slice(0, 5).map(t => t.id);
    const p = Native.restore(sn(want, { index: 3, pos: 80 }));
    mock.timers.tick(8000);
    assert.equal(await p, true);
    assert.deepEqual(ids(), want); assert.equal(S.index, 3); assert.equal(S.playing, false);
    assert.deepEqual(fake.P.ids, []);                                              // player never got it
  } finally { mock.timers.reset(); }
  fake.hangRestore = false;
  await Native.resume();
  assert.deepEqual(fake.P.ids, ids()); assert.equal(fake.P.index, 3); assert.equal(fake.P.pos, 80); assert.equal(fake.P.playing, true);
});

test('restore: plugin rejects -> still returns true, first Resume loads the queue', async () => {
  reset(); fake.failRestore = true;
  assert.equal(await Native.restore(sn(all.slice(0, 3).map(t => t.id), { index: 1, pos: 12 })), true);
  fake.failRestore = false;
  await Native.resume(); assert.deepEqual(fake.P.ids, ids()); assert.equal(fake.P.index, 1);
});

test('store: readJson / writeJson round trip; missing file -> null', async () => {
  reset();
  const { store } = await import('../src/native.js');
  assert.equal(await store.get('session'), null);
  await store.set('session', { a: [1, 2], b: 'x' });
  assert.deepEqual(await store.get('session'), { a: [1, 2], b: 'x' });
});
