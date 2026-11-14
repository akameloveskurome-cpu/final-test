// v145b: listening pipeline (service tracker -> database -> page). The page side (mergeNativePlays, liveRefresh) runs for real; tests labelled GUARD are Java/wiring source checks, because the Java side cannot run here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract } from './extract.mjs';
const rd = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const T = rd('native-android/ListenTracker.java'), N = rd('native-android/LiquidNative.java'), M = rd('src/main.js'), NV = rd('src/native.js'), W = rd('native-android/StatsWidgets.java'), DB = rd('native-android/ListenDb.java'), L = rd('src/lstats.js');

test('GUARD: tracker saves every 5 s, first save at 1.5 s, and decides a play at an exact timer', () => {
  assert.match(T, /HEARTBEAT = 5_000/); assert.match(T, /FIRST_BEAT = 1_500/);
  assert.match(T, /h\.postDelayed\(qual,/); assert.match(T, /private void qualifyNow\(\)/);
});
test('GUARD: a failed insert is retried at once and again on the next beat; a failed update is retried', () => {
  assert.match(T, /one immediate retry/); assert.match(T, /else if \(p\.isPlaying\(\)\) \{ start\(\); return; \}/);
  assert.match(DB, /for \(int attempt = 0; attempt < 2; attempt\+\+\)/);
});
test('GUARD: plays are counted by the service only: saved at once with commit(), plugin ticker and page counter are off in the app', () => {
  assert.match(T, /static void recordPlay/); assert.match(T, /\.commit\(\)/); assert.doesNotMatch(T, /putString\("plays"[^;]*\.apply\(\)/); assert.doesNotMatch(T, /MAX_PENDING_PLAYS/);
  assert.doesNotMatch(N, /countPlayTick|playCounter\.tick/);
  assert.match(M, /on\('onProgress', \(\{ pos, dur \}\) => \{ if \(Native\.isNative\) return;/);
  assert.match(NV, /addListener\('onPlayCounted'/); assert.match(N, /notifyListeners\("onPlayCounted"/);
  assert.match(N, /synchronized \(ListenTracker\.PLAYS_LOCK\)/);
});
// BUG #38: extract() passes dependencies as function parameters (a snapshot), so it cannot show a value that changes while the function runs. extractLive() runs the same real source inside with(D), so every name is read live from D (statsGen can change during a take).
function extractLive(file, name, D) {
  const src = readFileSync(new URL('../' + file, import.meta.url), 'utf8').split('\n');
  const i = src.findIndex(l => new RegExp('^async function ' + name + '\\b').test(l));
  if (i < 0) throw new Error(name + ' not found in ' + file);
  let j = i; while (j < src.length && src[j] !== '}') j++;
  if (j >= src.length) throw new Error(name + ': closing "}" at column 0 not found in ' + file);
  return new Function('D', `with (D) {\n${src.slice(i, j + 1).join('\n')}\nreturn ${name}; }`)(D);
}
function mergeWorld({ takes, saveFail = false }) {
  const log = []; let i = 0; const D = {};
  D.Native = { isNative: true, takePlays: async () => { log.push('take'); if (D.during) D.during(); return { plays: takes[i++] || [] }; }, ackPlays: async a => { log.push('ack ' + a.plays.length); } };
  Object.assign(D, { statsReady: true, mergingPlays: false, mergeAgain: false, statsGen: 0, stats: { n: 0 }, mergePlays: (st, l) => ({ added: l.length, stats: { n: st.n + l.length } }), refreshHome: () => {}, logLine: () => {}, saveUser: (n, d) => D.store.set(n, d), store: { set: async () => { if (saveFail) throw new Error('disk'); log.push('save'); } }, STATS_FILE: 'f' });
  D.fn = extract('src/main.js', 'mergeNativePlays', Object.fromEntries(Object.entries(D).filter(([k]) => !['fn', 'during'].includes(k))), '}');
  return { log, D };
}
test('page takes plays again when one arrives during a take (real mergeNativePlays), never skips it', async () => {
  const w = mergeWorld({ takes: [[{ id: 1, ts: 1 }], [{ id: 2, ts: 2 }]] });
  w.D.during = () => { w.D.during = null; w.D.fn(); };   // a play arrives while the first take runs
  await w.D.fn(); await new Promise(r => setImmediate(r));
  assert.deepEqual(w.log, ['take', 'save', 'ack 1', 'take', 'save', 'ack 1']);
});
test('plays are acknowledged only after the save; a failed save keeps them for the next take', async () => {
  const w = mergeWorld({ takes: [[{ id: 1, ts: 1 }]], saveFail: true }); await w.D.fn();
  assert.deepEqual(w.log, ['take']);
  const ok = mergeWorld({ takes: [[{ id: 1, ts: 1 }, { id: 2, ts: 2 }]] }); await ok.D.fn();
  assert.deepEqual(ok.log, ['take', 'save', 'ack 2']);
});
test('BUG-103: stats cleared while a take is running: those plays are dropped (not merged, not saved, not acknowledged); a take after the clear merges normally', async () => {
  const log = []; let gen = 0, clearDuringTake = true;
  const D = { Native: { isNative: true, takePlays: async () => { log.push('take'); if (clearDuringTake) { clearDuringTake = false; gen++; } return { plays: [{ id: 1, ts: 1 }] }; }, ackPlays: async a => { log.push('ack ' + a.plays.length); } },
    statsReady: true, mergingPlays: false, mergeAgain: false, stats: { n: 0 }, mergePlays: (st, l) => ({ added: l.length, stats: { n: st.n + l.length } }),
    refreshHome: () => {}, logLine: () => {}, saveUser: async () => { log.push('save'); }, STATS_FILE: 'f' };
  Object.defineProperty(D, 'statsGen', { get: () => gen, enumerable: true });   // live: reads the current generation on every access
  const fn = extractLive('src/main.js', 'mergeNativePlays', D);
  await fn();
  assert.deepEqual(log, ['take']);              // clear happened during the take: no save, no ack
  assert.deepEqual(D.stats, { n: 0 });          // nothing merged back into the cleared stats
  assert.equal(D.mergingPlays, false);          // the guard released its lock
  await fn();                                   // no clear this time
  assert.deepEqual(log, ['take', 'take', 'save', 'ack 1']);
  assert.deepEqual(D.stats, { n: 1 });
});
test('no plays: nothing saved or acknowledged; not native or stats not ready: no take at all', async () => {
  const w = mergeWorld({ takes: [[]] }); await w.D.fn(); assert.deepEqual(w.log, ['take']);
  const x = mergeWorld({ takes: [[{ id: 1, ts: 1 }]] }); x.D.statsReady = false;
  const f = extract('src/main.js', 'mergeNativePlays', { Native: { isNative: true, takePlays: async () => { x.log.push('take'); return {}; } }, statsReady: false, mergingPlays: false, mergeAgain: false }, '}');
  await f(); assert.deepEqual(x.log, []);
});
test('GUARD: widget redraw is never dropped inside the 4 s window (a trailing redraw is scheduled)', () => {
  assert.match(W, /trailing/); assert.match(W, /MAIN\.postDelayed/);
});
test('stats screen refreshes every 5 s while playing and once more when playback pauses (real liveRefresh)', async () => {
  const realSI = globalThis.setInterval, timers = []; globalThis.setInterval = (fn, ms) => { timers.push([fn, ms]); return { unref() {} }; };
  globalThis.document = { hidden: false, addEventListener() {}, querySelectorAll() { return []; }, getElementById: () => null };
  const { initLStats } = await import('../src/lstats.js'); let reads = 0;
  const state = { playing: true }, top = { t: 'lstats' };
  const D = { Native: { getListens: async () => { reads++; return { segs: [] }; }, getListenDays: async () => ({ days: [] }), getListenSeen: async () => ({ seen: [] }), state },
    escH: x => String(x), pl: (n, w) => n + ' ' + w, I: new Proxy({}, { get: () => '' }), unesc: x => x, tracks: () => [], trackAlbum: () => ({}), trackArtists: () => [], byAlbum: () => null, artistCov: () => '', header: () => '', push() {}, rerender() {}, refreshHome() {}, toast() {}, tokenColour: () => '', sheet() {}, closeSheet() {}, stack: () => [top], tab: () => 'home' };
  let L; try { L = initLStats(D); } finally { globalThis.setInterval = realSI; }
  const live = timers.find(t => t[1] === 5000); assert.ok(live, 'a 5 s live timer is registered');
  L.state.period = 'daily'; L.state.ref = Date.now();
  const tick = async () => { const before = reads; live[0](); await new Promise(r => setTimeout(r, 20)); return reads - before; };
  assert.equal(await tick(), 1, 'playing: the open period is re-read');
  await new Promise(r => setTimeout(r, 1)); state.playing = false;
  assert.equal(await tick(), 0, 'paused right after playing: the last refresh runs, the 15 s throttle keeps it from re-reading');
  assert.equal(await tick(), 0, 'paused and idle: nothing');
  state.playing = true; document.hidden = true; assert.equal(await tick(), 0, 'app hidden: nothing');
});
