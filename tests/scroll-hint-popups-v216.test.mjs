// v216 (owner): the red "Scroll down" hint is only for the popup cards. Pages, lists, sheets and grids get no hint.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const rd = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the scroll hint selects only the popup cards', () => {
  const s = rd('src/scrollhint.js');
  const m = /const SEL = '([^']+)';/.exec(s);
  assert.ok(m, 'SEL found');
  assert.equal(m[1], '#sheet .popcard, #lf-assist > div');
  for (const bad of ['.screen', '.picklist', '.infobox', '.qlist', '.grid', '#sheet .sheetbox']) {
    assert.ok(!m[1].split(', ').includes(bad), `no hint on ${bad}`);
  }
});
