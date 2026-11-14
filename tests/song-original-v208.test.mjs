// v208: "Back to original cover" for ONE song, album Back to default overrides every song of the album, export / import files are named Liquid Dark.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';
import * as SIO from '../src/settingsio.js';
import * as PLX from '../src/plexport.js';
import * as LIO from '../src/listenio.js';
import * as PLF from '../src/plforeign.js';
const M = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('a song marked "original" shows the cover from its own file, even with a song picture or an album picture', () => {
  const spUrls = new Map([['s1', 'blob:song1']]), gOf = a => 'ALBUM-' + a.k, trackAlbum = t => ({ k: t && t.albumId, g: 'ORIG-' + (t && t.albumId) });
  const marked = new Set(['s1', 's2']);
  const gOfT = extract('src/main.js', 'gOfT', { gOf, trackAlbum, spUrls, PIC_BASE: '#111', soHas: t => !!(t && marked.has(t.id)) });
  assert.equal(gOfT({ id: 's1', albumId: 'A' }), 'ORIG-A');   // has its own picture AND is marked: the original wins
  assert.equal(gOfT({ id: 's2', albumId: 'A' }), 'ORIG-A');   // album has a custom picture, the song is marked: still the original
  assert.equal(gOfT({ id: 's3', albumId: 'A' }), 'ALBUM-A');   // not marked: follows the album as before
});

function world({ songpics = {}, orig = {}, albpics = {} } = {}) {
  const store = { sp: { ...songpics }, so: { ...orig }, al: { ...albpics } }, log = [];
  const tracks = [{ id: 't1', albumId: 'A' }, { id: 't2', albumId: 'A' }, { id: 't3', albumId: 'A' }, { id: 't4', albumId: 'B' }];
  const d = {
    tracks, covTint: new Map([['t1|s', 1], ['t4|s', 1]]), alpFor: 'A', spFor: 't1',
    spMap: () => ({ ...store.sp }), spSave: m => { store.sp = { ...m }; }, soMap: () => ({ ...store.so }), soSave: m => { store.so = { ...m }; },
    soIds: () => new Set(Object.keys(store.so)), alpMap: () => ({ ...store.al }), alpSave: m => { store.al = { ...m }; },
    spDb: { del: id => { log.push('spdel ' + id); return Promise.resolve(); } }, alDb: { del: id => { log.push('aldel ' + id); return Promise.resolve(); } },
    spSet: (id, b) => log.push('spset ' + id + ' ' + b), alpSet: (id, b) => log.push('alpset ' + id + ' ' + b),
    alpDone: m => log.push('done ' + m), spDone: m => log.push('sdone ' + m),
  };
  d.alpSongsCustom = extract('src/main.js', 'alpSongsCustom', d);
  d.spOrigOff = extract('src/main.js', 'spOrigOff', d);
  return { store, log, d };
}

test('Back to default on an ALBUM clears every song picture / GIF / original mark of that album, other albums stay', () => {
  const { store, log, d } = world({ songpics: { t1: 1, t4: 1 }, orig: { t2: 1 }, albpics: { A: 1 } });
  extract('src/main.js', 'alpReset', d, '}')();
  assert.deepEqual(store.sp, { t4: 1 });   // t1 (custom song picture or GIF) removed, t4 is in another album and stays
  assert.deepEqual(store.so, {});          // t2's "original" mark removed too
  assert.deepEqual(store.al, {});
  assert.ok(log.includes('spdel t1') && log.includes('spset t1 null') && !log.includes('spdel t4'));
  assert.ok(log.includes('aldel A') && log.includes('done Back to the original cover'));
  assert.equal(d.covTint.has('t1|s'), false); assert.equal(d.covTint.has('t4|s'), true);
});

test('Back to default on an album with NO album picture but custom song pictures still resets the songs', () => {
  const { store, d } = world({ songpics: { t3: 1 } });
  assert.equal(d.alpSongsCustom('A').length, 1);
  extract('src/main.js', 'alpReset', d, '}')();
  assert.deepEqual(store.sp, {});
  assert.ok(/mine \? 'The cover from the music files, for the album and for every song in it'/.test(M) && /'alp-reset', mine \?/.test(M) && /, '', !!mine\); }/.test(M));   // the button is shown when only songs have pictures
});

test('song sheet: "Back to original cover" deletes the song picture and marks the song; Back to default un-marks it; choosing a picture un-marks it', () => {
  const { store, log, d } = world({ songpics: { t1: 1 } });
  extract('src/main.js', 'spOrig', d)();
  assert.deepEqual(store.sp, {}); assert.deepEqual(store.so, { t1: 1 });
  assert.ok(log.includes('spdel t1') && log.some(l => l.startsWith('sdone ')));
  extract('src/main.js', 'spReset', d)();
  assert.deepEqual(store.so, {});   // follows the album picture again
  assert.ok(M.includes('spSave(m); spOrigOff(id); spSet(id, b); spDone(\'Song picture set\', mine);'));   // a new picture replaces the mark
  assert.ok(M.includes("case 'sp-orig': spOrig(); break;"));
});

test('song sheet shows the original-cover button only when the song is not already showing its original', () => {
  const sheet = M.slice(M.indexOf('function spEdit(id)'), M.indexOf('function closeIfStill'));
  assert.ok(sheet.includes('!so && (hasPic || albPic)') && sheet.includes('data-act="sp-orig"') && sheet.includes('Back to original cover'));
});

test('export / import files and labels use the app name Liquid Dark, old liquid-flac files still import', () => {
  assert.equal(SIO.FILE_NAME, 'liquid-dark-settings.json'); assert.match(SIO.fileName(new Date(2026, 10, 14)), /^liquid-dark-settings-20261114\.json$/);
  assert.equal(PLX.FILE_NAME, 'liquid-dark-playlists.json');
  assert.equal(LIO.buildExport('csv', [], new Date(2026, 10, 14)).name.startsWith('liquid-dark-listening-'), true);
  assert.ok(LIO.FORMATS.some(f => f.label === 'Liquid Dark backup (.json)'));
  assert.ok(PLF.FORMATS.some(f => f.label === 'Liquid Dark backup (.json)'));
  for (const f of ['src/settingsio.js', 'src/plexport.js', 'src/listenio.js', 'src/plforeign.js', 'src/listensrc.js']) assert.doesNotMatch(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), /liquid-flac|Liquid FLAC/);
  assert.doesNotMatch(M, /liquid-flac-playlists/);
  const old = JSON.stringify({ app: 'liquid-flac', kind: 'settings', version: 1, settings: { lyricStyle: 'cover' } });
  const r = SIO.parseImport(old); assert.ok(r && !r.error, JSON.stringify(r));   // a file made before the rename (app: 'liquid-flac') is still accepted
});
