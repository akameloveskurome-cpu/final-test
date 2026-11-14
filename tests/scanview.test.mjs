import test from 'node:test';
import assert from 'node:assert/strict';
import { scanState, doneState } from '../src/scanview.js';

test('scanState: walking the folders is indeterminate and counts what was found', () => {
  assert.deepEqual(scanState({ phase: 'walk', found: 0 }), { title: 'Finding your music', count: 'Looking through your folders…', pct: 0, indeterminate: true });
  assert.equal(scanState({ phase: 'walk', found: 1 }).count, '1 song found');
  assert.equal(scanState({ phase: 'walk', found: 12345 }).count, '12,345 songs found');
});

test('scanState: reading shows done / total and a whole-number percent that only reaches 100 at the end', () => {
  const s = scanState({ done: 1240, total: 4310, phase: 'read' });
  assert.equal(s.title, 'Scanning your music'); assert.equal(s.count, '1,240 / 4,310 songs'); assert.equal(s.pct, 28); assert.equal(s.indeterminate, false);
  assert.equal(scanState({ done: 4309, total: 4310 }).pct, 99);
  assert.equal(scanState({ done: 4310, total: 4310 }).pct, 100);
});

test('scanState: bad numbers are clamped, an unknown total falls back to the indeterminate look', () => {
  assert.equal(scanState({ done: 9999, total: 10 }).count, '10 / 10 songs');
  assert.equal(scanState({ done: -5, total: 10 }).pct, 0);
  assert.equal(scanState({ done: 3, total: 0, phase: 'read' }).indeterminate, true);
  assert.equal(scanState().indeterminate, true);
  assert.equal(scanState({ done: 'x', total: 'y' }).indeterminate, true);
});

test('scanState: saving is a full ring', () => {
  assert.deepEqual(scanState({ done: 4310, total: 4310, phase: 'save' }), { title: 'Saving your library', count: '4,310 songs', pct: 100, indeterminate: false });
  assert.equal(scanState({ total: 1, phase: 'save' }).count, '1 song');
});

test('doneState: song count plus what changed', () => {
  assert.deepEqual(doneState({ tracks: new Array(4310), newSongs: 12, removed: 3 }), { title: 'Library updated', count: '4,310 songs', note: '12 new · 3 removed' });
  assert.equal(doneState({ tracks: [1] }).count, '1 song');
  assert.equal(doneState({ tracks: [1, 2] }).note, '');
  assert.equal(doneState().count, '0 songs');
});
