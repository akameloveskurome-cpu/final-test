import test from 'node:test'; import assert from 'node:assert/strict';
import { cleanHome, toggleSection, moveSection, KEYS, DEFAULT_HIDDEN } from '../src/homecfg.js';
test('defaults and repair', () => {
  const h = cleanHome(null); assert.deepEqual(h.order, KEYS); assert.deepEqual(h.hidden, DEFAULT_HIDDEN); assert.equal(h.count, 12); assert.equal(h.card, 'normal');
  const r = cleanHome({ order: ['top', 'top', 'nope'], hidden: ['x', 'fav'], count: 7, card: 'huge', greet: false });
  assert.equal(r.order[0], 'top'); assert.equal(r.order.length, KEYS.length); assert.deepEqual(r.hidden, ['fav']); assert.equal(r.count, 12); assert.equal(r.card, 'normal'); assert.equal(r.greet, false);
});
test('toggle and move', () => {
  let h = cleanHome({}); h = toggleSection(h, 'recent'); assert.ok(h.hidden.includes('recent')); h = toggleSection(h, 'recent'); assert.ok(!h.hidden.includes('recent'));
  h = moveSection(h, 'daily', -1); assert.equal(h.order[1], 'daily'); assert.equal(moveSection(h, KEYS[0] === h.order[0] ? h.order[0] : '', -1), h);
  const last = h.order[h.order.length - 1]; assert.equal(moveSection(h, last, 1), h);
});
import { cleanHome as cH, periodOf, hiddenFor, setTod, toggleSectionFor, isHiddenFor, addPin, removePin, renameSection, renameQuick, toggleQuick, moveQuick, MAX_PINS, QUICK } from '../src/homecfg.js';
test('parts of the day', () => {
  assert.deepEqual([4, 5, 11, 12, 16, 17, 20, 21, 0, 23].map(periodOf), ['night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night', 'night']);
  let h = cH(null); assert.equal(h.tod, false); assert.equal(hiddenFor(h, 9), h.hidden);
  h = setTod(h, true); assert.equal(h.tod, true); h = toggleSectionFor(h, 'recent', 'night');
  assert.ok(hiddenFor(h, 23).includes('recent')); assert.ok(!hiddenFor(h, 9).includes('recent')); assert.ok(isHiddenFor(h, 'recent', 'night') && !isHiddenFor(h, 'recent', 'morning'));
  const r = cH(JSON.parse(JSON.stringify(h))); assert.equal(r.tod, true); assert.ok(r.todHidden.night.includes('recent'));
  assert.equal(setTod(h, false).tod, false); assert.ok(!toggleSectionFor(setTod(cH(null), false), 'recent', 'night').todHidden);
  assert.equal(cH({ tod: true }).tod, false);   // switched on without saved lists = repaired to off
});
test('pinned sections', () => {
  let h = cH(null); h = addPin(h, 'playlist', 'p1', 'aaa1'); h = addPin(h, 'artist', 'Abba', 'aaa2'); h = addPin(h, 'album', 'al1', 'aaa3');
  assert.equal(h.pins.length, 3); assert.deepEqual(h.order.slice(-3), ['pin:aaa1', 'pin:aaa2', 'pin:aaa3']);
  assert.equal(addPin(h, 'artist', 'Abba', 'zzz9'), h);   // same thing twice = ignored
  assert.equal(addPin(h, 'song', 'x'), h); assert.equal(addPin(h, 'artist', ''), h);
  h = renameSection(h, 'pin:aaa2', 'My Abba'); h = toggleSectionFor(h, 'pin:aaa2', 'x');
  assert.equal(cH(JSON.parse(JSON.stringify(h))).names['pin:aaa2'], 'My Abba');
  h = removePin(h, 'aaa2'); assert.equal(h.pins.length, 2); assert.ok(!h.order.includes('pin:aaa2') && !h.hidden.includes('pin:aaa2') && !h.names['pin:aaa2']);
  let m = cH(null); for (let i = 0; i < MAX_PINS + 3; i++) m = addPin(m, 'album', 'a' + i, 'id' + i + 'x'); assert.equal(m.pins.length, MAX_PINS);
  const bad = cH({ pins: [{ id: 'ok1', type: 'album', ref: 'a' }, { id: 'ok1', type: 'album', ref: 'b' }, { id: 'no', type: 'album', ref: 'a' }, { id: 'ok2', type: 'bogus', ref: 'a' }], order: ['pin:ghost', 'pin:ok1'], hidden: ['pin:ghost'] });
  assert.equal(bad.pins.length, 1); assert.ok(!bad.order.includes('pin:ghost') && bad.order.includes('pin:ok1')); assert.deepEqual(bad.hidden, []);
});
test('own names and quick buttons', () => {
  let h = cH(null); h = renameSection(h, 'fav', '  Loved   songs '); assert.equal(h.names.fav, 'Loved songs'); h = renameSection(h, 'fav', '  '); assert.ok(!('fav' in h.names));
  h = renameQuick(h, 'mix', 'Mix of the day'); assert.equal(h.qnames.mix, 'Mix of the day'); assert.equal(renameQuick(h, 'nope', 'x').qnames.nope, 'x'); assert.ok(!('nope' in cH(renameQuick(h, 'nope', 'x')).qnames));
  assert.equal(h.qb.length, QUICK.length); assert.deepEqual(h.qhidden, ['favs', 'top']);
  h = moveQuick(h, 'mix', -1); assert.equal(h.qb[0], 'mix'); assert.equal(moveQuick(h, 'mix', -1), h);
  h = toggleQuick(h, 'top'); assert.deepEqual(h.qhidden, ['favs']); h = toggleQuick(h, 'recent'); assert.deepEqual(h.qhidden, ['favs', 'recent']);
  const r = cH({ qb: ['top', 'x', 'top'], qhidden: ['zzz'], names: { fav: 'x'.repeat(80) } }); assert.equal(r.qb[0], 'top'); assert.equal(r.qb.length, QUICK.length); assert.deepEqual(r.qhidden, []); assert.equal(r.names.fav.length, 30);
});
test('Apple Music style sections exist and old saves get them', () => {
  for (const k of ['heavy', 'favmix', 'newmix']) assert.ok(KEYS.includes(k), k);
  const old = cleanHome({ order: ['top', 'fav'], hidden: ['fav'] }); for (const k of ['heavy', 'favmix', 'newmix']) { assert.ok(old.order.includes(k)); assert.ok(!old.hidden.includes(k)); }
});

import { addCustom, addCustomItem, removeCustomItem, moveCustomItem, cleanItems, MAX_ITEMS } from '../src/homecfg.js';
test('custom sections', () => {
  let h = addCustom(cH(null), '  Gym   songs ', 'cc01');
  assert.equal(h.pins.length, 1); assert.equal(h.pins[0].type, 'custom'); assert.equal(h.pins[0].ref, 'Gym songs'); assert.deepEqual(h.pins[0].items, []); assert.equal(h.order.at(-1), 'pin:cc01');
  assert.equal(addCustom(cH(null), '', 'cc02').pins[0].ref, 'My picks');
  h = addCustomItem(h, 'cc01', 'album', 'al1'); h = addCustomItem(h, 'cc01', 'artist', 'Abba'); h = addCustomItem(h, 'cc01', 'song', 's9');
  assert.deepEqual(h.pins[0].items.map(i => i.t), ['album', 'artist', 'song']);
  assert.equal(addCustomItem(h, 'cc01', 'album', 'al1'), h);   // same thing twice = ignored
  assert.equal(addCustomItem(h, 'cc01', 'playlist', 'x'), h); assert.equal(addCustomItem(h, 'nope', 'album', 'x'), h);
  h = moveCustomItem(h, 'cc01', 'song', 's9', -1); assert.deepEqual(h.pins[0].items.map(i => i.t), ['album', 'song', 'artist']);
  assert.equal(moveCustomItem(h, 'cc01', 'album', 'al1', -1).pins[0].items[0].v, 'al1');
  const r = cH(JSON.parse(JSON.stringify(h))); assert.deepEqual(r.pins, h.pins);   // survives being saved and loaded
  h = removeCustomItem(h, 'cc01', 'song', 's9'); assert.equal(h.pins[0].items.length, 2);
  h = removePin(h, 'cc01'); assert.equal(h.pins.length, 0); assert.ok(!h.order.includes('pin:cc01'));
});
test('custom sections: repair and limits', () => {
  const many = Array.from({ length: MAX_ITEMS + 10 }, (_, i) => ({ t: 'song', v: 's' + i }));
  assert.equal(cleanItems(many).length, MAX_ITEMS);
  assert.deepEqual(cleanItems([{ t: 'x', v: 1 }, null, { t: 'album', v: '' }, { t: 'album', v: 'a' }, { t: 'album', v: 'a' }]), [{ t: 'album', v: 'a' }]);
  const r = cH({ pins: [{ id: 'abc', type: 'custom', ref: '', items: 'bad' }, { id: 'abd', type: 'custom' }] });
  assert.equal(r.pins.length, 2); assert.equal(r.pins[0].ref, 'My picks'); assert.deepEqual(r.pins[0].items, []);
  let h = cH(null); for (let i = 0; i < MAX_PINS; i++) h = addCustom(h, 'n' + i, 'id' + 'abcdefghijkl'[i]);
  assert.equal(h.pins.length, MAX_PINS); assert.equal(addCustom(h, 'one more', 'zzz9'), h);
});
