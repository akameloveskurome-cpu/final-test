// BUG #14: autoplay fill must add its songs one at a time (overlapping addToQueue calls each keep a rollback snapshot that overwrites the others).
import test from 'node:test';
import assert from 'node:assert/strict';
import { extract } from './extract.mjs';

const mk = failAt => {
  const log = []; let inFlight = 0, maxInFlight = 0;
  const tracks = Array.from({ length: 12 }, (_, i) => ({ id: 't' + i }));
  const Native = {
    state: { index: 0, queue: [tracks[0]] },
    addToQueue: async t => { log.push('start ' + t.id); inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); await new Promise(r => setTimeout(r, 5)); inFlight--; if (t.id === failAt) { log.push('fail ' + t.id); throw new Error('native failed'); } log.push('done ' + t.id); },
  };
  const warns = [];
  const deps = { set: { autoplay: true }, fillBusy: false, Native, trackAlbum: () => ({ artist: 'A', genre: 'G' }), tracks, shuffled: a => a, logLine: (...a) => warns.push(a), };
  return { autoFill: extract('src/main.js', 'autoFill', deps, '}'), log, warns, max: () => maxInFlight };
};

test('autoFill adds its songs one after the other', async () => {
  const m = mk(null);
  m.autoFill();
  await new Promise(r => setTimeout(r, 120));
  assert.equal(m.max(), 1, 'never two addToQueue calls at once');
  assert.equal(m.log.filter(x => x.startsWith('done')).length, 5, 'five songs added');
});

test('autoFill: a failing add stops the batch (no later song is added on top of a rolled-back queue) and is logged', async () => {
  const m = mk('t2');
  m.autoFill();
  await new Promise(r => setTimeout(r, 120));
  assert.equal(m.max(), 1);
  assert.ok(!m.log.some(x => x === 'start t3'), 'nothing is started after the failure');
  assert.equal(m.warns.length, 1, 'the failure is logged once');
});
