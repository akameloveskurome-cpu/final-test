// BUG-224: behaviour test. probeUrl() from main.js is run against a fake fetch; it must ask for no-store and still report ok / not ok.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const line = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').split('\n').find(l => /^const probeUrl = /.test(l));
const make = fetch => new Function('fetch', `${line}; return probeUrl;`)(fetch);
test('probeUrl asks for no-store', async () => { let opt; const p = make((u, o) => { opt = o; return Promise.resolve({ ok: true, body: { cancel() {} } }); }); assert.equal(await p('x'), true); assert.equal(opt && opt.cache, 'no-store'); });
test('probeUrl false on bad status and on network error', async () => {
  assert.equal(await make(() => Promise.resolve({ ok: false })) ('x'), false);
  assert.equal(await make(() => Promise.reject(new Error('n')))('x'), false);
});
