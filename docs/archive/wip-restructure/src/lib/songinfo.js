// T11: Song Info. Pure JS (no DOM), so it can be tested in Node.
// Rules ported from liquid_all.py (liquid_flac_report): year validation, LRC analysis, cover checks, audio tiles.
export const MIN_COVER = 3000;                 // covers under this (px, either side) are flagged Low-res
const PIC_TYPES = { 0: 'Other', 1: 'Icon', 2: 'Other icon', 3: 'Cover (front)', 4: 'Cover (back)', 5: 'Leaflet', 6: 'Media', 7: 'Lead artist', 8: 'Artist', 9: 'Conductor', 10: 'Band', 11: 'Composer', 12: 'Lyricist', 13: 'Recording location', 14: 'During recording', 15: 'During performance', 16: 'Video capture', 17: 'Fish', 18: 'Illustration', 19: 'Band logo', 20: 'Publisher logo' };
export const picType = id => PIC_TYPES[id] || `Type ${id}`;

const INVIS = /[\u200b\u200c\u200d\u2060\ufeff\u00a0\u0000]/g;
export const clean = v => String(v ?? '').replace(INVIS, '').trim();

// Year: YYYY, YYYY-MM, YYYY-MM-DD (also / or . separators, optional time). Also YYYYMMDD (added).
const YEAR_RE = /^([0-9]{4})(?:[-/.]([0-9]{1,2})(?:[-/.]([0-9]{1,2}))?)?(?:[T ][0-9]{1,2}:[0-9]{2}(?::[0-9]{2}(?:\.[0-9]+)?)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)?$/;
export const YEAR_KEYS = ['DATE', 'YEAR', 'ORIGINALDATE', 'ORIGINALYEAR', 'RELEASEDATE'];   // report uses DATE, YEAR; the rest are extra fallbacks

export function yearProblem(v, now = new Date().getFullYear()) {
  let s = clean(v);
  if (!s) return 'empty';
  if (/^\d{8}$/.test(s)) s = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const m = s.match(YEAR_RE);
  if (!m) return 'use YYYY or YYYY-MM-DD';
  const y = +m[1];
  if (y < 1900 || y > now + 1) return `year ${y} out of range`;
  const mo = m[2], d = m[3];
  if (mo && !(+mo >= 1 && +mo <= 12)) return `month ${mo} invalid`;
  if (d && !(+d >= 1 && +d <= new Date(y, +mo, 0).getDate())) return `day ${d} invalid`;
  return '';
}

// first valid year value across the year keys; otherwise the first non-empty one (with its problem)
export function pickYear(tags) {
  let first = null;
  for (const k of YEAR_KEYS) {
    const v = clean(tags[k]);
    if (!v) continue;
    const p = yearProblem(v);
    if (!p) return { value: v, key: k, problem: '' };
    if (!first) first = { value: v, key: k, problem: p };
  }
  return first || { value: '', key: '', problem: 'empty' };
}

const TS = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const ENH = /<(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?>/;
const META = /^\[(ar|ti|al|by|offset|re|ve|length|au):\s*([^\]]*)\]/i;
const fmtStamp = m => `${+m[1]}:${m[2]}`;

// same rules as analyze_lrc(): line count skips metadata tags, synced = any [mm:ss.xx], enhanced = any <mm:ss.xx>
export function analyzeLrc(text, { name = '', size = 0, encoding = '' } = {}) {
  const info = { name, size, encoding, synced: false, enhanced: false, lines: 0, first: '', last: '' };
  const stamps = [];
  for (let line of String(text || '').split(/\r?\n/)) {
    line = line.trim();
    if (!line || META.test(line)) continue;
    info.lines++;
    const ts = [...line.matchAll(TS)];
    if (ts.length) stamps.push(...ts);
    if (ENH.test(line)) info.enhanced = true;
  }
  info.synced = stamps.length > 0;
  if (stamps.length) { info.first = fmtStamp(stamps[0]); info.last = fmtStamp(stamps[stamps.length - 1]); }
  return info;
}

export const fmtSr = hz => !hz ? '?' : hz % 1000 === 0 ? `${hz / 1000} kHz` : `${(hz / 1000).toFixed(1)} kHz`;
export const fmtCh = ch => ({ 1: 'Mono', 2: 'Stereo' })[ch] || (ch ? `${ch} ch` : '?');
export const fmtDur = s => s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '?';
export const fmtSize = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
const fmtFormat = mime => { const m = String(mime || '').toLowerCase(); return m.includes('jpeg') || m.includes('jpg') ? 'JPEG' : m.includes('png') ? 'PNG' : m.includes('gif') ? 'GIF' : m.includes('webp') ? 'WEBP' : (m.split('/').pop() || '?').toUpperCase(); };
const badNum = v => !(parseInt(v, 10) > 0);

// raw = native getSongInfo() result { tags, tech, pics, lrc }, track = the app's track object
export function buildSongInfo(raw, track) {
  const tags = raw.tags || {}, tech = raw.tech || {}, pics = raw.pics || [], lrc = raw.lrc || null;
  const first = (...ks) => { for (const k of ks) { const v = clean(tags[k]); if (v) return v; } return ''; };
  const tile = (label, value, missing = false) => ({ label, value: value ?? '', missing: missing || (value ?? '') === '' });
  const stem = String(track.path || '').split('/').pop().replace(/\.flac$/i, '');

  const yr = pickYear(tags);
  const trk = first('TRACKNUMBER', 'TRACK'), dsc = first('DISCNUMBER', 'DISC', 'DISK');
  const title = first('TITLE') || stem;
  const bits = tech.bits || 0, rate = tech.rate || 0, samples = tech.samples || 0;
  const dur = samples && rate ? samples / rate : 0;
  const hires = bits >= 24 || rate > 48000;

  // ---- TAGS
  const tagTiles = [
    tile('Title', first('TITLE')), tile('Album', first('ALBUM')), tile('Artist', first('ARTIST')),
    tile('Album-Artist', first('ALBUMARTIST', 'ALBUM ARTIST', 'ALBUM_ARTIST')),
    tile('Composer', first('COMPOSER')), tile('Lyricist', first('LYRICIST')), tile('Genre', first('GENRE')),
    tile('Year', yr.value ? (yr.problem ? `${yr.value} (invalid: ${yr.problem})` : yr.value) : '', !!yr.problem || !yr.value),
    tile('Label', first('LABEL', 'ORGANIZATION', 'PUBLISHER')), tile('Comment', first('COMMENT')),
    tile('Track number', trk, !trk || badNum(trk)), tile('Disc number', dsc, !dsc || badNum(dsc)),
  ];
  const lyrSync = first('SYNCEDLYRICS', 'SYNCED_LYRICS', 'LYRICS_SYNCED');
  const lyr = first('LYRICS', 'UNSYNCEDLYRICS', 'UNSYNCED_LYRICS');
  if (lyrSync) tagTiles.push(tile('Embedded lyrics', `Synced · ${lyrSync.length.toLocaleString('en-US')} chars`));
  else if (lyr) tagTiles.push(tile('Embedded lyrics', `${/\[\d{1,2}:\d{2}/.test(lyr.slice(0, 2000)) ? 'Synced' : 'Plain'} · ${lyr.length.toLocaleString('en-US')} chars`));
  tagTiles.push(tile('LRC file', lrc ? lrc.name : '', !lrc));
  // ---- cover tiles
  const best = pics.length ? (pics.filter(p => p.type === 3).concat(pics.filter(p => p.type !== 3)).reduce((a, b) => (b.width * b.height > a.width * a.height && (a.type !== 3 || b.type === 3) ? b : a))) : null;
  if (best) {
    const low = pics.filter(p => !p.width || !p.height || p.width < MIN_COVER || p.height < MIN_COVER).map(p => `${picType(p.type)} (${p.width && p.height ? `${p.width}×${p.height}` : 'unknown'})`);
    const res = best.width && best.height ? `${best.width}×${best.height}` : 'unknown';
    tagTiles.push(tile('Cover art', `${pics.length} image(s)`));
    tagTiles.push(low.length ? tile('Cover resolution', `${res} (Low-res: ${low.join(', ')})`, true) : tile('Cover resolution', res, !best.width || !best.height));
    tagTiles.push(tile('Cover format', `${fmtFormat(best.mime)} · ${picType(best.type)}${best.depth ? ` · ${best.depth}-bit` : ''}`));
    tagTiles.push(tile('Cover size', fmtSize(best.size)));
  } else if (track.cover) {
    tagTiles.push(tile('Cover art', 'Folder image'));
    tagTiles.push(tile('Cover resolution', 'unknown', true));
    tagTiles.push(tile('Cover format', 'folder file'));
    tagTiles.push(tile('Cover size', ''));
  } else {
    tagTiles.push(tile('Cover art', '', true));
  }

  // ---- LYRICS FILE
  const lyrTiles = [];
  if (lrc) {
    const li = analyzeLrc(lrc.text, { name: lrc.name, size: lrc.size, encoding: lrc.encoding });
    lyrTiles.push(tile('LRC sync', li.synced ? 'Synced' : 'Not synced'));
    lyrTiles.push(tile('LRC word-level', li.enhanced ? 'Yes' : 'No'));
    lyrTiles.push(tile('LRC lines', String(li.lines)));
    lyrTiles.push(tile('LRC encoding', li.encoding));
    lyrTiles.push(tile('LRC size', fmtSize(li.size)));
    lyrTiles.push(tile('LRC timestamps', li.first ? `${li.first} to ${li.last}` : '', !li.first));
  } else {
    lyrTiles.push(tile('Expected LRC', `${stem}.lrc`));
    lyrTiles.push(tile('Similar LRC', '', true));
  }

  // ---- AUDIO
  const audioTiles = [
    tile('Bit depth', bits ? `${bits}-bit` : '', !bits),
    tile('Sample rate', fmtSr(rate), !rate),
    tile('Channels', fmtCh(tech.channels), !tech.channels),
    tile('Length', dur ? fmtDur(dur) : '', !dur),
    tile('Bitrate', dur && tech.size ? `${Math.round(tech.size * 8 / dur / 1000)} kbps` : '', !(dur && tech.size)),
    tile('File size', tech.size ? fmtSize(tech.size) : '', !tech.size),
    tile('Block size', tech.minBlock || tech.maxBlock ? `${tech.minBlock}–${tech.maxBlock}` : '', !tech.maxBlock),
    tile('MD5', tech.md5 ? tech.md5.slice(0, 12) : 'n/a', !tech.md5),
    tile('Hi-res', hires ? 'Yes' : 'No'),
  ];

  // ---- PATH
  const pathTiles = [tile('File path', track.path || '', !track.path)];
  if (raw.error) pathTiles.unshift(tile('Unreadable file', raw.error, true));

  const sections = [
    { title: 'Tags', tiles: tagTiles }, { title: 'Lyrics file', tiles: lyrTiles },
    { title: 'Audio', tiles: audioTiles }, { title: 'Path', tiles: pathTiles },
  ];
  const problems = sections.reduce((n, s) => n + s.tiles.filter(x => x.missing).length, 0);
  const basic = {
    title, artist: first('ARTIST'), albumArtist: first('ALBUMARTIST', 'ALBUM ARTIST', 'ALBUM_ARTIST'),
    album: first('ALBUM'), year: yr.value, genre: first('GENRE'), track: trk, disc: dsc,
    length: dur ? fmtDur(dur) : '', quality: bits ? `${bits}-bit ${fmtSr(rate)}` : '', hires,
  };
  return { basic, sections, problems };
}
