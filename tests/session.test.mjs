// session.js in browser mode (store = localStorage 'lf.session'): nothing is saved before restoreSession(); changes are saved; a new start restores them.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

const { Native } = await import('../src/native.js');
const { tracks } = await import('../src/data.js');
const { restoreSession, snapshot } = await import('../src/session.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const saved = () => JSON.parse(localStorage.getItem('lf.session'));

test('events BEFORE restoreSession() never write the session (an empty start must not wipe the old one)', async () => {
  localStorage.setItem('lf.session', JSON.stringify({ v: 1, ids: ['t1'], index: 0, pos: 1, shuffle: false, repeat: 'off', orig: [] }));
  await Native.play(tracks.slice(0, 5), 2);          // user plays before the restore ran
  await sleep(800);
  assert.deepEqual(saved().ids, ['t1'], 'old session untouched');
});

test('restoreSession(): a queue already exists -> it is NOT replaced; afterwards changes are saved', async () => {
  assert.equal(await restoreSession(), false);       // queue not empty -> skip
  assert.equal(await restoreSession(), false);       // second call is a no-op
  await Native.addToQueue(tracks[10]);
  await sleep(800);
  const s = saved();
  assert.deepEqual(s.ids, [...tracks.slice(0, 5).map(t => t.id), tracks[10].id]);
  assert.equal(s.index, 2); assert.equal(s.shuffle, false); assert.equal(s.repeat, 'off');
});

test('shuffle, repeat and track changes are saved (and the snapshot is plain JSON)', async () => {
  await Native.setShuffle(true);
  await Native.setRepeat('all');
  await sleep(800);
  let s = saved();
  assert.equal(s.shuffle, true); assert.equal(s.repeat, 'all'); assert.equal(s.orig.length, 3);   // 3 upcoming songs before the shuffle (tracks 3,4 + added)
  assert.deepEqual(s.ids, Native.state.queue.map(t => t.id));
  await Native.next(); await sleep(800);
  s = saved(); assert.equal(s.index, 3);
  assert.doesNotThrow(() => JSON.stringify(snapshot()));
});

test('position is saved about every 5 s while playing (progress events)', async () => {
  await Native.seek(0); await sleep(800); // save pos ~0
  const before = saved().pos;
  Native.state.playing = true;
  // simulate the mock player / Android progress events
  const { on } = await import('../src/native.js');
  assert.equal(typeof on, 'function');
  await Native.seek(30);                              // mock seek emits onProgress with pos 30 -> |30 - lastPos| >= 5 -> save
  await sleep(800);
  assert.ok(saved().pos >= 30 && saved().pos > before);
});

test('clearQueue: the saved session is the single current song', async () => {
  await Native.clearQueue(); await sleep(800);
  const s = saved(); assert.equal(s.ids.length, 1); assert.equal(s.index, 0); assert.deepEqual(s.orig, []);
});

after(() => Native.pause());   // stop the mock player's timer so the process can exit
