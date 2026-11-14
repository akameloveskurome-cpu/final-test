// Screen templates. `screens` = the 4 tabs, `sub` = pushed screens (S.stack entries {t,id}), results() = Search results. Pure HTML builders.
import { albums, tracks, artists, genres, playlists, byAlbum, albumTracks, quality, isHires, genreTracks, artistTracks, folderEntries, recentAlbums, plTracks, match } from '../data.js';
import { E, pl } from '../text.js';
import { I } from '../../../src/icons.js';
import { S, $, set } from '../state.js';
import { cov, trackAlbum, actions, navRow, albumCard, songRow, header, mosaic, emptyBox } from './parts.js';

export const screens = {
  home: () => `${header()}<h1 class="large">Home</h1>${emptyBox()}
    <h2 class="sec" style="margin-top:6px">Recently Added</h2><div class="grid">${recentAlbums(4).map(albumCard).join('')}</div>
    <h2 class="sec">Hi-Res Albums</h2><div class="hscroll">${albums.filter(a => a.hires).map(albumCard).join('')}</div>`,
  albums: () => `${header()}<h1 class="large">Albums</h1><div class="grid">${albums.map(albumCard).join('')}</div>`,
  library: () => `${header()}<h1 class="large">Library</h1>
    ${[['playlist', 'Playlists', 'playlists'], ['artist', 'Artists', 'artists'], ['album', 'Albums', 'albums'], ['song', 'Songs', 'songs'], ['genre', 'Genres', 'genres'], ['folder', 'Folders', 'folders']]
      .map(([ic, l, k]) => `<button class="row" data-act="lib" data-k="${k}"><span class="ic">${I[ic]}</span><span class="lbl">${l}</span><span class="chev">${I.chev}</span></button>`).join('')}
    <h2 class="sec">Recently Added</h2><div class="grid">${recentAlbums(4).map(albumCard).join('')}</div>`,
  search: () => `${header()}<h1 class="large">Search</h1>
    <label class="searchpill">${I.search}<input id="q" placeholder="Artists, Songs, Lyrics and more" autocomplete="off"></label>
    <div id="results"></div>`,
};

export function results() {
  const q = S.query.trim().toLowerCase(), el = $('#results'); if (!el) return;
  if (!q) { el.innerHTML = `<h2 class="sec">Browse Library</h2><div class="genre-grid">${genres.map(g => `<button class="gtile" style="--gc:var(${g.c})" data-act="genre" data-id="${g.n}">${g.n}<small>${g.count} songs</small></button>`).join('')}</div>`; return; }
  const ar = artists.filter(a => match(a, q)), al = albums.filter(a => match(a.title + ' ' + a.artist, q));
  const so = tracks.filter(t => match(t.title, q)), ly = tracks.filter(t => t.lyric && match(t.lyric, q));
  let h = '';
  if (ar.length) h += `<h2 class="sec">Artists</h2>` + ar.map(a => `<button class="row" data-act="artist" data-id="${a}"><span class="ic">${I.artist}</span><span class="lbl" style="font-size:17px">${a}</span><span class="chev">${I.chev}</span></button>`).join('');
  if (al.length) h += `<h2 class="sec">Albums</h2><div class="grid">${al.map(albumCard).join('')}</div>`;
  if (so.length) h += `<h2 class="sec">Songs</h2>` + so.map(t => songRow(t, 'all', tracks.indexOf(t))).join('');
  if (ly.length) h += `<h2 class="sec">Lyrics</h2>` + ly.map(t => `<button class="row song" data-act="play" data-list="all" data-i="${tracks.indexOf(t)}"><div class="thumb cover" style="--g:${trackAlbum(t).g}"></div><div class="meta"><b>${t.title}</b><span>“${t.lyric}”</span></div></button>`).join('');
  el.innerHTML = h || `<div class="empty">No results for “${E(S.query.trim())}”</div>`;
}

const albumsGrid = as => `<div class="grid">${as.map(albumCard).join('')}</div>`;
const meta = (as, ts) => `<div class="detail-t" style="text-align:left"><div class="m">${pl(as.length, 'album')} · ${pl(ts.length, 'song')}</div></div>`;

export const sub = {
  album: id => { const a = byAlbum(id), ts = albumTracks(id);
    return `${header({ back: 1 })}<div class="detail-art">${cov(a)}</div>
    <div class="detail-t"><b>${a.title}</b><div class="a">${a.artist}</div><div class="m">${a.genre} · ${a.year}${ts[0] && isHires(ts[0]) ? ' · ' + quality(ts[0]) : ''}</div></div>
    ${actions('album:' + id)}${ts.map((t, i) => songRow(t, 'album:' + id, i, { idx: true })).join('')}`; },
  playlists: () => `${header({ back: 1, right: 'plus' })}<h1 class="large">Playlists</h1>${playlists.length ? `<div class="grid">${playlists.map(p => { const ts = plTracks(p); return `<button class="card" data-act="playlist" data-id="${p.id}">${mosaic(ts)}<div class="t">${p.name}</div><div class="s">${pl(ts.length, 'song')}</div></button>`; }).join('')}</div>` : '<div class="empty">No playlists yet. Tap + to create one.</div>'}`,
  playlist: id => { const p = playlists.find(x => x.id === id); if (!p) return `${header({ back: 1 })}<div class="empty">Playlist not found.</div>`;
    const ts = plTracks(p);
    return `${header({ back: 1, right: 'plmenu' })}<div class="detail-art">${mosaic(ts)}</div><div class="detail-t"><b>${p.name}</b><div class="m">${pl(ts.length, 'song')}${S.plEdit ? ' · editing' : ''}</div></div>
    ${ts.length ? actions('pl:' + id) : ''}
    ${ts.length ? ts.map((t, i) => `<div class="plrow">${songRow(t, 'pl:' + id, i)}${S.plEdit ? `<div class="plctl"><button class="gbtn sm" data-act="pl-up" data-i="${i}" ${i ? '' : 'disabled'}>↑</button><button class="gbtn sm" data-act="pl-down" data-i="${i}" ${i < ts.length - 1 ? '' : 'disabled'}>↓</button><button class="gbtn sm" data-act="pl-rm" data-i="${i}">✕</button></div>` : ''}</div>`).join('') : '<div class="empty">Empty playlist. Tap ⋯ then Add Songs.</div>'}`; },
  songs: () => `${header({ back: 1 })}<h1 class="large">Songs</h1>${tracks.map((t, i) => songRow(t, 'all', i)).join('')}`,
  artists: () => { const n = new Map(); tracks.forEach(t => { const a = trackAlbum(t).artist; n.set(a, (n.get(a) || 0) + 1); });
    return `${header({ back: 1 })}<h1 class="large">Artists</h1>${artists.length ? artists.map(a => navRow('artist', a, 'artist', a, n.get(a) || 0)).join('') : '<div class="empty">No artists yet.</div>'}`; },
  genres: () => `${header({ back: 1 })}<h1 class="large">Genres</h1>${genres.length ? genres.map(g => navRow('genre', g.n, 'genre', g.n, g.count)).join('') : '<div class="empty">No genres yet.</div>'}`,
  genre: name => { const n = E(name), as = albums.filter(a => a.genre === n), ts = genreTracks(n);
    return `${header({ back: 1 })}<h1 class="large">${n}</h1>${meta(as, ts)}
    ${ts.length ? actions('genre:' + n) : ''}<h2 class="sec">Albums</h2>${albumsGrid(as)}
    <h2 class="sec">Songs</h2>${ts.map((t, i) => songRow(t, 'genre:' + n, i)).join('')}`; },
  folder: path => { const p = E(path), { subs, files } = folderEntries(p);
    return `${header({ back: 1 })}<h1 class="large">${p ? p.split('/').pop() : 'Folders'}</h1>${p ? `<div class="detail-t" style="text-align:left"><div class="m">${p}</div></div>` : ''}
    ${subs.map(f => navRow('folder', f.path, 'folder', f.name, f.count)).join('')}
    ${files.length ? actions('folder:' + p) + files.map((t, i) => songRow(t, 'folder:' + p, i)).join('') : ''}
    ${!subs.length && !files.length ? '<div class="empty">No folders yet. Choose your music folder in Settings.</div>' : ''}`; },
  albumsAll: () => `${header({ back: 1 })}<h1 class="large">Albums</h1>${albumsGrid(albums)}`,
  artist: name => { const n = E(name), as = albums.filter(a => a.artist === n).sort((x, y) => (y.year || 0) - (x.year || 0)), ts = artistTracks(n);
    return `${header({ back: 1 })}<h1 class="large">${n}</h1>${meta(as, ts)}
    ${ts.length ? actions('artist:' + n) : ''}<h2 class="sec">Albums</h2>${albumsGrid(as)}
    <h2 class="sec">Songs</h2>${ts.map((t, i) => songRow(t, 'artist:' + n, i)).join('')}`; },
  settings: () => {
    const row = (t, d, right = '') => `<div class="setrow"><div class="tx"><b>${t}</b>${d ? `<span>${d}</span>` : ''}</div>${right}</div>`;
    const btn = (act, t, d = '') => `<button class="setrow" data-act="${act}" style="width:100%;text-align:left"><div class="tx"><b>${t}</b>${d ? `<span>${d}</span>` : ''}</div></button>`;
    const tg = (k, on) => `<button class="toggle ${on ? 'on' : ''}" data-act="tg" data-k="${k}"></button>`;
    return `<div class="top"><button class="gbtn" data-act="back">${I.back}</button><b style="font-size:20px">Settings</b><span style="width:44px"></span></div>
    <div class="sethead">Appearance</div><div class="setcard">
      ${row('Color style', 'Vibrant keeps small spots of colour. Black &amp; Red is pure black with red as the only colour.')}
      <div class="seg" id="styleseg"><button data-style="vibrant">Vibrant</button><button data-style="blackred">Black &amp; Red</button></div></div>
    <div class="sethead">Display options</div><div class="setcard">
      ${row('Theme', 'Dark')}
      ${row('Motion', 'Reduce Motion turns glide and jelly into plain fades.', tg('motion', set.motion))}
      <button class="setrow" data-act="lyricsize" style="width:100%;text-align:left"><div class="tx"><b>Lyrics</b><span>Text size: ${set.lyricSize}</span></div>${I.chev}</button>
      ${row('Increase Contrast', 'Increase color contrast between app foreground and background colors.', tg('contrast', set.contrast))}</div>
    <div class="sethead">Playback</div><div class="setcard">${row('Autoplay', 'Add similar songs from your library when the queue runs out.', tg('autoplay', set.autoplay))}</div>
    <div class="sethead">Diagnostics</div><div class="setcard">
      ${btn('notiftest', 'Notification test', 'Sends a sample media notification')}
      ${btn('pickfolder', 'Music folder', 'Choose or change the folder with your FLAC files')}
      ${btn('rescan', 'Rescan library')}
      ${btn('copylog', 'Copy log', 'Copies recent errors so you can paste them to an AI')}</div>
    <div class="sethead">About</div><div class="setcard">${row('Liquid FLAC', 'Version 0.8.0 (queue and shuffle survive a restart, smart shuffle)')}</div>`;
  },
};
