// BUG-378: behaviour test. Compiles the REAL native-android/CoverCleanup.java and runs it on a fake covers folder.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url))), hasJava = spawnSync('java', ['-version']).status === 0, skip = !hasJava && 'no java';
const DRV = `package com.liquid.flacplayer; import java.io.*; import java.nio.file.*;
public class CDriver { public static void main(String[] a) throws Exception { File d = new File(a[0]); String ref = new String(Files.readAllBytes(Paths.get(a[1])), "UTF-8"); System.out.println(CoverCleanup.clean(d, ref, Long.parseLong(a[2]))); } }`;
function setup() {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-')), out = path.join(t, 'out'), src = path.join(t, 'src'); fs.mkdirSync(src); fs.mkdirSync(out);
  fs.writeFileSync(path.join(src, 'CDriver.java'), DRV);
  const r = spawnSync('java', ['--module', 'jdk.compiler/com.sun.tools.javac.Main', '-d', out, path.join(root, 'native-android/CoverCleanup.java'), path.join(src, 'CDriver.java')], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr);
  const files = path.join(t, 'files'), covers = path.join(files, 'covers'); fs.mkdirSync(covers, { recursive: true });
  return { t, out, files, covers, run(ref, now = Date.now()) { const rf = path.join(t, 'ref.txt'); fs.writeFileSync(rf, ref); const q = spawnSync('java', ['-cp', out, 'com.liquid.flacplayer.CDriver', covers, rf, String(now)], { encoding: 'utf8' }); assert.equal(q.status, 0, q.stderr); return Number(q.stdout.trim()); } };
}
const put = (d, n, ageMs = 3600e3) => { const f = path.join(d, n); fs.writeFileSync(f, 'x'); const tm = new Date(Date.now() - ageMs); fs.utimesSync(f, tm, tm); return f; };
test('referenced covers survive, unreferenced are removed', { skip }, () => {
  const s = setup(); const a = put(s.covers, 'aaaaaaaaaaaaaaaa.jpg'), b = put(s.covers, 'bbbbbbbbbbbbbbbb.jpg'), c = put(s.covers, 'cccccccccccccccc.jpg');
  const n = s.run(`{"x":{"cover":"/data/files/covers/aaaaaaaaaaaaaaaa.jpg"}}\n{"alb":{"k":"/data/files/covers/cccccccccccccccc.jpg"}}`);
  assert.equal(n, 1); assert.ok(fs.existsSync(a)); assert.ok(!fs.existsSync(b)); assert.ok(fs.existsSync(c));
});
test('empty or unreadable cache deletes nothing', { skip }, () => {
  const s = setup(); const a = put(s.covers, 'aaaaaaaaaaaaaaaa.jpg');
  assert.equal(s.run(''), 0); assert.equal(s.run('{}\n{}'), 0); assert.ok(fs.existsSync(a));
});
test('young .tmp kept, old .tmp removed', { skip }, () => {
  const s = setup(); put(s.covers, 'k.jpg'); const y = put(s.covers, 'zz.1.tmp', 5e3), o = put(s.covers, 'zz.2.tmp', 3600e3);
  s.run('/covers/k.jpg'); assert.ok(fs.existsSync(y)); assert.ok(!fs.existsSync(o));
});
test('other folders and subfolders are never touched', { skip }, () => {
  const s = setup(); put(s.covers, 'k.jpg'); const up = []; for (const d of ['lfart', 'lfpics', 'sub']) { const dir = d === 'sub' ? path.join(s.covers, d) : path.join(s.files, d); fs.mkdirSync(dir, { recursive: true }); up.push(put(dir, 'mine.gif')); }
  const other = put(s.files, 'playlists.json'); put(s.covers, 'old.jpg');
  assert.equal(s.run('/covers/k.jpg'), 1); for (const f of [...up, other]) assert.ok(fs.existsSync(f), f);
});
test('wiring: LiquidNative runs the cleanup only after the cache is saved, off the plugin thread', () => {
  const j = fs.readFileSync(path.join(root, 'native-android/LiquidNative.java'), 'utf8'), i = j.indexOf('CoverCleanup.clean('), c = j.indexOf('cacheFile())) {', j.indexOf('library-v9.tmp'));
  assert.ok(i > c && c > 0); assert.ok(/LIB_POOL\.execute\([^;]*CoverCleanup\.clean/s.test(j));
});
