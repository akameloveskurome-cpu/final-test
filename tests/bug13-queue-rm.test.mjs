// BUG #13: Up Next "remove" must not fail silently when the native remove is rejected.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';

test('q-rm: a rejected remove shows a message and refreshes the queue', async () => {
  const toasts = []; let refreshed = 0; let unhandled = 0;
  const onUnhandled = () => { unhandled++; };
  process.on('unhandledRejection', onUnhandled);
  const Native = { state: { index: 0, queue: [1, 2, 3] }, removeItem: () => Promise.reject(new Error('native failed')) };
  const deps = { Native, toast: m => toasts.push(m), queueSheet: () => { refreshed++; }, closeSheet: () => {}, playFail: () => {}, nameSheet: () => {}, sheetItemsOf: () => [] };
  const queueAction = extract('src/main.js', 'queueAction', deps, '}');
  assert.equal(queueAction('q-rm', { qi: '2' }), true, 'q-rm is handled');
  await new Promise(r => setTimeout(r, 30));
  process.off('unhandledRejection', onUnhandled);
  assert.deepEqual(toasts, ['Could not change the queue'], 'the user is told');
  assert.equal(refreshed, 1, 'the list is refreshed');
  assert.equal(unhandled, 0, 'no unhandled rejection');
});
