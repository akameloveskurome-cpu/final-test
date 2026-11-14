// BUG-277: behaviour test. Compiles and runs the REAL native-android/ScanSizing.java (the formula LiquidNative.scanThreads() uses). BUG-052: 20 MB per worker.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url))), skip = spawnSync('java', ['-version']).status !== 0 && 'no java';
const t = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-')), out = path.join(t, 'out'), src = path.join(t, 'D.java'); fs.mkdirSync(out);
fs.writeFileSync(src, `package com.liquid.flacplayer; public class D { public static void main(String[] a) { StringBuilder b = new StringBuilder(); for (int i = 0; i + 1 < a.length; i += 2) b.append(ScanSizing.threads(Long.parseLong(a[i]), Long.parseLong(a[i + 1]))).append(' '); System.out.println(b.toString().trim() + '|' + ScanSizing.WORKER_MB); } }`);
const run = (...pairs) => { const r = spawnSync('java', ['-cp', out, 'com.liquid.flacplayer.D', ...pairs.flat().map(String)], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); const [n, mb] = r.stdout.trim().split('|'); return { n: n.split(' ').map(Number), mb: Number(mb) }; };
test('scanThreads: small heaps get fewer workers, big heaps are capped by cores x 4, never below 1', { skip }, () => {
  const c = spawnSync('java', ['--module', 'jdk.compiler/com.sun.tools.javac.Main', '-d', out, path.join(root, 'native-android/ScanSizing.java'), src], { encoding: 'utf8' }); assert.equal(c.status, 0, c.stderr);
  const r = run([8, 160], [8, 80], [8, 8], [2, 512], [8, 640], [8, 0], [1, 19], [4, 20]);
  assert.deepEqual(r.n, [8, 4, 1, 8, 32, 1, 1, 1]);
  assert.equal(r.mb, 20, 'BUG-052: the per-worker budget is 20 MB');
});
test('the heap budget wins: workers x budget never exceeds the heap (unless the floor of 1 applies)', { skip }, () => {
  const heaps = [64, 100, 128, 256, 384, 512, 1024], r = run(...heaps.map(h => [16, h]));
  r.n.forEach((n, i) => assert.ok(n === 1 || n * r.mb <= heaps[i], `heap ${heaps[i]} MB -> ${n} workers`));
});
test('LiquidNative.scanThreads() delegates to ScanSizing (wiring)', () => {
  const j = fs.readFileSync(path.join(root, 'native-android/LiquidNative.java'), 'utf8');
  assert.ok(/ScanSizing\.threads\(\s*Runtime\.getRuntime\(\)\.availableProcessors\(\)/.test(j) && /SCAN_WORKER_MB = 20;/.test(j));
});
