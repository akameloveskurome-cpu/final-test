import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCreditPic, CREDIT_DIR, CREDIT_POLL_MS } from '../src/creditpic.js';

const GIF = new Uint8Array([...'GIF89a'].map(c => c.charCodeAt(0)).concat([1, 0, 1, 0, 0, 0, 0, 0, 0, 0])).buffer;
const json = body => ({ ok: true, json: async () => body });
const bytes = body => ({ ok: true, arrayBuffer: async () => body });
globalThis.URL.createObjectURL ||= () => 'blob:credit';

test('Credits artwork uses the separate credit-gif-pic folder and one-second polling', () => {
  assert.equal(CREDIT_DIR, 'credit-gif-pic');
  assert.equal(CREDIT_POLL_MS, 1000);
});

test('fetchCreditPic reads its manifest and downloads the named GIF', async () => {
  const calls = [];
  const fetchFn = async url => {
    calls.push(url);
    if (url.includes('latest.json')) return json({ name: 'credits.gif', stamp: 'c123' });
    if (url.includes('/credits.gif')) return bytes(GIF);
    return { ok: false, status: 404 };
  };
  const r = await fetchCreditPic(fetchFn, 'owner/repo', 'main');
  assert.ok(r && r.src);
  assert.equal(r.stamp, 'c123');
  assert.ok(calls[0].includes('/credit-gif-pic/latest.json'));
  assert.ok(calls[1].includes('/credit-gif-pic/credits.gif?v=c123'));
});

test('fetchCreditPic skips re-downloading an unchanged stamp and handles removal', async () => {
  let count = 0;
  const same = await fetchCreditPic(async () => { count++; return json({ name: 'credits.gif', stamp: 'c1' }); }, 'owner/repo', 'main', 'c1');
  assert.deepEqual(same, { same: true, stamp: 'c1' });
  assert.equal(count, 1);
  // BUG #2: gone only while the repo still answers (update/latest.json OK); an all-404 repo is not "gone"
  assert.deepEqual(await fetchCreditPic(async u => (String(u).includes('/update/latest.json') ? { ok: true, status: 200, json: async () => ({}) } : { ok: false, status: 404 }), 'owner/repo', 'main'), { gone: true });
  assert.equal(await fetchCreditPic(async () => ({ ok: false, status: 404 }), 'owner/repo', 'main'), null);
});

test('unreadable Credits asset is not re-downloaded every second for the same stamp', async () => {
  let imageFetches = 0;
  const f = async url => {
    if (url.includes('latest.json')) return { ok: true, json: async () => ({ name: 'broken.png', stamp: 'retry-storm-credit-144' }) };
    imageFetches++;
    throw new Error('connection reset');
  };
  assert.equal(await fetchCreditPic(f, 'o/r', 'main'), null);
  assert.equal(await fetchCreditPic(f, 'o/r', 'main'), null);
  assert.equal(imageFetches, 1);
});
