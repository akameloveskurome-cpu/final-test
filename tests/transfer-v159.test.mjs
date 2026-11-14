// v159: playlist import (zips, preview counts, duplicates not added twice), playlist export (duration kept, songs left out counted),
// settings export (date-stamped name), settings import (what changes, app version). Pure logic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planForeign, summaryForeign, exportLists, buildFiles, parseAny } from '../src/plforeign.js';
import { buildExport, parseImport as parsePl, exportText as plText } from '../src/plexport.js';
import { zipFiles } from '../src/transfer.js';
import { expandFiles, PLAYLIST_WANT } from '../src/zipread.js';
import { toBase64 } from '../src/transfer.js';
import * as SIO from '../src/settingsio.js';

const tracks = [
  { id: 't1', title: 'Alpha', trackArtist: 'Ann', path: 'Ann/Alpha.flac', albumId: 'a1', dur: 200 },
  { id: 't2', title: 'Beta', trackArtist: 'Ben', path: 'Ben/Beta.flac', albumId: 'a2', dur: 180 },
  { id: 't3', title: 'Gamma', trackArtist: 'Cy', path: 'Cy/Gamma.flac', albumId: 'a3', dur: 0 },
];
const aa = t => ({ artist: t.trackArtist, album: 'Album ' + t.albumId });
const M3U = (name, songs) => `#EXTM3U\n#PLAYLIST:${name}\n` + songs.map(s => `#EXTINF:200,${s.a} - ${s.t}\n${s.p}`).join('\n') + '\n';
const songsOf = [{ t: 'Alpha', a: 'Ann', p: 'Ann/Alpha.flac' }, { t: 'Beta', a: 'Ben', p: 'Ben/Beta.flac' }];

test('a playlist already in the app (same name, same songs in order) is not added again; a changed one is kept as (2)', () => {
  const imp = parseAny(M3U('Road', songsOf), 'Road.m3u8');
  const existing = [{ name: 'Road', ids: ['t1', 't2'] }];
  const same = planForeign(imp, tracks, aa, ['Road'], existing);
  assert.equal(same.lists.length, 0); assert.equal(same.already.length, 1); assert.equal(same.already[0].count, 2);
  const diff = planForeign(imp, tracks, aa, ['Road'], [{ name: 'Road', ids: ['t2', 't1'] }]);   // same songs, other order: a different playlist
  assert.equal(diff.lists.length, 1); assert.equal(diff.lists[0].name, 'Road (2)');
  assert.match(summaryForeign(same), /already in the app/);
  assert.doesNotMatch(summaryForeign(diff), /already/);
});

test('the plan says how many songs of each list are matched, and which are missing', () => {
  const imp = parseAny(M3U('Mix', [...songsOf, { t: 'Nope', a: 'Nobody', p: 'Nobody/Nope.flac' }]), 'Mix.m3u8');
  const p = planForeign(imp, tracks, aa, []);
  assert.equal(p.lists[0].ids.length, 2); assert.equal(p.lists[0].total, 3); assert.equal(p.lists[0].missing, 1);
  assert.equal(p.missing.length, 1); assert.equal(p.missing[0].title, 'Nope');
});

test('a zip of playlist files (what the app exports for several M3U8 / XSPF lists) reads back as the files', async () => {
  const bytes = zipFiles([{ name: 'Road.m3u8', text: M3U('Road', songsOf) }, { name: 'Night.m3u8', text: M3U('Night', songsOf.slice(1)) }]);
  const files = await expandFiles([{ name: 'Playlists.zip', bytes }], { want: PLAYLIST_WANT });   // the same path the app's import takes
  assert.ok(files.every(f => f.zip === 'Playlists.zip'));
  assert.deepEqual(files.map(f => f.name).sort(), ['Night.m3u8', 'Road.m3u8']);
  const all = files.flatMap(f => parseAny(f.text, f.name));
  assert.deepEqual(all.map(p => p.name).sort(), ['Night', 'Road']);
});

test('our JSON keeps the duration of each song (seconds) and drops it when unknown', () => {
  const pls = [{ id: 'p1', name: 'Mine', ids: ['t1', 't3', 'gone'] }];
  const obj = buildExport(pls, tracks, aa);
  assert.equal(obj.playlists[0].songs[0].dur, 200); assert.equal('dur' in obj.playlists[0].songs[1], false); assert.deepEqual(obj.playlists[0].songs[2], { id: 'gone' });
  const back = parsePl(plText(obj));
  assert.equal(back[0].songs[0].dur, 200); assert.equal(back[0].songs[1].dur, undefined);
});

test('exportLists drops songs not in the library; the count of the drop is what the export reports', () => {
  const pls = [{ id: 'p1', name: 'Mine', ids: ['t1', 'gone', 't2'] }];
  const out = exportLists(pls, tracks, aa);
  assert.equal(pls[0].ids.length - out[0].songs.length, 1);
  assert.equal(buildFiles('m3u8', out).name, 'Mine.m3u8');
});

test('settings file name is dated, so a new export never overwrites an older backup', () => {
  assert.equal(SIO.fileName(new Date(2026, 10, 8, 9)), 'liquid-dark-settings-20261108.json');
  assert.notEqual(SIO.fileName(new Date(2026, 10, 8)), SIO.fileName(new Date(2026, 10, 9)));
});

test('settings import reports the app version and what would change: changed, new, same; search history is never counted', () => {
  const file = SIO.parseImport(JSON.stringify({ kind: 'settings', version: 1, appVersion: '0.208.0', settings: { lyricSize: 'Small', tabPct: 90, recent: ['x'], brandNew: 1 } }));
  assert.equal(file.appVersion, '0.208.0');
  assert.equal(file.count, 3); assert.equal('recent' in file.settings, false);
  const st = Object.fromEntries(SIO.groupDiffs({ lyricSize: 'Large', tabPct: 90, recent: ['mine'] }, file.settings).map(d => [d.key, d.status]));
  assert.deepEqual(st, { lyricSize: 'changed', tabPct: 'same', brandNew: 'new' });
});
