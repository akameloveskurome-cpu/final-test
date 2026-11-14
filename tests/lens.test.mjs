import test from 'node:test';
import assert from 'node:assert/strict';
import { lensPixels } from '../src/lens.js';

const at = (px, w, x, y) => { const i = (y * w + x) * 4; return [px[i], px[i + 1], px[i + 2], px[i + 3]]; };
test('lens map: the middle is neutral (128 = no shift), fully opaque', () => {
  const w = 128, h = 48, px = lensPixels(w, h);
  assert.equal(px.length, w * h * 4);
  assert.deepEqual(at(px, w, 64, 24), [128, 128, 128, 255]);
  assert.deepEqual(at(px, w, 40, 24), [128, 128, 128, 255]);
});
test('lens map: the rim pulls outward (left edge < 128 in R, right edge > 128, top edge < 128 in G, bottom > 128)', () => {
  const w = 128, h = 48, px = lensPixels(w, h);
  assert.ok(at(px, w, 2, 24)[0] < 90 && at(px, w, 125, 24)[0] > 166);
  assert.ok(at(px, w, 64, 1)[1] < 90 && at(px, w, 64, 46)[1] > 166);
  assert.ok(Math.abs(at(px, w, 64, 1)[0] - 128) < 3);   // straight above the middle: no sideways pull
});
test('lens map: values stay in 0..255 and any size works', () => {
  for (const [w, h] of [[10, 10], [200, 40], [64, 64]]) { const px = lensPixels(w, h); assert.equal(px.length, w * h * 4); assert.ok(px.every(v => v >= 0 && v <= 255)); }
});
