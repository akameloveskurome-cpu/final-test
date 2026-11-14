// BUG-362: behaviour tests. restoreGate() driven with a fake persistent store and a fake localStorage.
import test from 'node:test'; import assert from 'node:assert/strict';
import { restoreGate } from '../src/updgate.js';
const KEY = 'lf.updGate';
const fakes = (saved, ls0 = {}, o = {}) => {
  const data = new Map(saved === undefined ? [] : [['updgate', saved]]), ls = new Map(Object.entries(ls0)), sets = [];
  return { data, ls, sets, d: { isNative: true, key: KEY, myCodeId: 'abc', getInstalledBuild: async () => 5,
    isInstalled: (g, code, ib) => Number(g.build) <= ib,
    store: { get: async k => (data.has(k) ? data.get(k) : null), set: async (k, v) => { sets.push([k, v]); data.set(k, v); } },
    ls: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) }, ...o } };
};
const tick = () => new Promise(r => setTimeout(r, 0));
test('already-installed gate is deleted from the persistent store and from localStorage', async () => {
  const f = fakes({ id: 'u1', build: 5 }, { [KEY]: '{"id":"old"}' });
  assert.equal(await restoreGate(f.d), null); await tick(); assert.equal(f.data.get('updgate'), null); assert.equal(f.ls.has(KEY), false);
});
test('junk gate (no build number) is deleted from the persistent store', async () => {
  const f = fakes({ id: 'u1' }); assert.equal(await restoreGate(f.d), null); await tick(); assert.equal(f.data.get('updgate'), null);
});
test('a pending update that is not installed yet is returned (locks the app) and stays saved', async () => {
  const f = fakes({ id: 'u2', build: 9 }); const g = await restoreGate(f.d); assert.equal(g.id, 'u2'); assert.deepEqual(f.data.get('updgate'), { id: 'u2', build: 9 }); assert.equal(f.sets.length, 0);
});
test('build without a code id: gate is not judged, the saved record is left alone', async () => {
  const f = fakes({ id: 'u1', build: 5 }, { [KEY]: 'x' }, { myCodeId: '' }); assert.equal(await restoreGate(f.d), null); await tick();
  assert.equal(f.sets.length, 0); assert.deepEqual(f.data.get('updgate'), { id: 'u1', build: 5 });
});
test('old localStorage gate is migrated once into the store, then retired', async () => {
  const f = fakes(undefined, { [KEY]: JSON.stringify({ id: 'u3', build: 8 }) }); const g = await restoreGate(f.d);
  assert.equal(g.id, 'u3'); assert.deepEqual(f.data.get('updgate'), { id: 'u3', build: 8 }); assert.equal(f.ls.has(KEY), false);
});
test('not native or nothing saved: nothing happens', async () => {
  assert.equal(await restoreGate({ ...fakes({ id: 'u', build: 9 }).d, isNative: false }), null);
  const f = fakes(undefined); assert.equal(await restoreGate(f.d), null); assert.equal(f.sets.length, 0);
});
