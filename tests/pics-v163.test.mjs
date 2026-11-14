// v163: custom pictures stay separate. Behaviour tests run the real gOf / artHtml / coverHtml from main.js; the few wiring lines that need the Android build or a browser are small labelled guards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';
const rd = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('gOf: a custom album picture REPLACES the original cover (no original under it); none / album gone = the original only', () => {
  const alpUrls = new Map([['A', 'blob:x']]);
  const gOf = extract('src/main.js', 'gOf', { alpUrls, PIC_BASE: '#111', byAlbum: id => id !== 'gone' });
  assert.equal(gOf({ id: 'A', g: 'ORIG' }), "url('blob:x') center/cover no-repeat, #111");
  assert.equal(gOf({ id: 'B', g: 'ORIG' }), 'ORIG')
  alpUrls.set('gone', 'blob:y'); assert.equal(gOf({ id: 'gone', g: 'ORIG' }), 'ORIG');
});
test('the player: canvas on = canvas; otherwise (or a bad canvas file) the custom cover layer', () => {
  const mk = o => extract('src/main.js', 'artHtml', { canvasOn: true, cvPath: () => '/v.mp4', cvBad: new Set(), covT: () => 'COV', Native: { fileUrl: p => 'file://' + p }, isVideo: p => p.endsWith('.mp4'), gOfT: () => 'G', ...o });
  assert.match(mk({})({ id: 't' }, {}), /<video class="cvmedia" src="file:\/\/\/v.mp4"/);
  assert.match(mk({ cvPath: () => '/i.png' })({ id: 't' }, {}), /<img class="cvmedia" src="file:\/\/\/i.png"/);
  assert.equal(mk({ canvasOn: false })({ id: 't' }, {}), 'COV'); assert.equal(mk({ cvPath: () => '' })({ id: 't' }, {}), 'COV'); assert.equal(mk({ cvBad: new Set(['/v.mp4']) })({ id: 't' }, {}), 'COV');
});
test('the tap viewer shows the ORIGINAL cover (a.g), never the custom layer', () => {
  const coverHtml = extract('src/main.js', 'coverHtml', {});
  assert.equal(coverHtml({ g: 'ORIG', id: 'A' }), '<span class="cover blk" style="--g:ORIG"></span>');
});
test('GUARD (browser/Android build needed): widget album key is title + album artist on both sides, old title-only key gone', () => {
  const M = rd('src/main.js'), J = rd('native-android/LiquidTiles.java');
  /* BUG #9: the custom-picture branch of pushWidgetCovers was removed from main.js (widgets always show the original covers, v166), so only the Java side of the key is checked now. */ assert.ok(J.includes('.put("a", aa)')); assert.ok(J.includes('String key = artists ? n : n + "\\u0001" + o.optString("a");'));
  assert.doesNotMatch(M, /alb\[unesc\(a\.title\)\.toLowerCase\(\)\]/);
});
test('GUARD: every picture type keeps its own store prefix, and main.js never writes a cover', () => {
  const all = ['src/main.js', 'src/plpics.js', 'src/data.js', 'src/bgmedia.js'].map(rd).join('\n');
  for (const k of ["'lf-playlist-pics:'", "'lf-albumpics:'", "'lf-artistgifs:'", "'lf-background:media'", "'lf-profile:media'"]) assert.ok(all.includes(k), k);
  assert.doesNotMatch(rd('src/main.js'), /\.coverPath\s*=\s*(?!'')/); assert.doesNotMatch(rd('src/main.js'), /a\.cover\s*=\s*(?!'')/);
});
test('GUARD (needs the running player): the open-player and lyrics tap wiring is unchanged', () => {
  const M = rd('src/main.js');
  assert.ok(M.includes("case 'open-np': if (Native.current()) renderNP();")); assert.ok(M.includes("go('lf-albumpics', (k, u) => { alpUrls.set(k, u); npSoon(); },"));
  assert.ok(M.includes("if (npPress || np.querySelector('[data-down]')) { npLate = true; return; }")); assert.ok(M.includes("if (k.long || k.moved) return; const art = e.target.closest && e.target.closest(ART); if (art) show(art); });"));
});
