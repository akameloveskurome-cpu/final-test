// BUG #9: pushWidgetCovers() must only tell the widgets to show ORIGINAL covers (empty custom lists) and must not
// contain the old unreachable custom-picture code (lf-artistphoto copies, lf.apsig cache).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';


test('pushWidgetCovers: sends empty custom lists once and never touches pictures or lf.apsig', async () => {
  const calls = { covers: [], artists: [], put: 0, ls: 0 };
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').split('\n');
  const i = src.findIndex(l => l.startsWith('async function pushWidgetCovers'));
  let j = i; while (src[j] !== '}') j++;
  const code = src.slice(i, j + 1).join('\n');
  const mk = () => new Function('Native', 'albums', 'widgetArtists', 'mirrorPut', 'localStorage', 'apicMap',
    'let wcSig = "", waSig = "";\n' + code + '\n; return pushWidgetCovers;')(
    { isNative: true, setWidgetCovers: x => calls.covers.push(x), setWidgetArtists: x => calls.artists.push(x) },
    [{ id: 1 }], () => ['A'], () => { calls.put++; }, { getItem: () => { calls.ls++; return null; }, setItem: () => { calls.ls++; } }, () => ({ x: 'data:image/png;base64,AAAA' }));
  const push = mk();
  await push(); await push();
  assert.deepEqual(calls.covers, [{ alb: {}, art: {} }], 'original covers only, sent once');
  assert.equal(calls.artists.length, 1, 'artist names sent once while unchanged');
  assert.equal(calls.put, 0, 'no custom artist photo is copied for the widgets');
  assert.equal(calls.ls, 0, 'lf.apsig is not read or written');
});

test('pushWidgetCovers: the old unreachable custom-picture code is gone', () => {
  const s = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(!s.includes('lf-artistphoto:'), 'no lf-artistphoto: copies');
  assert.ok(!s.includes('lf.apsig'), 'no lf.apsig cache');
});
