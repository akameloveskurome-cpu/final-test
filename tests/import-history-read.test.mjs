// BUG-286: a failed read of the existing history must stop the import (real readImportHistory), not look like an empty history.
import test from 'node:test'; import assert from 'node:assert/strict'; import { extract } from './extract.mjs';
const world = reads => { let i = 0; const calls = []; const Native = { getListens: async a => { calls.push(a); const r = reads[Math.min(i++, reads.length - 1)]; if (r instanceof Error) throw r; return r; } }; return { calls, fn: extract('src/main.js', 'readImportHistory', { Native, failMsg: e => e.message }, '}') }; };
test('a good read returns the segments (an empty history is a real, valid answer)', async () => {
  assert.deepEqual(await world([{ segs: [{ s: 1 }] }]).fn(), [{ s: 1 }]);
  assert.deepEqual(await world([{ segs: [] }]).fn(), []);
});
test('one failed read is retried once, then it works', async () => {
  const w = world([new Error('bridge'), { segs: [{ s: 2 }] }]); assert.deepEqual(await w.fn(), [{ s: 2 }]); assert.equal(w.calls.length, 2);
});
test('two failed or malformed reads stop the import with a clear message and write nothing', async () => {
  for (const bad of [new Error('bridge down'), null, {}, { segs: 'x' }]) {
    const w = world([bad]); await assert.rejects(w.fn(), /nothing was imported[\s\S]*try again/); assert.equal(w.calls.length, 2);
  }
});
test('importLs uses it instead of the old catch-to-empty pattern (wiring check)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(src.includes('LIO.playKeysOf(await readImportHistory())')); assert.ok(!/getListens\([^)]*\)\.catch\(\(\) => null\)/.test(src));
});
