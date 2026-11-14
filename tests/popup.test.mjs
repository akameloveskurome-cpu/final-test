import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, fetchPopupPic, popupUrl, sniffType, imageNames, manifestName, manifestStamp, peekManifest } from '../src/popup.js';

test('fingerprint: same bytes = same hash, different bytes = different hash', async () => {
  const a = new Uint8Array([1, 2, 3]).buffer, b = new Uint8Array([1, 2, 4]).buffer;
  assert.equal(await fingerprint(a), await fingerprint(new Uint8Array([1, 2, 3]).buffer));
  assert.notEqual(await fingerprint(a), await fingerprint(b));
});
test('no repo configured (local dev): nothing is fetched', async () => {
  assert.equal(popupUrl(), '');
  assert.equal(await fetchPopupPic(() => { throw new Error('must not fetch'); }), null);
});
test('sniffType: gif / png / jpg / webp / bmp by content, unknown = empty', () => {
  const b = a => new Uint8Array([...a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).buffer;
  assert.equal(sniffType(b([...'GIF89a'].map(c => c.charCodeAt(0)))), 'image/gif');
  assert.equal(sniffType(b([0x89, 0x50, 0x4e, 0x47])), 'image/png');
  assert.equal(sniffType(b([0xff, 0xd8, 0xff])), 'image/jpeg');
  assert.equal(sniffType(b([..."RIFF....WEBP"].map(c => c.charCodeAt(0)))), 'image/webp');
  assert.equal(sniffType(b([0x42, 0x4d, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/bmp');   // BUG-42: needs a real DIB header
  assert.equal(sniffType(b([0x42, 0x4d, 0x00, 0x00])), '');
  assert.equal(sniffType(b([1, 2, 3])), '');
});
test('imageNames: any picture file name, files only', () => {
  const l = [{ name: 'my cat.PNG', type: 'file' }, { name: 'x.gif', type: 'file' }, { name: 'notes.txt', type: 'file' }, { name: 'sub.png', type: 'dir' }, { name: 'a.webp', type: 'file' }, { name: 'cover.bmp', type: 'file' }];
  assert.deepEqual(imageNames(l), ['my cat.PNG', 'x.gif', 'a.webp', 'cover.bmp']);
  assert.deepEqual(imageNames({ message: 'rate limit' }), []);
});
test('popFit: aspect ratio + natural width, unusable sizes = null', async () => {
  const { popFit } = await import('../src/popup.js');
  assert.deepEqual(popFit(300, 150), { ar: 2, nw: 300 });
  assert.deepEqual(popFit(100, 400), { ar: 0.25, nw: 100 });
  for (const [w, h] of [[0, 10], [10, 0], [-1, 5], [NaN, 5], [5, Infinity], [undefined, undefined]]) assert.equal(popFit(w, h), null);
});
test('manifestName: only a plain picture file name is accepted', () => {
  assert.equal(manifestName({ name: 'new pic.GIF' }), 'new pic.GIF');
  for (const j of [null, {}, { name: 5 }, { name: 'notes.txt' }, { name: '../x.png' }, { name: 'a/b.png' }]) assert.equal(manifestName(j), '');
});

// v122: a manifest that names a missing file is no longer a dead end
const gifBytes = () => new Uint8Array([...'GIF89a'].map(c => c.charCodeAt(0)).concat([1, 2, 3, 4, 5, 6])).buffer;
const res = (ok, body) => ({ ok, json: async () => body, arrayBuffer: async () => body });
globalThis.URL.createObjectURL ??= () => 'blob:test';
test('fetchPopupPic: manifest names a picture that is not readable yet -> null, NO older picture, NO API calls', async () => {
  const calls = [];
  const f = async url => {
    calls.push(url);
    if (url.includes('latest.json')) return res(true, { name: 'new.gif', stamp: 's1' });
    if (url.includes('/notification-popup-gif-pic/new.gif')) return res(false, null);
    if (url.includes('api.github.com')) return res(true, [{ name: 'old.gif', type: 'file' }]);
    if (url.includes('/notification-popup-gif-pic/old.gif') || url.includes('/notification-popup-gif-pic/character.gif')) return res(true, gifBytes());
    return res(false, null);
  };
  assert.equal(await fetchPopupPic(f, 'o/r', 'main'), null);
  assert.ok(!calls.some(u => u.includes('api.github.com') || u.includes('old.gif') || u.includes('character.')));
});
test('fetchPopupPic: no manifest at all -> folder listing still works', async () => {
  const f = async url => {
    if (url.includes('latest.json')) return res(false, null);
    if (url.includes('api.github.com') && url.includes('/contents/notification-popup-gif-pic')) return res(true, [{ name: 'real.gif', type: 'file' }]);
    if (url.includes('/notification-popup-gif-pic/real.gif')) return res(true, gifBytes());
    return res(false, null);
  };
  assert.ok((await fetchPopupPic(f, 'o/r', 'main')).hash);
});
test('fetchPopupPic: a manifest handed in by the caller is not read again; the stamp is the cache key', async () => {
  const calls = [];
  const f = async url => { calls.push(url); return url.includes('/notification-popup-gif-pic/a.gif') ? res(true, gifBytes()) : res(false, null); };
  const p = await fetchPopupPic(f, 'o/r', 'main', { name: 'a.gif', stamp: 'r9-1' });
  assert.ok(p && p.id.endsWith('.r9-1'));
  assert.equal(calls.length, 1);
  assert.ok(calls[0].endsWith('/notification-popup-gif-pic/a.gif?v=r9-1'));
});
test('fetchPopupPic: no manifest, API rate limited -> guessed names', async () => {
  const f = async url => (url.includes('/notification-popup-gif-pic/character.gif') ? res(true, gifBytes()) : res(false, null));
  assert.ok(await fetchPopupPic(f, 'o/r', 'main'));
});
test('fetchPopupPic: nothing reachable -> null, never throws', async () => {
  assert.equal(await fetchPopupPic(async () => { throw new Error('offline'); }, 'o/r', 'main'), null);
});

// v123: the same picture sent again (same bytes) must show the popup again: the upload stamp is part of what "seen" means
test('manifestStamp: plain token only', () => {
  assert.equal(manifestStamp({ stamp: 'r123-1' }), 'r123-1');
  for (const j of [null, {}, { stamp: 5 }, { stamp: '' }, { stamp: 'a b' }, { stamp: '../x' }]) assert.equal(manifestStamp(j), '');
});
test('fetchPopupPic: same bytes, new stamp -> different id (popup shows again); same stamp -> same id', async () => {
  const mk = stamp => async url => (url.includes('latest.json') ? res(true, { name: 'a.gif', stamp }) : url.includes('/notification-popup-gif-pic/a.gif') ? res(true, gifBytes()) : res(false, null));
  const a = await fetchPopupPic(mk('r1-1'), 'o/r', 'main'), b = await fetchPopupPic(mk('r2-1'), 'o/r', 'main'), c = await fetchPopupPic(mk('r1-1'), 'o/r', 'main');
  assert.equal(a.hash, b.hash, 'same picture bytes');
  assert.notEqual(a.id, b.id, 'a new send has a new id');
  assert.equal(a.id, c.id, 'no new send = same id');
});
test('fetchPopupPic: old manifest without stamp -> id is just the hash (nobody re-sees an old picture)', async () => {
  const f = async url => (url.includes('latest.json') ? res(true, { name: 'a.gif' }) : url.includes('/notification-popup-gif-pic/a.gif') ? res(true, gifBytes()) : res(false, null));
  const p = await fetchPopupPic(f, 'o/r', 'main'); assert.equal(p.id, p.hash);
});
test('peekManifest: name + stamp, null when unreachable', async () => {
  assert.deepEqual(await peekManifest(async () => res(true, { name: 'a.gif', stamp: 'x1' }), 'o/r', 'main'), { name: 'a.gif', stamp: 'x1' });
  assert.equal(await peekManifest(async () => { throw new Error('offline'); }, 'o/r', 'main'), null);
  assert.equal(await peekManifest(async () => res(false, null), 'o/r', 'main'), null);
});

// BUG-041: without a manifest the GitHub API fallback is cached for 10 minutes and stops after a rate limit (was: 1 + N calls on every check).
test('BUG-041: the folder-listing fallback is cached, and a 429 stops all API calls for a while', async () => {
  const { resetApiCache } = await import('../src/popup.js');
  const calls = { api: 0 };
  const mk = status => async url => {
    const u = String(url);
    if (u.includes('latest.json')) return { ok: false, status: 404 };
    if (u.includes('api.github.com')) { calls.api++; if (status === 429) return { ok: false, status: 429, json: async () => ({}) }; return u.includes('/contents/') ? { ok: true, status: 200, json: async () => [{ name: 'a.png', type: 'file' }, { name: 'b.png', type: 'file' }] } : { ok: true, status: 200, json: async () => [{ commit: { committer: { date: '2026-01-01T00:00:00Z' } } }] }; }
    return { ok: false, status: 404 };   // the pictures themselves: not needed here
  };
  resetApiCache();
  await fetchPopupPic(mk(200), 'o/r', 'main');
  const first = calls.api; assert.equal(first, 3, 'one listing + two commit lookups the first time');
  await fetchPopupPic(mk(200), 'o/r', 'main');
  assert.equal(calls.api, first, 'the second check uses the cache: no new API call');
  resetApiCache(); calls.api = 0;
  await fetchPopupPic(mk(429), 'o/r', 'main');
  const limited = calls.api; assert.equal(limited, 1, 'a 429 on the listing stops there');
  await fetchPopupPic(mk(429), 'o/r', 'main');
  assert.equal(calls.api, limited, 'after a rate limit no API call is made for 10 minutes');
  resetApiCache();
});
