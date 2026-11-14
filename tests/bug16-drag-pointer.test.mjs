// BUG #16: the scrubber drag and the A/B mark drag must follow only the finger that started them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lines = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').split('\n');
const a = lines.findIndex((l, i) => l === "document.addEventListener('pointerdown', e => {" && lines[i + 1].includes("e.target.closest('.abm')"));
assert.ok(a >= 0, 'pointerdown handler found');
let b = a; while (lines[b] !== '});') b++;
const handlerSrc = lines.slice(a, b + 1).join('\n');

function world({ withMarks = false } = {}) {
  const listeners = {}, seeks = [], log = [];
  const sc = { id: 'scrub', getBoundingClientRect: () => ({ left: 0, width: 100 }) };
  const mark = { id: 'abA' };
  const hit = sel => ({ '#scrub': sc, '.abm': withMarks ? mark : null }[sel] || null);
  const Native = { current: () => ({ id: 's1', dur: 200 }), state: { pos: 0, playing: false }, seek: p => seeks.push(p) };
  const scr = { drag: false, dpos: 0, raf: 0, pos: 0, at: 0 };
  let ab = { id: 's1', a: withMarks ? 50 : null, b: withMarks ? 150 : null };
  let captured;
  const document = { addEventListener: (n, f) => { if (n === 'pointerdown') captured = f; } };
  const deps = { document, Native, scr, ab, $: () => sc, paintScrub: () => {}, scrubKick: () => {}, scrubPos: () => 0, abSave: () => log.push('abSave'), renderNP: () => {}, progress: () => {},
    addEventListener: (n, f) => { (listeners[n] = listeners[n] || new Set()).add(f); }, removeEventListener: (n, f) => { listeners[n] && listeners[n].delete(f); } };
  new Function(...Object.keys(deps), handlerSrc)(...Object.values(deps));
  const fire = (n, ev) => [...(listeners[n] || [])].forEach(f => f(ev));
  const down = (pid, x, isPrimary = true, target = null) => captured({ target: { closest: sel => (target ? (sel === '.abm' ? mark : sc) : hit(sel)) }, button: 0, isPrimary, pointerId: pid, clientX: x, preventDefault() {}, stopPropagation() {} });
  return { seeks, log, scr, fire, down, count: () => Object.values(listeners).reduce((n, s) => n + s.size, 0) };
}

test('scrubber: a second finger moving or lifting does not seek to its position', () => {
  const w = world();
  w.down(1, 10);                                   // finger 1 grabs the bar
  w.down(2, 90, false);                            // finger 2 touches the bar (not primary)
  assert.equal(w.count(), 3, 'only one set of listeners (move, up, cancel)');
  w.fire('pointermove', { pointerId: 2, clientX: 80 });
  assert.equal(w.scr.dpos, 20, 'finger 2 does not move the knob (10% of 200 s)');
  w.fire('pointerup', { pointerId: 2, clientX: 95 });
  assert.deepEqual(w.seeks, [], 'finger 2 lifting does not seek');
  assert.equal(w.scr.drag, true, 'the drag of finger 1 is still active');
  w.fire('pointermove', { pointerId: 1, clientX: 50 });
  w.fire('pointerup', { pointerId: 1, clientX: 50 });
  assert.deepEqual(w.seeks, [100], 'finger 1 seeks to its own position');
  assert.equal(w.scr.drag, false);
  assert.equal(w.count(), 0, 'listeners removed');
});

test('scrubber: a single finger still works (move, release, cancel)', () => {
  const w = world();
  w.down(7, 25); w.fire('pointerup', { pointerId: 7, clientX: 75 });
  assert.deepEqual(w.seeks, [150]);
  const c = world(); c.down(3, 10); c.fire('pointercancel', { pointerId: 3, clientX: 60 });
  assert.deepEqual(c.seeks, [], 'cancel does not seek'); assert.equal(c.count(), 0);
});

test('A/B mark drag: a second finger does not end or move it', () => {
  const w = world({ withMarks: true });
  w.down(1, 25, true, true);
  assert.equal(w.count(), 3);
  w.down(2, 80, false, true);
  assert.equal(w.count(), 3, 'no second set of listeners');
  w.fire('pointerup', { pointerId: 2, clientX: 80 });
  assert.deepEqual(w.log, [], 'finger 2 lifting does not end the mark drag');
  w.fire('pointerup', { pointerId: 1, clientX: 25 });
  assert.deepEqual(w.log, ['abSave'], 'finger 1 lifting ends it');
  assert.equal(w.count(), 0);
});
