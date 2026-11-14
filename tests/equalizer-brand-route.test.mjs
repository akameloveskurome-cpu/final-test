// Equalizer row per phone brand: OnePlus -> Dirac Audio Tuner, OPPO / Realme -> Real Sound Technology (unchanged), other brands -> their own sound-effects page.
// The Java part is checked on the source text (no Android here); the real routing was also run against stub Android classes in the AI sandbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const java = read('native-android/LiquidNative.java');
const block = (from, to) => { const a = java.indexOf(from), b = java.indexOf(to, a + 1); assert.ok(a > -1 && b > a, 'block ' + from); return java.slice(a, b); };

test('eqBrand: OnePlus is detected first, OPPO and Realme share the Real Sound route, everything else is "other"', () => {
  const b = block('private static String eqBrand()', 'private static boolean eqSystemApp');
  assert.ok(b.indexOf('"oneplus"') > -1 && b.indexOf('"oneplus"') < b.indexOf('"oppo"'), 'oneplus is checked before oppo');
  assert.match(b, /contains\("realme"\)/);
  assert.match(b, /return "other"/);
});

test('openEqualizer: oppo -> realSoundRoute, oneplus -> diracRoute, other -> effectsRoute', () => {
  const b = block('public void openEqualizer(final PluginCall call)', '/* ---------- v77: Bluetooth.');
  assert.match(b, /"oppo"\.equals\(brand\)\) \{ rs = realSoundRoute\(\); found = "real-sound"; \}/);
  assert.match(b, /"oneplus"\.equals\(brand\)\) \{ rs = diracRoute\(\); found = "dirac"; \}/);
  assert.match(b, /else \{ rs = effectsRoute\(\); found = "effects"; \}/);
  assert.match(b, /o\.put\("brand", brand\)/, 'the brand is sent to the JS side');
});

test('OPPO / Realme path is untouched: realSoundRoute still looks for "realsound" and the weaker "soundeffect" page', () => {
  const b = block('private Intent realSoundRoute()', '/* ---------- Equalizer per phone brand');
  assert.match(b, /name\.contains\("realsound"\) \|\| label\.contains\("realsound"\)/);
  assert.match(b, /name\.contains\("soundeffect"\) \|\| label\.contains\("soundeffect"\)/);
  assert.doesNotMatch(b, /dirac/i, 'Real Sound code never mentions Dirac');
});

test('OnePlus: diracRoute only uses exported, enabled pages of pre-installed apps and prefers "Dirac Audio Tuner"', () => {
  const b = block('private Intent diracRoute()', 'private static final String[] EQ_KEYS');
  assert.match(b, /eqSystemApp\(pi\.applicationInfo\)/);
  assert.match(b, /!ai\.exported \|\| !ai\.enabled/);
  assert.match(b, /diracaudiotuner/);
  assert.doesNotMatch(b, /realsound/i, 'OnePlus never falls into Real Sound');
});

test('other brands: effectsRoute is system-apps-only and skips this app; the standard panel only counts when a system app answers it', () => {
  const e = block('private Intent effectsRoute()', 'private Intent eqPanel()');
  assert.match(e, /own\.equals\(pi\.packageName\) \|\| !eqSystemApp\(pi\.applicationInfo\)/);
  assert.match(e, /!ai\.exported \|\| !ai\.enabled/);
  const p = block('private Intent eqPanel()', 'private volatile Intent eqRouteCache');
  assert.match(p, /ACTION_DISPLAY_AUDIO_EFFECT_CONTROL_PANEL/);
  assert.match(p, /!eqSystemApp\(ri\.activityInfo\.applicationInfo\)\) return null/);
  assert.match(p, /PlaybackService\.audioSession\(\)/);
});

test('every brand still ends in Sound & vibration when nothing opens', () => {
  const b = block('public void openEqualizer(final PluginCall call)', '/* ---------- v77: Bluetooth.');
  assert.match(b, /"android\.settings\.SOUND_SETTINGS"/);
  assert.match(b, /"other"\.equals\(brand\)\) \{\s*Intent panel = eqPanel\(\)/, 'the standard panel is only tried on other brands');
  assert.match(b, /o\.put\("via", "settings"\)/);
});

test('Native.equalizerHint names the right row per brand', async () => {
  const { Native } = await import('../src/native.js');
  assert.match(Native.equalizerHint('oneplus'), /Dirac Audio Tuner/);
  assert.match(Native.equalizerHint('oppo'), /Real Sound Technology/);
  for (const b of ['other', undefined, 'samsung']) {
    const t = Native.equalizerHint(b);
    assert.match(t, /Sound effects|Equalizer/);
    assert.doesNotMatch(t, /Real Sound|Dirac/);
  }
});

test('main.js uses the per-brand hint and the Settings row names all three routes', () => {
  const m = read('src/main.js');
  assert.match(m, /toast\(Native\.equalizerHint\(r\.brand\), 4500\)/);
  assert.doesNotMatch(m, /toast\('Opened Sound & vibration\. Tap Real Sound Technology there\.'/);
  assert.match(m, /Dirac Audio Tuner on OnePlus, Real Sound Technology on OPPO and Realme/);
});
