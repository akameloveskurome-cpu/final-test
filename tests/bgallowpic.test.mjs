import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBgAllowPic, BGALLOW_DIR, BGALLOW_POLL_MS } from '../src/bgallowpic.js';
test('background-allow picture uses its own folder, 1 s polling and per-stamp downloads', async () => {
  assert.equal(BGALLOW_DIR, 'background-allow-gif-pic'); assert.equal(BGALLOW_POLL_MS, 1000);
  const calls = [];
  const f = async url => { calls.push(url); if (url.includes('latest.json')) return { ok: true, json: async () => ({ name: 'a.gif', stamp: 'b1' }) }; return { ok: true, arrayBuffer: async () => new TextEncoder().encode('GIF89a....').buffer }; };
  globalThis.URL.createObjectURL ??= () => 'blob:x';
  const r = await fetchBgAllowPic(f, 'o/r', 'main', '');
  assert.equal(r.stamp, 'b1'); assert.ok(calls[0].includes('/background-allow-gif-pic/latest.json')); assert.ok(calls[1].includes('/background-allow-gif-pic/a.gif?v=b1'));
  const same = await fetchBgAllowPic(f, 'o/r', 'main', 'b1'); assert.equal(same.same, true); assert.equal(calls.length, 3);
});
