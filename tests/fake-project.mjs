// helper (not a test): runs scripts/install-native.sh on a fake generated android/ project and returns its folder.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url'; import assert from 'node:assert/strict';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export function project() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lf277-'));
  for (const n of ['native-android', 'scripts']) fs.symlinkSync(path.join(root, n), path.join(d, n));
  fs.copyFileSync(path.join(root, 'package.json'), path.join(d, 'package.json'));
  const m = path.join(d, 'android/app/src/main'); fs.mkdirSync(path.join(m, 'res/values'), { recursive: true });
  fs.writeFileSync(path.join(m, 'AndroidManifest.xml'), '<?xml version="1.0"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n<application android:label="x"><activity android:name=".MainActivity"/></application>\n</manifest>\n');
  fs.writeFileSync(path.join(m, 'res/values/styles.xml'), '<resources><style name="AppTheme.NoActionBarLaunch" parent="x"><item name="android:background">@drawable/splash</item></style></resources>');
  fs.writeFileSync(path.join(d, 'android/app/build.gradle'), 'android { defaultConfig { versionCode 1\n versionName "1.0" } }\ndependencies {\n}\n');
  const r = spawnSync('bash', ['scripts/install-native.sh'], { cwd: d, encoding: 'utf8', env: { ...process.env, LF_VERSION_CODE: '77' } });
  assert.equal(r.status, 0, r.stderr); return d;
}
export const manifest = d => fs.readFileSync(path.join(d, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
