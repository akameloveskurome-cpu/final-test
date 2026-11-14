// BUG-394: behaviour tests. install-native.sh runs on a fake generated android/ project; the workflow's own guard step is extracted from android.yml and executed.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
function project() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lf394fp-'));
  for (const n of ['native-android', 'scripts']) fs.symlinkSync(path.join(root, n), path.join(d, n));
  fs.copyFileSync(path.join(root, 'package.json'), path.join(d, 'package.json'));
  const m = path.join(d, 'android/app/src/main'); fs.mkdirSync(path.join(m, 'res/values'), { recursive: true });
  fs.writeFileSync(path.join(m, 'AndroidManifest.xml'), '<?xml version="1.0"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n<application android:label="x"><activity android:name=".MainActivity"/></application>\n</manifest>\n');
  fs.writeFileSync(path.join(m, 'res/values/styles.xml'), '<resources><style name="AppTheme.NoActionBarLaunch" parent="x"><item name="android:background">@drawable/splash</item></style></resources>');
  fs.writeFileSync(path.join(d, 'android/app/build.gradle'), 'android { defaultConfig { versionCode 1\n versionName "1.0" } }\ndependencies {\n}\n');
  const r = spawnSync('bash', ['scripts/install-native.sh'], { cwd: d, encoding: 'utf8', env: { ...process.env, LF_VERSION_CODE: '77' } });
  assert.equal(r.status, 0, r.stderr); return d;
}
const xml = (d, rel, py) => { const r = spawnSync('python3', ['-c', 'import sys,xml.etree.ElementTree as E\n' + py, path.join(d, 'android/app/src/main', rel)], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
const hasPy = spawnSync('python3', ['-c', 'import yaml']).status === 0;

test('generated project: FileProvider is registered and its paths file exposes files/update', () => {
  const d = project();
  assert.equal(xml(d, 'res/xml/file_paths.xml', 'r=E.parse(sys.argv[1]).getroot()\nprint(",".join(e.get("name")+"="+e.get("path") for e in r if e.tag=="files-path"))'), 'lf_update_files=update/');
  const A = '{http://schemas.android.com/apk/res/android}';
  assert.equal(xml(d, 'AndroidManifest.xml', `A="${A}"\nr=E.parse(sys.argv[1]).getroot()\nfor p in r.iter("provider"):\n  if p.get(A+"name")=="androidx.core.content.FileProvider":\n    print(",".join(m.get(A+"resource","") for m in p.iter("meta-data")))`), '@xml/file_paths');
  assert.ok(!fs.existsSync(path.join(d, 'android/app/src/main/res/xml/lf_file_paths.xml')));
});

test('workflow: the apk job waits for tests, and its FileProvider guard step passes a good project and fails a broken one', { skip: (!hasPy && 'no python yaml') || (!fs.existsSync(path.join(root, '.github/workflows/android.yml')) && 'no .github/workflows/android.yml in this copy (zips drop dot-folders); it runs on GitHub') }, () => {
  const out = spawnSync('python3', ['-c', 'import yaml,json,sys\nw=yaml.safe_load(open(sys.argv[1]))\nj=w["jobs"]["apk"]\ns=[x for x in j["steps"] if "Verify the update installer file path" in x.get("name","")]\nprint(json.dumps({"needs":j["needs"],"run":s[0]["run"] if s else None}))', path.join(root, '.github/workflows/android.yml')], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr); const { needs, run } = JSON.parse(out.stdout);
  for (const n of ['unpack', 'plan', 'test']) assert.ok(needs.includes(n), 'apk needs ' + n);
  assert.ok(run, 'guard step exists');
  const d = project(), go = () => spawnSync('bash', ['-c', run], { cwd: d, encoding: 'utf8' });
  assert.equal(go().status, 0);
  const fp = path.join(d, 'android/app/src/main/res/xml/file_paths.xml'), orig = fs.readFileSync(fp, 'utf8');
  fs.writeFileSync(fp, orig.replace('update/', 'other/')); assert.equal(go().status, 1);
  fs.writeFileSync(fp, orig);
  const mf = path.join(d, 'android/app/src/main/AndroidManifest.xml'); fs.writeFileSync(mf, fs.readFileSync(mf, 'utf8').replaceAll('@xml/file_paths', '@xml/x')); assert.equal(go().status, 1);
});

test('legacy unverified updater is gone: the JS bridge does not expose installUpdate and no plugin method of that name exists', async () => {
  const { Native } = await import('../src/native.js'); assert.equal(typeof Native.installUpdate, 'undefined');
  const java = fs.readFileSync(path.join(root, 'native-android/LiquidNative.java'), 'utf8');
  assert.ok(!/@PluginMethod[\s\S]{0,40}\binstallUpdate\s*\(/.test(java));
});
