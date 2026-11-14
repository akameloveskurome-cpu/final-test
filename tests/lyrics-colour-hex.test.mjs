import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');
const sheet = main.slice(main.indexOf('async function lycolSheet()'), main.indexOf('function lycSetHex('));

test('Lyrics colour sheet: no preset colours (no cover swatches, no Black), one circular picker and a hex box', () => {
  assert.ok(!/p\.sw\.map|lycdot|Colour ' \+ \(i \+ 1\)|'Black'/.test(sheet), 'no preset swatch buttons are built');
  assert.ok(!/lycdot/.test(css), 'the preset dot CSS is gone');
  assert.ok(!/type="color"/.test(sheet), 'no Android system colour dialog');
  assert.match(sheet, /id="lycwheel"/);
  assert.match(sheet, /id="lycknob"/);
  assert.match(sheet, /id="lycbright"/);
  assert.match(sheet, /id="lychextxt"[^>]*maxlength="7"/);
  assert.match(css, /\.lycwheel\{[^}]*conic-gradient/);
});

test('wheel: pointer drag sets hue from the angle and saturation from the distance', () => {
  assert.match(main, /Math\.atan2\(dx, -dy\)/);
  assert.match(main, /document\.addEventListener\('pointerdown', lycDrag\)/);
  const hsvHex = (h, s, v) => { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); };
  assert.equal(hsvHex(0, 1, 1), '#ff0000'); assert.equal(hsvHex(120, 1, 1), '#00ff00'); assert.equal(hsvHex(240, 1, 1), '#0000ff');
  assert.equal(hsvHex(0, 0, 1), '#ffffff'); assert.equal(hsvHex(0, 1, 0), '#000000');
});

test('the hex box accepts 3 or 6 digits, with or without #, and the colour is saved with its hex', () => {
  const ok = v => /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.test(String(v).trim());
  for (const v of ['FA243C', '#fa243c', 'abc', '#ABC']) assert.ok(ok(v), v);
  for (const v of ['', 'GG0000', 'fa243', '#12345678']) assert.ok(!ok(v), v);
  assert.match(main, /lycSave\(p\.ck, \{ \.\.\.hexHS\(hex\), hex \}\)/);
  assert.match(main, /e\.target\.id === 'lychextxt'/);
});

test('Auto: says it takes the colour from the album cover, and really does (no stored colour = the cover palette)', () => {
  assert.match(sheet, /<b>Auto<\/b> takes the colour from this song's album cover/);
  assert.match(sheet, /id="lycauto"/);
  const pal = main.slice(main.indexOf('async function coverPal('), main.indexOf('// v208: hex colour picker'));
  assert.match(pal, /if \(!o \|\| !\(o\.n \|\| Number\.isFinite\(o\.h\)\)\) return p;/, 'no stored colour: the cover palette p is used as it is');
  const tint = main.slice(main.indexOf('function coverTint('), main.indexOf('function coverTint(') + 700);
  assert.match(tint, /alpUrls\.get\(a\.id\) \|\| a\.cover/, 'the colour is read from the song picture, else the album cover');
  assert.match(main, /case 'lyc-pick'[^\n]*lycSave\(p\.ck, w \? [^\n]*: null\)/, 'Back to Auto deletes the stored colour');
});
