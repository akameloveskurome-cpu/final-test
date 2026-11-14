// v149: in-place refresh. Instead of el.innerHTML = html (which destroys and re-creates every row, cover and bar, so the whole screen blinks and covers are decoded again),
// the new html is parsed off-screen and only what differs is changed: text, attributes, and rows that were added or removed. Elements that did not change are never touched,
// so images do not reload, CSS animations do not restart, scroll and focus stay, and a text field being typed in keeps its value. Pure DOM, tests/morph.test.mjs.

const KEEP = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function syncAttrs(a, b) {
  for (const { name } of Array.from(a.attributes)) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value } of Array.from(b.attributes)) {
    if (KEEP.has(a.tagName) && name === 'value') continue;   // never overwrite what the person typed
    if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  }
}

function sameKind(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType === 1) return a.tagName === b.tagName && (a.id || '') === (b.id || '');
  return true;
}

/** Makes the children of `a` equal to the children of `b` (b is a throw-away tree). */
export function morphChildren(a, b) {
  const nb = Array.from(b.childNodes);
  let i = 0;
  for (; i < nb.length; i++) {
    const cur = a.childNodes[i], want = nb[i];
    if (!cur) { a.appendChild(want); continue; }
    if (!sameKind(cur, want)) { a.replaceChild(want, cur); continue; }
    if (cur.nodeType === 3 || cur.nodeType === 8) { if (cur.nodeValue !== want.nodeValue) cur.nodeValue = want.nodeValue; continue; }
    if (cur.isEqualNode(want)) continue;   // identical subtree: not touched at all
    syncAttrs(cur, want);
    if (cur.tagName === 'VIDEO' || cur.tagName === 'IFRAME') continue;   // media keeps playing
    if (KEEP.has(cur.tagName)) continue;
    morphChildren(cur, want);
  }
  while (a.childNodes.length > nb.length) a.removeChild(a.lastChild);
}

/** el.innerHTML = html, but in place. Falls back to a plain assignment when there is no DOM template support. */
export function morphHtml(el, html) {
  if (!el) return;
  if (!el.firstChild || typeof document === 'undefined' || !document.createElement) { el.innerHTML = html; return; }
  const t = document.createElement('template'); t.innerHTML = html;
  morphChildren(el, t.content);
}
