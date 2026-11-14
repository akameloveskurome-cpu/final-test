// Painting: the tab screen (#main), the pushed-screen stack (#sub), the mini player (#mini). Also keeps them in step with player events.
import { S, $, set, applySettings } from '../state.js';
import { Native, on } from '../../../src/native.js';
import { I } from '../../../src/icons.js';
import { glide } from '../glidebar.js';
import { screens, sub, results } from './screens.js';
import { cov, trackAlbum } from './parts.js';
import { renderNP } from './np.js';

export function renderMain() {
  const m = $('#main'); m.innerHTML = screens[S.tab](); m.scrollTop = 0; m.style.display = S.stack.length ? 'none' : '';
  if (S.tab === 'search') { results(); $('#q').value = S.query; }
}
export function renderSub() {
  const el = $('#sub'), top = S.stack[S.stack.length - 1];
  $('#main').style.display = top ? 'none' : '';
  if (!top) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="screen sub">${sub[top.t](top.id)}</div>`;
  if (top.t === 'settings') glide($('#styleseg'), { initial: set.style === 'blackred' ? 1 : 0, onChange: i => { set.style = i ? 'blackred' : 'vibrant'; applySettings(); renderNP(); } });
}
/** Open a pushed screen. t = key of `sub` in screens.js, id = its argument. */
export const push = (t, id) => { S.stack.push({ t, id }); renderSub(); };
export const pop = () => { S.plEdit = false; S.stack.pop(); renderSub(); };

export function renderMini() {
  const t = Native.current(), el = $('#mini'); if (!t) { el.innerHTML = ''; return; }
  const a = trackAlbum(t), s = Native.state;
  el.innerHTML = `<div class="mini" data-act="open-np" role="button">${cov(a)}<div class="meta"><b>${t.title}</b><span>${t.trackArtist || a.artist}, ${a.title}</span></div>
    <button class="mb" data-act="pp">${s.playing ? I.pause : I.play}</button><button class="mb" data-act="next">${I.next}</button></div>`;
}
/** Highlight the playing song in every visible list. */
export function markPlaying() { const c = Native.current(); document.querySelectorAll('[data-tid]').forEach(r => r.classList.toggle('playing', c && r.dataset.tid === c.id)); }

on('onTrackChanged', () => { renderMini(); renderNP(); markPlaying(); });
on('onState', () => { renderMini(); renderNP(); });
on('onRepeatChanged', () => renderNP());
