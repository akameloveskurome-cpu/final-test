// The GitHub test job: Node 24 prints "ℹ skipped 0" (spec) where Node 22 printed "# skipped 0" (TAP).
// The "no test may be skipped" check in .github/workflows/android.yml must accept both, and must also require "fail 0".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const wfPath = path.join(root, '.github', 'workflows', 'android.yml');
const SK = !fs.existsSync(wfPath) && '.github/workflows/android.yml is not in this copy (a project zip may not carry it)';

test('workflow test job: the skipped/fail check accepts the TAP and the spec summary', { skip: SK }, () => {
  const yml = fs.readFileSync(wfPath, 'utf8');
  const m = yml.match(/grep -qE '(\^\(# \|ℹ \)skipped 0\$)'/);
  assert.ok(m, 'skipped check must accept both "# skipped 0" and "ℹ skipped 0"');
  assert.match(yml, /grep -qE '\^\(# \|ℹ \)fail 0\$'/, 'the job must also require "fail 0"');
  const re = new RegExp('^(# |ℹ )skipped 0$', 'm');
  assert.ok(re.test('# pass 618\n# skipped 0\n'));
  assert.ok(re.test('ℹ pass 618\nℹ skipped 0\n'));
  assert.ok(!re.test('ℹ skipped 2\n'));
});

test('workflow: test job on Node 24, build job stays on Node 22, Playwright pin is current', { skip: SK }, () => {
  const yml = fs.readFileSync(wfPath, 'utf8');
  const nodes = [...yml.matchAll(/node-version: (\d+)/g)].map((x) => Number(x[1]));
  assert.deepEqual(nodes, [24, 22]);
  assert.match(yml, /playwright@1\.63\.0/);
  assert.doesNotMatch(yml, /playwright@1\.49\.1/);
});
