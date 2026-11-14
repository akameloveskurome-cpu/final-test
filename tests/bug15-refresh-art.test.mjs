// BUG #15: Settings > Refresh art must check the running scan BEFORE it clears any picture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const line = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').split('\n').find(l => l.includes("case 'refresh-art':"));
const run = scanning => {
  const log = [];
  const body = line.slice(line.indexOf("case 'refresh-art':") + "case 'refresh-art':".length).split('//')[0];
  new Function('scanning', 'refreshAllPics', 'toast', 'loadLib', `switch ('x') { default: ${body} }`)(scanning, () => log.push('refreshAllPics'), m => log.push('toast:' + m), () => log.push('loadLib'));
  return log;
};

test('refresh-art while a scan runs: only the message, no picture is cleared', () => {
  assert.deepEqual(run(true), ['toast:A scan is running. Try again in a moment.']);
});
test('refresh-art with no scan: pictures reloaded, then the library', () => {
  assert.deepEqual(run(false), ['refreshAllPics', 'loadLib']);
});
