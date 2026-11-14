import test from 'node:test';
import assert from 'node:assert/strict';
import { csvText, csvParse } from '../src/transfer.js';
import { buildExport, parseListens } from '../src/listenio.js';

test('a name that starts with = + - @ comes back unchanged after export and import (no stray apostrophe)', () => {
  const rows = [['-Heroes', '+44', '@home', '=x', '-1.5', "it's", 'a,b']];
  assert.deepEqual(csvParse(csvText(rows)), rows);
  const segs = [{ i: '1', t: '-Heroes', a: '+44', al: '@Album', s: Date.now() - 3600e3, d: 60000, q: 1, f: 1, sid: 's', pid: 'p', n: 0 }];
  const r = parseListens(buildExport('csv', segs).text, 'x.csv');
  assert.equal(r.plays[0].title, '-Heroes'); assert.equal(r.plays[0].artist, '+44'); assert.equal(r.plays[0].album, '@Album');
});

test('a value with a tab inside is quoted, so the delimiter is still detected as a comma on re-import', () => {
  const rows = [['a\tb\tc', 'x'], ['1', '2']];
  assert.deepEqual(csvParse(csvText(rows)), rows);
});
