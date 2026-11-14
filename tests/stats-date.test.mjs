// Listening Stats always opens on the CURRENT day / week / month / year, and stays current (no jump to the 1st of the month, no stale numbers).
import test from 'node:test';
import assert from 'node:assert/strict';
import { project, manifest } from './fake-project.mjs';
globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, querySelectorAll() { return []; }, getElementById: () => null };
const { shiftRef, rangeOf } = await import('../src/listenstats.js');
const { initLStats } = await import('../src/lstats.js');
const day = ms => new Date(ms).getDate();

test('shiftRef keeps the day of the month (clamped), it no longer jumps to the 1st', () => {
  const ref = new Date(2026, 10, 8, 14).getTime();
  assert.equal(day(shiftRef('monthly', ref, -1)), 8); assert.equal(day(shiftRef('yearly', ref, -1)), 8); assert.equal(day(shiftRef('monthly', ref, 1)), 8);
  const m31 = new Date(2026, 0, 31).getTime(); assert.equal(day(shiftRef('monthly', m31, 1)), 28); assert.equal(new Date(shiftRef('monthly', m31, 1)).getMonth(), 1);
  const leap = new Date(2028, 1, 29).getTime(); assert.equal(day(shiftRef('yearly', leap, 1)), 28); assert.equal(new Date(shiftRef('yearly', leap, 1)).getMonth(), 1);
  assert.equal(new Date(shiftRef('monthly', new Date(2026, 0, 15).getTime(), -1)).getMonth(), 11);
});
const mk = () => initLStats({
  Native: { getListens: async () => ({ segs: [] }), getListenDays: async () => ({ days: [] }), getListenSeen: async () => ({ seen: [] }), state: {} },
  escH: x => x, pl: (n, w) => n + ' ' + w, I: new Proxy({}, { get: () => '' }), unesc: x => x, tracks: () => [], trackAlbum: () => ({}), trackArtists: () => [], byAlbum: () => null,
  artistCov: () => '', header: () => '', push() {}, rerender() {}, refreshHome() {}, toast() {}, tokenColour: () => '', sheet() {}, closeSheet() {}, stack: () => [], tab: () => 'home',
});
const sameDay = (a, b) => rangeOf('daily', a).from === rangeOf('daily', b).from;
test('browse months back, switch to Daily: it shows TODAY, not the 1st', () => {
  const L = mk(), S = L.state;
  L.action('ls-period', { v: 'monthly' }); L.action('ls-prev', {}); L.action('ls-prev', {}); L.action('ls-period', { v: 'daily' });
  assert.ok(sameDay(S.ref, Date.now())); assert.equal(S.follow, true);
});
test('opening the screen (button or widget) resets an old date to now; the open screen follows midnight', () => {
  const L = mk(), S = L.state;
  L.action('ls-period', { v: 'weekly' }); L.action('ls-prev', {}); assert.equal(S.follow, false);
  L.action('ls-open', {}); assert.ok(sameDay(S.ref, Date.now())); assert.equal(S.stale, true);
  S.ref = Date.now() - 3 * 864e5; S.follow = true; L.screens.lstats(); assert.ok(sameDay(S.ref, Date.now()), 'a followed screen is moved to now when drawn');
  S.ref = Date.now() - 3 * 864e5; S.follow = false; L.screens.lstats(); assert.ok(!sameDay(S.ref, Date.now()), 'a day the person browsed to is kept');
});
test('new listening marks the numbers stale so the next draw re-reads them', async () => {
  let reads = 0; const L = mk(); L.state.period = 'daily';
  const D2 = L; L.state.key = ''; await L._test.load(true); const n0 = L.state.key; L.dirty(); assert.equal(L.state.stale, true);
  L.screens.lstats(); await new Promise(r => setTimeout(r, 20)); assert.equal(L.state.stale, false); assert.ok(n0);
});
test('widgets redraw on midnight AND on date / time / zone changes: the generated manifest registers the Day widget for those broadcasts (install-native.sh run on a fake project)', () => {
  const x = manifest(project()), m = x.match(/<receiver android:name="\.StatsWidgets\$Day"[\s\S]*?<\/receiver>/); assert.ok(m, 'Day widget receiver exists');
  for (const a of ['DATE_CHANGED', 'TIME_SET', 'TIMEZONE_CHANGED', 'appwidget.action.APPWIDGET_UPDATE']) assert.ok(m[0].includes(a), a);
  for (const other of x.match(/<receiver android:name="\.StatsWidgets\$(?!Day)[^"]*"[\s\S]*?<\/receiver>/g) || []) assert.ok(!other.includes('DATE_CHANGED'), 'only the Day widget listens for the date change');
});
