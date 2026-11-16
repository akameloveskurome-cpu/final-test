// v212: runs the REAL src/bgallow.js with a fake clock. The person taps Allow on the background card (goes to Android's battery page), does NOT come
// straight back (presses Home / closes Liquid Dark from there) and opens the app again later. Background activity is still OFF, so the card must come again.
// Before v212 that later open was taken for "back from the battery page" and the card was skipped for that whole open.
import test from 'node:test';
import assert from 'node:assert/strict';

function setup() {
  let now = 1_000_000; const realNow = Date.now; Date.now = () => now;
  const st = { bgCard: null, listeners: {}, click: null };
  globalThis.document = {
    hidden: false,
    addEventListener: (n, f) => { st.listeners[n] = f; },
    getElementById: id => (id === 'lf-bgallow' ? st.bgCard : null),
    querySelector: () => null,
    createElement: () => ({ setAttribute() {}, addEventListener(n, f) { if (n === 'click') st.click = f; }, remove() { st.bgCard = null; }, set innerHTML(v) {}, querySelector: () => null }),
    body: { appendChild: el => { st.bgCard = el; } },
  };
  const away = ms => { document.hidden = true; st.listeners.visibilitychange(); now += ms; document.hidden = false; st.listeners.visibilitychange(); };
  return { st, tick: ms => { now += ms; }, away, restore: () => { Date.now = realNow; delete globalThis.document; } };
}
const run = async (B, w, secs) => { let shown = false; for (let s = 0; s <= secs && !shown; s++) { await B.bgAllowCheck(); if (w.st.bgCard) shown = true; w.tick(1000); } return shown; };

test('Allow tapped, person leaves from the battery page and opens the app much later: the card comes again', async () => {
  const w = setup();
  try {
    const { Native } = await import('../src/native.js');
    Native.isNative = true; Native.isBackgroundAllowed = async () => ({ allowed: false }); Native.openBackgroundSettings = async () => ({});
    const B = await import('../src/bgallow.js?sim=trip1');
    B.setBgAllowGate(() => false);
    assert.ok(await run(B, w, 25), 'first open: shown');
    w.st.click({ target: { closest: () => ({ dataset: { bg: 'go' } }) } });   // person taps Allow -> Android battery page
    assert.equal(w.st.bgCard, null);
    w.away(30 * 60 * 1000);                                                    // leaves, opens Liquid Dark again 30 min later
    assert.ok(await run(B, w, 30), 'new open 30 min later, still OFF: shown again');
  } finally { w.restore(); }
});

test('Allow tapped and the person comes straight back (under 10 s): same open, not shown again', async () => {
  const w = setup();
  try {
    const { Native } = await import('../src/native.js');
    Native.isNative = true; Native.isBackgroundAllowed = async () => ({ allowed: false }); Native.openBackgroundSettings = async () => ({});
    const B = await import('../src/bgallow.js?sim=trip2');
    B.setBgAllowGate(() => false);
    assert.ok(await run(B, w, 25), 'first open: shown');
    w.st.click({ target: { closest: () => ({ dataset: { bg: 'go' } }) } });
    w.away(6 * 1000);
    assert.equal(await run(B, w, 30), false, 'back from the battery page within 10 s: no second card in the same open');
  } finally { w.restore(); }
});

test('the same "left from the settings page, opened the app much later" rule is in the notification and accessibility cards too', async () => {
  const { readFileSync } = await import('node:fs');
  const rd = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  assert.match(rd('src/bgallow.js'), /TRIP_MAX_MS = 10000/);
  assert.match(rd('src/assist.js'), /TRIP_MAX_MS = 600000/);
  assert.match(rd('src/assist.js'), /if \(trip\) \{ trip = false; if \(!hiddenAt \|\| Date\.now\(\) - hiddenAt < TRIP_MAX_MS\) return; \}/);
  assert.match(rd('src/main.js'), /if \(permTrip\) \{ permTrip = false; if \(!permHiddenAt \|\| Date\.now\(\) - permHiddenAt < 10000\) return; \}/);
});

// ---- whole chain: the REAL assist.js + bgallow.js together (tests/permchain-sim.mjs, one process per scenario) ----
import { execFileSync } from 'node:child_process';
const sim = name => JSON.parse(execFileSync(process.execPath, ['--import', './tests/register.mjs', 'tests/permchain-sim.mjs', name], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' }).trim().split('\n').pop());
const at = (log, e, n = 0) => log.filter(x => x.e === e)[n]?.t;

test('chain: background OFF, accessibility helper ON: the background card comes (no accessibility cards)', () => {
  const l = sim('helperOn'); const t = at(l, 'lf-bgallow shown'); assert.ok(t >= 10 && t <= 40, 'at +' + t); assert.equal(at(l, 'lf-assist shown'), undefined);
});
test('chain: helper OFF, person taps Not now: background card comes 10 s (+ at most 8 s for an unreadable picture) after', () => {
  const l = sim('helperOffNotNow'); const n = at(l, 'person: Not now'), b = at(l, 'lf-bgallow shown'); assert.ok(b - n >= 10 && b - n <= 20, 'gap ' + (b - n));
});
test('chain: helper OFF, all three accessibility cards done by hand: background card still comes at the end, 10 s gaps', () => {
  const l = sim('helperOffFullFlow'); assert.ok(at(l, 'lf-bgallow shown') > at(l, 'person: back', 2));
  for (const i of [0, 1, 2]) { const gap = at(l, 'lf-assist shown', i) - (i === 0 ? 0 : at(l, 'person: back', i - 1)); assert.ok(gap >= 10 && gap <= 12, 'card ' + (i + 1) + ' gap ' + gap); }
});
test('chain: closed from Home and reopened 5 min later, still OFF: accessibility card, then the background card, again', () => {
  const l = sim('resumeAfterLong'); assert.equal(l.filter(x => x.e === 'lf-bgallow shown').length, 2); assert.equal(l.filter(x => x.e === 'lf-assist shown').length, 2);
});
test('accessibility first: when the accessibility cards never get their turn the background card still comes, after the 45 s fail-safe (never hidden for good)', () => {
  const t = at(sim('gateStuck'), 'lf-bgallow shown'); assert.ok(t >= 45 && t <= 75, 'at +' + t);
});
test('accessibility first: both due -> the accessibility card is shown first and the background card only AFTER it was dismissed (10 s+)', () => {
  const l = sim('helperOffNotNow'); const a = at(l, 'lf-assist shown'), n = at(l, 'person: Not now'), b = at(l, 'lf-bgallow shown');
  assert.ok(a !== undefined && b !== undefined && a < n && n < b, 'order ' + [a, n, b]); assert.ok(b - n >= 10, 'gap ' + (b - n));
});
test('accessibility first: the background card waits through the whole 3-step accessibility flow and comes after the last step', () => {
  const l = sim('helperOffFullFlow'); const firstBg = at(l, 'lf-bgallow shown'), lastAssist = l.filter(x => x.e === 'lf-assist shown').pop().t;
  assert.ok(firstBg > lastAssist + 10, 'bg ' + firstBg + ' last accessibility card ' + lastAssist);
  assert.equal(l.filter(x => x.e === 'lf-bgallow shown').length, 1);
});
test('back to the first card: the button on step 2 and on step 3 brings step 1 back AT ONCE (even when Android says restricted settings are allowed)', () => {
  for (const sc of ['back1Step2', 'back1Step3']) {
    const l = sim(sc); const tap = l.find(x => x.e.startsWith('person: taps back to step 1')), c1 = l.filter(x => x.e === 'card: Step 1: open Accessibility')[0];
    assert.ok(tap && c1 && c1.t - tap.t <= 1, sc + ': step 1 came ' + (c1 && tap && c1.t - tap.t) + ' s after the tap');
  }
});
test('chain fail-safe: even if the All-files request never reports back, the background card comes', () => {
  const t = at(sim('holdStuck'), 'lf-bgallow shown'); assert.ok(t > 0 && t <= 70, 'at +' + t);
});

test('background activity switched OFF while the app is open: noticed and shown within a few seconds (checked every 1 s poll, ON state re-read every 5 s)', async () => {
  const w = setup();
  try {
    const { Native } = await import('../src/native.js');
    let allowed = true; Native.isNative = true; Native.isBackgroundAllowed = async () => ({ allowed });
    const B = await import('../src/bgallow.js?sim=live');
    B.setBgAllowGate(() => false);
    for (let s = 0; s < 40; s++) { await B.bgAllowCheck(); w.tick(1000); }
    assert.equal(w.st.bgCard, null, 'allowed: no card');
    allowed = false; let after = -1;
    for (let s = 0; s <= 15 && after < 0; s++) { await B.bgAllowCheck(); if (w.st.bgCard) after = s; w.tick(1000); }
    assert.ok(after >= 0 && after <= 8, 'card ' + after + ' s after it was switched off');
  } finally { w.restore(); }
});

// ---- v213: step 2 closes the app; the app knows where the person got to ----
const cards = l => l.filter(x => x.e.startsWith('card: ')).map(x => x.e.slice(6));
test('v213 step 2: tapping the button closes the app (exitApp) about a second later; Android 13+ "restricted" state keeps step 2 coming until it is done', () => {
  const l = sim('rsRestricted'); assert.deepEqual(cards(l).slice(0, 3), ['Step 1: open Accessibility', 'Step 2: Allow restricted settings', 'Step 2: Allow restricted settings']);
  const go = at(l, 'person: go on Step 2'), ex = at(l, 'exitApp called'); assert.ok(ex - go <= 1 && ex >= go, 'exit ' + (ex - go) + ' s after the tap');
});
test('v213: once Android says restricted settings are allowed, the next card is step 3, then the background card', () => {
  const l = sim('rsBecomesAllowed'); assert.deepEqual(cards(l), ['Step 1: open Accessibility', 'Step 2: Allow restricted settings', 'Step 3: turn Liquid Dark On']); assert.ok(at(l, 'lf-bgallow shown') > at(l, 'person: back', 2));
});
test('v213: restricted settings already allowed (e.g. done earlier): only step 3 is shown', () => {
  assert.deepEqual(cards(sim('rsAllowed')), ['Step 3: turn Liquid Dark On']);
});
test('v213: the app was closed by step 2 less than an hour ago and the helper is still off: it opens on step 3, not step 1', () => {
  assert.deepEqual(cards(sim('coldAfterStep2')), ['Step 3: turn Liquid Dark On']);
});
test('v213: more than an hour later and the helper is still off: the full sequence from step 1 again', () => {
  assert.deepEqual(cards(sim('coldLongAgo')), ['Step 1: open Accessibility']);
});
test('v213: sources: native methods exist, step 2 exits, helper ON clears the memory, greyed-switch button on step 3', async () => {
  const { readFileSync } = await import('node:fs');
  const rd = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  const j = rd('native-android/LiquidNative.java'), a = rd('src/assist.js'), n = rd('src/native.js');
  assert.match(j, /public void restrictedStatus\(PluginCall call\)/); assert.match(j, /android:access_restricted_settings/); assert.match(j, /public void exitApp\(PluginCall call\)/); assert.match(j, /finishAndRemoveTask/);
  assert.match(n, /restrictedStatus: /); assert.match(n, /exitApp: /);
  assert.match(a, /if \(n === 1\) setTimeout\(\(\) => \{ try \{ Promise\.resolve\(Native\.exitApp\(\)\)/);
  assert.match(a, /if \(!off\) \{ stage = 3; clearStage\(\); return; \}/);
  assert.match(a, /data-as="redo"/); assert.match(a, /Liquid Dark closes by itself/);
});

test('v213: the two cards are never open at the same time in any scenario', () => {
  for (const sc of ['helperOn', 'helperOffNotNow', 'helperOffFullFlow', 'resumeAfterLong', 'gateStuck', 'holdStuck', 'rsBecomesAllowed', 'rsRestricted', 'back1Step2', 'back1Step3'])
    assert.equal(sim(sc).filter(x => x.e.startsWith('OVERLAP')).length, 0, sc);
});
test('accessibility first: sources: main.js wires the hold, bgallow.js waits and re-checks before it builds, assist.js has the hold + fail-safe + back button', async () => {
  const { readFileSync } = await import('node:fs');
  const rd = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  assert.match(rd('src/main.js'), /setBgAllowAfter\(assistHoldsBg\);/);
  assert.match(rd('src/main.js'), /setBgAllowGate\(\(\) => permOff && !permShownOpen\);/);
  const b = rd('src/bgallow.js'); assert.match(b, /export function setBgAllowAfter/); assert.match(b, /accessibilityFirst\(\)\) return;/);
  const a = rd('src/assist.js'); assert.match(a, /export function assistHoldsBg/); assert.match(a, /HOLD_IDLE_MS = 45000/); assert.match(a, /data-as="back1"/); assert.match(a, /getElementById\('lf-bgallow'\)\) return;/);
});

test('v213: step 3 "The switch is greyed out? Back to step 2" shows step 2 at once (same second), not after a silent gap', () => {
  const l = sim('redoBack'); const tap = at(l, 'person: taps "greyed out? Back to step 2"'), c2 = l.filter(x => x.e === 'card: Step 2: Allow restricted settings')[0];
  assert.ok(c2 && c2.t - tap <= 1, 'step 2 came ' + (c2 && c2.t - tap) + ' s after the tap');
});

test('no clash: the notification / picture popup never opens on top of an accessibility card or the background card', async () => {
  const { readFileSync } = await import('node:fs');
  const m = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(m, /getElementById\('lf-bgallow'\) \|\| document\.getElementById\('lf-assist'\)\) \{ setTimeout\(\(\) => startPopup/);
});
