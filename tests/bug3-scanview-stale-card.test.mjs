// BUG #3: a new scan that finishes within 220 ms of the previous "done" card must not leave that old card on screen.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

function fakeEl() {
  const cls = new Set();
  const e = {
    className: '', id: '', innerHTML: '', textContent: '', style: { setProperty() {}, strokeDashoffset: '', width: '' }, firstChild: { nodeValue: '' },
    classList: { add: (...a) => a.forEach(x => cls.add(x)), remove: (...a) => a.forEach(x => cls.delete(x)), contains: x => cls.has(x), toggle: (x, on) => { if (on) cls.add(x); else cls.delete(x); } },
    offsetWidth: 0, appendChild() {}, addEventListener() {}, remove() {},
    querySelector: () => fakeEl(),
  };
  e.cls = cls; return e;
}
const root = fakeEl();
globalThis.document = { createElement: () => root, getElementById: () => ({ appendChild() {} }), body: { appendChild() {} } };

test('start() hides the previous card; a quick second scan leaves no stale card', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const { scanView } = await import('../src/scanview.js');
  scanView.start(); mock.timers.tick(250);                       // scan 1: card appears
  assert.ok(root.cls.has('on'), 'card shown for scan 1');
  scanView.finish({ tracks: [1, 2], newSongs: 1, removed: 0 });  // scan 1 done: "Library updated" card, hides after 1300 ms
  assert.ok(root.cls.has('done'));
  mock.timers.tick(300);                                          // inside the 1300 ms window
  scanView.start(); scanView.finish({ tracks: [1, 2] });         // scan 2 ends before its card is due (220 ms)
  mock.timers.tick(5000);
  assert.ok(!root.cls.has('on'), 'old card must not stay on screen');
  assert.ok(!root.cls.has('done'));
  mock.timers.reset();
});
