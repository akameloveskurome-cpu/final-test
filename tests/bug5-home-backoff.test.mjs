// BUG #5: Home stats section must not re-read the history in a loop when the read keeps failing.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, querySelectorAll() { return []; }, getElementById: () => null };
const { initLStats } = await import('../src/lstats.js');

test('failing home read: no tight re-render loop; retried at most once per 5 s', async () => {
  const realNow = Date.now, realSI = globalThis.setInterval;
  let now = 1_000_000; Date.now = () => now;
  globalThis.setInterval = () => ({ unref() {} });   // no live timers in this test
  let reads = 0, renders = 0, L;   // reads = home load attempts (one getListenDays call per attempt; fetchSegs retries getListens internally)
  const D = {
    Native: { getListens: async () => { throw new Error('db unreadable'); }, getListenDays: async () => { reads++; return { days: [] }; }, getListenSeen: async () => ({ seen: [] }), state: {} },
    escH: x => String(x), pl: (n, w) => n + ' ' + w, I: new Proxy({}, { get: () => '' }), unesc: x => x,
    tracks: () => [], trackAlbum: () => ({}), trackArtists: () => [], byAlbum: () => null, artistCov: () => '', header: () => '', push() {},
    // main.js refreshHome(): a debounced re-render of Home that calls homeSection again
    refreshHome() { renders++; setTimeout(() => { if (L) L.homeSection(); }, 5); },
    rerender() {}, toast() {}, tab: () => 'home',
  };
  try {
    L = initLStats(D);
    const first = L.homeSection();
    assert.match(first, /Loading/, 'first render shows loading while the read is pending');
    await new Promise(r => setTimeout(r, 200));                 // let the render loop run for a while
    assert.ok(reads <= 2, `reads while failing must stay bounded, got ${reads}`);
    const r0 = reads;
    now += 4_000; L.homeSection(); await new Promise(r => setTimeout(r, 30));
    assert.equal(reads, r0, 'inside the 5 s back-off: no new read');
    now += 2_000; L.homeSection(); await new Promise(r => setTimeout(r, 30));
    assert.equal(reads, r0 + 1, 'after the 5 s back-off: exactly one retry');
  } finally {
    Date.now = realNow; globalThis.setInterval = realSI;
  }
});
