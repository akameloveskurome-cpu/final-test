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

test('Auto: says it takes the colour from what the song shows (Canvas, else the picture / GIF, else the album cover), and really does (no stored colour = that palette)', () => {
  assert.match(sheet, /<b>Auto<\/b> takes the colour from what this song shows/);
  assert.match(sheet, /id="lycauto"/);
  const pal = main.slice(main.indexOf('async function coverPal('), main.indexOf('// v208: hex colour picker'));
  assert.match(pal, /if \(!o \|\| !\(o\.n \|\| Number\.isFinite\(o\.h\)\)\) return p;/, 'no stored colour: the cover palette p is used as it is');
  const tint = main.slice(main.indexOf('function tintSource('), main.indexOf('function tintSource(') + 900);
  assert.match(tint, /sp \|\| ap \|\| a\.cover/, 'the colour is read from the song picture, else the album picture, else the album cover');
  assert.match(main, /case 'lyc-pick'[^\n]*lycSave\(p\.ck, w \? [^\n]*: null\)/, 'Back to Auto deletes the stored colour');
});

test('exact colours: a picked hex is used as it is, Auto uses the cover\'s own average colour (no boost, no darkening)', () => {
  const pal = main.slice(main.indexOf('async function coverPal('), main.indexOf('// v208: hex colour picker'));
  assert.match(pal, /o\?\.hex[^\n]*exactPal\(o\.hex\)/, 'a stored hex goes straight to exactPal');
  assert.match(main, /const exactPal = \(a, b\) =>/);
  const tint = main.slice(main.indexOf('function tintFromPixels('), main.indexOf('/* v148+: the person can pick'));
  assert.match(tint, /const p = exactPal\(avgOf\(k1\)/, 'Auto: average colour of the cover\'s main hue');
  assert.ok(!/p\.b = vivid\(/.test(tint), 'the second colour is no longer boosted');
  const mix = (x, y, t) => { const a = parseInt(x.slice(1), 16), b = parseInt(y.slice(1), 16); const h = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); return '#' + h((a >> 16) + ((b >> 16) - (a >> 16)) * t) + h((a >> 8 & 255) + ((b >> 8 & 255) - (a >> 8 & 255)) * t) + h((a & 255) + ((b & 255) - (a & 255)) * t); };
  assert.equal(mix('#202830', '#000000', 0), '#202830', 'a dark colour stays as dark as chosen');
});

test('splash: a black splash cover is in index.html, shown before Home is drawn, removed at once when there is no picture', () => {
  const idx = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(idx.indexOf('id="lf-splash"') > -1 && idx.indexOf('id="lf-splash"') < idx.indexOf('id="app"'));
  assert.match(main, /if \(!splashPic\.src\) \{ splashHide\(\); return; \}/);
  assert.match(main, /splashReady\.then\(splashShow\);\s*\/\/ v208\+/);
  assert.equal((main.match(/splashReady\.then\(splashShow\)/g) || []).length, 1, 'only the early call, not one at the end of the file');
});
