// v101: the library scan card. Transparent liquid glass; a radar sweep + progress ring, album covers flying into the disc, a liquid progress bar.
// scanState / doneState are pure (tested in tests/scanview.test.mjs); the DOM part builds itself on first use (nothing runs at import time).
const n = x => Math.max(0, Math.floor(+x || 0)).toLocaleString('en-US');
const songs = k => `${n(k)} ${Math.floor(+k || 0) === 1 ? 'song' : 'songs'}`;

/** What the card shows for one onScanProgress event { done, total, phase: 'walk' | 'read' | 'save', found }. */
export function scanState({ done = 0, total = 0, phase = 'read', found = 0 } = {}) {
  const t = Math.max(0, Math.floor(+total || 0));
  if (phase === 'walk' || (phase !== 'save' && t <= 0)) {
    return { title: 'Finding your music', count: found > 0 ? `${songs(found)} found` : 'Looking through your folders…', pct: 0, indeterminate: true };
  }
  if (phase === 'save') return { title: 'Saving your library', count: songs(t), pct: 100, indeterminate: false };
  const d = Math.min(Math.max(0, Math.floor(+done || 0)), t);
  return { title: 'Scanning your music', count: `${n(d)} / ${n(t)} songs`, pct: Math.min(100, Math.floor((d / t) * 100)), indeterminate: false };
}

/** Text of the finished card, from the scan result { tracks, newSongs, removed }. */
export function doneState({ tracks = [], newSongs = 0, removed = 0 } = {}) {
  const parts = [];
  if (newSongs > 0) parts.push(`${n(newSongs)} new`);
  if (removed > 0) parts.push(`${n(removed)} removed`);
  return { title: 'Library updated', count: songs(tracks.length), note: parts.join(' · ') };
}

const SHOW_AFTER_MS = 220;   // a scan that ends sooner than this never shows the card (no flash)
const DONE_MS = 1300;
let el = null, refs = null, active = false, shown = false, hiddenByUser = false, latest = null, showT = 0, doneT = 0, chips = 0, lastName = '';
const seen = new Set();

function build() {
  if (el) return;
  el = document.createElement('div');
  el.className = 'scanv'; el.id = 'scanv';
  el.innerHTML = `<div class="scanv-card">
    <button class="scanv-hide" type="button" aria-label="Hide scan progress"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg></button>
    <div class="scanv-orb" aria-hidden="true">
      <span class="pr"></span><span class="pr"></span><span class="pr"></span>
      <div class="sc-disc"><span class="sc-sweep"></span></div>
      <svg class="sc-ring" viewBox="0 0 132 132"><circle class="trk" cx="66" cy="66" r="60"/><circle class="val" cx="66" cy="66" r="60"/></svg>
      <div class="sc-mid"><span class="sc-pct">0<small>%</small></span>
        <svg class="sc-note" viewBox="0 0 24 24" width="34" height="34"><path d="M9 18V6l10-2v12" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="7" cy="18" r="2.6" fill="currentColor"/><circle cx="17" cy="16" r="2.6" fill="currentColor"/></svg>
        <svg class="sc-chk" viewBox="0 0 24 24" width="40" height="40"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div>
      <div class="sc-fly"></div>
    </div>
    <div class="scanv-title" role="status" aria-live="polite">Scanning your music</div>
    <div class="scanv-count">&nbsp;</div>
    <div class="scanv-bar" aria-hidden="true"><i></i></div>
    <div class="scanv-file" aria-hidden="true">&nbsp;</div>
  </div>`;
  (document.getElementById('app') || document.body).appendChild(el);
  const q = s => el.querySelector(s);
  refs = { title: q('.scanv-title'), count: q('.scanv-count'), file: q('.scanv-file'), val: q('.val'), pct: q('.sc-pct'), fill: q('.scanv-bar i'), fly: q('.sc-fly') };
  q('.scanv-hide').addEventListener('click', () => { hiddenByUser = true; el.classList.remove('on'); });   // the scan keeps running, only the card goes
}

function chip(src) {
  if (!src || seen.has(src) || chips >= 7 || !el.classList.contains('on')) return;
  seen.add(src); if (seen.size > 500) seen.clear();
  const im = document.createElement('img'), a = Math.PI * (-1.1 + Math.random() * 1.2), r = 112 + Math.random() * 28;
  im.className = 'sc-chip'; im.alt = ''; im.decoding = 'async';
  im.style.setProperty('--sx', Math.round(Math.cos(a) * r) + 'px'); im.style.setProperty('--sy', Math.round(Math.sin(a) * r) + 'px'); im.style.setProperty('--sr', Math.round(Math.random() * 50 - 25) + 'deg');
  let gone = false; chips++;
  const off = () => { if (gone) return; gone = true; chips = Math.max(0, chips - 1); im.remove(); /* BUG-121 */ };
  im.addEventListener('load', () => im.classList.add('go'));   // starts flying only once the picture is ready
  im.addEventListener('animationend', off); im.addEventListener('error', off); setTimeout(off, 2600);
  im.src = src; refs.fly.appendChild(im);
}

function render(p) {
  const s = scanState(p), C = 377;   // 2 * PI * 60
  refs.title.textContent = s.title; refs.count.textContent = s.count;
  el.classList.toggle('ind', s.indeterminate);
  refs.val.style.strokeDashoffset = String(C * (1 - s.pct / 100));
  refs.pct.firstChild.nodeValue = String(s.pct); refs.fill.style.width = s.indeterminate ? '' : s.pct + '%';
  if (p.name && p.name !== lastName) { lastName = p.name; refs.file.textContent = p.name; }
  if (p.cover) chip(p.cover);
}

export const scanView = {
  get shown() { return shown && !hiddenByUser; },   // BUG-152: a hidden card must not also swallow the end-of-scan toast   // did the card appear during the last scan? (then the caller skips its own "N songs" toast)
  start() {
    clearTimeout(showT); clearTimeout(doneT);
    if (el) el.classList.remove('on', 'done');   // BUG-151: a finished card from the last scan must not stay on screen; BUG #3: 'on' goes too, or a new scan that ends before the card is due (finish() returns early) would leave the old card showing
    active = true; shown = false; hiddenByUser = false; latest = null; lastName = ''; seen.clear();
    showT = setTimeout(() => {
      if (!active || hiddenByUser) return;
      build(); el.classList.remove('done', 'ind'); chips = 0; refs.fly.textContent = '';
      void el.offsetWidth; el.classList.add('on'); shown = true;
      render(latest || { phase: 'walk' });
    }, SHOW_AFTER_MS);
  },
  update(p) {
    if (!active) return;
    latest = p;
    if (shown && !hiddenByUser) render(p);
  },
  finish(r) {
    active = false; clearTimeout(showT);
    if (!shown || hiddenByUser || !el) return;
    const d = doneState(r || {});
    refs.title.textContent = d.title; refs.count.textContent = d.count; refs.file.textContent = d.note || '';
    refs.val.style.strokeDashoffset = '0'; refs.fill.style.width = '100%'; refs.pct.firstChild.nodeValue = '100';
    el.classList.remove('ind'); el.classList.add('done');
    clearTimeout(doneT); doneT = setTimeout(() => el && el.classList.remove('on', 'done'), DONE_MS);
  },
  hide() {   // scan failed or was refused: no animation, just go
    active = false; clearTimeout(showT); clearTimeout(doneT);
    if (el) el.classList.remove('on', 'done');
  },
};
