import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDim, cleanFit, bgVars, memoryBackend, isPicFile, BG_DIM_DEF, BG_DIM_MIN, BG_DIM_MAX } from '../src/bgmedia.js';

test('cleanDim: whole numbers inside the range, anything odd = the default', () => {
  assert.equal(cleanDim(0), 0); assert.equal(cleanDim(40), 40); assert.equal(cleanDim('55'), 55); assert.equal(cleanDim(33.6), 34);
  assert.equal(cleanDim(-5), BG_DIM_MIN); assert.equal(cleanDim(500), BG_DIM_MAX);
  for (const bad of [undefined, null, '', 'x', NaN]) assert.equal(cleanDim(bad), BG_DIM_DEF);
});

test('cleanFit and bgVars', () => {
  assert.equal(cleanFit('fit'), 'fit'); assert.equal(cleanFit('fill'), 'fill'); assert.equal(cleanFit('zoom'), 'fill'); assert.equal(cleanFit(), 'fill');
  assert.deepEqual(bgVars(40, 'fill'), { '--bgdimc': 'rgba(0,0,0,0.40)', '--bgsize': 'cover' });
  assert.deepEqual(bgVars(0, 'fit'), { '--bgdimc': 'rgba(0,0,0,0.00)', '--bgsize': 'contain' });
});

test('any picture or GIF is accepted, anything else is not', () => {
  assert.ok(isPicFile({ type: 'image/gif', name: 'a.gif' })); assert.ok(isPicFile({ type: '', name: 'photo.HEIC' }));
  assert.ok(!isPicFile({ type: 'audio/flac', name: 'a.flac' })); assert.ok(!isPicFile(null));
});

test('storage keeps the exact file, replaces it, removes it', async () => {
  const b = memoryBackend(); assert.equal(await b.get(), null);
  const f1 = { size: 123456789 }, f2 = { size: 5 };
  await b.put(f1); assert.equal(await b.get(), f1);
  await b.put(f2); assert.equal(await b.get(), f2);
  await b.del(); assert.equal(await b.get(), null);
});
