import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { packBlob, unpackBlob, isLegacy } from '../src/blobsafe.js';
test('a picture is stored as bytes and comes back as the same Blob', async () => {
  const f = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/gif' });
  const v = await packBlob(f); assert.equal(v.__lfb, 1); assert.ok(v.buf instanceof ArrayBuffer);
  const b = unpackBlob(v); assert.equal(b.type, 'image/gif'); assert.deepEqual([...new Uint8Array(await b.arrayBuffer())], [1, 2, 3, 4]);
});
test('old entries (a Blob) still load and are flagged for rewriting; junk gives null', () => {
  const old = new Blob(['x'], { type: 'image/png' }); assert.equal(unpackBlob(old), old); assert.equal(isLegacy(old), true);
  assert.equal(unpackBlob(null), null); assert.equal(unpackBlob({}), null);
});
// Minimal fake IndexedDB: stores values exactly as given (no structured clone), so we see what each store really writes.
const fakeIdb = (store, dump) => ({ open: () => { const r = {}; setTimeout(() => { const kv = new Map(); dump.map = kv; r.result = { createObjectStore() {}, close() {}, transaction: () => { const t = {}; const os = { get: k => { const q = { result: kv.get(k) }; setTimeout(() => t.oncomplete && t.oncomplete()); return q; }, put: (v, k) => { kv.set(k, v); const q = { result: k }; setTimeout(() => t.oncomplete && t.oncomplete()); return q; }, delete: k => { kv.delete(k); setTimeout(() => t.oncomplete && t.oncomplete()); return {}; } }; t.objectStore = () => os; return t; } }; r.onupgradeneeded && r.onupgradeneeded(); r.onsuccess && r.onsuccess(); }); return r; } });
test('playlist-picture and background stores keep bytes (not a Blob), and the same Blob comes back; a legacy Blob entry is rewritten as bytes', async () => {
  globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };
  for (const [mod, key, args] of [['../src/plpics.js', 'p1', id => [id]], ['../src/bgmedia.js', 'media', () => []]]) {
    const { idbBackend } = await import(mod), dump = {}, be = idbBackend(fakeIdb(null, dump));
    const blob = new Blob([new Uint8Array([9, 8, 7])], { type: 'image/gif' });
    await be.put(...(key === 'media' ? [blob] : ['p1', blob]));
    const stored = dump.map.get(key); assert.equal(stored.__lfb, 1, mod); assert.ok(stored.buf instanceof ArrayBuffer, mod);
    const got = await be.get(...args('p1')); assert.equal(got.type, 'image/gif'); assert.deepEqual([...new Uint8Array(await got.arrayBuffer())], [9, 8, 7]);
    dump.map.set(key, new Blob(['x'], { type: 'image/png' }));   // legacy entry
    assert.ok(await be.get(...args('p1'))); await new Promise(r => setTimeout(r, 30)); assert.equal(dump.map.get(key).__lfb, 1, mod + ' legacy rewritten');
  }
});
// main.js (album store, repaintAll, restorePics wiring) can only be checked by running the app: kept as a shape guard.
test('guard: album store keeps bytes, failed reads keep the marker, repaintAll repaints mini + Now Playing', () => {
  const m = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(m.includes('packBlob(b).then(v => tx(')); assert.ok(!/delete m\[id\]; alpSave\(m\); return 0/.test(m), 'album marker must not be deleted on a failed read');
  assert.match(m, /function repaintAll\(\) \{[\s\S]*?renderMini\(\)[\s\S]*?renderNP\(\)[\s\S]*?renderMain\(\)/); assert.match(m, /restorePics\(Object\.keys\(alpMap\(\)\), alDb, alpSet, 12, 'lf-albumpics'/);
});
