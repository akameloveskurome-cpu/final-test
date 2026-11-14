import test from 'node:test'; import assert from 'node:assert/strict';
import { greetingFor, messageCount, pickK, hourLabel } from '../src/greeting.js';
test('every hour has 200+ different messages, with and without a name', () => {
  for (let h = 0; h < 24; h++) {
    assert.ok(messageCount(h) >= 200, 'hour ' + h);
    for (const name of ['', 'Sam']) {
      const set = new Set(); for (let k = 0; k < messageCount(h); k++) set.add(greetingFor(h, name, k));
      assert.equal(set.size, messageCount(h), `hour ${h} name "${name}"`);
    }
  }
});
test('no message is shared between two different hours (each hour has its own 210)', () => {
  for (const name of ['', 'Sam']) {
    const seen = new Map();
    for (let h = 0; h < 24; h++) for (let k = 0; k < messageCount(h); k++) { const g = greetingFor(h, name, k); assert.ok(!seen.has(g), `"${g}" is in hour ${seen.get(g)} and hour ${h}`); seen.set(g, h); }
    assert.equal(seen.size, 24 * 210);
  }
});
test('clean text: no braces, double spaces or stray commas; name included', () => {
  for (let h = 0; h < 24; h++) for (let k = 0; k < messageCount(h); k++) {
    const g = greetingFor(h, '', k), w = greetingFor(h, 'Sam', k);
    assert.ok(!/[{}]/.test(g + w) && !/\s\s/.test(g) && !/,\s*[.?!,]/.test(g) && !/\s[.?!,]/.test(g), g);
    assert.ok(w.includes('Sam'), w); assert.match(g, /^[A-Z0-9]/, g);
  }
});
test('hour labels and hour specific text', () => {
  assert.equal(hourLabel(0), 'midnight'); assert.equal(hourLabel(12), 'noon'); assert.equal(hourLabel(7), '7 AM'); assert.equal(hourLabel(15), '3 PM');
  assert.ok(greetingFor(7, '', 0).startsWith('It is 7 AM.')); assert.ok(greetingFor(7, 'Sam', 0).startsWith('It is 7 AM, Sam.')); assert.ok(greetingFor(12, '', 0).startsWith('It is noon.'));
});
test('bad hours wrap, pickK avoids the last one', () => {
  assert.equal(greetingFor(24, 'A', 5), greetingFor(0, 'A', 5)); assert.equal(greetingFor('x', 'A', 5), greetingFor(0, 'A', 5));
  assert.notEqual(pickK(9, 4, () => 4 / messageCount(9)), 4);
});
