// T7 Track menu: the ⋯ button on every song row and on Now Playing (data-act="trackmenu" data-tm=<trackId>).
import { toast, reg } from '../state.js';
import { Native } from '../../../src/native.js';
import { tracks, playlists } from '../data.js';
import { openSheet, closeSheet, menuRow } from '../ui/sheet.js';
import { push } from '../ui/render.js';
import { trackAlbum } from '../ui/parts.js';
import { savePl } from './playlists.js';
import { canvasSheet } from './canvas.js';
import { songInfoSheet } from './info.js';

let menuTid = null;
const menuTrack = () => tracks.find(x => x.id === menuTid);
const needT = f => () => { const t = menuTrack(); if (t) f(t); };

reg({
  trackmenu: d => {
    const t = tracks.find(y => y.id === d.tm); if (!t) return;
    menuTid = t.id; const a = trackAlbum(t);
    openSheet(`<b>${t.title}</b><p>${t.trackArtist || a.artist}, ${a.title}</p>
      ${menuRow('tm-next', 'Play Next')}${menuRow('tm-queue', 'Add to Queue')}${menuRow('tm-addpl', 'Add to Playlist')}
      ${menuRow('tm-album', 'Go to Album')}${menuRow('tm-artist', 'Go to Artist')}${menuRow('tm-canvas', 'Canvas…')}${menuRow('tm-info', 'Song Info')}`);
  },
  'tm-next': needT(t => { closeSheet(); Native.addNext(t).then(() => toast('Plays next')).catch(() => toast('Could not add song')); }),
  'tm-queue': needT(t => { closeSheet(); Native.addToQueue(t).then(() => toast('Added to queue')).catch(() => toast('Could not add song')); }),
  'tm-addpl': () => {
    const rows = playlists.map(p => menuRow('tm-pl', `${p.name}</span><span class="cnt">${p.ids.length}`, `data-plid="${p.id}"`)).join('');
    openSheet(`<b>Add to Playlist</b><div style="height:12px"></div>${rows || '<p>No playlists yet. Create one in Library &gt; Playlists.</p>'}<div class="actions"><button data-act="sheet-close">Cancel</button></div>`);
  },
  'tm-album': needT(t => { closeSheet(); push('album', t.albumId); }),
  'tm-artist': needT(t => { closeSheet(); push('artist', trackAlbum(t).artist); }),
  'tm-canvas': needT(canvasSheet),
  'tm-info': needT(songInfoSheet),
});
reg({
  'tm-pl': d => {
    const p = playlists.find(x => x.id === d.plid), t = menuTrack(); if (!p || !t) return;
    if (p.ids.includes(t.id)) toast('Already in that playlist'); else { p.ids.push(t.id); savePl(); toast('Added to playlist'); }
    closeSheet();
  },
});
