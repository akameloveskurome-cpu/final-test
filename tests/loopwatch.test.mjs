// v149: looped songs are counted. The real native-android/LoopWatch.java is compiled and run (behaviour), the page-side repeat statistics run for real, and the wiring is guarded.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { aggregate } from '../src/listenstats.js';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url))), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
// A javac binary, or else the jdk.compiler module run through java (same fallback the other Java tests use): the tests only skip when neither exists.
const JAVAC = spawnSync('javac', ['-version']).status === 0 ? ['javac'] : spawnSync('java', ['--module', 'jdk.compiler/com.sun.tools.javac.Main', '--version']).status === 0 ? ['java', '--module', 'jdk.compiler/com.sun.tools.javac.Main'] : null;
const skip = !JAVAC && 'no javac and no jdk.compiler module in this environment';

function javaRun(expr) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lf149-')), src = path.join(d, 'src'), out = path.join(d, 'out'); fs.mkdirSync(src); fs.mkdirSync(out);
  fs.copyFileSync(path.join(root, 'native-android/LoopWatch.java'), path.join(src, 'LoopWatch.java'));
  fs.writeFileSync(path.join(src, 'Driver.java'), `package com.liquid.flacplayer; public class Driver { public static void main(String[] a) { System.out.println(${expr}); } }`);
  const c = spawnSync(JAVAC[0], [...JAVAC.slice(1), '-d', out, path.join(src, 'LoopWatch.java'), path.join(src, 'Driver.java')], { encoding: 'utf8' }); assert.equal(c.status, 0, c.stderr);
  const r = spawnSync('java', ['-cp', out, 'com.liquid.flacplayer.Driver'], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}

test('a song that restarts from its end is a loop; a small scrubber nudge, a mid-song seek and an unknown length are not', { skip }, () => {
  assert.equal(javaRun('LoopWatch.endWrap(239000, 120, 240000)'), 'true');          // end -> start
  assert.equal(javaRun('LoopWatch.endWrap(238000, 2500, 240000)'), 'true');         // lands a little after 0
  assert.equal(javaRun('LoopWatch.endWrap(120000, 0, 240000)'), 'false');           // seek to 0 from the middle = not a repeat
  assert.equal(javaRun('LoopWatch.endWrap(239000, 120000, 240000)'), 'false');      // seek from the end to the middle
  assert.equal(javaRun('LoopWatch.endWrap(239000, 238500, 240000)'), 'false');      // nudge of 0.5 s
  assert.equal(javaRun('LoopWatch.endWrap(239000, 0, 0)'), 'false');                // length unknown
});

test('heartbeat fallback: a wrap between two beats is found from the elapsed time; normal playback and seeks are not', { skip }, () => {
  assert.equal(javaRun('LoopWatch.passedEnd(236000, 1500, 5000, 240000)'), 'true');   // 236 s + 5 s of playing passes the end, now at ~1.5 s
  assert.equal(javaRun('LoopWatch.passedEnd(100000, 105000, 5000, 240000)'), 'false'); // moved forward
  assert.equal(javaRun('LoopWatch.passedEnd(100000, 10000, 5000, 240000)'), 'false');  // seek back from the middle
  assert.equal(javaRun('LoopWatch.passedEnd(236000, 100000, 5000, 240000)'), 'false'); // jumped back, but not to where a restart would be
  assert.equal(javaRun('LoopWatch.passedEnd(30000, 1000, 5000, 20000)'), 'false');     // impossible numbers (a position beyond the song length) never match
});

test('A-B loop: a jump back of 1 s or more is a pass; the loop span decides the play threshold (half the span, at most 10 s)', { skip }, () => {
  assert.equal(javaRun('LoopWatch.abWrap(70000, 40000)'), 'true');
  assert.equal(javaRun('LoopWatch.abWrap(40500, 40000)'), 'false');
  assert.equal(javaRun('LoopWatch.region(true, 70000, 40000, 240000)'), '30000');
  assert.equal(javaRun('LoopWatch.region(false, 239000, 0, 240000)'), '240000');
  assert.equal(javaRun('LoopWatch.threshold(LoopWatch.region(true, 46000, 40000, 240000))'), '3000');   // 6 s loop: 3 s counts
  assert.equal(javaRun('LoopWatch.threshold(240000)'), '10000'); assert.equal(javaRun('LoopWatch.threshold(8000)'), '4000'); assert.equal(javaRun('LoopWatch.threshold(0)'), '10000');
});

test('the same wrap reported by two signals counts once; a real second wrap later counts again', { skip }, () => {
  assert.equal(javaRun('LoopWatch.duplicate(1100, 1000)'), 'true');
  assert.equal(javaRun('LoopWatch.duplicate(1500, 1000)'), 'false');
  assert.equal(javaRun('LoopWatch.duplicate(5000, 0)'), 'false');   // nothing seen before
});

const seg = (o = {}) => ({ i: 'a', t: 'A', a: 'X', al: 'Al', aa: 'X', s: 0, d: 30000, f: 1, q: 1, sid: 's1', pid: 'p' + Math.random(), ...o });
const meta = g => ({ id: g.i, title: g.t, artists: [g.a], albumKey: g.al, album: g.al, genres: [] });
test('looped plays: every pass is a play and repeats are counted, per song and in total (real aggregate)', () => {
  const T = 1700000000000, segs = [0, 1, 2, 3].map(k => seg({ s: T + k * 30000 })).concat([seg({ i: 'b', t: 'B', s: T + 4 * 30000 }), seg({ i: 'a', s: T + 5 * 30000 })]);
  const A = aggregate(segs, T - 1, T + 864e5, meta);
  assert.equal(A.plays, 6); assert.equal(A.songs.get('a').plays, 5); assert.equal(A.repeats, 3); assert.equal(A.songs.get('a').loops, 3);   // a a a a | b | a: the last a follows b, so it is no repeat
  assert.equal(A.totalMs, 6 * 30000);
});
test('repeats never cross sessions and never count other songs', () => {
  const T = 1700000000000, A = aggregate([seg({ s: T, sid: 's1' }), seg({ s: T + 30000, sid: 's2' }), seg({ i: 'b', s: T + 60000, sid: 's2' })], T - 1, T + 864e5, meta);
  assert.equal(A.repeats, 0);
});
test('a loop pass that did not qualify adds time but is not a play or a repeat', () => {
  const T = 1700000000000, A = aggregate([seg({ s: T }), seg({ s: T + 30000, q: 0, d: 2000 })], T - 1, T + 864e5, meta);
  assert.equal(A.plays, 1); assert.equal(A.repeats, 0); assert.equal(A.totalMs, 32000);
});

test('GUARD: tracker wiring - every loop signal goes through loopWrap, the A-B jump is tagged by the page, and a failed first insert is written by the next save', () => {
  const T = rd('native-android/ListenTracker.java'), N = rd('native-android/LiquidNative.java'), DB = rd('native-android/ListenDb.java');
  assert.match(T, /onPositionDiscontinuity\(Player\.PositionInfo/); assert.match(T, /private void loopWrap\(boolean ab/); assert.match(T, /LoopWatch\.passedEnd/); assert.match(T, /LoopWatch\.duplicate/);
  assert.match(T, /MEDIA_ITEM_TRANSITION_REASON_REPEAT\) \{\s*\n\s*if \(LoopWatch\.duplicate/);
  assert.match(T, /static void noteLoopSeek\(\)/); assert.match(N, /if \(loop\) ListenTracker\.noteLoopSeek\(\)/);
  assert.match(rd('src/main.js'), /Native\.seek\(to, \{ loop: true \}\)/); assert.match(rd('src/native.js'), /opts && opts\.loop \? \{ sec, loop: true \}/);
  assert.match(DB, /boolean updateSegment\(/); assert.match(T, /db\.updateSegment\(fPlay[^;]*\)\s*\n\s*&& !\(fClosing && fDur < 500 && !fQual\)\s*\n\s*&& db\.insertSegment\(/);
  assert.match(T, /return m\.localConfiguration != null/);   // an item without a mediaId is recorded under its address
});
