import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchSplashPic, SPLASH_DIR, SPLASH_POLL_MS } from '../src/splashpic.js';

const json = body => ({ ok: true, json: async () => body });
test('the opening splash is a separate live folder with a 1-second manifest poll', () => {
  assert.equal(SPLASH_DIR, 'splash-pic');
  assert.equal(SPLASH_POLL_MS, 1000);
});

test('a failed splash image download is backed off per stamp', async () => {
  let imageFetches = 0;
  const f = async url => {
    if (url.includes('latest.json')) return json({ name: 'broken.png', stamp: 'retry-storm-splash-144' });
    imageFetches++;
    throw new Error('connection reset');
  };
  assert.equal(await fetchSplashPic(f, 'o/r', 'main'), null);
  assert.equal(await fetchSplashPic(f, 'o/r', 'main'), null);
  assert.equal(imageFetches, 1);
});

test('a GIF is never accepted as the splash picture', async () => {
  let imageFetches = 0;
  const f = async url => {
    if (url.includes('latest.json')) return json({ name: 'anim.gif', stamp: 'gif-splash-144' });
    imageFetches++;
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode('GIF89a-bytes').buffer };
  };
  assert.equal(await fetchSplashPic(f, 'o/r', 'main'), null);
  assert.equal(imageFetches, 0);
});
