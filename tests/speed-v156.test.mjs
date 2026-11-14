// v156: "run like a game": chunked picture upload + ownBlob run for real; the remaining tests are labelled GUARDs (need Android build/browser) (no phone here): pictures show before they are saved, pictures are decoded ahead and again on resume,
// the library and picture calls never block Capacitor's single plugin thread, the phone is asked for sustained performance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';
const rd = f => readFileSync(new URL(f, import.meta.url), 'utf8');
const M = rd('../src/main.js'), J = rd('../native-android/LiquidNative.java'), A = rd('../native-android/MainActivity.java'), P = rd('../src/picmirror.js');

test('GUARD: a picked picture / GIF is shown first and saved in the background (every picker)', () => {
  assert.match(M, /const ownBlob = async f =>/);
  for (const re of [/alpSet\(id, b\); alpDone\('Album picture set'(, mine)?\); alDb\.put\(id, b\)/, /gpSet\(n, b\); gpDone\('Genre picture set'(, mine)?\); gDb\.put\(n, b\)/, /agSet\(n, b\); apicDone\('Artist photo set'(, mine)?\); agDb\.put\(n, b\)/, /bgSetMedia\(b\); toast\('Background set'\); renderSub\(true\); bgDb\.put\(b\)/, /pfSetMedia\(b\);.*pfDbPut\(b\)/, /ppUrl\.set\(id, warmUrl\(URL\.createObjectURL\(b\)\)\)/]) assert.match(M, re);
  // v158: once the file copy actually lands, the lock screen / notification and the home screen widgets are told too (they read that file, not the in-memory picture)
  assert.match(M, /alDb\.put\(id, b\)\.then\(\(\) => \{ pushWidgetCovers\(\); Native\.updateArtwork\(id\)\.catch\(\(\) => \{\}\); \}/);
});
test('GUARD: pictures are decoded ahead (covers in batches by core count) and again when the app comes back', () => {
  assert.match(M, /function warmCovers\(\)/); assert.match(M, /function rewarmAll\(\)/); assert.match(M, /warmCores\(\) \* 8/);
  assert.match(M, /warmCovers\(\);\n  \} catch \(e\) \{ libLoading = false/);
  assert.match(M, /if \(!document\.hidden\) \{ resumeCanvas\(\); rewarmAll\(\)/);
});
test('GUARD: Java: library + picture calls run on their own threads, the saved library is parsed before the page asks', () => {
  for (const n of ['getLibraryNow', 'putPicNow', 'listPicsNow']) assert.ok(J.includes('LIB_POOL.execute(new Runnable() { @Override public void run() { ' + n + '(call)'), n);
  assert.match(J, /public void load\(\) \{\s*super\.load\(\);\s*try \{ warmLibrary\(\)/);
});
test('GUARD: Java: sustained performance mode + web view redraw on resume', () => {
  assert.match(A, /isSustainedPerformanceModeSupported\(\)\) w\.setSustainedPerformanceMode\(true\)/);
  assert.match(A, /web\.onResume\(\); web\.resumeTimers\(\); web\.postInvalidateOnAnimation\(\)/);
});
test('pictures are sent to the phone in bigger pieces, base64 made by the browser (real mirrorPut)', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.FileReader = class { readAsDataURL(b) { b.arrayBuffer().then(ab => { this.result = 'data:;base64,' + Buffer.from(ab).toString('base64'); this.onload(); }, e => { this.error = e; this.onerror(); }); } };
  const m = await import('../src/picmirror.js');
  const bytes = Uint8Array.from({ length: 3.5 * 1024 * 1024 }, (_, i) => (i * 31) & 255); bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  const calls = [];
  m.useMirror({ url: p => p, putPic: async a => { calls.push(a); return a.done ? { path: '/f/x.gif' } : {}; } });
  assert.equal(await m.mirrorPut('lf-albumpics:big', new Blob([bytes], { type: 'image/gif' })), '/f/x.gif');
  assert.deepEqual(calls.map(c => c.append), [false, true, true]);
  assert.deepEqual(calls.map(c => c.done), [false, false, true]);
  assert.deepEqual(calls.map(c => Buffer.from(c.base64, 'base64').length), [1536 * 1024, 1536 * 1024, 512 * 1024]);
  assert.ok(Buffer.concat(calls.map(c => Buffer.from(c.base64, 'base64'))).equals(Buffer.from(bytes)));
  assert.equal(calls[0].ext, 'gif');
  assert.equal(m.mirrorPathSync('lf-albumpics:big'), '/f/x.gif');
  delete globalThis.FileReader;
});
test('ownBlob copies a picked file into a plain Blob (real function), falls back to the file itself on error', async () => {
  const own = extract('src/main.js', 'ownBlob', { Blob });
  const b = await own({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer, type: 'image/png' });
  assert.equal(b.size, 3); assert.equal(b.type, 'image/png');
  const bad = { arrayBuffer: async () => { throw new Error('x'); } };
  assert.equal(await own(bad), bad);
});
