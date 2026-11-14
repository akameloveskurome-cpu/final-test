import test from 'node:test';
import assert from 'node:assert/strict';
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const m = await import('../src/picmirror.js');

test('sniffExt recognises a picture with no type', () => {
  const pad = a => Uint8Array.from([...a, ...new Array(16).fill(0)]);
  assert.equal(m.sniffExt(pad([...'GIF89a'].map(c => c.charCodeAt(0)))), 'gif');
  assert.equal(m.sniffExt(pad([0x89, 0x50, 0x4e, 0x47])), 'png');
  assert.equal(m.sniffExt(pad([0xff, 0xd8, 0xff])), 'jpg');
  assert.equal(m.sniffExt(pad([1, 2, 3])), 'bin');
});

test('mirrorSync rebuilds the quick list from the files, drops stale entries', async () => {
  const names = ['lf-albumpics:a1', 'lf-playlist-pics:ix'].map(k => m.nameOf(k));
  m.useMirror({ url: p => 'http://x' + p, listPics: async () => ({ names, files: names.map(n => ({ n, p: '/f/' + n + '.gif' })) }) });
  store.set('lf.picurls', JSON.stringify({ 'lf-albumpics:gone': '/f/old.gif' }));
  assert.equal(await m.mirrorSync(), true);
  assert.deepEqual(m.mirrorSyncKeys('lf-albumpics:'), ['lf-albumpics:a1']);
  assert.deepEqual(m.mirrorSyncKeys('lf-playlist-pics:'), ['lf-playlist-pics:ix']);
  assert.ok(m.mirrorUrlSync('lf-albumpics:a1').startsWith('http://x/f/'));
});

test('an older phone part (no paths) changes nothing', async () => {
  m.useMirror({ url: p => p, listPics: async () => ({ names: ['k61'] }) });
  assert.equal(await m.mirrorSync(), false);
});

import { readFileSync } from 'node:fs';
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
import { extract } from './extract.mjs';
function repaintWorld(open = true) {
  const log = [], el = { classList: { contains: () => open }, scrollTop: 7 };
  const stack = []; const deps = { renderMini: () => log.push('mini'), markPlaying: () => log.push('mark'), $: () => el, Native: { current: () => ({}) }, stack, mainY: 0, renderNP: () => log.push('np'), renderMain: () => log.push('main'), renderSub: v => log.push('sub' + v) };
  return { log, stack, fn: extract('src/main.js', 'repaintAll', deps, '}') };
}
test('v152: repaintAll repaints mini player, playing mark, Now Playing, tab screen and (only when open) the sub screen', () => {
  const w = repaintWorld(); w.fn();
  assert.deepEqual(w.log, ['mini', 'mark', 'np', 'main']);
  w.log.length = 0; w.stack.push({}); w.fn();
  assert.deepEqual(w.log, ['mini', 'mark', 'np', 'main', 'subtrue']);
});
test('v152: alpDone / gpDone / apicDone close the sheet, toast and repaint everything', () => {
  for (const [name, extra] of [['alpDone', ['widgets', 'art:A']], ['gpDone', []], ['apicDone', ['widgets']]]) {
    const log = [], tint = new Map([['A|1', 1], ['B|1', 2]]);
    const fn = extract('src/main.js', name, { closeIfStill: () => log.push('close'), closeSheet: () => log.push('close'), toast: m => log.push('toast ' + m), covTint: tint, alpFor: 'A', repaintAll: () => log.push('repaint'), pushWidgetCovers: () => log.push('widgets'), Native: { updateArtwork: id => { log.push('art:' + id); return Promise.resolve(); } } });
    fn('msg');
    assert.deepEqual(log.slice(0, 3), ['close', 'toast msg', 'repaint'], name);
    for (const x of extra) assert.ok(log.includes(x), name + ' ' + x);
    if (name === 'alpDone') assert.deepEqual([...tint.keys()], ['B|1']);
  }
});
test('GUARD (needs the Android build): Canvas list is retried', () => assert.match(main, /loadCanvasList/));

test('v153: the playing song\'s notification artwork is updated live', () => {
  assert.match(main, /alpDone\(msg(, mine)?\)[^\n]*Native\.updateArtwork\(alpFor\)/);
  assert.match(main, /Native\.updateArtwork\(\)/);   // after a restart
  const nat = readFileSync(new URL('../src/native.js', import.meta.url), 'utf8');
  assert.match(nat, /async updateArtwork\(albumIds\)[\s\S]*N\.setArtwork/);
  const java = readFileSync(new URL('../native-android/LiquidNative.java', import.meta.url), 'utf8');
  assert.match(java, /public void setArtwork\(PluginCall call\)[\s\S]*replaceMediaItem/);
});

test('v154: a removed picture stays removed (mark until every saved copy is gone)', async () => {
  const del = [];
  m.useMirror({ url: p => p, delPic: async a => { del.push(a.name); }, listPics: async () => ({ files: [{ n: m.nameOf('lf-albumpics:z'), p: '/f/z.gif' }, { n: m.nameOf('lf-albumpics:y'), p: '/f/y.gif' }] }) });
  await m.mirrorDel('lf-albumpics:z');
  assert.equal(m.mirrorTombed('lf-albumpics:z'), true);
  assert.equal(m.mirrorUrlSync('lf-albumpics:z'), '');
  await m.mirrorSync();   // the file is "still there" (delete interrupted): it must not come back
  assert.deepEqual(m.mirrorSyncKeys('lf-albumpics:'), ['lf-albumpics:y']);
  assert.ok(del.includes(m.nameOf('lf-albumpics:z')));
  m.mirrorUntomb('lf-albumpics:z'); assert.equal(m.mirrorTombed('lf-albumpics:z'), false);
});

test('v155: every cover on screen goes through the same lookup, and a custom picture replaces the original', () => {
  // v158: coverHtml() (the full-screen cover viewer, opened by tapping the cover) is the ONE deliberate exception: it always shows the
  // real / embedded cover (a.g), never the custom-picture layer that gOf() would add, same rule the listening stats and yearly recap follow.
  const bad = [...main.matchAll(/--g:([^;"']{0,80})/g)].map(x => x[1]).filter(x => !/gOf\(|gOfT\(|row-fill|^\$\{a && a\.g\}$/.test(x));
  assert.deepEqual(bad, []);   // every OTHER square paints a cover without the custom-picture lookup
  assert.match(main, /const gOf = a => \{[^\n]*center\/cover no-repeat, \$\{PIC_BASE\}/);   // v208+: custom only, original not underneath
  assert.doesNotMatch(main, /center\/cover no-repeat, var\(--row-fill\)` : a\.g/);
  assert.match(main, /async function ppHeal/);
  assert.match(main, /function coverHtml\(a\) \{ return `<span class="cover blk" style="--g:\$\{a && a\.g\}"><\/span>`; \}/, 'the cover viewer bypasses gOf() on purpose: it must show the real cover, not the custom picture');
});

test('BUG-79: a picker that finishes after its sheet was replaced does not close the new sheet', () => {
  const log = [];
  let cur = { id: 'new' };
  const $ = () => ({ firstElementChild: cur });
  const closeIfStill = extract('src/main.js', 'closeIfStill', { $, closeSheet: () => log.push('close') });
  closeIfStill({ id: 'old' });
  assert.deepEqual(log, []);
  closeIfStill(cur);
  assert.deepEqual(log, ['close']);
  log.length = 0; closeIfStill(undefined);   // a synchronous caller (Reset) always closes
  assert.deepEqual(log, ['close']);
});
