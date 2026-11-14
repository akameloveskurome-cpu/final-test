// BUG-311: behaviour test. Runs glidebar's force() on fake pointer events (extracted from the real source line, so a rename/reformat of other code does not matter).
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/glidebar.js', import.meta.url), 'utf8');
const line = src.split('\n').find(l => /const force = e =>/.test(l)).replace(/\/\/.*$/, '');
function make() { return new Function(`let pNot = false; ${line}; return { force, reset: () => { pNot = false; } };`)(); }
const ev = (p, w = 0, h = 0, t = 'touch') => ({ pressure: p, width: w, height: h, pointerType: t });
test('device with no pressure (only 0.5 all gesture) uses contact size', () => { const g = make(); assert.equal(g.force(ev(0.5, 54, 54)), 1); assert.equal(g.force(ev(0.5, 54, 54)), 1); });
test('real 0.5 after another reading is used as pressure', () => { const g = make(); g.force(ev(0.3, 12, 12)); assert.equal(g.force(ev(0.5, 12, 12)), 0.625); });
test('new gesture resets', () => { const g = make(); g.force(ev(0.3)); g.reset(); assert.equal(g.force(ev(0.5, 12, 12)), 0); });
test('mouse ignores pressure', () => { const g = make(); assert.equal(g.force(ev(0.9, 12, 12, 'mouse')), 0); });
test('normal pressure unchanged', () => { const g = make(); assert.equal(g.force(ev(0.8, 12, 12)), 1); });
