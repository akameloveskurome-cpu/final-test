// v212: simulation helper (NOT a test file). Runs the REAL src/assist.js + src/bgallow.js together with a fake clock, a fake page and the same gates main.js uses.
// Usage: node --import ./tests/register.mjs tests/permchain-sim.mjs <scenario>   -> prints a JSON log: [{t: seconds, e: event}]
// It is run in its own process per scenario because assist.js and bgallow.js keep module state.
const scen = process.argv[2];
let now = 1_000_000; Date.now = () => now;
const intervals = [], timers = []; globalThis.setInterval = f => { intervals.push(f); return 0; }; globalThis.setTimeout = (f, ms) => { timers.push({ at: now + ms, f }); return 0; };
globalThis.fetch = async () => { throw new Error('offline'); };   // no picture readable: the plain card (picture swaps in later)
const store = {}; globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
if (scen === 'back1Step2') store['lf.assist'] = JSON.stringify({ stage: 1, at: now - 120000 });   // the sequence was at step 2 when the app was closed
if (scen === 'coldAfterStep2' || scen === 'redoBack' || scen === 'back1Step3') store['lf.assist'] = JSON.stringify({ stage: 2, at: now - 120000 });   // the app was closed by step 2 two minutes ago
if (scen === 'coldLongAgo') store['lf.assist'] = JSON.stringify({ stage: 2, at: now - 2 * 3600000 });   // two hours ago: the full sequence again
const els = new Set(), listeners = {}; let popcard = false, hidden = false;
globalThis.document = {
  get hidden() { return hidden; },
  addEventListener: (n, f) => { (listeners[n] ||= []).push(f); },
  getElementById: id => { for (const e of els) if (e.id === id) return e; return null; },
  querySelector: sel => (sel === '#sheet .popcard' && popcard ? {} : null),
  createElement: () => { const e = { style: {}, handlers: {}, setAttribute() {}, addEventListener(n, f) { e.handlers[n] = f; }, remove() { els.delete(e); }, querySelector: () => null }; return e; },
  body: { appendChild: e => { els.add(e); } },
};
const { Native } = await import('../src/native.js');
const A = await import('../src/assist.js');
const B = await import('../src/bgallow.js');
const t0 = now, log = [], T = () => Math.round((now - t0) / 1000);
const push = e => log.push({ t: T(), e });
let helperOn = scen === 'helperOn' || scen === 'holdStuck', gateOpen = scen !== 'gateStuck';
Native.isNative = true;
Native.batteryAssistStatus = async () => ({ enabled: helperOn });
Native.openAccessibilityList = async () => ({});
Native.restrictedStatus = async () => ({ state: scen === 'rsAllowed' ? 'allowed' : (scen === 'rsRestricted' || scen === 'rsBecomesAllowed') ? (rsNow ? 'allowed' : 'restricted') : 'unknown' });
let rsNow = false;
Native.exitApp = async () => { push('exitApp called'); return { ok: true }; };
Native.isBackgroundAllowed = async () => ({ allowed: false });
Native.openBackgroundSettings = async () => ({});
A.setAssistGate(() => gateOpen);
B.setBgAllowGate(() => false);   // main.js (v213): permOff && !permShownOpen; notifications are ON in these runs
B.setBgAllowAfter(A.assistHoldsBg);   // owner's order: the accessibility cards first, the background card 10 s after them (same wiring as main.js)
if (scen === 'holdStuck') B.bgAllowHold(new Promise(() => {}));
A.startAssist(); B.startBgAllow();
const hide = () => { hidden = true; (listeners.visibilitychange || []).forEach(f => f()); };
const show = () => { hidden = false; (listeners.visibilitychange || []).forEach(f => f()); };
const click = (id, key, val) => { const e = document.getElementById(id); if (!e) return false; e.handlers.click({ target: { closest: () => ({ dataset: { [key]: val } }) } }); return true; };
const seen = {};
async function step(personFn) {
  for (const t of timers.splice(0)) { if (t.at <= now) t.f(); else timers.push(t); }
  for (const f of intervals) await f();
  if (document.getElementById('lf-assist') && document.getElementById('lf-bgallow')) push('OVERLAP: both cards open');
  for (const id of ['lf-assist', 'lf-bgallow']) { const e = document.getElementById(id); if (e && !e.__seen) { e.__seen = true; push(id + ' shown'); if (id === 'lf-assist') push('card: ' + (/<h2[^>]*>([^<]*)</.exec(e.innerHTML) || [])[1]); } }
  if (personFn) await personFn();
  now += 1000;
}
const cardAt = {};
const run = async (secs, personFn) => { for (let i = 0; i < secs; i++) await step(personFn); };
if (scen === 'helperOn' || scen === 'gateStuck' || scen === 'holdStuck') await run(120);
else if (scen === 'helperOffNotNow') {
  await run(60, async () => { if (document.getElementById('lf-assist')) { cardAt.a ??= T(); if (T() >= cardAt.a + 2) { click('lf-assist', 'as', 'later'); push('person: Not now'); cardAt.a = undefined; } } });
} else if (scen === 'helperOffFullFlow') {
  let n = 0;
  for (let i = 0; i < 200; i++) {
    await step(async () => {
      const e = document.getElementById('lf-assist');
      if (e && !hidden) { cardAt.a ??= T(); if (T() >= cardAt.a + 3) { click('lf-assist', 'as', 'go'); push('person: go (card ' + (++n) + ')'); cardAt.a = undefined; hide(); cardAt.back = T() + (n === 2 ? 60 : 20); } }
      if (hidden && T() >= cardAt.back) { show(); push('person: back'); }
    });
  }
} else if (scen === 'step2Exit' || scen === 'coldAfterStep2' || scen === 'coldLongAgo' || scen === 'rsAllowed') {
  await run(40, async () => { const e = document.getElementById('lf-assist'); if (e && !hidden) { const title = /<h2[^>]*>([^<]*)</.exec(e.innerHTML)[1]; if (/Step 2/.test(title)) { click('lf-assist', 'as', 'go'); push('person: go on step 2'); } else { click('lf-assist', 'as', 'later'); push('person: Not now on ' + title.slice(0, 6)); } } });
} else if (scen === 'redoBack') {
  await run(70, async () => { const e = document.getElementById('lf-assist'); if (e && !hidden) { const title = /<h2[^>]*>([^<]*)</.exec(e.innerHTML)[1]; if (/Step 3/.test(title) && !cardAt.r) { cardAt.r = T(); click('lf-assist', 'as', 'redo'); push('person: taps "greyed out? Back to step 2"'); } else if (/Step 2/.test(title) && !cardAt.s) { cardAt.s = T(); click('lf-assist', 'as', 'later'); push('person: Not now on step 2'); } } });
} else if (scen === 'back1Step2' || scen === 'back1Step3') {   // the person taps "Back to the first card (step 1)" on the first card that comes
  await run(40, async () => { const e = document.getElementById('lf-assist'); if (e && !hidden) { const title = /<h2[^>]*>([^<]*)</.exec(e.innerHTML)[1]; if (/Step 1/.test(title)) { if (!cardAt.s1) { cardAt.s1 = T(); push('person: sees step 1'); } } else if (!cardAt.b) { cardAt.b = T(); push('person: taps back to step 1 on ' + title.slice(0, 6)); click('lf-assist', 'as', 'back1'); } } });
} else if (scen === 'rsRestricted' || scen === 'rsBecomesAllowed') {
  let goes = 0;
  for (let i = 0; i < 160; i++) {
    await step(async () => {
      if (hidden) { if (T() >= cardAt.back) { if (scen === 'rsBecomesAllowed' && goes >= 2) rsNow = true; show(); push('person: back'); } return; }
      const e = document.getElementById('lf-assist');
      if (e) { const title = /<h2[^>]*>([^<]*)</.exec(e.innerHTML)[1]; click('lf-assist', 'as', 'go'); goes++; push('person: go on ' + title.slice(0, 6)); hide(); cardAt.back = T() + 30; }
    });
  }
} else if (scen === 'resumeAfterLong') {
  let phase = 0;
  for (let i = 0; i < 400; i++) {
    await step(async () => {
      if (hidden) { if (T() >= cardAt.back) { show(); push('person: reopens app'); } return; }
      if (document.getElementById('lf-assist')) { cardAt.a ??= T(); if (T() >= cardAt.a + 2) { click('lf-assist', 'as', 'later'); push('person: Not now'); cardAt.a = undefined; } }
      if (document.getElementById('lf-bgallow')) { click('lf-bgallow', 'bg', 'later'); push('person: Later'); if (++phase === 1) { hide(); cardAt.back = T() + 300; push('person: closes app (Home)'); } }
    });
  }
}
console.log(JSON.stringify(log));
