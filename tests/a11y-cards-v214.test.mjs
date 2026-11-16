// v214: accessibility of the two permission cards (Allow background activity, and the Accessibility steps).
// (1) Back / Escape closes an Accessibility card (= Not now, this open only) and the background card (= Later).
// (2) While a card is open the app behind it is inert, focus moves onto the card's main button, and focus goes back when it closes.
// (3) Every tutorial screenshot has a real text description (alt), and step 2 has a route that needs no long press.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const rd = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Back and Escape close the Accessibility card (Not now) and the background card (Later)', () => {
  const m = rd('src/main.js');
  assert.match(m, /if \(assistCardOpen\(\)\) return assistBack\(\);/, 'closeTop handles the accessibility card');
  assert.match(m, /if \(document\.getElementById\('lf-bgallow'\)\) return bgAllowClose\(\);/, 'closeTop handles the background card');
  const a = rd('src/assist.js');
  assert.match(a, /export function assistBack\(\) \{ if \(!assistCardOpen\(\)\) return false; stage = 3; close\(\); return true; \}/);
  assert.match(m, /assistBack, assistCardOpen \} from '\.\/assist\.js'/);
});

test('the app behind a permission card is inert, and syncModal keeps the card in charge of focus', () => {
  const m = rd('src/main.js');
  assert.match(m, /const card = !!document\.getElementById\('lf-bgallow'\) \|\| !!document\.getElementById\('lf-assist'\);/);
  assert.match(m, /inertOf\('#main,#sub,#mini,#tabs', card \|\| np \|\| lyr \|\| sheet\)/);
  assert.match(m, /inertOf\('#sheet', card\)/);
  assert.match(m, /const topSel = card \? '' : sheet/);
  assert.match(m, /setLayerSync\(syncModal\);/);
});

test('both cards take focus on open and give it back on close', () => {
  const c = rd('src/cardlayer.js');
  assert.match(c, /export function enterCard\(card, goSelector\)/);
  assert.match(c, /export function leaveCard\(opener\)/);
  const b = rd('src/bgallow.js');
  assert.match(b, /enterCard\(o, '\[data-bg="go"\]'\)/);
  assert.match(b, /leaveCard\(f\)/);
  const a = rd('src/assist.js');
  assert.match(a, /enterCard\(o, '\[data-as="go"\]'\)/);
  assert.match(a, /leaveCard\(f\)/);
});

test('the permission cards draw no red focus ring (v215), but still take focus', () => {
  const css = rd('src/styles/app.css');
  assert.match(css, /#lf-bgallow button:focus,#lf-bgallow button:focus-visible,#lf-assist button:focus,#lf-assist button:focus-visible\{outline:none\}/);
});

test('every tutorial screenshot has a real description, and none is announced as empty', () => {
  const pics = rd('src/assistpics.js');
  const keys = [...pics.matchAll(/^\s{2}(\w+): 'data:image/gm)].map(x => x[1]);
  const alt = pics.slice(pics.indexOf('export const ASSIST_ALT'));
  assert.ok(keys.length >= 10, 'screenshots found');
  for (const k of keys) {
    const m = new RegExp('\\b' + k + ": '([^']+)'").exec(alt);
    assert.ok(m && m[1].length > 10, `screenshot ${k} needs alt text`);
  }
  const a = rd('src/assist.js');
  assert.doesNotMatch(a, /<img alt=""/, 'no screenshot is hidden from screen readers');
});

test('step 2 has a text-only route that does not rely on the long press', () => {
  const a = rd('src/assist.js');
  assert.match(a, /Cannot long press\? Open Android <b>Settings<\/b>, find <b>Liquid Dark<\/b> in the apps list/);
  assert.match(a, /Allow restricted settings/, 'the existing step 2 text is still there');
});

test('step 2 exitApp opens the HOME screen first, then closes the app (no jump to the previous app)', () => {
  const j = rd('native-android/LiquidNative.java');
  const body = j.slice(j.indexOf('public void exitApp(PluginCall call)'), j.indexOf('public void openAccessibilityList'));
  assert.match(body, /Intent\.CATEGORY_HOME/);
  assert.match(body, /Intent\.ACTION_MAIN/);
  assert.ok(body.indexOf('CATEGORY_HOME') < body.indexOf('finishAndRemoveTask'), 'home first, then close');
});
