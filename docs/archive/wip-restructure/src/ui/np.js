// Now Playing screen (#np): cover / Canvas, titles, scrubber, transport. progress() is called on every onProgress.
import { $ } from '../state.js';
import { Native, on } from '../../../src/native.js';
import { mmss, quality } from '../data.js';
import { I } from '../../../src/icons.js';
import { trackAlbum } from './parts.js';
import { artHtml, canvasActive, syncCanvas } from '../features/canvas.js';

const tokenColour = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();   // colours live only in tokens.css
const hexA = (g, n, al) => (g.match(/#[0-9a-f]{6}/gi) || [tokenColour('--accent'), tokenColour('--bg')])[n] + al;

export function renderNP() {
  const t = Native.current(), np = $('#np'); if (!t) return;
  const a = trackAlbum(t), s = Native.state;
  np.style.setProperty('--np1', hexA(a.g, 1, 'cc')); np.style.setProperty('--np2', hexA(a.g, 1, '88'));
  np.innerHTML = `<div class="glow"></div><button class="grab" data-act="close-np" style="padding:10px 0;width:100%;background:none;height:auto"><div class="grab" style="margin:0 auto"></div></button>
    <div class="art">${artHtml(t, a)}</div>
    <div class="titles"><div class="t"><b>${t.title}</b><span>${t.trackArtist || a.artist}, ${a.title}</span></div><button class="gbtn" data-act="trackmenu" data-tm="${t.id}">${I.more}</button></div>
    <div class="chip green badge"><i></i>${quality(t)}</div>
    <div class="scrub" id="scrub"><div class="rail"></div><div class="fill" id="fill"></div><div class="thumb" id="thumb"></div></div>
    <div class="times"><span id="tl">0:00</span><span id="tr">-0:00</span></div>
    <div class="transport"><button class="sbtn ${s.shuffle ? 'on' : ''}" data-act="shuf">${I.shuffle}</button>
      <div class="cluster"><button data-act="prev">${I.prev}</button><button class="pp" data-act="pp">${s.playing ? I.pause : I.play}</button><button data-act="next">${I.next}</button></div>
      <button class="sbtn ${s.repeat !== 'off' ? 'on' : ''}" data-act="rep">${s.repeat === 'one' ? I.repeat1 : I.repeat}</button></div>
    <div class="bottom"><button data-act="lyrics">${I.lyrics}</button><button class="cvbtn ${canvasActive(t) ? 'on' : ''}" data-act="canvas" title="Canvas">${I.canvas}</button><button data-act="queue">${I.queue}</button></div>`;
  progress(s.pos, t.dur);
  syncCanvas();
}
export function progress(pos, dur) {
  const f = $('#fill'); if (!f) return; const p = Math.min(1, pos / dur) * 100;
  f.style.width = p + '%'; $('#thumb').style.left = p + '%'; $('#tl').textContent = mmss(pos); $('#tr').textContent = '-' + mmss(Math.max(0, dur - pos));
}
on('onProgress', ({ pos, dur }) => progress(pos, dur));

/* scrubber drag */
document.addEventListener('pointerdown', e => {
  const sc = e.target.closest('#scrub'); if (!sc) return;
  const seek = ev => { const r = sc.getBoundingClientRect(), p = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), t = Native.current(); if (t) Native.seek(p * t.dur); };
  seek(e); const mv = ev => seek(ev), up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
});
