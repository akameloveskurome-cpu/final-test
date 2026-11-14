import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchUpdatePic, UPD_DIR } from '../src/updpic.js';

const GIF = new Uint8Array([...'GIF89a'].map(c => c.charCodeAt(0)).concat([1, 0, 1, 0, 0, 0, 0, 0, 0, 0])).buffer;
const mk = (routes, log = []) => async (url) => {
  log.push(url);
  for (const [k, v] of Object.entries(routes)) if (url.includes(k)) return v;
  return { ok: false };
};
const json = o => ({ ok: true, json: async () => o });
const bytes = b => ({ ok: true, arrayBuffer: async () => b });
globalThis.URL.createObjectURL ||= () => 'blob:x';

test('folder name is update-popup-gif-pic (not popup)', () => assert.equal(UPD_DIR, 'update-popup-gif-pic'));
test('no repo configured (local dev): nothing is fetched', async () => {
  assert.equal(await fetchUpdatePic(() => { throw new Error('must not fetch'); }, ''), null);
});
test('reads update-popup-gif-pic/latest.json, then the named picture', async () => {
  const log = [];
  const r = await fetchUpdatePic(mk({ 'latest.json': json({ name: 'my pic.gif', stamp: 'u123' }), 'my%20pic.gif': bytes(GIF) }, log), 'o/r', 'main');
  assert.ok(r && r.src && r.stamp === 'u123');
  assert.ok(log[0].startsWith('https://raw.githubusercontent.com/o/r/main/update-popup-gif-pic/latest.json'));
  assert.ok(log[1].includes('/update-popup-gif-pic/my%20pic.gif?v=u123'));
});
test('same stamp as before: the picture is not downloaded again', async () => {
  const log = [];
  const r = await fetchUpdatePic(mk({ 'latest.json': json({ name: 'a.gif', stamp: 'u9' }) }, log), 'o/r', 'main', 'u9');
  assert.deepEqual(r, { same: true, stamp: 'u9' }); assert.equal(log.length, 1);
});
test('no manifest, bad name, not an image, or offline: null (plain popup)', async () => {
  assert.equal(await fetchUpdatePic(mk({}), 'o/r', 'main'), null);
  assert.equal(await fetchUpdatePic(mk({ 'latest.json': json({ name: '../x.gif' }) }), 'o/r', 'main'), null);
  assert.equal(await fetchUpdatePic(mk({ 'latest.json': json({ name: 'a.gif', stamp: 's' }), 'a.gif': bytes(new Uint8Array([1, 2, 3, 4]).buffer) }), 'o/r', 'main'), null);
  assert.equal(await fetchUpdatePic(async () => { throw new Error('offline'); }, 'o/r', 'main'), null);
});

test('v134: looked at once a second', async () => {
  const m = await import('../src/updpic.js'); assert.equal(m.UPD_PIC_MIN_MS, 1000);
});
test('v134: manifest 404 = no picture in the folder (gone), other errors = null', async () => {
  // BUG #2: gone only while the repo still answers (update/latest.json OK)
  assert.deepEqual(await fetchUpdatePic(async u => (String(u).includes('/update/latest.json') ? { ok: true, status: 200, json: async () => ({}) } : { ok: false, status: 404 }), 'o/r', 'main'), { gone: true });
  assert.equal(await fetchUpdatePic(async () => ({ ok: false, status: 404 }), 'o/r', 'main'), null);
  assert.equal(await fetchUpdatePic(async () => ({ ok: false, status: 503 }), 'o/r', 'main'), null);
});

test('broken image bytes are backed off per stamp instead of downloaded every second', async () => {
  let imageFetches = 0;
  const fetchFn = async url => {
    if (url.includes('latest.json')) return json({ name: 'bad.gif', stamp: 'retry-storm-upd-144' });
    imageFetches++;
    throw new Error('connection reset');
  };
  assert.equal(await fetchUpdatePic(fetchFn, 'o/r', 'main'), null);
  assert.equal(await fetchUpdatePic(fetchFn, 'o/r', 'main'), null);
  assert.equal(imageFetches, 1, 'the one-second poll reads only the manifest during backoff');
});
