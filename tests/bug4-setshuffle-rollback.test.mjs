// BUG #4: setShuffle() must restore shuffle flag, queue and orig when the native replaceTail call fails.
// native.js imports @capacitor/core (not installed in CI), so the real method text is cut out of the source and run with stand-ins.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/native.js', import.meta.url), 'utf8');
const a = src.indexOf('  async setShuffle(on) {'), b = src.indexOf('\n  },', a);
assert.ok(a > 0 && b > a, 'setShuffle found');
const body = src.slice(a, b + 5).replace(/^\s*async setShuffle\(on\)/, 'async function setShuffle(on)').replace(/\},\s*$/, '}');
const make = fail => {
  const s = { shuffle: false, index: 0, queue: [1, 2, 3, 4].map(id => ({ id })), orig: [] };
  const events = [];
  const deps = { s, changed: () => events.push('changed'), shuffled: t => t.slice().reverse(), restoreOrder: t => t, item: t => t,
    nat: async () => { if (fail) throw new Error('native failed'); return {}; } };
  const f = new Function(...Object.keys(deps), body + '\nreturn setShuffle;')(...Object.values(deps));
  return { s, f, events };
};

test('a failed replaceTail restores shuffle, queue and orig and rethrows', async () => {
  const { s, f, events } = make(true); const q0 = s.queue;
  await assert.rejects(() => f(true), /native failed/);
  assert.equal(s.shuffle, false); assert.equal(s.queue, q0); assert.deepEqual(s.orig, []);
  assert.deepEqual(s.queue.map(t => t.id), [1, 2, 3, 4]);
  assert.ok(events.includes('changed'), 'listeners are told the old state is back');
});

test('a successful replaceTail keeps the new order', async () => {
  const { s, f } = make(false);
  await f(true);
  assert.equal(s.shuffle, true); assert.deepEqual(s.queue.map(t => t.id), [1, 4, 3, 2]); assert.equal(s.orig.length, 3);
});
