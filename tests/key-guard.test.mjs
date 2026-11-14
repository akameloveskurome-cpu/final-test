import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

import { existsSync } from 'node:fs';
const GI = new URL('../.gitignore', import.meta.url), NOGI = !existsSync(GI);
const gi = NOGI ? '' : await readFile(GI, 'utf8');
const WF = new URL('../.github/workflows/android.yml', import.meta.url), NOWF = !existsSync(WF);
const wf = NOWF ? '' : await readFile(WF, 'utf8');

test('.gitignore blocks every signing-secret file name the guides mention', { skip: NOGI && 'no .gitignore in this copy (zips drop dot-files); it runs on GitHub' }, () => {
  for (const n of ['*.keystore', '*.jks', 'KEYSTORE_BASE64.txt', 'KEYSTORE_PASSWORD.txt', 'key.txt', '*.p12']) assert.ok(gi.split('\n').includes(n), n);
});

test('workflow refuses committed signing secrets before it unpacks anything', { skip: NOWF && 'no .github/workflows/android.yml in this copy (zips drop dot-folders); it runs on GitHub' }, () => {
  const guard = wf.indexOf('name: Refuse committed signing secrets'), unpack = wf.indexOf('name: Unpack uploaded zip');
  assert.ok(guard > 0 && guard < unpack);
  assert.match(wf, /KEYSTORE\[\^\/\]\*\\\.\(txt\|b64\|base64\)/);
  assert.match(wf, /git ls-files -z \| tr/);   // BUG-448
});

test('the guard pattern flags key files and nothing else', { skip: NOWF && 'no .github/workflows/android.yml in this copy (zips drop dot-folders); it runs on GitHub' }, () => {
  const pat = /PAT='(.*)'/.exec(wf)[1];   // the real pattern of the workflow (BUG-446)
  const run = name => spawnSync('grep', ['-iE', pat], { input: name + '\n' }).status === 0;
  for (const bad of ['KEYSTORE_BASE64.txt', 'KEYSTORE_PASSWORD.txt', 'signing/liquid-dark.keystore', 'a/b/key.txt', 'x.jks', 'x.p12', 'Copy of KEYSTORE_BASE64.txt', 'sign/upload.pfx', 'sign/key.properties', 'signing/upload.keystore.b64', 'app/release.jks ']) assert.ok(run(bad), bad);
  for (const ok of ['signing/README.md', 'src/main.js', 'monkey.txt', 'notes.txt', 'package.json']) assert.ok(!run(ok), ok);
});
