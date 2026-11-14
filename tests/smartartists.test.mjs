// Smart artist grouping: spellings of one artist merge, collab credits split into their artists, and the whole thing can be switched off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { artistKey, splitArtists, songArtists, PROTECTED_KEYS } from '../src/artistnames.js';
import { setLibrary, setSmartArtists, smartArtists, artists, tracks, trackArtists, artistInfo, artistTracks, artistVariants } from '../src/data.js';

let n = 0;
const row = (album, artist, title, albumArtist = '') => ({ uri: `content://x/tree/p%3A/document/p%3AMusic%2F${encodeURIComponent(album)}%2F${++n}.flac`, album, artist, albumArtist, aaTag: !!albumArtist, title, dur: 200, bits: 16, khz: 44.1 });
const LIB = [
  row('After Hours', 'The Weeknd', 'Alone Again'), row('After Hours', 'The Weeknd', 'Blinding Lights'), row('Starboy', 'The Weeknd', 'Starboy'),
  row('Weeknd Misc', 'Weeknd', 'Old Song'),
  row('Lily A', 'Lily-Rose Depp', 'One'), row('Lily A', 'Lily-Rose Depp', 'Two'), row('Lily B', 'Lily Rose Depp', 'Three'),
  row('Maluma Single', 'Maluma, The Weeknd', 'Collab', 'Maluma, The Weeknd'),
  row('Maluma Album', 'Maluma', 'Solo'),
  row('We Dont Trust You', 'Metro Boomin, The Weeknd, Diddy, 21 Savage', 'Big Collab', 'Metro Boomin, The Weeknd, Diddy, 21 Savage'),
  row('Heroes', 'Metro Boomin', 'Solo Metro'),
  row('Igor', 'Tyler, The Creator', 'Earfquake'), row('Igor', 'Tyler', 'Other Tyler'),
  row('Plain', 'Drake', 'Song (feat. Travis Scott)'),
  row('Hits', 'Beyoncé', 'Halo'), row('Hits2', 'Beyonce', 'Crazy'),
];
const names = () => artists.map(a => a.replace(/&amp;/g, '&'));

test('artistKey merges only safe differences', () => {
  assert.equal(artistKey('Lily Rose Depp'), artistKey('Lily-Rose Depp'));
  assert.equal(artistKey('The Weeknd'), artistKey('Weeknd'));
  assert.equal(artistKey('Beyoncé'), artistKey('Beyonce'));
  assert.equal(artistKey('A$AP Rocky'), artistKey('ASAP Rocky'));
  assert.equal(artistKey('Jay-Z'), artistKey('JAY Z'));
  assert.notEqual(artistKey('Lil Wayne'), artistKey('Lil Uzi Vert'));
  assert.notEqual(artistKey('Drake'), artistKey('Drake Bell'));
  assert.ok(artistKey('The The').length > 0 && artistKey('The') === 'the');
});
test('smart ON: variants are one artist, shown with the most used spelling', () => {
  setLibrary(LIB); setSmartArtists(true); assert.equal(smartArtists(), true);
  const a = names();
  assert.ok(a.includes('Lily-Rose Depp') && !a.includes('Lily Rose Depp'));
  assert.ok(a.includes('The Weeknd') && !a.includes('Weeknd'));
  assert.ok(a.includes('Beyoncé') || a.includes('Beyonce'));
  assert.equal(a.filter(x => artistKey(x) === artistKey('Beyonce')).length, 1);
  assert.equal(artistInfo('Lily-Rose Depp').count, 3);
  assert.equal(artistInfo('Lily Rose Depp').count, 3, 'looking up the old spelling finds the same artist');
  assert.ok(artistVariants('The Weeknd').length >= 2);
});
test('smart ON: collabs split, no made-up combined artists, every artist gets the song', () => {
  setLibrary(LIB); setSmartArtists(true);
  const a = names();
  for (const bad of ['Maluma, The Weeknd', 'Metro Boomin, The Weeknd, Diddy, 21 Savage']) assert.ok(!a.includes(bad), bad + ' must not be an artist');
  const big = tracks.find(t => t.title === 'Big Collab');
  assert.deepEqual(trackArtists(big).map(x => x.replace(/&amp;/g, '&')), ['Metro Boomin', 'The Weeknd', 'Diddy', '21 Savage']);
  assert.ok(a.includes('Diddy') && a.includes('21 Savage') && a.includes('Maluma'));
  assert.ok(artistTracks('The Weeknd').some(t => t.title === 'Big Collab') && artistTracks('The Weeknd').some(t => t.title === 'Collab'));
  assert.ok(artistTracks('Travis Scott').some(t => t.title.startsWith('Song')), 'feat. in the title still works');
});
test('smart ON: names that are one act stay whole', () => {
  setLibrary(LIB); setSmartArtists(true);
  assert.ok(names().includes('Tyler, The Creator'));
  assert.ok(PROTECTED_KEYS.has(artistKey('Earth, Wind & Fire')));
  assert.deepEqual(splitArtists('Earth, Wind & Fire', new Set(['earth']), artistKey, PROTECTED_KEYS), ['Earth, Wind & Fire']);
  assert.deepEqual(songArtists('A', 'x', 'Various Artists', new Set(), { keyOf: artistKey, protect: PROTECTED_KEYS }), ['A']);
});
test('smart OFF: exact old behaviour, and switching back and forth is stable', () => {
  setLibrary(LIB); setSmartArtists(false); assert.equal(smartArtists(), false);
  let a = names();
  assert.ok(a.includes('Lily Rose Depp') && a.includes('Lily-Rose Depp') && a.includes('Weeknd') && a.includes('The Weeknd'));
  assert.equal(setSmartArtists(false), false, 'no rebuild when nothing changed');
  assert.equal(setSmartArtists(true), true); a = names();
  assert.ok(!a.includes('Weeknd') && !a.includes('Maluma, The Weeknd'));
  setSmartArtists(true);
});

import { readFileSync } from 'node:fs';
import { artistName } from '../src/data.js';
test('artistName: an old spelling resolves to the shown artist; off = exact names only; variants are empty when off', () => {
  setLibrary(LIB); setSmartArtists(true);
  assert.equal(artistName('Weeknd'), 'The Weeknd'); assert.equal(artistName('Lily Rose Depp'), 'Lily-Rose Depp');
  assert.equal(artistName('Diddy'), 'Diddy'); assert.deepEqual(artistTracks('Weeknd').map(t => t.id), artistTracks('The Weeknd').map(t => t.id));
  setSmartArtists(false);
  assert.equal(artistName('Diddy'), '', 'a collab-only artist does not exist when grouping is off');
  assert.equal(artistName('Weeknd'), 'Weeknd'); assert.equal(artistName('The Weeknd'), 'The Weeknd');
  assert.deepEqual(artistVariants('The Weeknd'), [], 'no merged spellings when off');
  setSmartArtists(true);
});
import { picNames, picKey, picDrop } from '../src/artistpics.js';
test('picture helpers: shown name first, every spelling dropped, bytes deleted even without a marker', () => {
  const un = s => s.replace(/&amp;/g, '&');
  const names = picNames('Simon &amp; Co', ['Simon and Co', 'Simon &amp; Co'], un);
  assert.deepEqual(names, ['Simon &amp; Co', 'Simon & Co', 'Simon and Co']);
  assert.equal(picKey({ 'Simon and Co': 'gif:1' }, names, 'Simon &amp; Co'), 'Simon and Co', 'a picture under an old spelling is found');
  assert.equal(picKey({ 'Simon and Co': 'x', 'Simon &amp; Co': 'y' }, names, 'Simon &amp; Co'), 'Simon &amp; Co', 'shown name wins');
  assert.equal(picKey({}, names, 'Simon &amp; Co'), 'Simon &amp; Co');
  assert.deepEqual(picDrop(names, 'Simon &amp; Co'), ['Simon & Co', 'Simon and Co'], 'setting a picture: every other spelling goes');
  assert.deepEqual(picDrop(names, null), names, 'removing: every spelling goes');
  assert.deepEqual(picNames('Drake', [], un), ['Drake'], 'grouping off: one name only');
});
import { extract } from './extract.mjs';
function apicWorld(map, names) {
  const m = { ...map }, del = [], set = [];
  const deps = { apicMap: () => ({ ...m }), apicSave: x => { for (const k of Object.keys(m)) delete m[k]; Object.assign(m, x); }, agDb: { del: k => { del.push(k); return Promise.resolve(); } }, agSet: (k, v) => set.push([k, v]), picDrop, apicNames: () => names };
  return { m, del, set, gone: extract('src/main.js', 'apicGone', deps), drop: extract('src/main.js', 'apicDropOthers', { ...deps, apicGone: null, apicNames: () => names }) , deps };
}
test('apicGone deletes bytes and live url of every named spelling, even without a marker, and saves the map once', () => {
  const w = apicWorld({ A: 'gif:1', B: 'x' }, []); w.gone(['A', 'C']);
  assert.deepEqual(w.del, ['A', 'C']); assert.deepEqual(w.set, [['A', null], ['C', null]]); assert.deepEqual(w.m, { B: 'x' });
});
test('apicDropOthers keeps the chosen spelling and drops every other one', () => {
  const w = apicWorld({ A: 'x', 'A2': 'y' }, ['A', 'A2', 'A3']);
  const gone = extract('src/main.js', 'apicGone', w.deps);
  const drop = extract('src/main.js', 'apicDropOthers', { apicGone: gone, picDrop, apicNames: () => ['A', 'A2', 'A3'] });
  drop('A'); assert.deepEqual(w.del, ['A2', 'A3']); assert.deepEqual(w.m, { A: 'x' });
  w.del.length = 0; drop(null); assert.deepEqual(w.del, ['A', 'A2', 'A3']);
});
test('apicDropGif deletes a replaced GIF, then the other spellings', () => {
  const log = []; const fn = extract('src/main.js', 'apicDropGif', { apicMap: () => ({ N: 'gif:1', M: 'x' }), agDb: { del: k => { log.push('del ' + k); return Promise.resolve(); } }, agSet: (k, v) => log.push('set ' + k), apicDropOthers: k => log.push('others ' + k) });
  fn('N'); fn('M');
  assert.deepEqual(log, ['del N', 'set N', 'others N', 'others M']);
});
test('GUARD (needs browser): custom artist pictures wiring, source text', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /case 'apic-reset': \{ apicGone\(picDrop\(apicNames\(apicFor\), null\)\)/);
  assert.match(src, /agDb\.put\(n, b\)\.then\(\(\) => \{ apicDropOthers\(n\); pushWidgetCovers\(\); \}\)/);
  assert.match(src, /stack = stack\.filter\(s => s\.t !== 'artist' \|\| artistInfo\(s\.id\)\.count > 0\)/);
});

import { picAliases } from '../src/artistpics.js';
import { artistKey as _ak } from '../src/artistnames.js';
test('v157: a photo is found and removable under every stored spelling, grouping on or off', () => {
  const stored = ['The Weeknd', 'weeknd', 'Drake', 'drake', 'Lily-Rose Depp'];
  assert.deepEqual(picAliases(stored, 'The Weeknd', _ak), ['The Weeknd', 'weeknd']);                       // on: The / case / punctuation
  assert.deepEqual(picAliases(stored, 'Drake', s => s.trim().toLowerCase()), ['Drake', 'drake']);        // off: only case differs
  assert.deepEqual(picAliases(stored, 'The Weeknd', s => s.trim().toLowerCase()), ['The Weeknd']);       // off: "Weeknd" stays its own artist
});
