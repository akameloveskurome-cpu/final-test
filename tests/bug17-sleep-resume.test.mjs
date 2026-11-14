// BUG #17: a sleep timer lost by a killed app must be resumed once the queue is back, not only if the queue was there at the first check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';

const mk = (state) => {
  const store = {}, calls = [];
  const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const Native = { getSleepTimer: () => Promise.resolve({ active: state.active }), current: () => state.cur, setSleepTimer: o => { calls.push(o); state.active = true; return Promise.resolve(); } };
  const sleepResume = extract('src/main.js', 'sleepResume', { Native, localStorage, renderNP: () => {}, Date });
  return { sleepResume, store, calls };
};
const tick = () => new Promise(r => setTimeout(r, 0));

test('timer is skipped while the queue is empty, resumed by the second call after the queue is restored', async () => {
  const state = { active: false, cur: undefined };
  const { sleepResume, store, calls } = mk(state);
  store['lf.sleepEnd'] = String(Date.now() + 10 * 60000);
  sleepResume(); await tick();
  assert.equal(calls.length, 0, 'no current song yet: nothing started, saved end time kept');
  assert.ok(store['lf.sleepEnd'], 'saved end time still there');
  state.cur = { id: 'a' };   // restoreSession() put the queue back
  sleepResume(); await tick();
  assert.equal(calls.length, 1); assert.ok(calls[0].minutes >= 9 && calls[0].minutes <= 10, 'minutes left: ' + calls[0].minutes);
  assert.ok(calls[0].ms > 9.9 * 60000 && calls[0].ms <= 10 * 60000, 'exact time left in ms, not rounded to a minute: ' + calls[0].ms);
  sleepResume(); await tick();
  assert.equal(calls.length, 1, 'timer already active: not started twice');
});

test('an expired saved end time is removed and nothing starts', async () => {
  const state = { active: false, cur: { id: 'a' } };
  const { sleepResume, store, calls } = mk(state);
  store['lf.sleepEnd'] = String(Date.now() - 1000);
  sleepResume(); await tick();
  assert.equal(calls.length, 0); assert.equal(store['lf.sleepEnd'], undefined);
});

test('loadLib calls sleepResume right after restoreSession()', () => {
  const s = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(s.includes('await Promise.resolve(restoreSession()).catch(() => {}); sleepResume();'));
});
