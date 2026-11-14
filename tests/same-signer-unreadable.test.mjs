// Update installer: an APK whose signature the phone cannot READ is not "a different key".
// Real report: after a logo build the in-app update showed "the downloaded APK is signed with a different key than the installed app"
// although the workflow's own guard printed the same SHA-256 for the published and the new key. The cause was sameSigner() in
// native-android/UpdateSupport.java: on Android 9+ it refused an APK whose signature list came back EMPTY (BUG-032). Some phones (V2-only APK, vendor ROMs)
// cannot read the signature from the archive, so a good download was rejected as a key mismatch. Now unreadable = Android's installer decides;
// only two READABLE, DIFFERENT certificates are a mismatch. The real UpdateSupport.java is compiled against tiny Android stubs and run.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import crypto from 'node:crypto'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasJava, run } from './update-java-harness.mjs';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url))), skip = !hasJava && 'no java in this environment';
const SHA = crypto.createHash('sha256').update(Buffer.alloc(1_100_000)).digest('hex'), B = 1700000002, OLD = 1700000001;
const verify = (inst, apk) => run('verify28', B, SHA, B, OLD, inst, apk)[1];   // Android 9+ (SDK 28), correct size, SHA-256 and build number

test('Android 9+: the APK signature cannot be read -> accepted (Android decides at install), not "different key"', { skip }, () => {
  assert.equal(verify('CERT-A', 'none'), 'OK');
});
test('Android 9+: same certificate -> accepted', { skip }, () => { assert.equal(verify('CERT-A', 'CERT-A'), 'OK'); });
test('Android 9+: two readable but different certificates -> still refused as a different key', { skip }, () => {
  assert.match(verify('CERT-A', 'CERT-B'), /different key/);
});
test('our own certificate cannot be read -> accepted (unchanged behaviour)', { skip }, () => { assert.equal(verify('none', 'CERT-B'), 'OK'); });
test('the build-number checks still report their own reason (wrong build, not newer)', { skip }, () => {
  assert.match(run('verify28', B, SHA, B + 5, OLD, 'CERT-A', 'none')[1], /does not match update build/);
  assert.match(run('verify28', B, SHA, B, B, 'CERT-A', 'none')[1], /not newer/);
});
const verifyOld = (inst, apk, instOld, apkOld) => run('verify28', B, SHA, B, OLD, inst, apk, instOld, apkOld)[1];
test('Android 9+: new list empty but the OLD signature list is readable and the same -> accepted', { skip }, () => { assert.equal(verifyOld('none', 'none', 'CERT-A', 'CERT-A'), 'OK'); });
test('Android 9+: new list empty but the OLD list shows a different certificate -> still refused (real mismatch caught)', { skip }, () => {
  assert.match(verifyOld('CERT-A', 'none', 'CERT-A', 'CERT-B'), /different key/);
});
test('Android 9+: nothing readable anywhere -> accepted, Android decides', { skip }, () => { assert.equal(verifyOld('CERT-A', 'none', 'none', 'none'), 'OK'); });
test('source: the old Android 9+ refusal of an unreadable signature is gone', () => {
  const j = fs.readFileSync(path.join(root, 'native-android', 'UpdateSupport.java'), 'utf8');
  assert.match(j, /if \(sa\.isEmpty\(\)\) return true;/);
  assert.doesNotMatch(j, /sa\.isEmpty\(\)\) return !p28/);
});
