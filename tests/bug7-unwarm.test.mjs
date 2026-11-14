// BUG #7: a replaced / removed custom picture must leave the warm-up cache (warmed Map + picKeep Set).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';

class FakeImage { decode() { return Promise.resolve(); } }
const mk = () => {
  const picKeep = new Set(), warmed = new Map();
  const warmUrl = extract('src/main.js', 'warmUrl', { Image: FakeImage, warmed, picKeep });
  const unwarm = extract('src/main.js', 'unwarm', { warmed, picKeep });
  return { picKeep, warmed, warmUrl, unwarm };
};

test('unwarm: forgets a warmed picture (Map and Set), so rewarmAll no longer decodes it', () => {
  const { picKeep, warmed, warmUrl, unwarm } = mk();
  warmUrl('blob:a'); warmUrl('blob:b');
  assert.equal(warmed.size, 2); assert.equal(picKeep.size, 2);
  unwarm('blob:a');
  assert.deepEqual([...warmed.keys()], ['blob:b']);
  assert.equal(picKeep.size, 1);
  unwarm('blob:a'); unwarm('blob:never');   // unknown / repeated: no error
  assert.equal(warmed.size, 1);
});

test('every setter / drop that revokes a warmed picture also calls unwarm', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').split('\n');
  for (const name of ['alpSet', 'spSet', 'agSet', 'gpSet']) {
    const l = src.find(x => x.startsWith('const ' + name + ' = '));
    assert.ok(l && l.includes('unwarm('), name + ' calls unwarm');
  }
  const pp = src.find(x => x.startsWith('function ppDrop')); assert.ok(pp.includes('unwarm('), 'ppDrop calls unwarm');
  const ra = src.findIndex(x => x.startsWith('function refreshAllPics'));
  assert.ok(src.slice(ra, ra + 6).filter(x => x.includes('unwarm(')).length === 2, 'refreshAllPics unwarms both groups');
});
