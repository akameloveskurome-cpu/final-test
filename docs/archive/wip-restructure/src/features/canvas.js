// T10 Canvas: an own looping video / GIF / image per song or album, shown instead of the cover on Now Playing. NOT the repeat button.
// Map { 't:<trackId>' | 'a:<albumId>' -> file path } lives in store 'canvas' (filesDir/canvas.json). Song beats album. Android copies the picked file into filesDir/canvas/.
import { toast, reg } from '../state.js';
import { Native, store } from '../../../src/native.js';
import { openSheet, closeSheet, menuRow } from '../ui/sheet.js';
import { cov } from '../ui/parts.js';
import { renderNP } from '../ui/np.js';

let map = {}, enabled = false, cvTrack = null;
try { enabled = localStorage.getItem('lf.canvasOn') === '1'; } catch {}
const setEnabled = v => { enabled = v; try { localStorage.setItem('lf.canvasOn', v ? '1' : '0'); } catch {} };
store.get('canvas').then(m => { map = m || {}; if (Native.current()) renderNP(); }).catch(() => {});

const key = (t, scope) => scope === 't' ? 't:' + t.id : 'a:' + t.albumId;
const pathOf = t => map['t:' + t.id] || map['a:' + t.albumId] || '';
const isVideo = p => /\.(mp4|webm)$/i.test(p);
/** True when Canvas is switched on AND this song (or its album) has one. */
export const canvasActive = t => enabled && !!pathOf(t);
/** The Now Playing art block: Canvas media inside the cover frame, or the plain cover. */
export function artHtml(t, a) {
  const p = enabled ? pathOf(t) : '';
  if (!p) return cov(a);
  const url = Native.fileUrl(p);
  const media = isVideo(p) ? `<video class="cvmedia" src="${url}" autoplay loop muted playsinline></video>` : `<img class="cvmedia" src="${url}" alt="">`;
  return `<div class="cover" style="--g:${a.g}">${media}</div>`;
}
export function syncCanvas() {
  const v = document.querySelector('#np .cvmedia');
  if (v && v.tagName === 'VIDEO') { if (Native.state.playing) v.play().catch(() => {}); else v.pause(); }
}
export function canvasSheet(t) {
  cvTrack = t;
  const hasT = !!map['t:' + t.id], hasA = !!map['a:' + t.albumId];
  openSheet(`<b>Canvas</b><p>A short looping video or GIF shown instead of the cover while Canvas is on. The album cover stays the default.</p>
    ${menuRow('cv-pick', hasT ? 'Change for this song' : 'Add for this song', 'data-scope="t"')}
    ${menuRow('cv-pick', hasA ? 'Change for the whole album' : 'Add for the whole album', 'data-scope="a"')}
    ${hasT ? menuRow('cv-rm', 'Remove for this song', 'data-scope="t"') : ''}
    ${hasA ? menuRow('cv-rm', 'Remove for the whole album', 'data-scope="a"') : ''}
    <div class="actions"><button data-act="sheet-close">Cancel</button></div>`);
}

reg({
  canvas: () => {
    const cur = Native.current();
    if (!cur) return toast('Play a song first');
    if (!pathOf(cur)) return canvasSheet(cur);   // nothing set yet: offer to add one
    setEnabled(!enabled); renderNP();
  },
  'cv-pick': d => {
    const t = cvTrack; if (!t) return;
    Native.pickMedia().then(r => store.set('canvas', Object.assign(map, { [key(t, d.scope)]: r.path })).then(() => { setEnabled(true); closeSheet(); toast('Canvas set'); renderNP(); }))
      .catch(e => { if (((e && e.message) || e) !== 'cancelled') toast('Could not add that file'); });
  },
  'cv-rm': d => {
    const t = cvTrack; if (!t) return;
    delete map[key(t, d.scope)];
    store.set('canvas', map).then(() => { closeSheet(); toast('Canvas removed'); renderNP(); }).catch(() => toast('Could not remove'));
  },
});
