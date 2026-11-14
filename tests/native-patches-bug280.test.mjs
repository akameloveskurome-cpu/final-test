// BUG-280: behaviour tests. Run install-native.sh on a fake generated android/ project; a missing patch must fail the run.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
function project() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lf280-'));
  for (const n of ['native-android', 'scripts']) fs.symlinkSync(path.join(root, n), path.join(d, n));
  fs.copyFileSync(path.join(root, 'package.json'), path.join(d, 'package.json'));
  const m = path.join(d, 'android/app/src/main'); fs.mkdirSync(path.join(m, 'res/values'), { recursive: true });
  fs.writeFileSync(path.join(m, 'AndroidManifest.xml'), '<?xml version="1.0"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n<application android:label="x"><activity android:name=".MainActivity"/></application>\n</manifest>\n');
  fs.writeFileSync(path.join(m, 'res/values/styles.xml'), '<resources><style name="AppTheme.NoActionBarLaunch" parent="x"><item name="android:background">@drawable/splash</item></style></resources>');
  fs.writeFileSync(path.join(d, 'android/app/build.gradle'), 'android { defaultConfig { versionCode 1\n versionName "1.0" } }\ndependencies {\n}\n');
  return d;
}
const run = (d, script, env = {}) => spawnSync('bash', ['-c', script], { cwd: d, encoding: 'utf8', env: { ...process.env, LF_VERSION_CODE: '77', ...env } });
test('all patches apply: install-native.sh succeeds and verifier passes', () => {
  const d = project(), r = run(d, 'bash scripts/install-native.sh');
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /patches verified/);
});
test('a patch that did not apply fails the build with a clear message', () => {
  const d = project(); assert.equal(run(d, 'bash scripts/install-native.sh').status, 0);
  const mf = path.join(d, 'android/app/src/main/AndroidManifest.xml');
  fs.writeFileSync(mf, fs.readFileSync(mf, 'utf8').replace(/<service[^>]*PlaybackService[\s\S]*?<\/service>/, ''));
  const r = run(d, 'python3 scripts/verify-native-patches.py'); assert.equal(r.status, 1); assert.match(r.stderr, /PlaybackService/);
});
test('missing permission, splash theme, gradle dependency and copied resource each fail', () => {
  const base = project(); assert.equal(run(base, 'bash scripts/install-native.sh').status, 0);
  const cases = [
    ['app/src/main/AndroidManifest.xml', s => s.replace(/<uses-permission android:name="android.permission.WAKE_LOCK"\/>/, ''), /WAKE_LOCK/],
    ['app/src/main/res/values/styles.xml', s => s.replaceAll('lf_black', 'x'), /splash/],
    ['app/build.gradle', s => s.replaceAll('media3-session', 'x'), /media3-session/],
    ['app/src/main/AndroidManifest.xml', s => s.replaceAll('androidx.core.content.FileProvider', 'x'), /FileProvider/],
  ];
  for (const [f, fn, re] of cases) {
    const p = path.join(base, 'android', f), orig = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, fn(orig));
    const r = run(base, 'python3 scripts/verify-native-patches.py'); assert.equal(r.status, 1, f); assert.match(r.stderr, re); fs.writeFileSync(p, orig);
  }
  const res = path.join(base, 'android/app/src/main/res/xml/file_paths.xml'); fs.rmSync(res);
  assert.equal(run(base, 'python3 scripts/verify-native-patches.py').status, 1);
});
test('a project with no manifest at all stops install-native.sh', () => {
  const d = project(); fs.rmSync(path.join(d, 'android/app/src/main/AndroidManifest.xml'));
  assert.notEqual(run(d, 'bash scripts/install-native.sh').status, 0);
});
