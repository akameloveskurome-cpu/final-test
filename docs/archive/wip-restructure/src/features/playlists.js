// T6 Playlists: create, rename, delete, add / remove / reorder (arrows), persisted in store 'playlists' (filesDir/playlists.json = { playlists: [{id,name,ids}] }).
// Names are escaped in memory (data.js) and RAW in the file (savablePlaylists / setPlaylists). Track ids are 't'+hash(uri), so they survive rescans.
import { S, $, toast, reg } from '../state.js';
import { store } from '../../../src/native.js';
import { tracks, playlists, setPlaylists, plTracks, savablePlaylists, match } from '../data.js';
import { E } from '../text.js';
import { openSheet, closeSheet, menuRow } from '../ui/sheet.js';
import { push, renderSub } from '../ui/render.js';
import { trackAlbum } from '../ui/parts.js';

export const savePl = () => store.set('playlists', { playlists: savablePlaylists() }).catch(() => toast('Could not save playlists'));
export async function loadPlaylists() { try { const r = await store.get('playlists'); if (r && Array.isArray(r.playlists)) setPlaylists(r.playlists); } catch {} }
const curPl = () => { const top = S.stack[S.stack.length - 1]; return top && top.t === 'playlist' ? playlists.find(p => p.id === top.id) : null; };
export const newId = () => 'p' + Date.now().toString(36);

/** Sheet with a name field; `act` is the data-act of its Save button (read the text from #nm). */
export function nameSheet(title, value, act) {
  openSheet(`<b>${title}</b><div class="searchpill field"><input id="nm" maxlength="60" value="${value}" placeholder="Playlist name" autocomplete="off"></div>
    <div class="actions"><button data-act="sheet-close">Cancel</button><button data-act="${act}">Save</button></div>`);
  setTimeout(() => { const i = $('#nm'); if (i) { i.focus(); i.select(); } }, 60);
}
export const nameValue = () => E(($('#nm')?.value || '').trim());

function pickSheet() {
  openSheet(`<b>Add Songs</b><div class="searchpill field"><input id="pq" placeholder="Search songs" autocomplete="off"></div><div class="picklist" id="picklist"></div>
    <div class="actions"><button data-act="pick-done">Done</button></div>`);
  pickList();
}
export function pickList() {
  const p = curPl(), el = $('#picklist'); if (!p || !el) return;
  const q = ($('#pq')?.value || '').trim().toLowerCase(), have = new Set(p.ids);
  const hits = tracks.filter(t => !q || match(t.title + ' ' + (t.trackArtist || '') + ' ' + trackAlbum(t).title + ' ' + trackAlbum(t).artist, q)).slice(0, 60);
  el.innerHTML = hits.length ? hits.map(t => { const a = trackAlbum(t); return `<button class="row song ${have.has(t.id) ? 'on' : ''}" data-act="pick-t" data-pid="${t.id}"><div class="thumb cover" style="--g:${a.g}"></div><div class="meta"><b>${t.title}</b><span>${t.trackArtist || a.artist}</span></div><span class="chk">${have.has(t.id) ? '✓' : '+'}</span></button>`; }).join('') : '<div class="empty">No songs found.</div>';
}
/** Move / remove the i-th shown song of the open playlist. */
function plEditStep(act, d) {
  const p = curPl(); if (!p) return;
  const ts = plTracks(p), i = +d.i, t = ts[i]; if (!t) return;
  const k = p.ids.indexOf(t.id);
  if (act === 'rm') p.ids.splice(k, 1);
  else { const o = ts[act === 'up' ? i - 1 : i + 1]; if (!o) return; const j = p.ids.indexOf(o.id); [p.ids[k], p.ids[j]] = [p.ids[j], p.ids[k]]; }
  savePl(); renderSub();
}

reg({
  newpl: () => nameSheet('New Playlist', '', 'newpl-ok'),
  'newpl-ok': () => { const n = nameValue(); if (!n) return toast('Type a name'); const np = { id: newId(), name: n, ids: [] }; playlists.push(np); savePl(); S.plEdit = false; push('playlist', np.id); pickSheet(); },
  plmenu: () => { const p = curPl(); if (!p) return;
    openSheet(`<b>${p.name}</b><div style="height:12px"></div>${menuRow('pick-open', 'Add Songs')}${menuRow('pl-edit', S.plEdit ? 'Done Editing' : 'Edit Songs (reorder / remove)')}${menuRow('pl-rename', 'Rename')}${menuRow('pl-del', 'Delete Playlist', '', 'color:var(--accent)')}`); },
  'pl-edit': () => { S.plEdit = !S.plEdit; closeSheet(); renderSub(); },
  'pl-rename': () => { const p = curPl(); if (p) nameSheet('Rename Playlist', p.name, 'rename-ok'); },
  'rename-ok': () => { const p = curPl(), n = nameValue(); if (!n || !p) return toast('Type a name'); p.name = n; savePl(); closeSheet(); renderSub(); },
  'pl-del': () => { const p = curPl(); if (p) openSheet(`<b>Delete “${p.name}”?</b><p>The songs stay in your library.</p><div class="actions"><button data-act="sheet-close">Cancel</button><button data-act="del-ok">Delete</button></div>`); },
  'del-ok': () => { const p = curPl(); if (p) { playlists.splice(playlists.indexOf(p), 1); savePl(); closeSheet(); S.stack.pop(); renderSub(); } },
  'pick-open': pickSheet,
  'pick-done': () => { closeSheet(); renderSub(); },
  'pick-t': (d, b) => { const p = curPl(); if (!p) return; const k = p.ids.indexOf(d.pid); if (k >= 0) p.ids.splice(k, 1); else p.ids.push(d.pid); savePl(); b.classList.toggle('on', k < 0); b.querySelector('.chk').textContent = k < 0 ? '✓' : '+'; },
  'pl-rm': d => plEditStep('rm', d), 'pl-up': d => plEditStep('up', d), 'pl-down': d => plEditStep('down', d),
});
