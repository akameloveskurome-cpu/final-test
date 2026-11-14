// BUG #6: the history detail screen must redraw and say so when the history read fails (not stay on "Loading…").
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, querySelectorAll() { return []; }, getElementById: () => null };
const { initLStats } = await import('../src/lstats.js');

test('failed read: rerender is called and the screen shows an error, then retries after 5 s', async () => {
  const realNow = Date.now, realSI = globalThis.setInterval;
  let now = 2_000_000; Date.now = () => now; globalThis.setInterval = () => ({ unref() {} });
  let reads = 0, rerenders = 0, L;
  const D = {
    Native: { getListens: async () => { reads++; throw new Error('db unreadable'); }, getListenDays: async () => ({ days: [] }), getListenSeen: async () => ({ seen: [] }), state: {} },
    escH: x => String(x), pl: (n, w) => n + ' ' + w, I: new Proxy({}, { get: () => '' }), unesc: x => x,
    tracks: () => [], trackAlbum: () => ({}), trackArtists: () => [], byAlbum: () => null, artistCov: () => '', header: () => '', push() {},
    rerender() { rerenders++; }, refreshHome() {}, toast() {}, tab: () => 'home',
  };
  try {
    L = initLStats(D);
    assert.match(L.screens.ldetail('song:abc'), /Loading/);
    await new Promise(r => setTimeout(r, 50));
    assert.equal(rerenders, 1, 'the screen is redrawn after the failure');
    const first = reads;
    const html = L.screens.ldetail('song:abc');
    assert.match(html, /Could not read your listening history/);
    assert.doesNotMatch(html, /No listening history yet/);
    assert.equal(reads, first, 'no new read inside the 5 s window (no render loop)');
    now += 6000;
    assert.match(L.screens.ldetail('song:abc'), /Loading/, 'after 5 s a render retries');
    await new Promise(r => setTimeout(r, 50));
    assert.ok(reads > first, 'retry read happened');
  } finally { Date.now = realNow; globalThis.setInterval = realSI; }
});
