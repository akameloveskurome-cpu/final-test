import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { UPDATE_POLL_MS } from '../src/update.js';
import { POPUP_POLL_MS } from '../src/popup.js';
import { UPD_PIC_MIN_MS } from '../src/updpic.js';
import { CREDIT_POLL_MS } from '../src/creditpic.js';
import { SPLASH_POLL_MS } from '../src/splashpic.js';
import { APP_LOGO_POLL_MS } from '../src/applogo.js';
import { BGALLOW_POLL_MS } from '../src/bgallowpic.js';
import { BANNER_POLL_MS } from '../src/statbanpic.js';

const logoSource = await readFile(new URL('../src/applogo.js', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

test('live update and artwork checks retain the 1000 ms cadence', () => {
  assert.equal(UPDATE_POLL_MS, 1000);
  assert.equal(POPUP_POLL_MS, 1000);
  assert.equal(UPD_PIC_MIN_MS, 1000);
  assert.equal(CREDIT_POLL_MS, 1000);
  assert.equal(SPLASH_POLL_MS, 1000);
  assert.equal(APP_LOGO_POLL_MS, 1000);
  assert.equal(BGALLOW_POLL_MS, 1000);   // v146
  assert.equal(BANNER_POLL_MS, 1000);    // v146
});

test('no logo is bundled; the About logo is checked live every 1000 ms', () => {
  assert.doesNotMatch(logoSource, /lf-app-logo/);
  assert.doesNotMatch(mainSource, /lf-app-logo/);
  assert.match(logoSource, /\bfetch\s*\(/);
  assert.match(logoSource, /setInterval\s*\([\s\S]*APP_LOGO_POLL_MS/);
});
