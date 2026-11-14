import test from 'node:test';
import assert from 'node:assert/strict';
import { quality } from '../src/data.js';
import { buildSongInfo } from '../src/songinfo.js';

test('quality badge: FLAC unchanged, MP3 / AAC show format + bitrate', () => {
  assert.equal(quality({ bits: 24, khz: 96 }), 'FLAC 24-bit / 96 kHz');
  assert.equal(quality({ fmt: 'FLAC', bits: 16, khz: 44.1 }), 'FLAC 16-bit / 44.1 kHz');
  assert.equal(quality({ fmt: 'MP3', kbps: 320, khz: 44.1, bits: 0 }), 'MP3 320 kbps / 44.1 kHz');
  assert.equal(quality({ fmt: 'AAC', kbps: 256, khz: 0, bits: 0 }), 'AAC 256 kbps');
});

test('Song Info for MP3: no bit depth / block size / MD5 tiles, stem strips .mp3', () => {
  const info = buildSongInfo({ tags: { ALBUM: 'A' }, tech: { format: 'MP3', rate: 44100, channels: 2, dur: 200, kbps: 320, size: 8000000 }, pics: [] }, { path: 'Music/x/Song.mp3' });
  const audio = info.sections.find(s => s.title === 'Audio').tiles.map(t => t.label);
  assert.deepEqual(audio, ['Format', 'Sample rate', 'Channels', 'Length', 'Bitrate', 'File size']);
  assert.equal(info.basic.title, 'Song');
  assert.equal(info.basic.quality, 'MP3 320 kbps 44.1 kHz');
  assert.equal(info.basic.length, '3:20');
});

test('Song Info finds embedded lyrics under any key name', () => {
  const tile = tags => buildSongInfo({ tags, tech: {}, pics: [] }, { path: 'a.flac' }).sections[0].tiles.find(t => t.label === 'Embedded lyrics');
  assert.match(tile({ 'SYNCED LYRICS': 'x'.repeat(30) }).value, /^Synced/);
  assert.match(tile({ 'LYRICS-ENG': 'plain words' }).value, /^Plain/);
  assert.match(tile({ UNSYNCEDLYRICS: '[00:01.00]hi' }).value, /^Synced/);
  assert.equal(tile({ LYRICIST: 'Someone' }), undefined);
});

import { lyricTwins } from '../src/data.js';
test('lyric twins: a copy without lyrics borrows them from the same song in another format', () => {
  const a = { title: 'Song', trackArtist: 'Artist', dur: 200, uri: 'u-flac', lrc: 'x.lrc', lyric: 'hello world' };
  const b = { title: 'song!', trackArtist: 'ARTIST', dur: 201, uri: 'u-mp3', lrc: '', lyric: '' };
  const c = { title: 'Song', trackArtist: 'Artist', dur: 400, uri: 'u-live', lrc: '', lyric: '' };   // live version: much longer
  const d = { title: 'Song', trackArtist: 'Other', dur: 200, uri: 'u-other', lrc: '', lyric: '' };    // other artist
  lyricTwins([a, b, c, d]);
  assert.equal(b.twinUri, 'u-flac'); assert.equal(b.twinLrc, 'x.lrc'); assert.equal(b.lyric, 'hello world');
  assert.equal(c.twinUri, undefined); assert.equal(d.twinUri, undefined); assert.equal(a.twinUri, undefined);
});

import { versionMarks, cleanTitle } from '../src/data.js';
test('versions: remix / live / instrumental never share lyrics; feat. / remaster / album version do', () => {
  const mk = (title, o = {}) => ({ title, trackArtist: 'Artist', dur: 200, uri: 'u-' + title, lrc: '', lyric: '', ...o });
  const base = mk('Song', { lrc: 'a.lrc', lyric: 'words' });
  const list = [base, mk('Song (Remix)'), mk('Song - Live'), mk('Song (Instrumental)'), mk('Song VIP'), mk('Song (feat. Guest)'), mk('Song (Remastered 2011)'), mk('Song - 2011 Remaster'), mk('Song (Album Version)'), mk('Song (Original Mix)')];
  lyricTwins(list);
  const got = Object.fromEntries(list.slice(1).map(t => [t.title, !!t.twinUri]));
  assert.deepEqual(got, { 'Song (Remix)': false, 'Song - Live': false, 'Song (Instrumental)': false, 'Song VIP': false, 'Song (feat. Guest)': true, 'Song (Remastered 2011)': true, 'Song - 2011 Remaster': true, 'Song (Album Version)': true, 'Song (Original Mix)': true });
  // two different remixes are different songs too, and a remix of another artist's remix is not the plain song
  const r1 = mk('Song (A Remix)', { lrc: 'r.lrc', lyric: 'rx' }), r2 = mk('Song (B Remix)');
  lyricTwins([r1, r2]); assert.equal(r2.twinUri, undefined);
  assert.equal(versionMarks('Song (Original Mix)'), ''); assert.equal(versionMarks('Song (Remix)'), 'remix');
  assert.equal(cleanTitle('Song (Remix) (feat. X)'), 'Song (Remix)');
});
