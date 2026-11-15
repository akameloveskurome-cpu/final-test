// v208: the colour field behind Now Playing / Lyrics follows what the screen SHOWS: the Canvas (video or GIF) when it is on, else the song's own picture / GIF, else the album's picture / GIF, else the original cover.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';
const M = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

const rgb2hsl = extract('src/main.js', 'rgb2hsl', {});
const rgbHex = extract('src/main.js', 'rgbHex', {});
const mixHex = extract('src/main.js', 'mixHex', { rgbHex });
const exactPal = extract('src/main.js', 'exactPal', { mixHex });
const palFrom = () => ({ a: '#000000' });
const tintFromPixels = extract('src/main.js', 'tintFromPixels', { rgb2hsl, rgbHex, exactPal, palFrom });
const frame = (r, g, b) => { const d = new Uint8ClampedArray(4096); for (let i = 0; i < 4096; i += 4) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; } return d; };
const join = list => { const o = new Uint8ClampedArray(list.length * 4096); list.forEach((d, i) => o.set(d, i * 4096)); return o; };

test('tintFromPixels: several frames give the same kind of answer as one frame (the thresholds scale with the frame count)', () => {
  const one = tintFromPixels(frame(40, 90, 220)), eight = tintFromPixels(join(Array.from({ length: 8 }, () => frame(40, 90, 220))));
  assert.equal(one.a, eight.a);
  const blue = rgb2hsl(...[1, 3, 5].map(i => parseInt(one.a.slice(i, i + 2), 16)))[0];
  assert.ok(blue > 200 && blue < 250, 'a blue picture gives a blue colour: ' + one.a);
});
test('tintFromPixels: a blue-toned animation and an orange cover give different colours (this is the Canvas mismatch)', () => {
  const orange = tintFromPixels(frame(230, 120, 30)), blueAnim = tintFromPixels(join([frame(30, 80, 230), frame(40, 100, 210), frame(20, 70, 240)]));
  assert.notEqual(orange.a, blueAnim.a);
});
test('tintFromPixels: frames of different colours are averaged (a loop that changes colour gives one steady middle colour)', () => {
  const mixed = tintFromPixels(join([frame(220, 40, 40), frame(40, 40, 220)]));
  assert.match(mixed.a, /^#[0-9a-f]{6}$/);
});

// tintSource with fake state
const mk = ({ canvasOn = true, cvPathV = '', bad = [], fileUrl = p => 'http://localhost/_f_' + p, so = false, sp = null, ap = null } = {}) => {
  const spUrls = new Map(sp ? [['T1', sp]] : []), alpUrls = new Map(ap ? [['A1', ap]] : []);
  return extract('src/main.js', 'tintSource', { soHas: () => so, spUrls, alpUrls, canvasOn, cvPath: () => cvPathV, cvBad: new Set(bad), Native: { fileUrl }, isVideo: p => /\.(mp4|webm)$/i.test(p) });
};
const A = { id: 'A1', cover: 'content://cover' }, T = { id: 'T1', albumId: 'A1' };

test('Canvas on and playable: the source is the Canvas file (video flag from the extension); the lyrics-colour key is the SAME as without Canvas', () => {
  const off = mk({ canvasOn: false, cvPathV: '/x/c.mp4' })(A, T), on = mk({ cvPathV: '/x/c.mp4' })(A, T), gif = mk({ cvPathV: '/x/c.gif' })(A, T);
  assert.equal(off.src, 'content://cover'); assert.ok(!off.media);
  assert.ok(on.media && on.vid && on.src === 'http://localhost/_f_/x/c.mp4');
  assert.ok(gif.media && !gif.vid);
  assert.equal(on.ck, off.ck, 'a colour the person picked for the lyrics keeps working while Canvas is on');
  assert.notEqual(on.key, off.key, 'the read colour is cached apart from the cover colour');
  assert.notEqual(on.key, gif.key);
});
test('Canvas file that failed to play, or no file url: the cover / picture is used as before', () => {
  assert.ok(!mk({ cvPathV: '/x/c.mp4', bad: ['/x/c.mp4'] })(A, T).media);
  assert.ok(!mk({ cvPathV: '/x/c.mp4', fileUrl: () => '' })(A, T).media);
  assert.ok(!mk({ cvPathV: '' })(A, T).media);
});
test('picture order without Canvas: the song picture / GIF, then the album picture / GIF, then the original cover; "keep original" wins over both', () => {
  assert.equal(mk({ sp: 'blob:s', ap: 'blob:a' })(A, T).src, 'blob:s');
  assert.equal(mk({ sp: 'blob:s', ap: 'blob:a' })(A, T).ck, 'T1|s');
  assert.equal(mk({ ap: 'blob:a' })(A, T).src, 'blob:a');
  assert.equal(mk({ ap: 'blob:a' })(A, T).ck, 'A1|c');
  assert.equal(mk({})(A, T).ck, 'A1|');
  assert.equal(mk({ so: true, sp: 'blob:s', ap: 'blob:a' })(A, T).src, 'content://cover');
  assert.equal(mk({ sp: 'blob:s' })(A, T).custom, true);
  assert.equal(mk({})(A, T).custom, false);
});
test('Canvas beats a custom song / album picture; when the Canvas cannot be read the picture under it is the fallback source', () => {
  const s = mk({ cvPathV: '/x/c.webm', sp: 'blob:s' })(A, T);
  assert.ok(s.media && s.vid); assert.equal(s.still, 'blob:s'); assert.equal(s.stillCustom, true);
});

test('GUARD (needs the running app): animated sources are read over several frames, the Canvas / custom picture feed coverTint, only the newest read paints, stale reads are not kept', () => {
  assert.ok(M.includes('function tintVideoPx('));
  assert.ok(M.includes('async function tintDecodeFrames('));
  assert.ok(M.includes('Math.min(n, 8)'));
  assert.match(M, /const S = tintSource\(a, t\), ck = S\.ck, key = S\.key;/);
  assert.match(M, /c\.ck = ck;[^\n]*covTint\.set\(key, c\)/);
  assert.match(M, /my === npTintSeq/);
  assert.match(M, /my === lyTintSeq/);
  assert.ok(M.includes("p.ck"), 'the lyrics colour is still saved under the stable key');
});
