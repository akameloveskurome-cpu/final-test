// v149: the live refresh of the listening screens patches the page in place (no blinking). Real Chromium (Playwright) runs the real src/morph.js; skipped when no browser is installed.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url))), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
let chromium = null; try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch {}
const code = rd('src/morph.js').replace(/^export /gm, '');
const row = (n, t) => `<button class="row" data-act="x" data-id="${n}"><img class="cv" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt=""><b>${t}</b></button>`;

async function page(fn) {
  const b = await chromium.launch(); try { const p = await b.newPage(); await p.setContent('<div id="root"></div>'); await p.addScriptTag({ content: code + ';window.morphHtml = morphHtml;' }); return await fn(p); } finally { await b.close(); }
}
const skip = !chromium && 'playwright is not installed';

test('unchanged rows are the SAME DOM nodes after a refresh; only the changed text is touched (no re-creation = no blink, no image reload)', { skip }, async () => {
  const r = await page(p => p.evaluate(([a, b]) => {
    const el = document.getElementById('root'); window.morphHtml(el, a); const before = [...el.querySelectorAll('.row')], img = el.querySelector('img');
    let removed = 0; new MutationObserver(m => m.forEach(x => removed += x.removedNodes.length)).observe(el, { childList: true, subtree: true });
    window.morphHtml(el, b); const after = [...el.querySelectorAll('.row')];
    return new Promise(res => setTimeout(() => res({ same: before.map((n, i) => n === after[i]), img: img === el.querySelector('img'), text: after.map(n => n.textContent), removed }), 20));
  }, [row(1, '3 plays') + row(2, '2 plays'), row(1, '4 plays') + row(2, '2 plays')]));
  assert.deepEqual(r.same, [true, true]); assert.equal(r.img, true); assert.deepEqual(r.text, ['4 plays', '2 plays']); assert.equal(r.removed, 0);
});

test('rows added and removed at the end; reordered content is patched in place', { skip }, async () => {
  const r = await page(p => p.evaluate(([a, b, c]) => {
    const el = document.getElementById('root'); window.morphHtml(el, a); const first = el.querySelector('.row');
    window.morphHtml(el, b); const n2 = el.querySelectorAll('.row').length; window.morphHtml(el, c);
    return { n2, n3: el.querySelectorAll('.row').length, keep: first === el.querySelector('.row'), html: el.innerHTML === c.replace(/\s+$/, '') || el.textContent };
  }, [row(1, 'a'), row(1, 'a') + row(2, 'b') + row(3, 'c'), row(1, 'a')]));
  assert.equal(r.n2, 3); assert.equal(r.n3, 1); assert.equal(r.keep, true); assert.equal(r.html, true);
});

test('a text field being typed in keeps its value and focus across a refresh', { skip }, async () => {
  const r = await page(p => p.evaluate(() => {
    const el = document.getElementById('root'), h = t => `<input id="lsfilter" value=""><div id="o">${t}</div>`;
    window.morphHtml(el, h('a')); const i = document.getElementById('lsfilter'); i.focus(); i.value = 'abc';
    window.morphHtml(el, h('b')); return { v: document.getElementById('lsfilter').value, same: document.getElementById('lsfilter') === i, focus: document.activeElement === i, o: document.getElementById('o').textContent };
  }));
  assert.deepEqual(r, { v: 'abc', same: true, focus: true, o: 'b' });
});

test('a different element kind is replaced, a playing video is left alone, attributes are added and removed', { skip }, async () => {
  const r = await page(p => p.evaluate(() => {
    const el = document.getElementById('root'); window.morphHtml(el, '<div class="a" data-x="1"><span>t</span></div><video src="x.mp4"></video>');
    const v = el.querySelector('video'); window.morphHtml(el, '<div class="b"><em>t</em></div><video src="x.mp4"></video>');
    return { cls: el.firstChild.className, x: el.firstChild.hasAttribute('data-x'), tag: el.firstChild.firstChild.tagName, vid: v === el.querySelector('video') };
  }));
  assert.deepEqual(r, { cls: 'b', x: false, tag: 'EM', vid: true });
});

test('GUARD: the live refresh no longer wipes the shown data and renders in place', () => {
  const L = rd('src/lstats.js'), M = rd('src/main.js');
  assert.doesNotMatch(L, /periodAt = Date\.now\(\); S\.key = ''; S\.all = null;/); assert.doesNotMatch(L, /const dirty = \(\) => \{[^}]*S\.all = null/);
  assert.match(M, /morphHtml\(el, subHtml\)/); assert.match(M, /morphHtml\(m, screens\.home\(\)\)/);
});
