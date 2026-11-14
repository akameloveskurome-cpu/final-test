import test from 'node:test';
import assert from 'node:assert/strict';
import { setLibrary, tracks, unesc } from '../src/data.js';

// Same check the Search screen runs (src/main.js: has = unesc(stored).toLowerCase().includes(q)).
const has = (stored, q) => unesc(stored).toLowerCase().includes(q);

test('lyrics search finds the LAST word of a ~10 min song with 60,000+ characters', () => {
  let lyric = '', i = 0;
  while (lyric.length < 60000) lyric += `la la word${i++} & <b> "q" la\n`;
  lyric += 'zyxwvuendword';
  assert.ok(lyric.length > 60000);
  setLibrary([{ uri: 'content://x/tree/p%3A/document/p%3AMusic%2FA%2Flong.flac', album: 'Hits', artist: 'A', albumArtist: '', aaTag: false, title: 'Long', dur: 600, bits: 16, khz: 44.1, lyric }]);
  const t = tracks.find(x => x.title === 'Long');
  assert.ok(t.lyric.length >= 60000, 'stored lyric keeps every character');
  const hits = tracks.filter(x => x.lyric && has(x.lyric, 'zyxwvuendword'));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].title, 'Long');
  assert.ok(has(t.lyric, 'word0 &'));                        // start, with an escaped character
  assert.ok(has(t.lyric, `word${i - 1} & <b> "q" la`));      // end
});
