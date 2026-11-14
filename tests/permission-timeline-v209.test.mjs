// v209: runs the REAL src/bgallow.js through a simulated first launch (both permissions OFF, no pictures uploaded) with a fake clock and a fake page.
// Notification card due -> shown at +3 s -> person taps Allow / Later at +20 s -> the background card must NOT appear before +30 s (10 s after the notification card is gone).
import test from 'node:test';
import assert from 'node:assert/strict';

function setup() {
  let now = 1_000_000; const realNow = Date.now; Date.now = () => now;
  const st = { notifCard: false, bgCard: null, listeners: {} };
  globalThis.document = {
    hidden: false,
    addEventListener: (n, f) => { st.listeners[n] = f; },
    getElementById: id => (id === 'lf-bgallow' ? st.bgCard : null),
    querySelector: sel => (sel === '#sheet .popcard' && st.notifCard ? {} : null),
    createElement: () => ({ setAttribute() {}, addEventListener() {}, remove() { st.bgCard = null; }, set innerHTML(v) {}, querySelector: () => null }),
    body: { appendChild: el => { st.bgCard = el; } },
  };
  return { st, tick: ms => { now += ms; }, at: () => now, restore: () => { Date.now = realNow; delete globalThis.document; } };
}

test('first launch, both OFF: notification card first, background card only 10 s after it is gone', async () => {
  const w = setup();
  try {
    const { Native } = await import('../src/native.js');
    Native.isNative = true; Native.isBackgroundAllowed = async () => ({ allowed: false });
    const B = await import('../src/bgallow.js?sim=1');
    let permOff = true, permShownOpen = false;
    B.setBgAllowGate(() => permOff && !permShownOpen);
    const t0 = w.at(), log = [];
    for (let s = 0; s <= 60; s++) {
      if (s === 3) { w.st.notifCard = true; permShownOpen = true; }   // notification card appears
      if (s === 20) w.st.notifCard = false;                           // person taps Allow / Later / Back
      await B.bgAllowCheck();
      if (w.st.bgCard && log.length === 0) log.push(s);
      w.tick(1000);
    }
    assert.equal(log.length, 1, 'background card appeared');
    assert.ok(log[0] >= 30, 'background card at +' + log[0] + ' s, must be at least 10 s after the notification card went away (+20 s)');
    // no GitHub repo in this simulation = the picture is "unreadable": the app then waits up to 8 s MORE for it (so +30 .. +38 s). With a readable / absent picture it is exactly +30 s.
    assert.ok(log[0] <= 40, 'and not much later than that (+' + log[0] + ' s)');
  } finally { w.restore(); }
});

test('notification already ON: background card still comes (10 s after launch)', async () => {
  const w = setup();
  try {
    const { Native } = await import('../src/native.js');
    Native.isNative = true; Native.isBackgroundAllowed = async () => ({ allowed: false });
    const B = await import('../src/bgallow.js?sim=2');
    B.setBgAllowGate(() => false);
    let first = -1;
    for (let s = 0; s <= 40 && first < 0; s++) { await B.bgAllowCheck(); if (w.st.bgCard) first = s; w.tick(1000); }
    assert.ok(first >= 10 && first <= 20, 'at +' + first + ' s');
  } finally { w.restore(); }
});

test('both pop-ups come back on the next open if still OFF (cold start = fresh state, away 10 s+ = new open)', async () => {
  const w = setup();
  try {
    const { Native } = await import('../src/native.js');
    Native.isNative = true; Native.isBackgroundAllowed = async () => ({ allowed: false });
    const B = await import('../src/bgallow.js?sim=3');
    B.setBgAllowGate(() => false);
    for (let s = 0; s <= 25; s++) { await B.bgAllowCheck(); w.tick(1000); }
    assert.ok(w.st.bgCard, 'first open: shown'); w.st.bgCard.remove();            // person taps Later
    for (let s = 0; s < 15; s++) { await B.bgAllowCheck(); w.tick(1000); }
    assert.equal(w.st.bgCard, null, 'same open: not shown again');
    w.st.listeners.visibilitychange && (document.hidden = true, w.st.listeners.visibilitychange());   // app goes to background
    w.tick(30000); document.hidden = false; w.st.listeners.visibilitychange();                         // back after 30 s = a new open
    let again = false;
    for (let s = 0; s <= 25 && !again; s++) { await B.bgAllowCheck(); if (w.st.bgCard) again = true; w.tick(1000); }
    assert.ok(again, 'new open: shown again');
  } finally { w.restore(); }
});
