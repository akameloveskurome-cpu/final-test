import test from 'node:test';
import assert from 'node:assert/strict';
import { LYA_DEFS, LYA_PRESETS, cleanLya, lyaVars } from '../src/lyanim.js';

test('defaults are the built-in feel', () => {
  const c = cleanLya({});
  for (const d of LYA_DEFS) assert.equal(c[d.k], d.def);
  const v = lyaVars({});
  assert.equal(v['--ly-glide'], '1.00'); assert.equal(v['--ly-zoom'], '1.020'); assert.equal(v['--ly-small'], '0.940'); assert.equal(v['--ly-blur'], '0.00px');
});
test('bad or out of range values are fixed', () => {
  const c = cleanLya({ glide: 99999, fade: -5, zoom: 'abc', blur: '', anchor: null });
  assert.equal(c.glide, 250); assert.equal(c.fade, 30); assert.equal(c.zoom, 102); assert.equal(c.blur, 0); assert.equal(c.anchor, 16);
  assert.deepEqual(cleanLya(null), cleanLya(undefined));
});
test('every preset is valid and complete', () => {
  for (const [n, p] of Object.entries(LYA_PRESETS)) assert.deepEqual(cleanLya(p), p, n);
  assert.deepEqual(LYA_PRESETS.default, cleanLya({}));
});
