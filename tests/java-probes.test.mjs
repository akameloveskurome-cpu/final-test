// BUG-201: the Java/Android probes (tests/java-probe*.py) run as part of `npm test`.
// Each one compiles the real native-android/*.java methods against small hand-made Android stubs with the JDK's own compiler (no Android SDK needed) and exits 0 on success.
// They only need python3 and a JDK with the jdk.compiler module (GitHub's ubuntu runners have both); without them the tests are SKIPPED with the reason, never silently passed.
import test from 'node:test'; import assert from 'node:assert/strict'; import { spawn, spawnSync } from 'node:child_process'; import { readdirSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const has = (cmd, args) => { try { return spawnSync(cmd, args, { stdio: 'ignore' }).status === 0; } catch { return false; } };
const missing = !has('python3', ['--version']) ? 'python3 not found' : !has('java', ['--module', 'jdk.compiler/com.sun.tools.javac.Main', '--version']) ? 'JDK with jdk.compiler not found' : '';
const probes = readdirSync(new URL('.', import.meta.url)).filter(f => /^java-probe.*\.py$/.test(f)).sort();
const run = f => new Promise(res => { const p = spawn('python3', ['tests/' + f], { cwd: root }); let out = ''; p.stdout.on('data', d => (out += d)); p.stderr.on('data', d => (out += d)); p.on('close', code => res({ code, out })); });
test('there are Java probes to run (a renamed folder must not make this suite pass by running nothing)', () => assert.ok(probes.length >= 5, probes.join(', ')));
const results = missing ? null : Promise.all(probes.map(async f => [f, await run(f)]));
for (const f of probes) {
  test(`${f} compiles the real Java against the stubs and passes`, { skip: missing ? `${missing}; it runs on GitHub` : false }, async () => {
    const r = Object.fromEntries(await results)[f];
    assert.equal(r.code, 0, r.out.split('\n').filter(l => /error|FAILED|symbol/.test(l)).slice(0, 8).join('\n') || r.out.slice(-600));
    assert.match(r.out, /OK/);
  });
}
