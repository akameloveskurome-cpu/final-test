import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';

const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const jelly = readFileSync(new URL('../src/jelly.js', import.meta.url), 'utf8');
const anim = readFileSync(new URL('../src/animcfg.js', import.meta.url), 'utf8');   // v208: the CSS values are made here (capped)

test('GUARD (CSS/Android build): CSS wobble keyframes follow the animation sliders', () => {
  for (const name of ['lq-wobble', 'lq-wobble-bar']) {
    const m = css.match(new RegExp('@keyframes ' + name + '\\{.*\\}\\}\\n'));
    assert.ok(m, name); assert.ok(m[0].includes('var(--lq-amp'), name + ' reads --lq-amp');
    assert.ok(!/scale\(1\.\d+,/.test(m[0]), name + ' has no fixed squash left');
  }
  assert.ok(!/animation:lq-(wobble|wobble-bar|glint) \.6/.test(css), 'no fixed .6x s wobble duration is left');
  // v208: the values are made by glassVars (capped) in animcfg.js and applySettings writes them
  assert.ok(/'--lq-dur'/.test(anim) && /'--lq-amp'/.test(anim), 'glassVars makes both variables');
  assert.ok(/glassVars\(set\.anim\)/.test(main), 'applySettings sets the variables from glassVars');
});

test('GUARD (CSS/Android build): every tappable glass card is wired to the press wobble and the jelly', () => {
  for (const c of ['.lshome', '.lstop', '.lscell', '.resume', '.lsempty', '.statban', '.profile .pfmain']) assert.ok(main.includes(c), c + ' in main.js wobble list');
  assert.ok(jelly.includes('.lshome') && jelly.includes('.statban') && jelly.includes(',button'), 'jelly list');
});

test('GUARD (CSS/Android build): floating glass has no blur; the tab bar and mini player are pure transparent (no tint, no black, v161)', () => {
  const tail = css.slice(css.indexOf('v148 fix: NO blur anywhere'));
  assert.ok(/html \.tabbar,html \.mini\{background:transparent;/.test(tail));
  assert.ok(!/html \.tabbar,html \.mini\{[^}]*(#000|rgba\(0,0,0|linear-gradient|sheen)/.test(css));   // no rule may tint or darken the bars
  assert.ok(!/blur\(/.test(tail));
});

test('GUARD (CSS/Android build): every CSS spring follows Bounciness + Spring speed; fringe and scrub thumb are wired', () => {
  assert.ok(!/[^\w.-]\.?\d*\.?\d+s var\(--spring\)/.test(css.replace(/calc\([^)]*\) var\(--spring\)/g, '')), 'no fixed-duration --spring left (lyrics animation excluded below)');
  assert.ok(/'--dur-k'/.test(anim) && /'--spring'/.test(anim) && /'--liq'/.test(anim), 'glassVars makes --dur-k, --spring, --liq');
  assert.ok(/glassVars\(set\.anim\)/.test(main), 'applySettings writes them');
  assert.ok(/\.scrub:active \.thumb\{scale:/.test(css) && /inset calc\(var\(--fringe/.test(css));
});

function restoreWorld({ files = {}, mirror = [], quick = [], busy = [] }) {
  const log = [], timers = [], applied = {}, marked = [];
  const db = { get: k => (files[k] === 'throw' ? Promise.reject(new Error('x')) : Promise.resolve(files[k] || null)) };
  const deps = { quickKeys: new Set(quick), mirrorKeys: async () => mirror, picBusy: new Set(busy), bkey: (d, k) => k, repaintPics: () => log.push('repaint'), setTimeout: (f, ms) => timers.push([f, ms]) };
  const fn = extract('src/main.js', 'restorePics', deps, '}');
  return { fn, log, timers, applied, marked, db, apply: (k, b) => { applied[k] = b; }, mark: k => marked.push(k) };
}
test('v157: restorePics loads what is saved, repaints once, retries the missing ones with a growing wait, and stops after the tries', async () => {
  const w = restoreWorld({ files: { a: 'A', b: null, c: 'throw' } });
  await w.fn(['a', 'b', 'c'], w.db, w.apply, 12);
  assert.deepEqual(w.applied, { a: 'A' }); assert.deepEqual(w.log, ['repaint']);
  assert.deepEqual(w.timers.map(t => t[1]), [2000]);   // one retry for the two missing, first wait 2 s
  const w2 = restoreWorld({ files: { b: null } });
  await w2.fn(['b'], w2.db, w2.apply, 3); assert.equal(w2.timers[0][1], 10000);   // wait is capped at 10 s
  const w3 = restoreWorld({ files: { b: null } }); await w3.fn(['b'], w3.db, w3.apply, 1); assert.equal(w3.timers.length, 0, 'last try: no more retries');
});
test('v157: restorePics also finds pictures that exist only as files, skips ones already shown or being loaded, and marks them', async () => {
  const w = restoreWorld({ files: { x: 'X', y: 'Y', z: 'Z' }, mirror: ['pre:x', 'pre:y', 'pre:z'], quick: ['pre:y'], busy: ['z'] });
  await w.fn([], w.db, w.apply, 12, 'pre', w.mark);
  assert.deepEqual(w.applied, { x: 'X' }); assert.deepEqual(w.marked, ['x']);
});
test('GUARD (needs browser): v157 pictures load at once and show everywhere (wiring)', () => {
  assert.match(main, /loadAllPics\(\);   \/\/ v157: at once/);
  assert.match(main, /function reloadMissingPics\(\) \{ try \{ ppBad\.clear\(\)/);
  assert.match(main, /async function ppEnsureAll\(tries = 10\)/);
});

test('GUARD (CSS/Android build): v157: Go to Artist, Up Next and Search show the pictures; widgets get custom covers', () => {
  assert.match(main, /data-act="tm-artist-go" data-id="\$\{n\}">\$\{artistCov\(n, 'thumb'\)\}/);
  assert.match(main, /data-act="q-play" data-qi="\$\{i\}"><span class="thumb cover" style="--g:\$\{gOfT\(t\)\}">/);
  assert.match(main, /async function pushWidgetCovers\(\)/);
  const nat = readFileSync(new URL('../native-android/LiquidNative.java', import.meta.url), 'utf8'), til = readFileSync(new URL('../native-android/LiquidTiles.java', import.meta.url), 'utf8');
  assert.ok(nat.includes('public void setWidgetCovers(PluginCall call)') && til.includes('static void setOverrides(') && til.includes('ovPath(c, artists, key,'));
});

test('GUARD (CSS/Android build): edge fringe reaches every glass rim; row pills follow Pill size; fades follow Spring speed', () => {
  const tok = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  const glide = readFileSync(new URL('../src/glidebar.js', import.meta.url), 'utf8');
  assert.ok(/--spec:[^;]*var\(--fringe-edge\)/.test(tok) && /--spec-lite:[^;]*var\(--fringe-edge\)/.test(tok), 'both rim tokens carry the fringe');
  assert.ok(/data-contrast="1"\]\{ --fringe-a:0/.test(tok), 'Increase Contrast turns the colour fringe off');
  assert.ok(/\* A\.pillSize \* pp/.test(glide) && /0\.06 \* A\.pillSize \* Math\.min\(pp, 1\)/.test(glide), 'button-row pills use Pill size');
  assert.ok(!/visibility 0s linear \.\d+s/.test(css.replace(/@media[^{]*\{[^}]*\{[^}]*\}[^}]*\}/g, '').replace(/html\[data-motion="reduce"\][^{]*\{[^}]*\}/g, '')), 'no fixed hide delay next to a Spring-speed slide');
});
