// T22: sleep-timer helpers (pure). The timer itself runs in the Android service (PlaybackService.java); in a browser native.js fakes it.
export const SLEEP_MINUTES = [5, 10, 15, 30, 45, 60];
export const SLEEP_MAX = 24 * 60;   // v148: custom timing, 1 minute to 24 hours (the same limit as SleepTimer.minutesToMs in the service)
/** Whole minutes 1..1440 -> itself, anything else -> 0 (= no timer). The four quick choices are just the usual values. */
export const cleanMinutes = m => (Number.isInteger(m) && m >= 1 && m <= SLEEP_MAX ? m : 0);
/** What the person typed -> minutes (0 = not usable). Accepts "90", "90 min", "1:30", "1h30", "1h 30m", "2h", "1.5h". */
export function parseSleepInput(text) {
  const t = String(text ?? '').trim().toLowerCase().replace(/,/g, '.'); if (!t) return 0;
  let m;
  if ((m = /^(\d+)\s*:\s*(\d{1,2})$/.exec(t))) return +m[2] > 59 ? 0 : cleanMinutes(+m[1] * 60 + +m[2]);   // BUG-335: minutes above 59 are not a time
  if ((m = /^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)(?:\s*(\d+)\s*(?:m|min|mins|minute|minutes)?)?$/.exec(t))) return m[2] && +m[2] > 59 ? 0 : cleanMinutes(Math.round(+m[1] * 60 + (m[2] ? +m[2] : 0)));
  if ((m = /^(\d+)\s*(?:m|min|mins|minute|minutes)?$/.exec(t))) return cleanMinutes(+m[1]);
  return 0;
}
/** 90 -> "1 h 30 min", 120 -> "2 h", 45 -> "45 min". */
export const fmtMinutes = m => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`; };
/** ms -> "4:07" or "1:02:09" (rounded UP to whole seconds, so it never shows 0:00 while time is left). */
export function fmtLeft(ms) {
  const s = Math.max(0, Math.ceil((+ms || 0) / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const two = n => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}
/** ms -> "4:07.350" or "1:02:09.005" (millisecond precision, rounded UP so it never shows 0:00.000 while time is left). */
export function fmtLeftMs(ms) {
  const t = Math.max(0, Math.ceil(+ms || 0)), s = Math.floor(t / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const two = n => String(n).padStart(2, '0'), three = n => String(n).padStart(3, '0');
  return (h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`) + '.' + three(t % 1000);
}
/** Text for the glass pill. state = { active, endOfSong, endsAt } (endsAt = ms clock time). '' when no timer. precise = true shows milliseconds. */
export function pillText(state, now, precise = false) {
  if (!state || !state.active) return '';
  const left = (state.endsAt || 0) - now;
  return state.endOfSong ? 'Stops after this song' : (precise ? fmtLeftMs(left) : fmtLeft(left));
}
/** Toast text right after the user sets a timer. */
export const setText = (minutes, endOfSong) => (endOfSong ? 'Music will stop after this song' : `Sleep timer: ${minutes > 60 ? fmtMinutes(minutes) : minutes + (minutes === 1 ? ' minute' : ' minutes')}`);
