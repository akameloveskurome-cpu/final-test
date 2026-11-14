// Bridge to the Android plugin "LiquidNative" (native-android/LiquidNative.java). In a browser every method is a mock, so the UI runs without a phone.
// LOCKED names (never rename): play pause resume seek next prev setRepeat setShuffle; events onTrackChanged onState onProgress onRepeatChanged.
// Extra event (JS only): onQueue = queue order/content changed.
// T8-rest: the queue in `state.queue` ALWAYS equals ExoPlayer's playlist order. Shuffle is done HERE (shuffle.js) by reordering the songs
// after the current one; ExoPlayer's own shuffle mode is never switched on (so the Up Next sheet is always right).
import { Capacitor, registerPlugin } from '@capacitor/core';
import { tracks, byAlbum } from './data.js';
import { smartShuffle, restoreOrder } from './shuffle.js';
import { cleanMinutes } from './sleep.js';
import { toBase64 } from './transfer.js';

export const isNative = Capacitor.isNativePlatform();
const N = isNative ? registerPlugin('LiquidNative') : null;
const nat = (m, a) => (N ? N[m](a) : Promise.resolve({}));   // call the plugin; resolves {} in a browser
const un = x => String(x ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

const L = {};
const emit = (ev, d) => (L[ev] || []).forEach(f => { try { f(d); } catch (e) { console.error('listener failed:', ev, e); } });   // BUG-252: one bad listener no longer stops the others
export const on = (ev, f) => (L[ev] = [...(L[ev] || []), f]);

/** Player state. queue = songs in play order. orig = the upcoming songs in their un-shuffled order (only while shuffle is on). */
const s = { queue: [], index: -1, playing: false, pos: 0, repeat: 'off', shuffle: false, orig: [] };
const cur = () => s.queue[s.index];
/** T22 sleep timer state: endsAt = ms clock time (minutes mode), endOfSong = stop after the current song. Real timer = PlaybackService.java; browser = the mock below. */
const sl = { active: false, endOfSong: false, endsAt: 0 };
const sleepSet = (active, endOfSong, endsInMs, fired) => { sl.active = !!active; sl.endOfSong = !!active && !!endOfSong; sl.endsAt = active && !endOfSong ? Date.now() + (+endsInMs || 0) : 0; emit('onSleepTimer', { ...sl, fired: !!fired }); };
let sleepTimer = null;                                                 // browser mock only
const sleepFire = () => { clearInterval(sleepTimer); sleepTimer = null; sleepSet(false, false, 0, true); };
const artistOf = t => (byAlbum(t.albumId) || {}).artist;
const shuffled = list => smartShuffle(list, artistOf, t => t.albumId);
const changed = () => { emit('onState', s); emit('onQueue', s); };   // player + queue changed
const queued = () => emit('onQueue', s);                              // only the queue changed (add / move / remove / clear)
let loaded = true;                                                    // false = the Android player never got the restored queue (see restore)
/** What the plugin needs to play a song (strings un-escaped). */
let coverFor = null;   // v152: main.js tells us the file of a custom song / album picture (it gets the track), so the notification / lock screen show the same cover as the app
const item = t => { const a = byAlbum(t.albumId) || {}; return { id: t.id, uri: t.uri, title: un(t.title), artist: un(t.trackArtist || a.artist), album: un(a.title), albumArtist: un(a.artist), no: t.no || 0, cover: (coverFor && coverFor(t)) || t.coverPath || a.coverPath || '' }; };

/* ---------- generic JSON files. Android = filesDir/<name>.json (name: a-z 0-9 _ -, max 40), browser = localStorage 'lf.<name>'. Use this for ALL new persistent data. ---------- */
export const store = {
  get: name => N
    ? N.readJson({ name }).then(r => (r && r.data !== undefined ? r.data : null))
    : Promise.resolve((() => { try { return JSON.parse(localStorage.getItem('lf.' + name)); } catch { return null; } })()),
  set: (name, data) => N
    ? N.writeJson({ name, data })
    : (() => { try { localStorage.setItem('lf.' + name, JSON.stringify(data)); } catch {} return Promise.resolve(); })(),
};

// T4c step 3: native returns the saved cover FILE path. `cover` becomes a WebView url; `coverPath` stays raw (used for the notification artwork).
const fixCovers = r => { (r.tracks || []).forEach(t => { if (t.cover) { t.coverPath = t.cover; t.cover = Capacitor.convertFileSrc(t.cover); } }); return r; };

/* ---------- browser mock player ---------- */
let timer = null;
const tick = () => {
  if (!s.playing) { clearInterval(timer); return; }   // paused: stop ticking (resume() / play() start it again)
  s.pos += 0.25; emit('onProgress', { pos: s.pos, dur: cur().dur });
  if (s.pos >= cur().dur) { if (sl.active && sl.endOfSong) { s.pos = 0; sleepFire(); mock.next(true).then(() => mock.pause()); } else s.repeat === 'one' ? (s.pos = 0) : Native.next(true); }
};
const start = () => { clearInterval(timer); timer = setInterval(tick, 250); };
const mock = {
  async pause() { s.playing = false; emit('onState', s); },
  async resume() { if (s.index < 0) return; s.playing = true; start(); emit('onState', s); },
  async seek(sec) { s.pos = sec; if (cur()) emit('onProgress', { pos: s.pos, dur: cur().dur }); },
  async next(auto) {   // auto = the song ended by itself (the Next BUTTON passes nothing)
    if (!s.queue.length) return;
    let i = s.index + 1;
    // Bug 17: same as the real player (ExoPlayer seekToNextMediaItem): the Next button does nothing on the last song unless Repeat All is on; only a song that ENDS stops playback
    if (i >= s.queue.length) { if (s.repeat !== 'all') { if (auto) { s.playing = false; s.pos = 0; emit('onState', s); } return; } i = 0; }
    s.index = i; s.pos = 0; emit('onTrackChanged', cur()); emit('onState', s);
  },
  async prev() { if (s.pos > 3) return mock.seek(0); if (!s.queue.length) return; s.index = (s.index - 1 + s.queue.length) % s.queue.length; s.pos = 0; emit('onTrackChanged', cur()); emit('onState', s); },
};

/* ---------- real player (Android): the service owns playback, events flow back ---------- */
const real = N && {
  pause: () => N.pause(),
  async resume() {
    if (!loaded && s.index >= 0) { const pos = s.pos; await Native.play(s.queue, s.index, true); if (pos > 1) await N.seek({ sec: pos }); return; }   // restore never reached the player: load it now
    return N.resume();
  },
  next: () => N.next(), prev: () => N.prev(),
  seek: (sec, opts) => { s.pos = sec; seekHold = { to: sec, until: performance.now() + 800 }; const t = cur(); if (t) emit('onSeek', { pos: sec, dur: t.dur }); return N.seek(opts && opts.loop ? { sec, loop: true } : { sec }); },   // opts.loop: the A-B loop jumped back (the listening tracker starts a new play)   // onSeek: the bar + lyrics move at once, also while paused (the player only reports while playing)
};
let seekHold = null;   // v56: right after a seek the player may still report the OLD place for a moment; those reports are dropped (max 0.8 s) so the bar does not snap back
if (N) {
  N.addListener('onTrackChanged', e => {
    if (e.index !== s.index) s.pos = 0;   // same index = restore / repeat-one: keep the shown position (progress events correct it)
    s.index = e.index;
    if (cur()) emit('onTrackChanged', cur());
    emit('onState', s);
  });
  N.addListener('onState', e => { s.playing = e.playing; emit('onState', s); });
  N.addListener('onProgress', e => {
    if (seekHold) { if (performance.now() > seekHold.until || Math.abs(e.pos - seekHold.to) < 1.5) seekHold = null; else return; }
    s.pos = e.pos; const t = cur(); if (t) emit('onProgress', { pos: s.pos, dur: t.dur }); });
  N.addListener('onPlayCounted', () => emit('onPlayCounted', {}));   // v145b: the playback service counted a play (see ListenTracker)
  N.addListener('onSleepTimer', e => sleepSet(e.active, e.endOfSong, e.endsInMs, e.fired));   // T22: the service started / cancelled / fired the timer
  N.addListener('onBluetooth', e => emit('onBluetooth', e));   // v77: a Bluetooth audio device connected / left: { devices:[{name,type}], change, name }
  N.addListener('onScanProgress', e => emit('onScanProgress', { done: e.done, total: e.total, phase: e.phase || 'read', found: e.found || 0, name: e.name || '', cover: e.cover ? Capacitor.convertFileSrc(e.cover) : '' }));   // T18 / v101: JS-only event { done, total, phase: walk | read | save, found, name (last file), cover (newest saved cover, shown by the scan card) }
}

export const Native = {
  isNative,
  setCoverOverride: f => { coverFor = typeof f === 'function' ? f : null; },
  state: s,
  current: cur,
  pos: () => s.pos,
  ...(N ? real : mock),

  /** Play `queue` from `index`. With shuffle on: the chosen song first, the rest smart-shuffled.
   *  keep = true: play it exactly as given (Up Next "tap a song"), no re-shuffle.
   *  Shuffle is the person's setting (owner rule): ON = every list they start is shuffled, OFF = every list plays in its own order. */
  async play(queue, index, keep) {
    if (!queue || !queue.length) return;
    let q = queue.slice(), i = Math.max(0, Math.min(+index || 0, q.length - 1));
    if (!keep) {
      if (s.shuffle && q.length > 1) { const rest = q.filter((_, k) => k !== i); s.orig = rest.slice(); q = [q[i], ...shuffled(rest)]; i = 0; } else s.orig = [];
    }
    s.queue = q; s.index = i; s.pos = 0; s.playing = true; loaded = true; if (!N) start();
    // Bug 1: send 'play' to the plugin BEFORE the events. Listeners (autoFill) call addToQueue inside onTrackChanged; if that reached the
    // plugin first, the later 'play' would replace the whole playlist with the old array and the JS queue would no longer match ExoPlayer.
    const sent = nat('play', { items: q.map(item), index: i }); sent.catch(() => {});
    emit('onTrackChanged', cur()); changed();
    try { await sent; } catch (e) { s.playing = false; emit('onState', s); throw e; }   // Bug 10: the player refused: do not keep showing "playing"
  },
  /** Shuffle All: shuffle on, start on a random song of the list. */
  playShuffled(list) { if (!list || !list.length) return Promise.resolve(); s.shuffle = true; return Native.play(list, Math.floor(Math.random() * list.length)); },
  async setRepeat(m) { s.repeat = m; emit('onRepeatChanged', m); await nat('setRepeat', { mode: m }); },
  /** T27: open the phone's own equalizer page for its brand: OPPO / Realme = Real Sound Technology, OnePlus = Dirac Audio Tuner, every other brand = its own sound-effects page (Samsung, Vivo...), else Sound & vibration.
   *  Resolves { via: "real-sound" | "dirac" | "effects" | "panel" | "settings", brand: "oppo" | "oneplus" | "other" }. Browser: rejects. */
  async openEqualizer() { if (!N) throw new Error('Only on the phone'); return await N.openEqualizer(); },
  /** What to tell the person when the equalizer could only open Sound & vibration (via "settings"): the name of the row to tap, per phone brand. */
  equalizerHint(brand) {
    if (brand === 'oneplus') return 'Opened Sound & vibration. Tap Dirac Audio Tuner there.';
    if (brand === 'oppo') return 'Opened Sound & vibration. Tap Real Sound Technology there.';
    return 'Opened Sound & vibration. Look for Sound effects, Audio effects or Equalizer there.';
  },
  /** v77: open the phone's Bluetooth settings. Browser: rejects. */
  async openBluetooth() { if (!N) throw new Error('Only on the phone'); return await N.openBluetooth(); },
  /** v82: ask for the Bluetooth permission (battery %). Resolves { granted }. */
  requestBluetooth: () => (N ? N.requestBluetooth() : Promise.resolve({ granted: true })),
  /** v77: connected Bluetooth audio devices { devices:[{name,type}] } (also starts the onBluetooth watcher). */
  getBluetooth: () => (N ? N.getBluetooth() : Promise.resolve({ devices: [] })),
  /** Plays the Android plugin counted itself (also while the page was paused in the background): { plays: [{ id, ts }] }. They stay there until ackPlays() (so a failed save loses nothing). Browser = none. */
  takePlays: () => (N ? N.takePlays() : Promise.resolve({ plays: [] })),
  /** The page saved these plays: remove them on the Android side. ackPlays({ all: true }) removes everything (Clear play history). */
  ackPlays: o => (N ? N.ackPlays(o || {}) : Promise.resolve()),
  /** Listening statistics (history database written inside the playback service). Browser = empty. */
  getListens: ({ from = 0, to = 4e15 } = {}) => (N ? N.getListens({ from, to }) : Promise.resolve({ segs: [] })),
  getListenDays: () => (N ? N.getListenDays() : Promise.resolve({ days: [] })),
  getListenSeen: before => (N ? N.getListenSeen({ before }) : Promise.resolve({ seen: [] })),
  clearListens: (o = {}) => (N ? N.clearListens(o) : Promise.resolve({ removed: 0 })),
  shareImage: (data, text = '', name = '') => (N ? N.shareImage({ data, text, name }) : Promise.reject(new Error('Only on the phone'))),
  /** CPU cores, processor, RAM and heap (Settings > Performance). Browser = what the browser reports. */
  getDeviceInfo: () => (N ? N.getDeviceInfo() : Promise.resolve({ cores: (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 0, scanThreads: 0, processor: '', abi: '', ramMb: ((typeof navigator !== 'undefined' && navigator.deviceMemory) || 0) * 1024, availMb: 0, heapMb: 0 })),
  /** T22: sleep timer. { minutes: 15|30|45|60 } or { endOfSong: true }. Rejects when nothing is playing. State: Native.sleepState(), event onSleepTimer { active, endOfSong, endsAt, fired }. */
  async setSleepTimer({ minutes = 0, endOfSong = false, ms = 0 } = {}) {   // ms (optional) = the exact time left, used to resume a timer after the app was killed; minutes stays as the whole-minute value
    if (!cur()) throw new Error('Nothing is playing');
    if (!endOfSong && !cleanMinutes(minutes)) throw new Error('bad minutes');
    if (N) { await N.setSleepTimer(endOfSong ? { endOfSong: true } : ms > 0 ? { minutes, ms } : { minutes }); return; }   // the service answers with an onSleepTimer event
    clearInterval(sleepTimer); sleepTimer = null;
    sleepSet(true, endOfSong, ms > 0 ? ms : minutes * 60000, false);
    if (!endOfSong) { const id = sleepTimer = setInterval(() => { if (sleepTimer !== id || !sl.active || sl.endOfSong) return; if (Date.now() >= sl.endsAt) { sleepFire(); mock.pause(); } }, 1000); }   // guard: a callback of a cancelled / replaced timer must never pause playback (some runtimes still run it after clearInterval)
  },
  async cancelSleepTimer() {
    if (N) { await N.cancelSleepTimer(); return; }
    clearInterval(sleepTimer); sleepTimer = null; if (sl.active) sleepSet(false, false, 0, false);
  },
  /** Ask the service what it is doing (the app may have been closed while the timer kept running). */
  async getSleepTimer() { if (N) { const r = await N.getSleepTimer(); sleepSet(r.active, r.endOfSong, r.endsInMs, false); } return { ...sl }; },
  sleepState: () => ({ ...sl }),
  /** Shuffle on = reorder everything AFTER the current song (smart shuffle); off = put that part back in its original order. The current song never restarts. */
  async setShuffle(on) {
    const os = s.shuffle, oq = s.queue, oo = s.orig;   // BUG #4: kept for a rollback (same pattern as addNext / moveItem / removeItem)
    s.shuffle = !!on;
    if (s.index >= 0) {
      let tail = s.queue.slice(s.index + 1);
      if (s.shuffle) { s.orig = tail.slice(); tail = shuffled(tail); } else { tail = restoreOrder(tail, s.orig); s.orig = []; }
      s.queue = s.queue.slice(0, s.index + 1).concat(tail);
      if (tail.length) { try { await nat('replaceTail', { items: tail.map(item) }); } catch (err) { s.shuffle = os; s.queue = oq; s.orig = oo; changed(); throw err; } }
    }
    changed();
  },
  // T7: Play Next = right after the current song; Add to Queue = end of the queue. (While shuffle is on they are also added to `orig`.)
  /** v153: put the CURRENT cover of these albums (custom picture, else the original) into the notification / lock screen of every queued song, playing one included. albumIds omitted = every album in the queue. */
  async updateArtwork(albumIds) {
    if (!N) return;
    const want = albumIds ? new Set([].concat(albumIds)) : null, seen = new Set(), items = [];
    s.queue.forEach(t => { if (!t || seen.has(t.id) || (want && !want.has(t.albumId))) return; seen.add(t.id); items.push({ id: t.id, cover: item(t).cover }); });
    if (items.length) await N.setArtwork({ items }).catch(() => {});
  },
  async addNext(t) { if (s.index < 0) return Native.play([t], 0); const oq = s.queue, oo = (s.orig || []).slice(); s.queue = s.queue.slice(); s.queue.splice(s.index + 1, 0, t); if (s.shuffle) s.orig.unshift(t); queued(); try { await nat('addNext', { item: item(t) }); } catch (err) { s.queue = oq; s.orig = oo; queued(); throw err; } },
  async addToQueue(t) { if (s.index < 0) return Native.play([t], 0); const oq = s.queue, oo = (s.orig || []).slice(); s.queue = s.queue.slice(); s.queue.push(t); if (s.shuffle) s.orig.push(t); queued(); try { await nat('addToQueue', { item: item(t) }); } catch (err) { s.queue = oq; s.orig = oo; queued(); throw err; } },
  // T8: queue edits use absolute indexes in s.queue; the current song is never moved or removed.
  async moveItem(from, to) {
    const oq = s.queue, oo = s.orig;   // BUG-126 / 251: kept for a rollback
    s.queue = s.queue.slice(); const [x] = s.queue.splice(from, 1); s.queue.splice(to, 0, x);
    if (s.shuffle && s.orig.length) {   // B9: keep the manual order for when Shuffle is turned off (put the song right after its new neighbour)
      const o = s.orig.filter(t => t !== x), prev = to - 1 > s.index ? s.queue[to - 1] : null, k = prev ? o.indexOf(prev) + 1 : 0;
      o.splice(k, 0, x); s.orig = o;
    }
    queued(); try { await nat('moveItem', { from, to }); } catch (err) { s.queue = oq; s.orig = oo; queued(); throw err; }
  },
  async removeItem(i) { const oq = s.queue; s.queue = s.queue.slice(); s.queue.splice(i, 1); queued(); try { await nat('removeItem', { index: i }); } catch (err) { s.queue = oq; queued(); throw err; } },   // BUG-126 / 251: a rejected call restores the page queue
  /** Keeps ONLY the current song (the plugin also drops the songs before it, so indexes stay in step). */
  async clearQueue() { const oq = s.queue, oi = s.index, oo = s.orig; s.queue = [cur()].filter(Boolean); s.index = s.queue.length ? 0 : -1; s.orig = []; queued(); try { await nat('clearQueue'); } catch (err) { s.queue = oq; s.index = oi; s.orig = oo; queued(); throw err; } },   // BUG-126 / 251: rollback on a rejected call

  /** T8-rest: put a saved session back in PAUSED state (no audio). `sn` = { ids, index, pos, shuffle, repeat, orig } (see session.js).
   *  Songs that no longer exist are skipped. If the Android service outlived the app and still has a queue, that queue is adopted instead. Returns true if something was restored. */
  async restore(sn) {
    const byId = new Map(tracks.map(t => [t.id, t])), ids = Array.isArray(sn && sn.ids) ? sn.ids : [], q = [];
    const at = Math.max(0, Math.floor(+(sn && sn.index) || 0));
    let idx = at;
    ids.forEach((id, k) => { const t = byId.get(id); if (t) q.push(t); else if (k < at) idx--; });   // a missing song BEFORE the current one shifts the index
    if (!q.length) return false;
    const wasThere = byId.has(ids[at]);                                  // the saved current song still exists -> keep its position
    idx = Math.max(0, Math.min(idx, q.length - 1));
    Object.assign(s, { queue: q, index: idx, pos: wasThere ? Math.max(0, +sn.pos || 0) : 0, playing: false, shuffle: !!sn.shuffle,
      repeat: ['all', 'one'].includes(sn.repeat) ? sn.repeat : 'off', orig: (Array.isArray(sn.orig) ? sn.orig : []).map(id => byId.get(id)).filter(Boolean) });
    if (N) {
      const send = force => N.restore({ items: q.map(item), index: idx, pos: s.pos, force });
      let to; const r = await Promise.race([send(false), new Promise(res => { to = setTimeout(() => res({ timeout: true }), 8000); })]).catch(() => ({ failed: true }));
      clearTimeout(to);
      if (r.timeout || r.failed) loaded = false;                         // the first Play/Resume will load the queue then
      else if (r.alive) {
        const q2 = (r.ids || []).map(id => byId.get(id));
        if (q2.length && q2.every(Boolean)) Object.assign(s, { queue: q2, index: r.index, pos: r.pos || 0, playing: !!r.playing, repeat: ['all', 'one'].includes(r.repeat) ? r.repeat : 'off' });
        else { await send(true).catch(() => { loaded = false; }); await N.setRepeat({ mode: s.repeat }).catch(() => {}); }   // service queue has songs we do not know: replace it
      } else await N.setRepeat({ mode: s.repeat }).catch(() => {});
    }
    emit('onTrackChanged', cur()); emit('onRepeatChanged', s.repeat); changed();
    return true;
  },

  // Notifications (real on Android; browser mock)
  insets: () => (N && N.insets ? N.insets() : Promise.resolve(null)),   // v53: status / navigation bar heights in CSS px (edge-to-edge)
  notificationStatus: () => (N ? N.notificationStatus() : Promise.resolve({ granted: true })),
  requestNotifications: () => (N ? N.requestNotifications() : Promise.resolve({ granted: true })),
  openNotificationSettings: () => (N ? N.openNotificationSettings() : Promise.resolve({})),   // v208: Android > App info > Notifications for Liquid Dark
  notificationTest: () => (N ? N.notificationTest() : Promise.reject('Android only')),
  // T3: folder + library. Browser mock returns nothing.
  addWidget: kind => (N ? N.addWidget({ kind: kind || '' }) : Promise.resolve({ requested: false })),
  setWidgetArtists: data => (N && N.setWidgetArtists ? N.setWidgetArtists(data).catch(() => {}) : Promise.resolve()),   // v159: known artists for the stats widgets' collab split
  setWidgetCovers: covers => (N && N.setWidgetCovers ? N.setWidgetCovers({ covers }).catch(() => {}) : Promise.resolve()),   // v157: custom album / artist pictures for the Albums + Artists widgets
  getLaunch: () => (N ? N.getLaunch() : Promise.resolve({ tab: '' })),   // v107: tab a widget tap asked for   // v106: pin the home screen widget
  allFilesStatus: () => (N ? N.allFilesStatus() : Promise.resolve({ granted: true })),   // v106
  requestAllFiles: () => (N ? N.requestAllFiles() : Promise.resolve({ granted: true })),
  pickFolder: () => (N ? N.pickFolder() : Promise.reject('browser')),
  // T18: scan runs on a background thread in Java; progress arrives as the 'onScanProgress' event {done,total}. Result also has { added, reused, newSongs, removed, touched }.
  // Rejects 'busy' (message 'busy') when a scan is already running.
  scan: (opts) => (N ? N.scan(opts || {}).then(fixCovers) : Promise.resolve({ tracks: [], newSongs: 0, removed: 0, touched: 0 })),
  getLibrary: () => (N ? N.getLibrary().then(fixCovers) : Promise.resolve({ tracks: [], hasFolder: false })),
  // T6: playlists. Android = filesDir/playlists.json; browser = localStorage (null = never saved, keep demo data).
  getPlaylists: () => (N ? N.getPlaylists() : Promise.resolve({ playlists: (() => { try { return JSON.parse(localStorage.getItem('lf.playlists')); } catch { return null; } })() })),
  savePlaylists: ({ playlists }) => { if (N) return N.savePlaylists({ playlists }); try { localStorage.setItem('lf.playlists', JSON.stringify(playlists)); } catch {} return Promise.resolve(); },
  // T17: export / import playlists as a file the user chooses. Android = system file dialogs (create / open document); browser = download / file input.
  // exportPlaylists({ text, name }) -> {} (rejects 'cancelled' if the dialog is closed). importPlaylists() -> { text } (rejects 'cancelled').
  exportPlaylists: ({ text, name }) => {
    if (N) return N.exportPlaylists({ text, name });
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); } catch (e) { return Promise.reject(e); }
    return Promise.resolve({});
  },
  importPlaylists: () => {
    if (N) return N.importPlaylists();
    return new Promise((res, rej) => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
      i.onchange = () => { const f = i.files && i.files[0]; if (!f) return rej('cancelled'); f.text().then(text => res({ text }), rej); };
      i.addEventListener('cancel', () => rej('cancelled'));
      i.click();
    });
  },
  // Backup & transfer: save / open ANY text file through the system dialogs (Android: create / open document; browser: download / file input).
  // saveFile({ name, mime, text } | { name, mime, bytes:Uint8Array }) -> {} (rejects 'cancelled'). openFiles({ multiple }) -> { files:[{ name, text } | { name, bytes }] } (rejects 'cancelled').
  saveFile: async ({ name, mime = 'application/octet-stream', text, bytes }) => {
    if (N) {
      // BUG-48: sent in small pieces into a staged file, then copied to the chosen place (no whole-file Base64 string)
      const data = bytes || new TextEncoder().encode(text || ''), PIECE = 256 * 1024;
      const { id } = await N.saveFileBegin({});
      try { for (let i = 0; i < data.length; i += PIECE) await N.saveFileChunk({ id, base64: toBase64(data.subarray(i, i + PIECE)) }); }
      catch (e) { N.saveFileDiscard({ id }).catch(() => {}); throw e; }
      return N.saveFile({ id, name, mime });
    }
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes || text], { type: mime })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); } catch (e) { return Promise.reject(e); }
    return Promise.resolve({});
  },
  openFiles: ({ multiple = false } = {}) => {
    if (N) return N.openFiles({ multiple }).then(async r => {
      // BUG-48: a .zip is read from the file the phone wrote (no Base64 string); the picked files are freed afterwards
      try {
        const out = [];
        for (const f of (r && r.files) || []) {
          if (f.zip && f.path) { const buf = await fetch(Capacitor.convertFileSrc(f.path)).then(x => { if (!x.ok) throw new Error('cannot read ' + f.name); return x.arrayBuffer(); }); out.push({ name: f.name, bytes: new Uint8Array(buf) }); }
          else out.push({ name: f.name, text: f.text });
        }
        return { files: out };
      } finally { N.releaseFiles({}).catch(() => {}); }
    });
    return new Promise((res, rej) => {
      const i = document.createElement('input'); i.type = 'file'; i.multiple = !!multiple;
      i.onchange = () => { const fs = [...(i.files || [])]; if (!fs.length) return rej('cancelled'); Promise.all(fs.map(f => (/\.zip$/i.test(f.name) ? f.arrayBuffer().then(b => ({ name: f.name, bytes: new Uint8Array(b) })) : f.text().then(text => ({ name: f.name, text }))))).then(files => res({ files }), rej); };
      i.addEventListener('cancel', () => rej('cancelled'));
      i.click();
    });
  },
  /** Listening history rows (src/listenio.js) -> { added:[{ i, s, q }] } = the rows that were new. Browser = nothing is stored (the demo has no history database). */
  importListens: rows => (N ? N.importListens({ rows }) : Promise.resolve({ added: rows.map(r => ({ i: r.i, s: r.s, q: r.q })) })),
  // v118: in-app update: -> { needsPermission } (opened Android's "Allow from this source" page) or { started } (installer opened). Progress = poll getUpdateStatus() (BUG-024: the plugin never emitted an onUpdateProgress event).
  downloadUpdate: (url, build, sha256) => (N ? N.downloadUpdate({ url, build: String(build || 0), sha256: sha256 || '' }) : Promise.reject('Android only')),   // v142: enqueue a build-specific persistent Android foreground download
  getUpdateStatus: (build, sha256) => (N ? N.getUpdateStatus({ build: String(build || 0), sha256: sha256 || '' }) : Promise.resolve({ status: 'unknown' })),   // v142: status and verification survive the WebView process
  installDownloadedUpdate: () => (N ? N.installDownloadedUpdate() : Promise.reject('Android only')),   // v120: hand the downloaded file to Android's installer
  openBackgroundSettings: () => (N ? N.openBackgroundSettings() : Promise.resolve({})),   // v146: Android Battery usage > Allow background activity
  isBackgroundAllowed: () => (N ? N.isBackgroundAllowed() : Promise.resolve({ allowed: true })),
  canInstallUpdates: () => (N ? N.canInstallUpdates() : Promise.resolve({ allowed: true })),   // v120: has the person allowed installs from this app?
  openInstallSettings: () => (N ? N.openInstallSettings() : Promise.reject('Android only')),   // v120: the "Allow from this source" page for this app
  // T16: phone-side log (logcat warnings/errors of this app). Browser = empty.
  getNativeLog: () => (N ? N.getNativeLog() : Promise.resolve({ log: '' })),
  // T10: Canvas (short looping video/GIF per song or album). Map = { 't:<trackId>' | 'a:<albumId>' -> file path }.
  getCanvas: () => (N ? N.getCanvas() : Promise.resolve({ map: (() => { try { return JSON.parse(localStorage.getItem('lf.canvas')) || {}; } catch { return {}; } })() })),
  saveCanvas: map => { if (N) return N.saveCanvas({ map }); try { localStorage.setItem('lf.canvas', JSON.stringify(map)); } catch {} return Promise.resolve(); },
  pickMedia: () => (N ? N.pickMedia() : Promise.reject('Android only')),
  fileUrl: p => (isNative && p ? Capacitor.convertFileSrc(p) : ''),
  // v150: second copy of custom pictures as plain files (Android only; null in a browser). See picmirror.js
  pics: N ? { putPic: a => N.putPic(a), picPath: a => N.picPath(a), delPic: a => N.delPic(a), listPics: () => N.listPics(), url: p => Capacitor.convertFileSrc(p) } : null,
  // T11: Song Info raw data (tags, audio, pictures, matched .lrc). Browser mock = demo record.
  getSongInfo: t => (N ? N.getSongInfo({ uri: t.uri, lrc: t.lrc || '' }) : Promise.resolve({ tags: { TITLE: t.title, DATE: '2020', GENRE: '' }, tech: { bits: 16, rate: 44100, channels: 2, samples: Math.round((t.dur || 0) * 44100), minBlock: 4096, maxBlock: 4096, md5: '', size: 0 }, pics: [], lrc: null })),
  // T9: full lyric text. Android reads the matched .lrc (or the embedded tag) on demand; browser returns the demo lyric.
  getLyrics: t => (N ? N.getLyrics({ uri: t.uri, lrc: t.lrc || '' }).then(r => (r && r.text && r.text.trim()) || !t.twinUri ? r : N.getLyrics({ uri: t.twinUri, lrc: t.twinLrc || '' })) : Promise.resolve({ text: un(t.lyric) })),
};
