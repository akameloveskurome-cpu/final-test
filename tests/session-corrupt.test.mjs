import test from 'node:test';
import assert from 'node:assert/strict';
localStorage.setItem('lf.session', '{not json');
const { Native } = await import('../src/native.js');
const { restoreSession } = await import('../src/session.js');
test('a corrupt session file is ignored (no crash, nothing restored)', async () => {
  assert.equal(await restoreSession(), false); assert.equal(Native.state.queue.length, 0); assert.equal(Native.state.index, -1);
});
