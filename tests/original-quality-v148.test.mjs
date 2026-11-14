// v148: custom profile pictures and artist photos are kept as the ORIGINAL file (same as GIFs, album, song, playlist and background pictures):
// no canvas crop, no shrinking to 256 / 512 px, no JPEG re-encode. Source checks, like the other pics tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';
const M = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const body = name => { const i = M.indexOf('function ' + name + '('); assert.ok(i >= 0, name); const j = M.indexOf('\nfunction ', i + 10), k = M.indexOf('\n/* v', i + 10); return M.slice(i, Math.min(...[j, k].filter(x => x > 0))); };

test('profile picture and artist photo are saved untouched: no canvas, no toBlob, no JPEG quality setting', () => {
  for (const fn of ['pfPick', 'apicPick']) {
    const b = body(fn);
    assert.doesNotMatch(b, /createElement\('canvas'\)|toBlob|toDataURL|drawImage|image\/jpeg/, fn);
    assert.match(b, /keepOriginal\(f\)/, fn);
  }
});
test('the original bytes are stored, and a missing file type is filled in from the file name (real keepOriginal)', async () => {
  const ownBlob = extract('src/main.js', 'ownBlob'), picType = f => (/\.gif$/i.test(f.name) ? 'image/gif' : 'image/png');
  const keepOriginal = extract('src/main.js', 'keepOriginal', { ownBlob, picType });
  const bytes = [1, 2, 3, 4, 5];
  const a = await keepOriginal(new File([new Uint8Array(bytes)], 'x.gif', { type: '' }));
  assert.equal(a.type, 'image/gif'); assert.deepEqual([...new Uint8Array(await a.arrayBuffer())], bytes);
  const b = await keepOriginal(new File([new Uint8Array(bytes)], 'y.png', { type: 'image/webp' }));
  assert.equal(b.type, 'image/webp'); assert.equal(b.size, 5);   // a known type is never changed, bytes never re-encoded
  assert.match(M, /import \{ isPicFile, picType,/);   // guard: the helper is imported
});
test('a file the phone cannot show is refused before anything is replaced', () => {
  assert.match(M, /const canShow = f => new Promise/);
  assert.match(body('pfPick'), /canShow\(f\)\.then\(ok => ok \? keepOriginal\(f\) : null\)/);
  assert.match(body('apicPick'), /canShow\(f\)/);
});
test('the picture is shown first and the old one is only dropped after the new file is safe (unchanged rules)', () => {
  assert.match(body('pfPick'), /pfDbPut\(b\)\.then\(\(\) => \{ setFlag\('lf\.haspf', true\); try \{ localStorage\.removeItem\('lf\.profile'\)/);
  assert.match(M, /agDb\.put\(n, b\)\.then\(\(\) => \{ apicDropOthers\(n\)/);
});
test('the square is cut by the screen, not by re-encoding', () => {
  const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');
  assert.match(css, /\.profile \.avatar img,\.profile \.avatar video\{[^}]*object-fit:cover/);
  assert.match(M, /center\/cover no-repeat, \$\{PIC_BASE\}/);
});
