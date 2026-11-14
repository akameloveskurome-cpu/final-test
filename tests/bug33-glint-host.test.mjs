// BUG #33: every tap-glint host listed in jelly's SEL / the glint rule needs position:relative, otherwise ::after{position:absolute;inset:0} is sized by an ancestor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');
const rel = css.split('\n').filter(l => /\{position:relative\}$/.test(l.trim())).flatMap(l => l.slice(0, l.lastIndexOf('{')).split(',').map(x => x.trim()));

test('.mini .mb and .searchpill (glint hosts) are position:relative', () => {
  assert.ok(rel.includes('.mini .mb'), '.mini .mb');
  assert.ok(rel.includes('.searchpill'), '.searchpill');
});
test('.mini keeps its own position:absolute rule (the relative list must not override it)', () => {
  assert.ok(/\.tabbar,\.mini\{position:absolute\}/.test(css));
});
