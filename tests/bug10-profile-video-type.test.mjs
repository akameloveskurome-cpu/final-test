// BUG #10: a profile video picked with no MIME type, or of another accepted type (mkv, mov, m4v, 3gp), must be a video at pick, save and restore.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';
import { extOf } from '../src/picmirror.js';

const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').split('\n');
const grab = name => src.find(l => l.startsWith('const ' + name + ' ='));
const VIDEO_TYPES = new Function(grab('VIDEO_TYPES').replace('const VIDEO_TYPES =', 'return') )();
const videoTypeOf = extract('src/main.js', 'videoTypeOf', { VIDEO_TYPES });
const pfKindOfUrl = extract('src/main.js', 'pfKindOfUrl');

test('empty MIME type: the type comes from the file name', () => {
  for (const [name, type] of [['a.mp4', 'video/mp4'], ['a.WEBM', 'video/webm'], ['a.mkv', 'video/x-matroska'], ['a.mov', 'video/quicktime'], ['a.m4v', 'video/x-m4v'], ['a.3gp', 'video/3gpp']])
    assert.equal(videoTypeOf({ type: '', name }), type, name);
  assert.equal(videoTypeOf({ type: 'video/mp4', name: 'x.bin' }), 'video/mp4', 'a type given by the picker is kept');
});

test('every video type the picker accepts is saved with a video file extension and comes back as a video', () => {
  for (const type of Object.values(VIDEO_TYPES)) {
    const ext = extOf(type);
    assert.notEqual(ext, 'bin', type + ' must not be saved as .bin');
    assert.equal(pfKindOfUrl('file:///x/lf-profile-media.' + ext), 'video', ext);
  }
});

test('pictures and GIFs are still not videos', () => {
  for (const u of ['a.gif', 'a.png', 'a.jpg', 'a.webp', 'a.bin']) assert.equal(pfKindOfUrl(u), 'gif', u);
});
