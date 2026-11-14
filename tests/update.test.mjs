import test from 'node:test';
import assert from 'node:assert/strict';
import {
  codeIdFromNotes, shaFromNotes, isUpdate, checkUpdate,
  manifestUpdate, pendingUpdateIsInstalled, resetUpdateCache, lastCheckConfirmed,
} from '../src/update.js';

test('release notes helpers read fingerprint, build and checksum safely', () => {
  const notes = 'Built on 2026-11-03. code 0123456789ab. build 1800000100. sha256 ' + 'a'.repeat(64);
  assert.equal(codeIdFromNotes(notes), '0123456789ab');
  assert.equal(shaFromNotes(notes), 'a'.repeat(64));
  assert.equal(codeIdFromNotes('Newest debug APK.'), '');
  assert.equal(codeIdFromNotes(null), '');
  assert.equal(shaFromNotes('sha256 nope'), '');
});

test('fingerprint is primary; Android build number blocks stale offers and same-code rebuilds', () => {
  const m = { id: 'bbbbbbbbbbbb', build: 1800000200 };
  assert.equal(isUpdate('aaaaaaaaaaaa', 1800000100, m), true);   // code changed and build is newer
  assert.equal(isUpdate('bbbbbbbbbbbb', 1800000100, m), false);  // already has exact code, even if metadata says newer
  assert.equal(isUpdate('aaaaaaaaaaaa', 1800000200, m), false);  // stale/equal build cannot be re-offered
  assert.equal(isUpdate('aaaaaaaaaaaa', 0, m), false); // unknown installed build: never infer that any id mismatch is newer
  assert.equal(isUpdate('aaaaaaaaaaaa', 1800000100, { id: 'bbbbbbbbbbbb' }), false); // unknown offered build: not enough evidence
  assert.equal(isUpdate('', 0, m), false);
});

test('pending update gate releases after fingerprint OR Android build confirms installation', () => {
  const g = { id: 'bbbbbbbbbbbb', build: 1800000200 };
  assert.equal(pendingUpdateIsInstalled(g, 'bbbbbbbbbbbb', 1800000100), true);
  assert.equal(pendingUpdateIsInstalled(g, 'aaaaaaaaaaaa', 1800000200), true);
  assert.equal(pendingUpdateIsInstalled(g, 'aaaaaaaaaaaa', 1800000199), false);
  assert.equal(pendingUpdateIsInstalled({ id: 'bbbbbbbbbbbb' }, 'aaaaaaaaaaaa', 0), false);
  assert.equal(pendingUpdateIsInstalled({ id: 'bbbbbbbbbbbb' }, 'bbbbbbbbbbbb', 0), true);
});

test('dev build (no repo / no id): never checks', async () => {
  assert.equal(await checkUpdate(() => { throw new Error('must not fetch'); }), null);
});

const res = (ok, body, status = ok ? 200 : 404) => ({ ok, status, json: async () => body, headers: { get: () => '' } });
const O = { repo: 'o/r', branch: 'main', myId: 'aaaaaaaaaaaa' };
const SHA = 'c'.repeat(64);

test('manifestUpdate validates fingerprint, build, APK name and optional SHA-256', () => {
  assert.deepEqual(manifestUpdate({ code: 'bbbbbbbbbbbb' }), { id: 'bbbbbbbbbbbb', apk: 'liquid-dark.apk' });
  assert.deepEqual(manifestUpdate({ code: 'BBBBBBBBBBBB', apk: 'x.apk', vcode: 1800000100, sha256: SHA.toUpperCase() }), { id: 'bbbbbbbbbbbb', apk: 'x.apk', build: 1800000100, sha256: SHA });
  for (const j of [null, {}, { code: 'xyz' }, { code: 5 }, { code: 'BBBBBBBBBBBZ' }]) assert.equal(manifestUpdate(j), null);
  assert.equal(manifestUpdate({ code: 'bbbbbbbbbbbb', apk: '../evil' }).apk, 'liquid-dark.apk');
  assert.equal('sha256' in manifestUpdate({ code: 'bbbbbbbbbbbb', sha256: 'bad' }), false);
  assert.equal('build' in manifestUpdate({ code: 'bbbbbbbbbbbb', vcode: 2147483647 }), false);
});

test('checkUpdate returns the fingerprinted APK URL and exact build/checksum metadata', async () => {
  resetUpdateCache(); const calls = [];
  const apk = 'liquid-dark-bbbbbbbbbbbb-1800000200.apk';
  const f = async (url, opts) => { calls.push([url, opts]); return res(true, { code: 'bbbbbbbbbbbb', apk, vcode: 1800000200, sha256: SHA }); };
  const u = await checkUpdate(f, { ...O, myBuild: 1800000100 });
  assert.deepEqual(u, {
    url: `https://github.com/o/r/releases/download/latest/${apk}?code=bbbbbbbbbbbb&build=1800000200`,
    id: 'bbbbbbbbbbbb', name: apk, build: 1800000200, sha256: SHA,
  });
  assert.ok(calls.every(([url]) => url.startsWith('https://raw.githubusercontent.com/')));
  assert.equal(calls[0][1].cache, 'no-store');
});

test('same fingerprint means up to date even if manifest build is newer', async () => {
  resetUpdateCache();
  assert.equal(await checkUpdate(async () => res(true, { code: 'aaaaaaaaaaaa', vcode: 1800000200 }), { ...O, myBuild: 1800000100 }), null);
});

test('stale manifest (different id but already-installed build) is not offered', async () => {
  resetUpdateCache();
  assert.equal(await checkUpdate(async () => res(true, { code: 'bbbbbbbbbbbb', vcode: 1800000100 }), { ...O, myBuild: 1800000100 }), null);
});

test('checkUpdate: temporary failure keeps the last answer, never throws', async () => {
  resetUpdateCache();
  await checkUpdate(async () => res(true, { code: 'bbbbbbbbbbbb', vcode: 1800000200 }), { ...O, myBuild: 1800000100 });
  assert.equal((await checkUpdate(async () => res(false, null, 503), { ...O, myBuild: 1800000100 })).id, 'bbbbbbbbbbbb');
  assert.equal((await checkUpdate(async () => { throw new Error('offline'); }, { ...O, myBuild: 1800000100 })).id, 'bbbbbbbbbbbb');
});

test('no manifest yet (404) -> release notes fallback reads build + checksum', async () => {
  resetUpdateCache(); let api = 0;
  const f = async url => {
    if (url.includes('api.github.com')) {
      api++;
      return res(true, { body: `code bbbbbbbbbbbb build 1800000200 sha256 ${SHA}`, assets: [{ name: 'liquid-dark-bbbbbbbbbbbb-1800000200.apk', browser_download_url: 'https://x/immutable.apk' }, { name: 'liquid-dark.apk', browser_download_url: 'https://x/liquid-dark.apk' }] });
    }
    return res(false, null, 404);
  };
  const u = await checkUpdate(f, { ...O, myBuild: 1800000100 });
  assert.equal(u.url, `https://x/liquid-dark.apk?code=bbbbbbbbbbbb&build=1800000200`);
  assert.equal(u.sha256, SHA);
  await checkUpdate(f, { ...O, myBuild: 1800000100 }); await checkUpdate(f, { ...O, myBuild: 1800000100 });
  assert.equal(api, 1, 'the API is not polled');
});

test('lastCheckConfirmed is true only when GitHub really answered (offline never ends the mandatory update)', async () => {
  const { lastCheckConfirmed } = await import('../src/update.js');
  resetUpdateCache();
  await checkUpdate(async () => res(true, { code: 'aaaaaaaaaaaa' }), O);
  assert.equal(lastCheckConfirmed(), true);
  resetUpdateCache();
  await checkUpdate(async () => { throw new Error('offline'); }, O);
  assert.equal(lastCheckConfirmed(), false);
});

test('v148: a blocked manifest request (thrown error) still checks the GitHub release', async () => {
  resetUpdateCache();
  const f = async url => {
    if (url.includes('raw.githubusercontent.com')) throw new TypeError('Failed to fetch');
    return res(true, { body: `code bbbbbbbbbbbb build 1800000200 sha256 ${SHA}`, assets: [{ name: 'liquid-dark.apk', browser_download_url: 'https://x/liquid-dark.apk' }] });
  };
  const u = await checkUpdate(f, { ...O, myBuild: 1800000100 });
  assert.equal(u.id, 'bbbbbbbbbbbb');
});
test('v148: the manifest request sends no custom header (no CORS preflight)', async () => {
  resetUpdateCache(); let init;
  await checkUpdate(async (url, i) => { init = i; return res(true, { code: 'aaaaaaaaaaaa', vcode: 1800000200 }); }, { ...O, myBuild: 1800000100 });
  assert.equal(init.headers, undefined);
});

test('v148 fix: the manifest request sends no custom header, and a thrown manifest request falls back to the release notes', async () => {
  resetUpdateCache(); const seen = [];
  const f = async (url, opt) => {
    seen.push([url, opt]);
    if (url.includes('raw.githubusercontent')) throw new TypeError('Failed to fetch');   // what a blocked CORS preflight looks like
    return res(true, { body: `code bbbbbbbbbbbb build 1800000200 sha256 ${SHA}`, assets: [{ name: 'liquid-dark.apk', browser_download_url: 'https://x/liquid-dark.apk' }] });
  };
  const u = await checkUpdate(f, { ...O, myBuild: 1800000100 });
  assert.equal(u && u.id, 'bbbbbbbbbbbb');
  assert.equal(seen[0][1].headers, undefined);
  assert.equal(lastCheckConfirmed(), true);
});
