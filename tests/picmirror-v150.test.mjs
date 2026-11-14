import test from 'node:test'; import assert from 'node:assert/strict'; 
import { useMirror, mirrorPut, mirrorGet, mirrorHas, mirrorDel, mirrorKeys, nameOf, keyOfName } from '../src/picmirror.js';
const fake = () => { const files = new Map(), parts = new Map(); return { files, calls: [],
  putPic(a) { this.calls.push(a); const cur = (a.append ? parts.get(a.name) || '' : '') + a.base64; parts.set(a.name, cur); if (a.done) { files.set(a.name, { ext: a.ext, b64: cur }); parts.delete(a.name); return Promise.resolve({ path: '/f/' + a.name + '.' + a.ext }); } return Promise.resolve({}); },
  picPath: a => Promise.resolve(files.has(a.name) ? { path: '/f/' + a.name + '.' + files.get(a.name).ext } : {}), delPic(a) { files.delete(a.name); return Promise.resolve(); },
  listPics: () => Promise.resolve({ names: [...files.keys()] }), url: p => 'file://' + p }; };
test('no native part: everything quietly does nothing', async () => { useMirror(null); assert.equal(await mirrorPut('a:1', new Blob(['x'])), false); assert.equal(await mirrorGet('a:1'), null); assert.deepEqual(await mirrorKeys('a:'), []); });
test('names round-trip, also with non-latin keys; long keys still get a valid name', () => {
  for (const k of ['lf-albumpics:42', 'lf-genrepics:Hip-Hop/Rap', 'lf-artistgifs:ザ・ウィークエンド']) { const n = nameOf(k); assert.match(n, /^[a-z0-9]{1,120}$/); assert.equal(keyOfName(n), k); }
  const long = 'lf-artistgifs:' + 'x'.repeat(300); assert.match(nameOf(long), /^[a-z0-9]{1,120}$/); assert.equal(nameOf(long), nameOf(long));
});
test('a big picture is sent in pieces, the last one marked done; keys can be listed; delete removes it', async () => {
  const P = fake(); useMirror(P); const big = new Blob([new Uint8Array(2_000_000).fill(7)], { type: 'image/gif' });
  assert.ok(await mirrorPut('lf-albumpics:9', big));
  assert.ok(P.calls.length >= 2); assert.equal(P.calls.filter(c => c.done).length, 1); assert.equal(P.calls[0].append, false); assert.ok(P.calls.slice(1).every(c => c.append)); assert.equal(P.calls[0].ext, 'gif');
  assert.equal(await mirrorHas('lf-albumpics:9'), true); assert.deepEqual(await mirrorKeys('lf-albumpics:'), ['lf-albumpics:9']); assert.deepEqual(await mirrorKeys('lf-genrepics:'), []);
  assert.equal(await mirrorDel('lf-albumpics:9'), true); assert.equal(await mirrorHas('lf-albumpics:9'), false); useMirror(null);
});
test('first-frame list: a saved copy is known instantly (no waiting), forgotten on delete, and found again for copies made by an older version', async () => {
  const mem = new Map(); globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  try {
    const P = fake(); useMirror(P);
    const { mirrorUrlSync, mirrorSyncKeys, mirrorForget } = await import('../src/picmirror.js');
    assert.equal(mirrorUrlSync('lf-albumpics:5'), '');
    await mirrorPut('lf-albumpics:5', new Blob(['abc'], { type: 'image/png' }));
    assert.equal(mirrorUrlSync('lf-albumpics:5'), 'file:///f/' + nameOf('lf-albumpics:5') + '.png');
    assert.deepEqual(mirrorSyncKeys('lf-albumpics:'), ['lf-albumpics:5']);
    mem.clear(); assert.equal(mirrorUrlSync('lf-albumpics:5'), '');   // list lost / older version: the file is still there
    assert.equal(await mirrorHas('lf-albumpics:5'), true); assert.ok(mirrorUrlSync('lf-albumpics:5'));   // looking for it fills the list again
    mirrorForget('lf-albumpics:5'); assert.equal(mirrorUrlSync('lf-albumpics:5'), '');
    await mirrorPut('lf-genrepics:Pop', new Blob(['x'], { type: 'image/gif' })); await mirrorDel('lf-genrepics:Pop'); assert.equal(mirrorUrlSync('lf-genrepics:Pop'), '');
  } finally { useMirror(null); delete globalThis.localStorage; }
});
