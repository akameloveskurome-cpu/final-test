import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanStats, bump, recentList, topList, threshold, makeCounter, TOP_N } from '../src/stats.js';

const T = (...ids) => ids.map(id => ({ id }));
const ids = l => l.map(t => t.id);

test('cleanStats: keeps valid records, drops junk, never throws', () => {
  assert.deepEqual(cleanStats({ a: { plays: 3, last: 10 }, b: { plays: 0, last: 5 }, c: 'x', d: null, e: { plays: 'x', last: 1 }, f: { plays: 2.9, last: 7 }, g: { plays: 1, last: -1 } }),
    { a: { plays: 3, last: 10 }, f: { plays: 2, last: 7 } });
  for (const bad of [null, undefined, 5, 'abc', [1, 2]]) assert.deepEqual(cleanStats(bad), {});
});
test('bump: adds a play and sets last; does not change the input', () => {
  const a = { x: { plays: 1, last: 5 } };
  const b = bump(a, 'x', 9), c = bump(b, 'y', 11);
  assert.deepEqual(a, { x: { plays: 1, last: 5 } });
  assert.deepEqual(c, { x: { plays: 2, last: 9, pg: 9 }, y: { plays: 1, last: 11, pg: 11 } });
});
test('recentList: newest first, only songs that are in the library, ties keep library order, capped', () => {
  const stats = { a: { plays: 1, last: 5 }, b: { plays: 1, last: 9 }, gone: { plays: 5, last: 99 }, c: { plays: 1, last: 5 } };
  assert.deepEqual(ids(recentList(stats, T('a', 'b', 'c', 'd'))), ['b', 'a', 'c']);
  assert.deepEqual(ids(recentList(stats, T('a', 'b', 'c'), 2)), ['b', 'a']);
  assert.deepEqual(recentList({}, T('a')), []);
});
test('topList: most plays first, then most recent, then library order; not capped', () => {
  const stats = { a: { plays: 2, last: 1 }, b: { plays: 5, last: 1 }, c: { plays: 2, last: 8 }, d: { plays: 2, last: 8 } };
  assert.deepEqual(ids(topList(stats, T('a', 'b', 'c', 'd', 'e'))), ['b', 'c', 'd', 'a']);
  const many = Array.from({ length: 250 }, (_, i) => 's' + i), big = Object.fromEntries(many.map((id, i) => [id, { plays: 1 + (i % 7), last: i }]));
  assert.equal(topList(big, T(...many)).length, 250);
});
test('threshold: 10 s, or half of a short song', () => {
  assert.equal(threshold(240), 10); assert.equal(threshold(16), 8); assert.equal(threshold(0), 10); assert.equal(threshold(undefined), 10);
});

const play = (c, from, to, dur, step = 0.25) => { let n = 0; for (let p = from; p <= to + 1e-9; p += step) if (c.tick(p, dur)) n++; return n; };

test('counter: a normal listen counts exactly once, at 10 s', () => {
  const c = makeCounter(); c.track('a');
  assert.equal(play(c, 0, 9, 240), 0);
  assert.equal(play(c, 9.25, 200, 240), 1);
});
test('counter: a short song counts at half its length', () => {
  const c = makeCounter(); c.track('a');
  assert.equal(play(c, 0, 5, 12), 0); assert.equal(play(c, 5.25, 12, 12), 1);
});
test('counter: skipping early does not count', () => {
  const c = makeCounter(); c.track('a'); assert.equal(play(c, 0, 8, 240), 0);
  c.track('b'); assert.equal(play(c, 0, 8, 240), 0);
});
test('counter: seeking to the end does not count; seeking back does not give extra plays', () => {
  const c = makeCounter(); c.track('a');
  assert.equal(play(c, 0, 5, 240), 0);
  assert.equal(c.tick(230, 240), false); assert.equal(play(c, 230.25, 233, 240), 0);   // jumped ahead: only ~8 s heard in total so far
  const d = makeCounter(); d.track('a'); assert.equal(play(d, 0, 35, 240), 1);
  assert.equal(d.tick(2, 240), false); assert.equal(play(d, 2.25, 100, 240), 0);        // seek back, listen again: still one play
});
test('counter: pause / resume (no events while paused) keeps counting the same listen', () => {
  const c = makeCounter(); c.track('a'); assert.equal(play(c, 0, 8, 240), 0);
  assert.equal(play(c, 8.25, 11, 240), 1);
});
test('counter: repeat-one (position wraps from the end to 0) counts again after another full threshold', () => {
  const c = makeCounter(); c.track('a');
  assert.equal(play(c, 0, 60, 60), 1);          // 60 s song: counted at 10 s
  assert.equal(c.tick(0.25, 60), false);        // wrapped
  assert.equal(play(c, 0.5, 9, 60), 0); assert.equal(play(c, 9.25, 60, 60), 1);
});
test('counter: same song reported again (restore / session) does not reset; a different one does', () => {
  const c = makeCounter(); c.track('a'); play(c, 0, 8, 240);
  c.track('a'); assert.equal(play(c, 8.25, 11, 240), 1);
  c.track('b'); assert.equal(play(c, 0, 9, 240), 0);
});
test('counter: no song selected or a bad position never counts or throws', () => {
  const c = makeCounter(); assert.equal(c.tick(5, 100), false); c.track('a'); assert.equal(c.tick(NaN, 100), false);
});

import { mergePlays } from '../src/stats.js';
test('mergePlays: plays counted natively while the page was paused are added; ones already counted are not counted twice', () => {
  const stats = { a: { plays: 2, last: 10_000 } };
  const r = mergePlays(stats, [{ id: 'a', ts: 10_000 }, { id: 'a', ts: 90_000 }, { id: 'b', ts: 50_000 }]);   // first = same play the page counted (within 1 s)
  assert.deepEqual(r.stats, { a: { plays: 3, last: 90_000, nat: [90_000] }, b: { plays: 1, last: 50_000, nat: [50_000] } });
  assert.equal(r.added, 2);
  assert.deepEqual(stats, { a: { plays: 2, last: 10_000 } });   // input untouched
});
test('mergePlays: junk is ignored, order does not matter, empty is a no-op', () => {
  const r = mergePlays({}, [null, {}, { id: '', ts: 5 }, { id: 'x', ts: 'no' }, { id: 'x', ts: -3 }, { id: 'y', ts: 20 }, { id: 'y', ts: 5_000 }]);
  assert.deepEqual(r.stats, { y: { plays: 2, last: 5_000, nat: [20, 5_000] } }); assert.equal(r.added, 2);
  for (const bad of [null, undefined, 'x', 5, {}]) { const e = mergePlays({ q: { plays: 1, last: 1 } }, bad); assert.equal(e.added, 0); assert.deepEqual(e.stats, { q: { plays: 1, last: 1 } }); }
});

test('mergePlays: plays of a very short song less than 1 s apart are all counted', () => {
  const r = mergePlays({}, [{ id: 's', ts: 1000 }, { id: 's', ts: 1400 }, { id: 's', ts: 1800 }]); assert.equal(r.added, 3); assert.equal(r.stats.s.plays, 3);
});

test('mergePlays BUG-322/150: an OLDER real native play is kept; the same play counted by page and service is counted once; a re-delivery is skipped', () => {
  let st = bump({}, 's', 305_000);   // the page counted a play at 305 s
  let r = mergePlays(st, [{ id: 's', ts: 302_000 + 0 }, { id: 's', ts: 306_000 }]);   // 302 s: older real play (3 s before, outside the window is false: 3 s > 2.5 s) / 306 s: the same play as the page's
  assert.equal(r.added, 1); assert.equal(r.stats.s.plays, 2);
  st = r.stats; r = mergePlays(st, [{ id: 's', ts: 302_000 }]);   // the same native list again after a failed save
  assert.equal(r.added, 0); assert.equal(r.stats.s.plays, 2);
  assert.equal(mergePlays({ s: { plays: 1, last: 305_000 } }, [{ id: 's', ts: 300_000 }]).added, 1);   // old data without pg: an older play 5 s earlier still counts
});
