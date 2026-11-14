// v166b: background + profile pictures follow the same rules as every other picture: two copies (IndexedDB + file), first-frame file, retried when missing. pfMigrate runs for real; the rest are labelled GUARD source checks (need browser/Android build).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';
const M = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('GUARD: a still profile photo is saved as a file + IndexedDB copy, not as text in localStorage', () => {
  assert.doesNotMatch(M, /localStorage\.setItem\('lf\.profile'/);
  assert.ok(/keepOriginal\(f\)[\s\S]{0,700}pfDbPut\(b\)\.then\(\(\) => \{ setFlag\('lf\.haspf', true\); try \{ localStorage\.removeItem\('lf\.profile'\)/.test(M));   // old text goes only after the save
});
function migWorld({ v = 'data:image/png;base64,AAA', putOk = true, changeDuring = false, media = null }) {
  const st = { v }, log = [];
  const deps = { pfp: () => st.v, pfMedia: media, fetch: async () => ({ blob: async () => ({ size: 3 }) }),
    pfDbPut: async () => { if (changeDuring) st.v = 'data:other'; if (!putOk) throw new Error('x'); log.push('saved'); },
    setFlag: (k, on) => log.push('flag ' + k + on), pfSetMedia: () => log.push('media'), localStorage: { removeItem: k => log.push('rm ' + k) },
    stack: [{ t: 'settings' }], renderSub: () => log.push('render') };
  return { log, run: extract('src/main.js', 'pfMigrate', deps, '}') };
}
test('an old text profile photo is moved to the two-copy storage; the old text is removed only after the save', async () => {
  const w = migWorld({}); await w.run();
  assert.deepEqual(w.log, ['saved', 'flag lf.haspftrue', 'media', 'rm lf.profile', 'render']);
});
test('a failed save, a changed photo, an already-migrated or non-text photo keep the old text untouched', async () => {
  for (const o of [{ putOk: false }, { changeDuring: true }, { media: {} }, { v: '' }, { v: 'file:///x.png' }]) {
    const w = migWorld(o); await w.run(); assert.ok(!w.log.some(x => x.startsWith('rm ') || x === 'media'), JSON.stringify(o));
  }
});
test('GUARD: a still profile photo is saved as a file + IndexedDB copy, migration runs after the saved picture was looked for', () => {
  assert.ok(/if \(!pfQuick && !pfMedia\) await restorePf\(\); pfMigrate\(\)/.test(M));
});
test('GUARD: background and profile that did not come back are retried like every other picture', () => {
  assert.ok(/picsMissing[\s\S]{0,900}bgSaved\(\)[\s\S]{0,80}pfSaved\(\)/.test(M));
  assert.ok(/function reloadMissingPics\(\)[^\n]*restoreBg\(\)[^\n]*restorePf\(\)/.test(M));
  assert.ok(M.includes("bgDb.put(b).then(() => setFlag('lf.hasbg', true))") && M.includes("case 'bgrm': bgDb.del().catch(() => {}); setFlag('lf.hasbg', false)"));
});
test('GUARD: both pickers list .gif next to image/*', () => {
  assert.ok(M.includes("i.accept = 'image/*,.gif,video/*'") && /function bgPick[\s\S]{0,200}i\.accept = 'image\/\*,\.gif'/.test(M));
});
