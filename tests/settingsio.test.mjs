import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExport, exportText, parseImport, mergeSettings, countValues, NOT_INCLUDED, FILE_NAME, EXTRA_KEYS } from '../src/settingsio.js';

const SET = { lyricSize: 'Small', lyricStyle: 'cover', anim: { wobble: 70 }, home: { card: 'big' }, tabPct: 90, userName: 'Ai', recent: ['secret search'], bgDim: 55 };
test('export holds every setting except the search history, plus the small extra switches', () => {
  const o = buildExport(SET, { 'lf.canvasOn': '1', 'lf.other': 'x' }, '0.145.0', new Date('2026-11-07T10:00:00Z'));
  assert.equal(o.kind, 'settings'); assert.equal(o.version, 1); assert.equal(o.appVersion, '0.145.0'); assert.deepEqual(Object.keys(o.settings).sort(), ['anim', 'bgDim', 'home', 'lyricSize', 'lyricStyle', 'tabPct', 'userName']);
  assert.deepEqual(o.extras, { 'lf.canvasOn': '1' }); assert.equal(FILE_NAME, 'liquid-dark-settings.json'); assert.deepEqual(EXTRA_KEYS, ['lf.canvasOn']);
});
test('round trip: export -> text -> import gives the same values', () => {
  const r = parseImport(exportText(buildExport(SET, { 'lf.canvasOn': '1' }))); assert.equal(r.count, 7); assert.equal(r.settings.lyricSize, 'Small'); assert.deepEqual(r.settings.anim, { wobble: 70 }); assert.deepEqual(r.extras, { 'lf.canvasOn': '1' });
});
test('merge keeps what the file does not know and keeps the CURRENT search history', () => {
  const m = mergeSettings({ lyricSize: 'Large', autoplay: false, recent: ['mine'] }, { lyricSize: 'Small' }); assert.deepEqual(m, { lyricSize: 'Small', autoplay: false, recent: ['mine'] });
});
test('junk, other file kinds and newer versions are refused; dangerous keys are dropped', () => {
  for (const bad of ['', 'x', '[]', '{}', '{"kind":"playlists","playlists":[]}', '{"kind":"settings"}', '{"kind":"settings","settings":{}}']) assert.throws(() => parseImport(bad), /settings/i, bad);
  assert.throws(() => parseImport('{"kind":"settings","version":3,"settings":{"a":1}}'), /newer/);
  const r = parseImport('{"kind":"settings","settings":{"a":1,"__proto__":{"x":1},"recent":["no"]}}'); assert.deepEqual(Object.keys(r.settings), ['a']); assert.equal({}.x, undefined);
});

const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
test('the profile photo is never exported or imported (the owner adds it again); a wrong switch value is dropped', () => {
  const o = buildExport(SET, { 'lf.canvasOn': '1', 'lf.profile': PHOTO }); assert.equal('lf.profile' in o.extras, false); assert.equal(o.extras['lf.canvasOn'], '1');
  const r = parseImport(exportText(o)); assert.equal('lf.profile' in r.extras, false); assert.equal(r.extras['lf.canvasOn'], '1');
  assert.deepEqual(buildExport(SET, { 'lf.canvasOn': 'yes' }).extras, {});
  assert.deepEqual(parseImport('{"kind":"settings","settings":{"a":1},"extras":{"lf.profile":"data:image/jpeg;base64,AAAA","lf.canvasOn":"2"}}').extras, {});   // a file that carries a photo: the photo is ignored
});
test('value count is the number of single values, not top-level keys; the not-included list is shown to the person', () => {
  assert.equal(countValues({ a: 1, b: { x: 1, y: 2, z: { q: 1 } }, c: [1, 2, 3], d: {} }), 1 + 3 + 1 + 1);
  assert.equal(parseImport(exportText(buildExport(SET, { 'lf.profile': PHOTO }))).values, countValues(SET) - 1);   // no photo in the count; the search history is not counted
  assert.ok(NOT_INCLUDED.some(x => /Background/.test(x)) && NOT_INCLUDED.some(x => /Search history/.test(x)) && NOT_INCLUDED.some(x => /Profile picture/.test(x)));
});
