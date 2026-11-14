import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('the size setting is called "Glass bar size" in Settings and in the Animation screen, never "Tab bar size"', () => {
  assert.ok(!/Tab bar size/.test(main), 'no "Tab bar size" label is left in src/main.js');
  assert.equal((main.match(/Glass bar size<(span|em)/g) || []).length, 2, 'one row in Display options and one in the Animation screen');
});

test('the Animation screen has its own Glass bar size slider that drives the same setting (tabPct) and keeps its % label in sync', () => {
  const anim = main.slice(main.indexOf('animation: () =>'), main.indexOf('lysize: () =>'));
  assert.ok(anim.indexOf('data-tabpct') < anim.indexOf('animchips') + anim.slice(anim.indexOf('animchips')).indexOf('</div></div>') + 12, 'the slider is inside the pinned .animdock, next to the test bar');
  assert.match(anim, /data-tabpct[^>]*value="\$\{set\.tabPct\}"/);
  assert.match(anim, /data-tabv>\$\{set\.tabPct\}%/);
  assert.match(main, /querySelectorAll\('\[data-tabv\]'\)/);
});
