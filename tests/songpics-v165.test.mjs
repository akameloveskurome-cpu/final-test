// v165: a song can have its own picture / GIF; genres are searchable. Everything that shows a song uses the same lookup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';
const M = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), N = readFileSync(new URL('../src/native.js', import.meta.url), 'utf8');

test('song pictures have their own store, two copies, restore, retry and a picker', () => {
  assert.ok(M.includes("spDb = kvDb('lf-songpics')") && M.includes("'lf.songpics'"));
  assert.ok(M.includes("go('lf-songpics', (k, u) => { spUrls.set(k, u); npSoon(); }"));   // shown from the file at the first frame
  assert.ok(M.includes('const loadAllPics = () => { loadAlbumPics(); loadSongPics();'));
  assert.ok(M.slice(M.indexOf('const picsMissing')).includes('!spUrls.has(k)'));
  assert.ok(M.includes("item('sp-edit', 'Song picture or GIF…')") && M.includes("case 'sp-pick': spPick(); break;") && M.includes("case 'sp-reset': spReset(); break;"));
  assert.ok(/function spPick\(\)[\s\S]*isPicFile\(f\)[\s\S]*spDb\.put\(id, b\)/.test(M));   // any picture or GIF, saved untouched
  assert.ok(/spDb\.put\(id, b\)\.then[\s\S]{0,400}if \(prev\) m2\[id\] = prev; else delete m2\[id\]/.test(M));   // a failed save keeps the old one
});

test('the song picture REPLACES the album picture (real gOfT): song picture alone; none = album only', () => {
  const spUrls = new Map([['s1', 'blob:song1']]), gOf = a => 'GRAD-' + a.k, trackAlbum = t => ({ k: t && t.albumId });
  const gOfT = extract('src/main.js', 'gOfT', { gOf, trackAlbum, spUrls, PIC_BASE: '#111', soHas: () => false });
  assert.equal(gOfT({ id: 's1', albumId: 'al1' }), "url('blob:song1') center/cover no-repeat, #111");
  assert.equal(gOfT({ id: 's2', albumId: 'al2' }), 'GRAD-al2');
  assert.equal(gOfT(null), 'GRAD-null');
});
test('guard (needs the running app): every place a song is shown uses gOfT/covT, none paints the album picture only', () => {
  assert.doesNotMatch(M, /cov\(trackAlbum\(/);
  assert.equal((M.match(/gOf\(trackAlbum\(/g) || []).length, 1);   // only inside gOfT itself
});
test('lock screen / notification: the song picture first, then the album picture; colours follow the song picture', () => {
  assert.ok(M.includes("Native.setCoverOverride(t => (t ? (soHas(t) ? '' : mirrorPathSync('lf-songpics:' + t.id) || mirrorPathSync('lf-albumpics:' + t.albumId)) : ''));"));   // v208: a song marked "original cover" gives the notification no override
  assert.ok(N.includes('(coverFor && coverFor(t))'));
  assert.ok(M.includes('function coverTint(a, t)') && M.includes("sp ? t.id + '|s'"));
  assert.ok(M.includes('coverTint(trackAlbum(t), t)'));
});

test('the full-screen tap viewer still shows the ORIGINAL cover (rule kept)', () => {
  assert.ok(M.includes('function coverHtml(a) { return `<span class="cover blk" style="--g:${a && a.g}"></span>`; }'));
});

test('search lists genres, each with its own picture', () => {
  assert.ok(M.includes('GN = genres.filter(g => has(g.n, q))'));
  assert.ok(M.includes("secs.push({ t: 'Genres', n: GN.length") && M.includes("genreCov(GN[i].n, 'thumb')"));
});
