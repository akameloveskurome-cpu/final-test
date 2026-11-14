// BUG-394: behaviour tests. The real UpdateSupport.java / UpdateGeneration.java are compiled against tiny Android stubs and run; install-native.sh is run on a fake project.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import crypto from 'node:crypto'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { UPDATE_POLL_MS } from '../src/update.js';
import { hasJava, run } from './update-java-harness.mjs';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url))), skip = !hasJava && 'no java in this environment';
const SHA = 'a'.repeat(64), SHA2 = 'b'.repeat(64), B = 1700000001, B2 = 1700000002;

function project() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lf394bg-'));
  for (const n of ['native-android', 'scripts']) fs.symlinkSync(path.join(root, n), path.join(d, n));
  fs.copyFileSync(path.join(root, 'package.json'), path.join(d, 'package.json'));
  const m = path.join(d, 'android/app/src/main'); fs.mkdirSync(path.join(m, 'res/values'), { recursive: true });
  fs.writeFileSync(path.join(m, 'AndroidManifest.xml'), '<?xml version="1.0"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n<application android:label="x"><activity android:name=".MainActivity"/></application>\n</manifest>\n');
  fs.writeFileSync(path.join(m, 'res/values/styles.xml'), '<resources><style name="AppTheme.NoActionBarLaunch" parent="x"><item name="android:background">@drawable/splash</item></style></resources>');
  fs.writeFileSync(path.join(d, 'android/app/build.gradle'), 'android { defaultConfig { versionCode 1\n versionName "1.0" } }\ndependencies {\n}\n');
  const r = spawnSync('bash', ['scripts/install-native.sh'], { cwd: d, encoding: 'utf8', env: { ...process.env, LF_VERSION_CODE: '77' } });
  assert.equal(r.status, 0, r.stderr); return d;
}

test('the update manifest polling cadence remains exactly one second', () => { assert.equal(UPDATE_POLL_MS, 1000); });

test('generated manifest: update service is a data-sync foreground service that survives task removal, with its permission', () => {
  const mf = fs.readFileSync(path.join(project(), 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  const svc = mf.match(/<service\b[^>]*UpdateDownloadService[^>]*>/); assert.ok(svc, 'service registered');
  assert.match(svc[0], /android:foregroundServiceType="dataSync"/); assert.match(svc[0], /android:stopWithTask="false"/); assert.match(svc[0], /android:exported="false"/);
  assert.match(mf, /<uses-permission[^>]*android:name="android\.permission\.FOREGROUND_SERVICE_DATA_SYNC"/);
  assert.match(mf, /<activity\b[^>]*UpdateInstallActivity/);
});

test('download key: build + sha256 decide the APK and .part names; case of the sha does not matter; different build or sha gives different files', { skip }, () => {
  const [apk, part, id] = run('key', B, SHA.toUpperCase());
  assert.equal(apk, `liquid-dark-${B}-${SHA}.apk`); assert.equal(part, `liquid-dark-${B}-${SHA}.apk.part`); assert.equal(id, `${B}-${SHA}`);
  assert.deepEqual(run('key', B, SHA), [apk, part, id]);
  for (const other of [run('key', B2, SHA), run('key', B, SHA2)]) { assert.notEqual(other[0], apk); assert.notEqual(other[1], part); }
  assert.equal(run('valid', B, SHA)[0], 'true'); assert.equal(run('valid', B, 'xyz')[0], 'false'); assert.equal(run('valid', 5, SHA)[0], 'false');
});

test('generation check: a newer update replaces the old one, old generations cannot finish or publish state', { skip }, () => {
  assert.deepEqual(run('gen'), ['true', 'true', 'true', 'true', 'true', 'true']);
});

const ZERO_SHA = crypto.createHash('sha256').update(Buffer.alloc(1_100_000)).digest('hex');   // the driver writes 1.1 MB of zeros as the "APK"
const verify = (file, { sha = SHA, archive = B, installed = B - 1 } = {}) => run('verify', B, sha, archive, installed, file)[1];

test('a missing, incomplete or wrong-checksum APK is never ready (verifyApk gives a reason)', { skip }, () => {
  assert.match(verify('none'), /missing or incomplete/); assert.match(verify('small'), /missing or incomplete/);
  assert.match(verify('big'), /SHA-256 check/);
  assert.match(verify('none', { sha: 'xyz' }), /valid build number or SHA-256/);
});

test('verifyApk accepts only an exact, newer APK of the promised build', { skip }, () => {
  assert.equal(verify('big', { sha: ZERO_SHA }), 'OK');
  assert.match(verify('big', { sha: ZERO_SHA, archive: B2 }), /does not match update build/);
  assert.match(verify('big', { sha: ZERO_SHA, installed: B }), /not newer than installed/);
  assert.match(verify('big', { sha: ZERO_SHA, installed: B + 5 }), /not newer than installed/);
});

test('a failure is recorded only for the current target id, and then the state is "failed" (UI shows Retry)', { skip }, () => {
  assert.deepEqual(run('state', B, SHA), ['downloading', 'failed']);
});
