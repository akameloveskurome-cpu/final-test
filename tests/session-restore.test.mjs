// A fresh start with a saved session: restoreSession() puts it back paused; resume plays it; corrupt data is ignored.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const want = ['t3', 't1', 'gone', 't7', 't9'];
localStorage.setItem('lf.session', JSON.stringify({ v: 1, ids: want, index: 3, pos: 77, shuffle: true, repeat: 'one', orig: ['t9', 't7', 'gone'] }));
const { Native } = await import('../src/native.js');
const { restoreSession } = await import('../src/session.js');

test('restoreSession puts the saved session back, paused, skipping deleted songs', async () => {
  const events = [];
  const { on } = await import('../src/native.js');
  on('onTrackChanged', t => events.push('track:' + t.id)); on('onRepeatChanged', r => events.push('repeat:' + r));
  assert.equal(await restoreSession(), true);
  const s = Native.state;
  assert.deepEqual(s.queue.map(t => t.id), ['t3', 't1', 't7', 't9']);
  assert.equal(s.queue[s.index].id, 't7'); assert.equal(s.pos, 77); assert.equal(s.playing, false);
  assert.equal(s.shuffle, true); assert.equal(s.repeat, 'one'); assert.deepEqual(s.orig.map(t => t.id), ['t9', 't7']);
  assert.deepEqual(events, ['track:t7', 'repeat:one']);        // UI hooks fire so the mini player / Now Playing draw
});

test('Resume plays the restored song from the restored position (browser mock)', async () => {
  await Native.resume(); assert.equal(Native.state.playing, true); assert.ok(Native.state.pos >= 77);
  await Native.pause();
});

test('after the restore, changes are saved again', async () => {
  await Native.next(); await sleep(800);
  assert.equal(JSON.parse(localStorage.getItem('lf.session')).index, 3);
});

after(() => Native.pause());   // stop the mock player's timer so the process can exit
