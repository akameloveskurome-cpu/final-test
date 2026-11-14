// BUG #8: the lyrics search snippet must be cut around the match even when toLowerCase changes the text length (U+0130).
import test from 'node:test';
import assert from 'node:assert/strict';
import { extract } from './extract.mjs';

const mk = () => {
  const unesc = x => x;
  const lyCache = new WeakMap();
  const lyOf = t => { const s = t.lyric || ''; let c = lyCache.get(t); if (!c || c.s !== s) { const dec = unesc(s); c = { s, dec, low: dec.toLowerCase() }; lyCache.set(t, c); } return c; };
  return extract('src/main.js', 'snip', { lyOf, E: x => x });
};

test('snip: İ before the match shifts the lower-cased index, the snippet still holds the searched word', () => {
  const snip = mk();
  const lyric = 'İ'.repeat(60) + ' and then the NEEDLE appears here ' + 'x'.repeat(200);
  assert.ok(lyric.toLowerCase().length !== lyric.length, 'precondition: lengths differ');
  const out = snip({ lyric }, 'needle');
  assert.ok(out.toLowerCase().includes('needle'), 'snippet contains the word: ' + out);
});

test('snip: plain text is unchanged (match in the middle, at the start)', () => {
  const snip = mk();
  const lyric = 'a'.repeat(100) + ' needle ' + 'b'.repeat(100);
  assert.ok(snip({ lyric }, 'needle').includes('needle'));
  assert.ok(snip({ lyric: 'needle first ' + 'z'.repeat(200) }, 'needle').startsWith('needle first'));
});
