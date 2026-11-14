import test from 'node:test'; import assert from 'node:assert/strict';
import { labelFor, rowLabel, LABELS } from '../src/a11y.js';
test('dynamic labels', () => {
  assert.equal(labelFor('pp', { playing: true }), 'Pause'); assert.equal(labelFor('pp', { playing: false }), 'Play');
  assert.equal(labelFor('rep', { repeat: 'one' }), 'Repeat one'); assert.equal(labelFor('rep', { repeat: 'all' }), 'Repeat all'); assert.equal(labelFor('rep', { repeat: 'off' }), 'Repeat off');
  assert.equal(labelFor('fav', { fav: true }), 'Remove from Favorites'); assert.equal(labelFor('fav', {}), 'Add to Favorites');
});
test('static labels + unknown', () => { for (const k of ['back', 'next', 'prev', 'shuf', 'settings', 'trackmenu', 'sleep']) assert.ok(LABELS[k]); assert.equal(labelFor('nope'), null); });
test('rowLabel strips tags and entities', () => { assert.equal(rowLabel('A &amp; B<i>x</i>', 'C', '3:41'), 'A & Bx, C, 3:41'); assert.equal(rowLabel('T', '', null), 'T'); });
