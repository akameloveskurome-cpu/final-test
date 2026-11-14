// T11: Song Info sheet (ported from src/main.js). Basic view by default; "Extra details" shows every tile.
import { reg } from '../state.js';
import { $ } from '../state.js';
import { Native } from '../../../src/native.js';
import { E } from '../text.js';
import { openSheet } from '../ui/sheet.js';
import { buildSongInfo } from '../lib/songinfo.js';

const cache = new Map();
let infoT = null, infoData = null, infoExtra = false;

export async function songInfoSheet(t) {
  infoT = t; infoData = null; infoExtra = false;
  openSheet('<div class="infobox" id="infobox"><div class="empty">Reading file…</div></div>');
  try {
    if (!cache.has(t.id)) cache.set(t.id, Native.getSongInfo(t).then(raw => buildSongInfo(raw, t)));
    const info = await cache.get(t.id);
    if (infoT !== t || !$('#infobox')) return;
    infoData = info; paint(info);
  } catch (e) {
    cache.delete(t.id);
    if ($('#infobox')) $('#infobox').innerHTML = `<div class="empty">Could not read this file${e && e.message ? ': ' + E(e.message) : ''}.</div>`;
  }
}
const tileHtml = x => `<div class="itile${x.missing ? ' miss' : ''}"><span class="il">${E(x.label)}</span><span class="iv">${x.missing && x.value === '' ? 'missing' : E(x.value)}</span></div>`;
function paint(info) {
  const b = info.basic, box = $('#infobox'); if (!box) return;
  const basic = [['Album', b.album], ['Artist', b.artist], ['Album artist', b.albumArtist], ['Year', b.year], ['Genre', b.genre], ['Track', b.track], ['Disc', b.disc], ['Length', b.length], ['Quality', b.quality]];
  box.innerHTML = `<b>${E(b.title)}</b>
    <div class="ibasic">${basic.filter(([, v]) => v).map(([l, v]) => `<div class="itile"><span class="il">${l}</span><span class="iv">${E(v)}</span></div>`).join('')}</div>
    <button class="ixtra ${infoExtra ? 'on' : ''}" data-act="info-extra">${infoExtra ? 'Hide extra details' : 'Extra details'}${info.problems && infoExtra ? ` · ${info.problems} to check` : ''}</button>
    ${infoExtra ? info.sections.map(s => `<div class="isec">${s.title}</div>${s.tiles.map(tileHtml).join('')}`).join('') : ''}`;
}
reg({ 'info-extra': () => { if (infoData) { infoExtra = !infoExtra; paint(infoData); } } });
