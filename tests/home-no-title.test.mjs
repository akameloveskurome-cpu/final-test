import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('Home screen has no big Home title', () => {
  const s = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(!s.includes('<h1 class="large">Home</h1>'));
  assert.ok(s.includes('<h1 class="large">Albums</h1>'));
});
