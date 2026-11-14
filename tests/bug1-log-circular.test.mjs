// BUG #1: the log must print a repeated (non-circular) reference in full; only a true cycle is "[circular]".
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.addEventListener = globalThis.addEventListener || (() => {});
const log = await import('../src/log.js');

test('log: shared reference printed, real cycle marked', () => {
  const shared = { x: 1 };
  log.logLine('E', { a: shared, b: shared });
  const cyc = { n: 1 }; cyc.self = cyc;
  log.logLine('E', cyc);
  const rep = log.buildReport({ native: '', info: {} });
  const shareLine = rep.split('\n').find(l => l.includes('"a"'));
  const cycLine = rep.split('\n').find(l => l.includes('"self"'));
  assert.ok(shareLine.includes('"b":{"x":1}'), 'the shared reference is printed in full');
  assert.ok(!shareLine.includes('"b":"[circular]"'), 'a repeated reference is not marked circular');
  assert.ok(cycLine.includes('"self":"[circular]"'), 'a real cycle is still marked');
});
