// T8-rest: remembers the player session (queue, current song, position, shuffle, repeat) in the JSON store ('session'),
// and puts it back (paused) on the next start. No DOM except the visibilitychange flush.
import { Native, on, store } from './native.js';
import { logLine } from './log.js';

const NAME = 'session';
let ready = false, timer = 0, lastPos = 0;   // nothing is saved until restoreSession() has run (else an empty start would overwrite the old session)

export function snapshot() {
  const s = Native.state;
  return { v: 1, ids: s.queue.map(t => t.id), index: s.index, pos: Math.round(s.pos * 10) / 10, shuffle: s.shuffle, repeat: s.repeat, orig: s.orig.map(t => t.id) };
}

function saveNow() {
  clearTimeout(timer); timer = 0;
  const s = Native.state;
  if (!ready) return;
  if (!s.queue.length) { Promise.resolve(store.set(NAME, { v: 1, ids: [], index: -1, pos: 0, shuffle: !!s.shuffle, repeat: s.repeat, orig: [] })).catch(() => {}); return; }   // BUG-117: a queue cleared on purpose is stored empty
  if (s.index < 0) return;
  lastPos = s.pos;
  Promise.resolve(store.set(NAME, snapshot())).catch(e => logLine('W', 'session save failed:', (e && e.message) || e));
}
const later = () => { if (!timer) timer = setTimeout(saveNow, 600); };   // coalesce bursts of events into one write

['onQueue', 'onTrackChanged', 'onRepeatChanged', 'onState'].forEach(ev => on(ev, later));
on('onProgress', ({ pos }) => { if (ready && Math.abs(pos - lastPos) >= 5) later(); });   // position: about every 5 s while playing
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

/** Call ONCE, after the library has loaded. Returns true if a session was put back. */
export async function restoreSession() {
  if (ready) return false;
  let ok = false;
  try {
    const sn = await store.get(NAME);
    if (sn && Array.isArray(sn.ids) && sn.ids.length && !Native.state.queue.length) ok = await Native.restore(sn);
  } catch (e) { logLine('W', 'session restore failed:', (e && e.message) || e); }
  ready = true;
  return ok;
}
