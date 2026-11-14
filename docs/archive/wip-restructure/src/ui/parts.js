// Small HTML builders shared by screens and features. All return strings; no state.
import { byAlbum, mmss, isHires, tracks } from '../data.js';
import { Native } from '../../../src/native.js';
import { I } from '../../../src/icons.js';

export const cov = (a, cls = '') => `<div class="cover ${cls}" style="--g:${a.g}"></div>`;
export const hi = t => isHires(t) ? '<span class="hires">HI-RES</span>' : '';
export const trackAlbum = t => byAlbum(t.albumId);
export const actions = list => `<div class="actions"><button data-act="playall" data-list="${list}">${I.play}Play</button><button data-act="shuffleall" data-list="${list}">${I.shuffle}Shuffle</button></div>`;
export const navRow = (act, id, icon, label, count) => `<button class="row" data-act="${act}" data-id="${id}"><span class="ic">${I[icon]}</span><span class="lbl" style="font-size:18px">${label}</span>${count == null ? '' : `<span class="cnt">${count}</span>`}<span class="chev">${I.chev}</span></button>`;
export const albumCard = a => `<button class="card" data-act="album" data-id="${a.id}">${cov(a)}<div class="t">${a.title}</div><div class="s">${a.artist}</div></button>`;
/** One song row + its ⋯ button. list = data-list key (see data.js listOf), i = index in that list. */
export const songRow = (t, list, i, { idx = false } = {}) => {
  const a = trackAlbum(t), cur = Native.current();
  return `<div class="songwrap"><button class="row song ${cur && cur.id === t.id ? 'playing' : ''}" data-tid="${t.id}" data-act="play" data-list="${list}" data-i="${i}">
    ${idx ? `<span class="idx">${i + 1}</span>` : `<div class="thumb cover" style="--g:${a.g}"></div>`}
    <div class="meta"><b>${t.title}${hi(t)}</b><span>${t.trackArtist || a.artist}</span></div><span class="dur">${mmss(t.dur)}</span></button><button class="gbtn sm" data-act="trackmenu" data-tm="${t.id}">${I.more}</button></div>`;
};
export const header = ({ back, right = 'more' } = {}) => `<div class="top">
  ${back ? `<button class="gbtn" data-act="back">${I.back}</button>` : '<span></span>'}
  ${right === 'more' ? `<button class="gbtn" data-act="settings">${I.more}</button>` : right === 'plus' ? `<button class="gbtn" data-act="newpl">${I.plus}</button>` : right === 'plmenu' ? `<button class="gbtn" data-act="plmenu">${I.more}</button>` : '<span></span>'}</div>`;
export const mosaic = ts => {
  const cs = [...new Set(ts.map(t => t.albumId))].slice(0, 4);
  if (!cs.length) return `<div class="pl-mosaic">${'<div class="cover" style="--g:var(--row-fill)"></div>'.repeat(4)}</div>`;
  while (cs.length < 4) cs.push(cs[cs.length % cs.length]);
  return `<div class="pl-mosaic">${cs.map(c => cov(byAlbum(c))).join('')}</div>`;
};
export const emptyBox = () => Native.isNative && !tracks.length ? `<div class="empty">No music yet. Pick the folder that holds your FLAC files.</div><div class="actions"><button data-act="pickfolder">${I.folder}Choose music folder</button></div>` : '';
