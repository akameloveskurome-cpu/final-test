import test from 'node:test';
import assert from 'node:assert/strict';
import { hourSummary, hour12, hour12s, fmtShort, aggregate, rangeOf, rank, streaks, shiftRef, sumMs, dayNum } from '../src/listenstats.js';
const meta = g => ({ id: g.i, title: g.t, artists: [g.a], albumKey: g.al, album: g.al, genres: [] });
const M = 60000;
test('midnight playback is split between the two days; plays count once', () => {
  const s = new Date(2026, 2, 1, 23, 50).getTime(), seg = [{ i: 'x', t: 'X', a: 'A', al: 'Al', s, d: 20 * M, f: 0, q: 1, sid: '1' }];
  const d1 = rangeOf('daily', s), d2 = rangeOf('daily', s + 864e5);
  assert.equal(aggregate(seg, d1.from, d1.to, meta).totalMs, 10 * M); assert.equal(aggregate(seg, d2.from, d2.to, meta).totalMs, 10 * M);
  assert.equal(aggregate(seg, d1.from, d1.to, meta).plays + aggregate(seg, d2.from, d2.to, meta).plays, 1);
});
test('week is Monday-Sunday, leap year month length, year bounds', () => {
  const w = rangeOf('weekly', new Date(2026, 10, 7).getTime()); assert.equal(new Date(w.from).getDay(), 1); assert.equal(Math.round((w.to - w.from) / 864e5), 7);
  const f = rangeOf('monthly', new Date(2028, 1, 10).getTime()); assert.equal(Math.round((f.to - f.from) / 864e5), 29);
  assert.equal(new Date(shiftRef('monthly', new Date(2026, 0, 31).getTime(), -1)).getMonth(), 11);
});
test('foreground/background, skips, replays, ranking, least/alpha sorting', () => {
  const t = new Date(2026, 5, 3, 10).getTime(), g = (i, d, f, q, k) => ({ i, t: i, a: 'A', al: 'Al', s: t + k * 1e6, d: d * 1000, f, q, sid: 's', pid: i + k });
  const r = rangeOf('daily', t), A = aggregate([g('a', 200, 1, 1, 0), g('a', 200, 0, 1, 1), g('b', 15, 0, 0, 2), g('c', 100, 1, 1, 3)], r.from, r.to, meta);
  assert.equal(A.songs.get('a').plays, 2); assert.equal(A.songs.get('b').plays, 0); assert.equal(A.bgMs, 215000); assert.equal(A.fgMs, 300000);
  assert.deepEqual(rank(A.songs).map(x => x.id), ['a', 'c', 'b']); assert.deepEqual(rank(A.songs, 'least').map(x => x.id), ['b', 'c', 'a']); assert.deepEqual(rank(A.songs, 'alpha').map(x => x.id), ['a', 'b', 'c']);
  assert.equal(sumMs([g('a', 60, 1, 1, 0)], 0, 4e15), 60000);
});
test('streaks', () => { assert.deepEqual(streaks([10, 9, 8, 5, 4], 10), { current: 3, best: 3 }); assert.deepEqual(streaks([9, 8], 10), { current: 2, best: 2 }); assert.deepEqual(streaks([], 10), { current: 0, best: 0 }); assert.equal(dayNum(Date.now()) > 20000, true); });
import { dayNight } from '../src/listenstats.js';
test('solar / lunar split comes from the hourly totals and adds to 100', () => {
  const h = new Array(24).fill(0); h[10] = 3 * 60000; h[23] = 1 * 60000;
  const n = dayNight({ totalMs: 4 * 60000, hours: h }); assert.deepEqual([n.solar, n.lunar, n.kind], [75, 25, 'solar']);
  h[10] = 0; h[23] = 60000; h[2] = 60000; assert.equal(dayNight({ totalMs: 2 * 60000, hours: h }).kind, 'lunar');
  assert.equal(dayNight({ totalMs: 0, hours: h }), null);
});

// v145b: solar / lunar comes from the SAME listening segments as every other number (no separate store); it must add up with them.
import { hoursOf, aggregate as agg2 } from '../src/listenstats.js';
test('solar / lunar: split at 18:00, crossing midnight, and always equal to the aggregate\'s hours', () => {
  const M2 = 60000, day = new Date(2026, 5, 10).getTime();
  const segs = [
    { i: 'a', t: 'A', a: 'X', al: 'Al', s: day + (17 * 60 + 50) * M2, d: 20 * M2, f: 1, q: 1, sid: '1' },   // 17:50-18:10: 10 min day, 10 min night
    { i: 'b', t: 'B', a: 'X', al: 'Al', s: day + (23 * 60 + 50) * M2, d: 20 * M2, f: 0, q: 1, sid: '2' },   // 23:50-00:10: all night, 10 min of it on the next day
    { i: 'c', t: 'C', a: 'X', al: 'Al', s: day + (5 * 60 + 55) * M2, d: 10 * M2, f: 0, q: 0, sid: '3' },    // 05:55-06:05: 5 min night, 5 min day
  ];
  const from = day, to = day + 864e5, h = hoursOf(segs, from, to), A = agg2(segs, from, to, g => ({ id: g.i, title: g.t, artists: [g.a], albumKey: g.al, album: g.al, genres: [] }));
  assert.deepEqual(h.hours, A.hours); assert.equal(h.totalMs, A.totalMs);
  assert.equal(h.hours.reduce((x, y) => x + y, 0), h.totalMs);                    // nothing lost or double counted
  assert.equal(h.totalMs, (20 + 10 + 10) * M2);                                     // the 10 min after midnight belong to the next day
  const n = dayNight(h); assert.equal(n.solar + n.lunar, 100);
  assert.equal(Math.round(h.hours.slice(6, 18).reduce((x, y) => x + y, 0) / M2), 15);   // 10 min (17:50-18:00) + 5 min (06:00-06:05)
});

test('v148 hour chart: 11:50-12:10 lands 10 min in 11 AM and 10 min in 12 PM, the summary names the right hours', () => {
  const t = new Date(2026, 10, 11, 11, 50).getTime(), h = hoursOf([{ s: t, d: 20 * M }], new Date(2026, 10, 11).getTime(), new Date(2026, 10, 12).getTime());
  const sm = hourSummary(h.hours);
  assert.deepEqual(sm.active.map(x => [x.h, x.ms / M]), [[11, 10], [12, 10]]); assert.equal(sm.busiest, 11); assert.equal(sm.total, 20 * M);
  assert.equal(hour12(0), '12 AM'); assert.equal(hour12(12), '12 PM'); assert.equal(hour12(13), '1 PM'); assert.equal(hour12(23), '11 PM');
  assert.deepEqual([0, 3, 6, 9, 12, 15, 18, 21].map(hour12s), ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p']);
  assert.deepEqual([20 * M, 52 * M, 65 * M, 4.75 * 60 * M, 10000, 0].map(fmtShort), ['20m', '52m', '1h05', '4h45', '<1m', '<1m']);
  assert.equal(hourSummary([]).busiest, -1); assert.equal(hourSummary(new Array(24).fill(0)).total, 0);
});
