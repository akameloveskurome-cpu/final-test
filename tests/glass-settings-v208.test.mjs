// v208: liquid glass + animation settings. (1) no slider combination can push a glass CSS value past its limit;
// (2) the animation / glass / lens settings travel in a settings file and come back on import, with plain names in the sheet;
// (3) the tappable glass controls are all wired to the sliders (press squash, wobble or lens).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANIM_DEFS, PRESETS, glassVars, GLASS_LIMITS, cleanAnim, setAnim, A } from '../src/animcfg.js';
import { buildExport, exportText, parseImport, groupDiffs, pickSettings, mergeSettings, GROUP_LABELS, groupLabel } from '../src/settingsio.js';

const num = s => parseFloat(s);
const DEFS_KNOWN = { anim: {}, lyAnim: {}, refract: true, lyricSize: 'Medium' };
const ALL = { speed: 600, bounce: 600, jelly: 600, knob: 600, pillWobbleV: 600, pillWobbleH: 600, pillStretch: 600, pillSize: 450, magnify: 600, fringe: 750 };
const FLOOR = { speed: 50, bounce: 30, jelly: 0, knob: 0, pillWobbleV: 0, pillWobbleH: 0, pillStretch: 0, pillSize: 50, magnify: 0, fringe: 0 };

function assertWithinLimits(anim, tag) {
  const v = glassVars(anim), L = GLASS_LIMITS;
  for (const [k, s] of Object.entries(v)) assert.ok(typeof s === 'string' && s.length, `${tag}: ${k} is a value`);
  assert.ok(num(v['--lq-amp']) >= 0 && num(v['--lq-amp']) <= L.lqAmp + 1e-9, `${tag}: lq-amp ${v['--lq-amp']}`);
  assert.ok(num(v['--lq-dur']) >= L.durMin - 1e-9 && num(v['--lq-dur']) <= L.durMax + 1e-9, `${tag}: lq-dur ${v['--lq-dur']}`);
  assert.ok(num(v['--dur-k']) >= L.durK[0] - 1e-9 && num(v['--dur-k']) <= L.durK[1] + 1e-9, `${tag}: dur-k ${v['--dur-k']}`);
  const sp = v['--spring'].match(/cubic-bezier\(\.3,([\d.]+),\.5,1\)/), liq = v['--liq'].match(/cubic-bezier\(\.3,([\d.]+),\.5,1\)/);
  assert.ok(sp && num(sp[1]) >= 1 && num(sp[1]) <= L.springOver + 1e-9, `${tag}: spring ${v['--spring']}`);
  assert.ok(liq && num(liq[1]) >= 1 && num(liq[1]) <= L.liqOver + 1e-9, `${tag}: liq ${v['--liq']}`);
  assert.ok(num(v['--fringe']) >= 0 && num(v['--fringe']) <= L.fringeMax + 1e-9, `${tag}: fringe ${v['--fringe']}`);
}

test('the slider maxima are the raised ones (and every preset fits inside them)', () => {
  const max = Object.fromEntries(ANIM_DEFS.map(d => [d.k, d.max]));
  assert.deepEqual(max, { pillWobbleV: 600, pillWobbleH: 600, pillStretch: 600, pillSize: 450, magnify: 600, bounce: 600, speed: 600, jelly: 600, knob: 600, fringe: 750 });
  for (const [name, p] of Object.entries(PRESETS)) for (const d of ANIM_DEFS) assert.ok(p[d.k] === undefined || (p[d.k] >= d.min && p[d.k] <= d.max), `${name}.${d.k}`);
});

test('the default feel is unchanged: the caps only bite at the extremes', () => {
  const v = glassVars({});
  assert.equal(v['--lq-amp'], '1.000'); assert.equal(v['--lq-dur'], '0.650s'); assert.equal(v['--dur-k'], '1.000');
  assert.equal(v['--spring'], 'cubic-bezier(.3,1.450,.5,1)'); assert.equal(v['--liq'], 'cubic-bezier(.3,1.300,.5,1)'); assert.equal(v['--fringe'], '1.20px');
});

test('every preset and the all-max / all-min corners stay inside the glass limits', () => {
  for (const [name, p] of Object.entries(PRESETS)) assertWithinLimits(p, 'preset ' + name);
  assertWithinLimits(ALL, 'all max'); assertWithinLimits(FLOOR, 'all min');
});

test('random slider combinations, garbage and missing values never break the limits', () => {
  let seed = 209; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 400; i++) {
    const o = {}; for (const d of ANIM_DEFS) { const r = rnd(); o[d.k] = r < 0.1 ? 'junk' : r < 0.15 ? null : r < 0.2 ? NaN : d.min + rnd() * (d.max - d.min + 80); }
    assertWithinLimits(o, 'random ' + i);
  }
  assertWithinLimits(undefined, 'undefined'); assertWithinLimits(null, 'null'); assertWithinLimits([], 'array');
});

test('the value the sliders set (A) and the CSS values come from the same clamped numbers', () => {
  const c = cleanAnim({ speed: 9999, bounce: -5 });
  assert.equal(c.speed, 600); assert.equal(c.bounce, 30);
  setAnim(ALL); assert.equal(A.speed, 6); assert.equal(A.bounce, 6);
  setAnim({});   // back to defaults for the other tests
});

test('animation, liquid glass and lens settings travel in a settings file and come back on import', () => {
  const set = { anim: { ...ALL, fringe: 130 }, lyAnim: { blur: 40 }, refract: false, lyricSize: 'Large', recent: ['x'] };
  const text = exportText(buildExport(set, {}, '0.208.0', new Date('2026-11-13T10:00:00Z')));
  const parsed = parseImport(text, DEFS_KNOWN);
  assert.deepEqual(parsed.settings.anim, set.anim, 'the animation studio values are in the file');
  assert.deepEqual(parsed.settings.lyAnim, { blur: 40 }, 'the lyrics animation values are in the file');
  assert.equal(parsed.settings.refract, false, 'the lens refraction switch is in the file');
  assert.equal(parsed.settings.recent, undefined, 'search history is not');
  const groups = groupDiffs({}, parsed.settings, {}, {}).map(g => g.key);
  assert.ok(groups.includes('anim') && groups.includes('lyAnim') && groups.includes('refract'), 'each shows as its own group in the import sheet');
  const anim = groupDiffs({}, parsed.settings, {}, {}).find(g => g.key === 'anim');
  assert.equal(anim.values, 10, 'the liquid glass group counts its 10 sliders');
  const merged = mergeSettings({ anim: { jelly: 50 }, refract: true, tabSize: 'Small' }, pickSettings(parsed.settings, ['anim']));
  assert.deepEqual(merged.anim, set.anim, 'picking only the glass group brings the glass values in');
  assert.equal(merged.refract, true, 'an unticked group keeps its value');
  assert.equal(merged.tabSize, 'Small');
});

test('a file with wrong-kind or out-of-range animation values is cleaned, not trusted', () => {
  const bad = { app: 'liquid-dark', kind: 'settings', version: 1, settings: { anim: { speed: 'fast', bounce: 9999 }, lyAnim: 'nope', refract: 'yes' } };
  const parsed = parseImport(JSON.stringify(bad), DEFS_KNOWN);
  // wrong kinds are dropped on import (the default is used): a text lyAnim, a text refract
  assert.equal(parsed.settings.lyAnim, undefined, 'a string lyAnim is dropped');
  assert.equal(parsed.settings.refract, undefined, 'a text refract is dropped');
  assert.ok(parsed.dropped.includes('lyAnim') && parsed.dropped.includes('refract'));
  // anim is an object, so it is kept on import; its numbers are clamped when the app applies them
  assert.deepEqual(parsed.settings.anim, { speed: 'fast', bounce: 9999 });
  const c = cleanAnim(parsed.settings.anim);
  assert.equal(c.speed, 100, 'a text speed falls back to the default');
  assert.equal(c.bounce, 600, 'an out-of-range bounce is held at the maximum');
  assertWithinLimits(parsed.settings.anim, 'imported junk');
  setAnim({});
});

test('the import sheet names the glass, lyrics and lens groups plainly', () => {
  assert.match(groupLabel('anim'), /Liquid glass/);
  assert.equal(groupLabel('lyAnim'), 'Lyrics animation');
  assert.match(groupLabel('refract'), /Lens refraction/);
  assert.equal(groupLabel('fooBarBaz'), 'Foo Bar Baz', 'an unknown key keeps the split-name label');
  assert.ok(Object.keys(GROUP_LABELS).length >= 20);
});

test('every tappable liquid glass control is wired to the sliders (press squash, wobble or lens)', () => {
  const jelly = readFileSync(new URL('../src/jelly.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');
  const squash = ['.gbtn', '.sbtn', '.chip', '.mini', '.gtile', '.card', '.row', '.setrow', '.searchpill', '.actions button', '.np .bottom button', '.itile[data-act]', '.lscell', '.lssnap', '.statban'];
  for (const s of squash) assert.ok(jelly.includes(s), `press squash covers ${s}`);
  const wobble = ['.gbtn', '.sbtn', '.chip', '.mini', '.gtile', '.card', '.row', '.setrow', '.searchpill', '.toggle', '.statban', '.lscell'];
  for (const s of wobble) assert.ok(main.includes(s), `tap wobble covers ${s}`);
  assert.ok(main.includes('glassVars(set.anim)'), 'applySettings writes the capped glass values');
  assert.ok(!/--spring', 'cubic-bezier\(\.3,' \+ Math\.min\(3/.test(main), 'no uncapped spring left');
  assert.ok(/\.lq-on\{animation:lq-wobble var\(--lq-dur/.test(css), 'the CSS wobble reads --lq-dur (Spring speed)');
  assert.ok(/\.toggle::after\{transition:left calc\(\.24s \* var\(--dur-k/.test(css), 'the toggle knob reads --dur-k and --liq');
  assert.ok(/\.lens::after\{[^}]*var\(--fringe/.test(css), 'the lens edge reads the fringe slider');
});

test('every settings group has its own label in the import sheet (no two rows share a name)', () => {
  const names = Object.values(GROUP_LABELS);
  assert.equal(new Set(names).size, names.length, 'labels are unique');
  assert.equal(groupLabel('tabPct'), 'Glass bar size');
  assert.match(groupLabel('tabSize'), /older/);
});

