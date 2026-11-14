import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBannerPic, BANNER_DIR, BANNER_POLL_MS } from '../src/statbanpic.js';
test('stats-banner picture uses its own folder, 1 s polling and per-stamp downloads', async () => {
  assert.equal(BANNER_DIR, 'stats-banner-gif-pic'); assert.equal(BANNER_POLL_MS, 1000);
  const calls = [];
  const f = async url => { calls.push(url); if (url.includes('latest.json')) return { ok: true, json: async () => ({ name: 'a.gif', stamp: 'b1' }) }; return { ok: true, arrayBuffer: async () => new TextEncoder().encode('GIF89a....').buffer }; };
  globalThis.URL.createObjectURL ??= () => 'blob:x';
  const r = await fetchBannerPic(f, 'o/r', 'main', '');
  assert.equal(r.stamp, 'b1'); assert.ok(calls[0].includes('/stats-banner-gif-pic/latest.json')); assert.ok(calls[1].includes('/stats-banner-gif-pic/a.gif?v=b1'));
  const same = await fetchBannerPic(f, 'o/r', 'main', 'b1'); assert.equal(same.same, true); assert.equal(calls.length, 3);
});
