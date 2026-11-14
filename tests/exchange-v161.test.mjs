// v161: listening export by period, listening import preview counts, settings import by group, playlist "don't import".
import test from 'node:test';
import assert from 'node:assert/strict';
import { inPeriod, countInHistory, playKeysOf, PERIODS } from '../src/listenio.js';
import { groupDiffs, pickSettings, EXTRAS_GROUP } from '../src/settingsio.js';

const now = new Date(2026, 10, 8, 12);   // 8 Nov 2026
const segs = [
  { s: new Date(2025, 5, 1).getTime(), t: 'Old', a: 'A' },        // last year, before the 12 month window
  { s: new Date(2025, 11, 20).getTime(), t: 'Winter', a: 'B' },   // within the last 12 months, not this year
  { s: new Date(2026, 2, 3).getTime(), t: 'Spring', a: 'C' },     // this year
];

test('export periods: all time keeps everything, this year starts 1 Jan, last 12 months starts a year back today', () => {
  assert.deepEqual(PERIODS.map(p => p.id), ['all', 'year', '12m']);
  assert.equal(inPeriod(segs, 'all', now).length, 3);
  assert.deepEqual(inPeriod(segs, 'year', now).map(g => g.t), ['Spring']);
  assert.deepEqual(inPeriod(segs, '12m', now).map(g => g.t), ['Winter', 'Spring']);
  assert.equal(inPeriod(segs, 'nonsense', now).length, 3);   // unknown period: nothing is dropped
  assert.equal(inPeriod(segs, 'all').length, 3);   // the input is not changed (a copy comes back)
});

test('import preview: how many records of a file are already in the history, and how many it holds', () => {
  const have = playKeysOf([{ s: segs[2].s, t: 'Spring', a: 'C' }]);   // one record already there
  const parsed = { plays: [{ start: segs[2].s, title: 'Spring', artist: 'C' }, { start: segs[1].s, title: 'Winter', artist: 'B' }] };
  assert.deepEqual(countInHistory(parsed, have), { total: 2, already: 1 });
  assert.deepEqual(countInHistory({ segs: [{ s: segs[2].s, t: 'Spring', a: 'C' }] }, have), { total: 1, already: 1 });
  assert.deepEqual(countInHistory({ plays: [] }, new Set()), { total: 0, already: 0 });
});

test('settings groups: new, changed or the same as now; search history is not a group; the extras are one group', () => {
  const current = { lyricSize: 'Large', tabPct: 90, recent: ['x'] };
  const imported = { lyricSize: 'Small', tabPct: 90, brandNew: { a: 1, b: 2 }, recent: ['y'] };
  const g = groupDiffs(current, imported, { 'lf.canvasOn': '1' }, {});
  const by = Object.fromEntries(g.map(x => [x.key, x]));
  assert.equal(by.lyricSize.status, 'changed'); assert.equal(by.tabPct.status, 'same'); assert.equal(by.brandNew.status, 'new'); assert.equal(by.brandNew.values, 2);
  assert.equal(by.recent, undefined);
  assert.equal(by[EXTRAS_GROUP].status, 'new'); assert.equal(by[EXTRAS_GROUP].values, 1);
  assert.equal(groupDiffs(current, imported, { 'lf.canvasOn': '1' }, { 'lf.canvasOn': '1' }).find(x => x.key === EXTRAS_GROUP).status, 'same');
});

test('only the ticked groups are taken from a settings file; search history and unticked groups are never copied', () => {
  const imported = { lyricSize: 'Small', tabPct: 60, recent: ['z'] };
  assert.deepEqual(pickSettings(imported, ['lyricSize']), { lyricSize: 'Small' });
  assert.deepEqual(pickSettings(imported, []), {});
  assert.deepEqual(pickSettings(imported, ['recent', 'tabPct']), { tabPct: 60 });   // recent is never taken
});
