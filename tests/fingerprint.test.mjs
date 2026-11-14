import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourceScript = resolve(fileURLToPath(new URL('../scripts/app-fingerprint.py', import.meta.url)));
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || `git ${args.join(' ')} failed`);
  return r.stdout;
};
const put = async (root, name, value) => {
  const p = join(root, name);
  await mkdir(join(p, '..'), { recursive: true });
  await writeFile(p, value);
};
const code = root => {
  const r = spawnSync('python3', ['scripts/app-fingerprint.py'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || 'fingerprint script failed');
  return r.stdout.trim();
};

test('app fingerprint changes for app code, package version and the selected logo (manifest and picture bytes), not live media folders', async t => {
  const root = await mkdtemp(join(tmpdir(), 'liquid-fingerprint-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const appFiles = {
    'src/main.js': 'app source A',
    'native-android/MainActivity.java': 'native A',
    'scripts/build.sh': 'build A',
    'package.json': '{"version":"0.140.0"}',
    'package-lock.json': '{"lockfileVersion":3}',
    'vite.config.js': 'vite A',
    'capacitor.config.json': '{}',
    'index.html': '<html></html>',
    'app-logo-pic/latest.json': '{"name":"logo.png","stamp":"logo-1"}',
    'app-logo-pic/logo.png': 'logo bytes 1',
    'notification-popup-gif-pic/latest.json': '{"name":"notice.gif","stamp":"p1"}',
    'notification-popup-gif-pic/notice.gif': 'notice bytes 1',
    'update-popup-gif-pic/latest.json': '{"name":"update.gif","stamp":"u1"}',
    'update-popup-gif-pic/update.gif': 'update bytes 1',
    'splash-pic/latest.json': '{"name":"splash.gif","stamp":"s1"}',
    'splash-pic/splash.gif': 'splash bytes 1',
    'credit-gif-pic/latest.json': '{"name":"credits.gif","stamp":"c1"}',
    'credit-gif-pic/credits.gif': 'credits bytes 1',
  };
  for (const [name, value] of Object.entries(appFiles)) await put(root, name, value);
  await mkdir(join(root, 'scripts'), { recursive: true });
  await copyFile(sourceScript, join(root, 'scripts/app-fingerprint.py'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Fingerprint test');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'initial');

  const initial = code(root);
  assert.match(initial, /^[0-9a-f]{12}$/);

  // Server artwork (including its latest.json stamps) is live, not APK code.
  for (const folder of ['notification-popup-gif-pic', 'update-popup-gif-pic', 'splash-pic', 'credit-gif-pic', 'background-allow-gif-pic', 'stats-banner-gif-pic']) {
    await put(root, `${folder}/latest.json`, `{"name":"new.gif","stamp":"${folder}-2"}`);
    await put(root, `${folder}/new.gif`, `${folder} new bytes`);
    assert.equal(code(root), initial, `${folder} upload must not trigger an APK install`);
  }

  // The logo is baked into the APK as the launcher icon, so BOTH a new stamp and new bytes of the picture it names rebuild the APK.
  await put(root, 'app-logo-pic/other.png', 'a different picture that latest.json does not name');
  git(root, 'add', '-A');
  assert.equal(code(root), initial, 'a picture the manifest does not select is not baked in, so it does not change the fingerprint');
  await put(root, 'app-logo-pic/logo.png', 'logo bytes 2');
  const logoBytes = code(root);
  assert.notEqual(logoBytes, initial, 'new bytes for the selected logo must trigger an APK build and update');
  await put(root, 'app-logo-pic/latest.json', '{"name":"logo.png","stamp":"logo-2"}');
  const logoUpdate = code(root);
  assert.notEqual(logoUpdate, logoBytes, 'a new latest.json stamp (upload or resend) must trigger an APK build and update');
  await put(root, 'app-logo-pic/latest.json', '{"name":"other.png","stamp":"logo-2"}');
  assert.notEqual(code(root), logoUpdate, 'selecting another picture must trigger an APK build and update');
  await put(root, 'app-logo-pic/latest.json', '{"name":"logo.png","stamp":"logo-2"}');
  assert.equal(code(root), logoUpdate, 'restoring the selection restores the fingerprint');

  await put(root, 'src/main.js', 'app source B');
  assert.notEqual(code(root), logoUpdate, 'any tracked app-code change must trigger an APK update');
  await put(root, 'package.json', '{"version":"0.141.0"}');
  assert.notEqual(code(root), logoUpdate, 'package version/build metadata is also fingerprinted');
});
