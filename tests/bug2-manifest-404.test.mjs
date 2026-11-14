// BUG #2: a 404 for a picture manifest is "gone" only while the repo still answers (same guard as splashpic.js, BUG-196).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCreditPic } from '../src/creditpic.js';
import { fetchBgAllowPic } from '../src/bgallowpic.js';
import { fetchBannerPic } from '../src/statbanpic.js';
import { fetchUpdatePic } from '../src/updpic.js';
import { manifest404IsGone } from '../src/picretry.js';

const res = (status, body) => ({ ok: status === 200, status, json: async () => body || {}, arrayBuffer: async () => new ArrayBuffer(0) });
const down = async () => res(404);                                         // wrong branch / private repo / captive page: everything 404s
const emptied = async url => (String(url).includes('/update/latest.json') ? res(200, { code: 'x' }) : res(404));   // repo is fine, only the folder is empty
const offline = async () => { throw new Error('offline'); };

for (const [name, fn] of [['credits', fetchCreditPic], ['background-allow', fetchBgAllowPic], ['stats banner', fetchBannerPic], ['update popup', fetchUpdatePic]]) {
  test(`BUG #2 ${name}: a 404 while the whole repo 404s is NOT "gone"`, async () => {
    assert.equal(await fn(down, 'o/r', 'main', ''), null);
    assert.equal(await fn(offline, 'o/r', 'main', ''), null);
  });
  test(`BUG #2 ${name}: a 404 while the repo still answers IS "gone"`, async () => {
    assert.deepEqual(await fn(emptied, 'o/r', 'main', ''), { gone: true });
  });
}

test('BUG #2 helper: true only when update/latest.json answers OK', async () => {
  assert.equal(await manifest404IsGone(down, 'o/r', 'main'), false);
  assert.equal(await manifest404IsGone(emptied, 'o/r', 'main'), true);
  assert.equal(await manifest404IsGone(offline, 'o/r', 'main'), false);
});

test('BUG #2 app logo: the guard is wired into checkLatestAppLogo (source check; the function needs a DOM)', async () => {
  const { readFileSync } = await import('node:fs');
  const s = readFileSync(new URL('../src/applogo.js', import.meta.url), 'utf8');
  assert.match(s, /if \(m\.status === 404\) \{\s*\n\s*if \(!\(await manifest404IsGone\(fetch, REPO, BRANCH\)\)\) return false;/);
});
