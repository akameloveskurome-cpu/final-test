import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const gateSource = await readFile(new URL('../src/updgate.js', import.meta.url), 'utf8');
import { existsSync } from 'node:fs';
const WF = new URL('../.github/workflows/android.yml', import.meta.url), NOWF = !existsSync(WF);
const workflow = NOWF ? '' : await readFile(WF, 'utf8');
const iconScript = await readFile(new URL('../scripts/no-launcher-icon.py', import.meta.url), 'utf8');
const applyScript = await readFile(new URL('../scripts/apply-app-logo.py', import.meta.url), 'utf8');
const appLogoSource = await readFile(new URL('../src/applogo.js', import.meta.url), 'utf8');

test('notification picture is deferred while an update is pending and not marked seen before paint', () => {
  assert.match(mainSource, /await updGateRestorePromise;[\s\S]*if \(updPending \|\| updBusy\) \{ popWaiting = true; return; \}/);
  assert.match(mainSource, /if \(updPending \|\| updBusy\) \{ popWaiting = true; return; \}/);
  assert.match(mainSource, /await new Promise\(resolve => \{[\s\S]*requestAnimationFrame\(\(\) => requestAnimationFrame\(resolve\)\)/);
  assert.match(mainSource, /if \(updPending \|\| !shown\.isConnected \|\| \$\('#sheet \.popimg'\) !== shown\) \{\s*popWaiting = true; popUnseen = null;/);
  assert.match(mainSource, /if \(!u\) \{[\s\S]*popupResumeAfterUpdateCheck\(\);/);
  assert.match(mainSource, /function popupResumeAfterUpdateCheck\(\)/);
  assert.match(mainSource, /else if \(updBusy\) \{[\s\S]*popUnseen = \{ el: shown, id: pic\.id, stamp: pic\.stamp \|\| '' \}/);
  assert.match(mainSource, /popUnseen && popUnseen\.el\?\.isConnected/);
  assert.match(mainSource, /localStorage\.setItem\('lf\.popupSeen', pic\.id\)/);
});

test('signing-key compatibility runs on branch APK jobs and fails closed without explicit override', { skip: NOWF && 'no .github/workflows/android.yml in this copy (zips drop dot-folders); it runs on GitHub' }, () => {
  const guard = workflow.slice(workflow.indexOf('name: "Guard: fail closed unless the published signing key matches"'));
  assert.ok(guard.length > 0, 'signing guard step exists');
  assert.doesNotMatch(guard.slice(0, guard.indexOf('      - name: Build summary')), /^        if:/m);
  assert.match(guard, /Could not download the published APK[\s\S]*exit 1/);
  assert.match(guard, /Could not read the published APK signing certificate[\s\S]*exit 1/);
  assert.match(guard, /ALLOW_NEW_KEY/);
  assert.match(workflow, /fetch-depth: 0.*complete history for newest-commit app-logo-pic fallback/);
});

test('the logo is baked into the APK as the launcher icon, with the generic icon only when no logo is usable', { skip: NOWF && 'no .github/workflows/android.yml in this copy (zips drop dot-folders); it runs on GitHub' }, () => {
  assert.match(workflow, /python3 -m venv "\$RUNNER_TEMP\/icon-venv"[\s\S]*pip" install --quiet pillow/);
  assert.match(workflow, /icon-venv\/bin\/python" scripts\/apply-app-logo\.py/);
  assert.match(workflow, /if \[ "\$RC" -eq 0 \][\s\S]*applied=true[\s\S]*elif \[ "\$RC" -eq 3 \][\s\S]*python3 scripts\/no-launcher-icon\.py[\s\S]*applied=false[\s\S]*Could not build the launcher icon/);
  assert.match(workflow, /ICON_APPLIED: \$\{\{ steps\.icon\.outputs\.applied \}\}/);
  assert.match(workflow, /The logo was baked in but the built APK has no launcher icon/);
  const iconStep = workflow.indexOf('name: "Launcher icon from app-logo-pic/');
  assert.ok(iconStep > workflow.indexOf('Install native plugin'), 'runs after the Android project exists');
  assert.ok(iconStep < workflow.indexOf('run: npx cap sync android'), 'runs before cap sync and the Gradle build');
  assert.match(iconScript, /android:\(\?:icon\|roundIcon\)/);
  assert.match(applyScript, /android:icon="@mipmap\/ic_launcher"/);
});

test('legacy logo cache is cleared and the mandatory update gate uses persistent native file storage', () => {
  assert.match(appLogoSource, /localStorage\.removeItem\('lf\.appLogo'\)/);
  assert.match(mainSource, /await store\.set\('updgate', u\)/);
  assert.match(gateSource, /await d\.store\.get\('updgate'\)/);
  assert.match(gateSource, /await d\.store\.set\('updgate', g\)/);
  assert.match(gateSource, /store\.set\('updgate', null\)\.catch/);
  assert.match(mainSource, /Could not save the update reminder/);
});
