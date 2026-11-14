// A tiny fake of the Android plugin + ExoPlayer playlist. It follows the Java in native-android/LiquidNative.java method by method,
// so tests can check the key invariant: the JS queue always equals the player's playlist (same songs, same order, same current index).
export function makeFakePlugin() {
  const ls = {};
  const P = { ids: [], index: 0, pos: 0, playing: false, repeat: 'off', exoShuffle: false, log: [], files: new Map() };
  const emit = (ev, d) => (ls[ev] || []).forEach(f => f(d));
  const ok = (name, fn) => async a => { P.log.push(name); return (fn ? fn(a || {}) : undefined) || {}; };
  const plugin = {
    P,
    emit,
    addListener: (ev, f) => { (ls[ev] ||= []).push(f); },
    play: ok('play', ({ items, index }) => { P.ids = items.map(x => x.id); P.index = index; P.pos = 0; P.playing = true; emit('onTrackChanged', { index }); }),
    pause: ok('pause', () => { P.playing = false; emit('onState', { playing: false }); }),
    resume: ok('resume', () => { P.playing = P.ids.length > 0; emit('onState', { playing: P.playing }); }),
    next: ok('next', () => { if (P.index + 1 < P.ids.length) { P.index++; P.pos = 0; emit('onTrackChanged', { index: P.index }); } }),
    prev: ok('prev', () => { if (P.index > 0) { P.index--; P.pos = 0; emit('onTrackChanged', { index: P.index }); } }),
    seek: ok('seek', ({ sec }) => { P.pos = sec; }),
    setRepeat: ok('setRepeat', ({ mode }) => { P.repeat = mode; }),
    setShuffle: ok('setShuffle', ({ on }) => { P.exoShuffle = on; }),   // must never be called by the JS (T8-rest)
    addNext: ok('addNext', ({ item }) => { P.ids.splice(Math.min(P.ids.length, P.index + 1), 0, item.id); }),
    addToQueue: ok('addToQueue', ({ item }) => { P.ids.push(item.id); }),
    moveItem: ok('moveItem', ({ from, to }) => { const [x] = P.ids.splice(from, 1); P.ids.splice(to, 0, x); }),
    removeItem: ok('removeItem', ({ index }) => { P.ids.splice(index, 1); }),
    clearQueue: ok('clearQueue', () => { const c = P.index; P.ids = P.ids.slice(c, c + 1); P.index = 0; }),   // same as the Java: drops songs after AND before the current one
    replaceTail: ok('replaceTail', ({ items }) => { P.ids = P.ids.slice(0, P.index + 1).concat(items.map(x => x.id)); }),
    restore: a => {
      P.log.push('restore');
      if (plugin.hangRestore) return new Promise(() => {});                       // tests set these flags to simulate a service that never answers / fails
      if (plugin.failRestore) return Promise.reject(new Error('service not ready'));
      const { items, index, pos, force } = a;
      if (!force && P.ids.length) return Promise.resolve({ alive: true, ids: P.ids.slice(), index: P.index, pos: P.pos, playing: P.playing, repeat: P.repeat });
      if (items.length) { P.exoShuffle = false; P.ids = items.map(x => x.id); P.index = Math.max(0, Math.min(index, items.length - 1)); P.pos = pos; P.playing = false; }
      return Promise.resolve({ alive: false });
    },
    takePlays: () => Promise.resolve({ plays: [] }),
    ackPlays: () => Promise.resolve(),
    readJson: ({ name }) => { P.log.push('readJson'); return Promise.resolve(P.files.has(name) ? { data: JSON.parse(P.files.get(name)) } : {}); },
    writeJson: ({ name, data }) => { P.log.push('writeJson'); P.files.set(name, JSON.stringify(data)); return Promise.resolve({}); },
    insets: ok('insets', () => ({ top: 0, bottom: 0 })),
    notificationStatus: ok('notificationStatus', () => ({ granted: true })),
    // T21 / T22: same contract as LiquidNative.java (setSleepTimer, cancelSleepTimer, getSleepTimer; event onSleepTimer)
    setSleepTimer: ok('setSleepTimer', ({ minutes, endOfSong }) => { P.sleep = { active: true, endOfSong: !!endOfSong, endsInMs: endOfSong ? 0 : minutes * 60000, fired: false }; emit('onSleepTimer', P.sleep); }),
    cancelSleepTimer: ok('cancelSleepTimer', () => { P.sleep = { active: false, endOfSong: false, endsInMs: 0, fired: false }; emit('onSleepTimer', P.sleep); }),
    getSleepTimer: ok('getSleepTimer', () => P.sleep || { active: false, endOfSong: false, endsInMs: 0, fired: false }),
  };
  return plugin;
}
