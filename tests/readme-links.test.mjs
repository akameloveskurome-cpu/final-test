// README.md must not link pictures or files that are not in the project (it once linked ~70 missing screenshots).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('README.md: every local image, video and doc link points to a file that exists', () => {
  const md = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const links = [...md.matchAll(/\]\(([^)\s#]+)\)/g)].map((m) => m[1]).concat([...md.matchAll(/src="([^"]+)"/g)].map((m) => m[1]));
  const local = links.filter((l) => !/^(https?:|mailto:)/.test(l));
  assert.ok(local.length > 5, 'README should still show its screenshots');
  const missing = local.filter((l) => !fs.existsSync(path.join(root, decodeURI(l))));
  assert.deepEqual(missing, []);
});

// The README screenshots must not carry a keyboard focus ring (a red or white 2 px box). The screenshot scripts once left
// the focus on the Now Playing grabber / the lyrics back button, so the outline was captured. Real pixel check, no text match.
import zlib from 'node:zlib';
function readPng(file) {
  const b = fs.readFileSync(file);
  assert.equal(b.subarray(1, 4).toString(), 'PNG');
  let off = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off), type = b.subarray(off + 4, off + 8).toString(), d = b.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); assert.equal(d[8], 8); ct = d[9]; assert.equal(d[12], 0); }
    if (type === 'IDAT') idat.push(d);
    off += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i], a = i >= bpp ? px[y * stride + i - bpp] : 0, up = y ? px[(y - 1) * stride + i] : 0, c = i >= bpp && y ? px[(y - 1) * stride + i - bpp] : 0;
      let v = x;
      if (f === 1) v = x + a; else if (f === 2) v = x + up; else if (f === 3) v = x + ((a + up) >> 1);
      else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c); }
      px[y * stride + i] = v & 255;
    }
  }
  return { w, h, bpp, at: (x, y) => [px[y * stride + x * bpp], px[y * stride + x * bpp + 1], px[y * stride + x * bpp + 2]] };
}
test('docs/screenshots: Now Playing, Immersive cover and Lyrics have no red / white focus box', () => {
  const RING = [[255, 255, 255], [250, 36, 60]];
  for (const n of ['now-playing', 'immersive-cover']) {
    const im = readPng(path.join(root, 'docs', 'screenshots', n + '.png'));
    for (let y = 0; y < 42; y++) {
      let run = 0, best = 0;
      for (let x = 0; x < im.w; x++) {
        const p = im.at(x, y);
        run = RING.some((r) => r[0] === p[0] && r[1] === p[1] && r[2] === p[2]) ? run + 1 : 0; best = Math.max(best, run);
      }
      assert.ok(best < 100, `${n}.png row ${y}: a ${best} px long red / white line (focus ring) is in the picture`);
    }
  }
  const ly = readPng(path.join(root, 'docs', 'screenshots', 'lyrics.png')); let red = 0;
  for (let y = 0; y < 60; y++) for (let x = 0; x < 100; x++) { const p = ly.at(x, y); if (p[0] === 250 && p[1] === 36 && p[2] === 60) red++; }
  assert.equal(red, 0, 'lyrics.png: a red focus ring is around the back button');
});
test('screenshot scripts: the focus is blurred before every screenshot', () => {
  for (const f of ['screenshots.py', 'screenshots_v146.py', 'screenshots_v208.py', 'screenshots_v208b.py']) {
    const t = fs.readFileSync(path.join(root, 'tests', f), 'utf8');
    assert.ok(/activeElement[^\n]*blur\(\)[^\n]*screenshot\(/.test(t), f + ' must blur the focused element before pg.screenshot()');
  }
});
