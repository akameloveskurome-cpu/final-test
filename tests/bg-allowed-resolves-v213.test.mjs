// v213: "Allow background activity" card never showed. Cause: in LiquidNative.isBackgroundAllowed a // comment sat at the END of the line that held the resolve call,
// so the resolve was part of the comment. The native call never answered, `await Native.isBackgroundAllowed()` in src/bgallow.js waited for ever, `busy` stayed true
// and the card never opened (not at start, not on later opens). The old tests only matched text with a regex and stubbed the answer in JS, so nobody noticed.
// This file (1) reads the real Java the way the compiler does (comments removed) and demands that every native method answers,
// (2) runs the real src/bgallow.js against a native call that never answers and against a normal one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const J = readFileSync(new URL('../native-android/LiquidNative.java', import.meta.url), 'utf8');

/** Java source with // and /* comments removed (string and char literals respected), i.e. what the compiler really sees. */
function stripComments(src) {
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (q) { out += c; if (c === '\\') { out += src[i + 1] || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'") q = c;
    out += c; i++;
  }
  return out;
}
/** { name, call, body } for every @PluginMethod, bodies cut out of the comment-free code by brace matching. */
function pluginMethods(code) {
  const re = /@PluginMethod[^\n]*\n\s*public\s+void\s+(\w+)\s*\(\s*(?:final\s+)?PluginCall\s+(\w+)\s*\)\s*(?:throws[^{]*)?\{/g;
  const list = []; let m;
  while ((m = re.exec(code))) {
    let i = re.lastIndex, depth = 1;
    while (i < code.length && depth) {
      const c = code[i];
      if (c === '"' || c === "'") { const q = c; i++; while (code[i] !== q) { if (code[i] === '\\') i++; i++; } }
      else if (c === '{') depth++; else if (c === '}') depth--;
      i++;
    }
    list.push({ name: m[1], call: m[2], body: code.slice(re.lastIndex, i) });
  }
  return list;
}
const code = stripComments(J), methods = pluginMethods(code);

// These hand their PluginCall to Android (activity result / permission callback) or to a helper method, which answers it. Checked by hand.
const HANDED_OFF = new Set(['pickFolder', 'getLibrary', 'requestAllFiles', 'importPlaylists', 'openFiles', 'pickMedia', 'putPic', 'listPics', 'requestNotifications']);

test('the Java parser really finds the native methods (guards this test itself)', () => {
  assert.ok(methods.length >= 60, 'found ' + methods.length + ' @PluginMethod methods');
  assert.ok(methods.some(m => m.name === 'isBackgroundAllowed'));
});

test('isBackgroundAllowed answers: its resolve call is real code, not part of a comment', () => {
  const m = methods.find(x => x.name === 'isBackgroundAllowed');
  assert.match(m.body, /\bcall\.resolve\(\s*o\s*\)\s*;/, 'call.resolve(o) must survive comment removal');
  assert.match(m.body, /o\.put\("allowed", ignoring\)\s*;/);
  // the resolve is on a line of its own in the source (no code behind a // comment on that line)
  const line = J.split('\n').find((l, i, all) => /^\s*call\.resolve\(o\);\s*$/.test(l) && /isBackgroundAllowed|background: allowed check/.test(all.slice(Math.max(0, i - 12), i).join('\n')));
  assert.ok(line, 'call.resolve(o) stands alone on its line');
});

test('EVERY native method answers (resolve or reject in real code), except the ones that hand the call over', () => {
  const silent = methods.filter(m => !new RegExp('\\b' + m.call + '\\.(resolve|reject)\\(').test(m.body)).map(m => m.name);
  const unexpected = silent.filter(n => !HANDED_OFF.has(n));
  assert.deepEqual(unexpected, [], 'native methods that can never answer (JS would wait for ever): ' + unexpected.join(', '));
});

test('no // comment in the Java contains a resolve / reject call (code hidden in a comment)', () => {
  const bad = [];
  J.split('\n').forEach((l, i) => {
    // find the start of a // comment outside string literals
    let q = null, k = -1;
    for (let p = 0; p < l.length; p++) { const c = l[p]; if (q) { if (c === '\\') p++; else if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '/' && l[p + 1] === '/') { k = p; break; } }
    if (k >= 0 && /\bcall\.(resolve|reject)\(/.test(l.slice(k))) bad.push((i + 1) + ': ' + l.slice(k, k + 90));
  });
  assert.deepEqual(bad, []);
});

// ---------- the real bgallow.js ----------
function setup() {
  let now = 1_000_000; const realNow = Date.now, realST = globalThis.setTimeout, realCT = globalThis.clearTimeout;
  Date.now = () => now;
  let timers = [], tid = 0;   // fake timers on the fake clock, so the 4 s Android time limit can be tested without waiting
  globalThis.setTimeout = (f, ms) => { const t = { id: ++tid, at: now + ms, f }; timers.push(t); return t.id; };
  globalThis.clearTimeout = id => { timers = timers.filter(t => t.id !== id); };
  const st = { bgCard: null, shown: 0, listeners: {}, click: null };
  globalThis.document = {
    hidden: false,
    addEventListener: (n, f) => { st.listeners[n] = f; },
    getElementById: id => (id === 'lf-bgallow' ? st.bgCard : null),
    querySelector: () => null,
    createElement: () => ({ setAttribute() {}, addEventListener(n, f) { if (n === 'click') st.click = f; }, remove() { st.bgCard = null; }, set innerHTML(v) {}, querySelector: () => null }),
    body: { appendChild: el => { st.bgCard = el; st.shown++; } },
  };
  const flush = () => new Promise(r => setImmediate(r));
  const tick = async ms => { now += ms; for (const t of timers.filter(x => x.at <= now)) { timers = timers.filter(x => x !== t); t.f(); } await flush(); };
  const away = async ms => { document.hidden = true; st.listeners.visibilitychange(); await tick(ms); document.hidden = false; st.listeners.visibilitychange(); };
  // one second of "the app is open": the real app calls bgAllowCheck from setInterval and does NOT wait for it
  const second = async B => { B.bgAllowCheck(); await flush(); await tick(1000); };
  const restore = () => { Date.now = realNow; globalThis.setTimeout = realST; globalThis.clearTimeout = realCT; delete globalThis.document; };
  return { st, tick, away, second, restore };
}
const runUntilShown = async (B, w, secs) => { for (let s = 0; s < secs && !w.st.bgCard; s++) await w.second(B); return !!w.st.bgCard; };

test('Android answers "not allowed": the card opens (plain card, no picture uploaded)', async () => {
  const w = setup();
  try {
    const { Native } = await import('../src/native.js');
    Native.isNative = true; Native.isBackgroundAllowed = async () => ({ allowed: false }); Native.openBackgroundSettings = async () => ({});
    const B = await import('../src/bgallow.js?sim=v213a'); B.setBgAllowGate(() => false);
    assert.ok(await runUntilShown(B, w, 40), 'card shown');
  } finally { w.restore(); }
});

test('Android answers "allowed": no card', async () => {
  const w = setup();
  try {
    const { Native } = await import('../src/native.js');
    Native.isNative = true; Native.isBackgroundAllowed = async () => ({ allowed: true });
    const B = await import('../src/bgallow.js?sim=v213b'); B.setBgAllowGate(() => false);
    assert.equal(await runUntilShown(B, w, 60), false);
  } finally { w.restore(); }
});

test('THE BUG: the native call never answers the first time -> the card must still come (it used to wait for ever)', async () => {
  const w = setup();
  try {
    const { Native } = await import('../src/native.js');
    let calls = 0;
    Native.isNative = true; Native.openBackgroundSettings = async () => ({});
    Native.isBackgroundAllowed = () => (++calls === 1 ? new Promise(() => {}) : Promise.resolve({ allowed: false }));
    const B = await import('../src/bgallow.js?sim=v213c'); B.setBgAllowGate(() => false);
    assert.ok(await runUntilShown(B, w, 60), 'card shown after the first call hung');
    assert.ok(calls >= 2, 'the check was asked again (busy was not stuck), calls=' + calls);
  } finally { w.restore(); }
});

test('a native call that NEVER answers keeps being retried and never shows a card by mistake', async () => {
  const w = setup();
  try {
    const { Native } = await import('../src/native.js');
    let calls = 0;
    Native.isNative = true; Native.isBackgroundAllowed = () => { calls++; return new Promise(() => {}); };
    const B = await import('../src/bgallow.js?sim=v213d'); B.setBgAllowGate(() => false);
    assert.equal(await runUntilShown(B, w, 90), false, 'no answer = no card');
    assert.ok(calls >= 5, 'still asking every few seconds, calls=' + calls);
  } finally { w.restore(); }
});

test('while OFF the card comes again on EVERY open (Later only hides it until the next open)', async () => {
  const w = setup();
  try {
    const { Native } = await import('../src/native.js');
    Native.isNative = true; Native.isBackgroundAllowed = async () => ({ allowed: false });
    const B = await import('../src/bgallow.js?sim=v213e'); B.setBgAllowGate(() => false);
    assert.ok(await runUntilShown(B, w, 40), 'open 1: shown');
    w.st.click({ target: { closest: () => ({ dataset: { bg: 'later' } }) } });
    assert.equal(w.st.bgCard, null);
    for (let s = 0; s < 30; s++) await w.second(B);
    assert.equal(w.st.bgCard, null, 'same open: not shown again');
    await w.away(60 * 1000);   // opens the app again a minute later
    assert.ok(await runUntilShown(B, w, 40), 'open 2: shown again');
    w.st.click({ target: { closest: () => ({ dataset: { bg: 'later' } }) } });
    await w.away(5 * 60 * 1000);
    assert.ok(await runUntilShown(B, w, 40), 'open 3: shown again');
    assert.equal(w.st.shown, 3);
  } finally { w.restore(); }
});

test('the guards are in the source', () => {
  const B = readFileSync(new URL('../src/bgallow.js', import.meta.url), 'utf8');
  assert.match(B, /withTimeout\(Native\.isBackgroundAllowed\(\), NATIVE_CHECK_MS\)/);
  assert.match(B, /if \(busy && Date\.now\(\) - busyAt < BUSY_MAX_MS\) return;/);
});
