// T16: in-app log. Keeps the last ~300 lines (errors, warnings, uncaught problems) so the user can paste them to an AI.
// Imported FIRST in main.js so it sees everything. No UI here; Settings > "Copy log" uses buildReport().
const MAX = 300, lines = [];
const stamp = () => new Date().toISOString().slice(11, 23);
const text = a => { try { return a instanceof Error ? (a.stack || a.message) : typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); } };
export function logLine(level, ...args) {
  lines.push(`${stamp()} ${level} ${args.map(text).join(' ')}`.slice(0, 2000));
  if (lines.length > MAX) lines.shift();
}
for (const [fn, lv] of [['error', 'E'], ['warn', 'W']]) {
  const orig = console[fn].bind(console);
  console[fn] = (...a) => { logLine(lv, ...a); orig(...a); };
}
addEventListener('error', e => logLine('E', 'uncaught:', e.message, e.filename ? `(${String(e.filename).split('/').pop()}:${e.lineno})` : ''));
addEventListener('unhandledrejection', e => logLine('E', 'promise:', e.reason));

/** Text block to paste to an AI. `extra` = { native: string, info: object } from main.js. */
export function buildReport({ native = '', info = {} } = {}) {
  const head = Object.entries({ app: 'Liquid FLAC', time: new Date().toISOString(), ua: navigator.userAgent, ...info }).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `${head}\n\n--- app log (last ${lines.length}) ---\n${lines.join('\n') || '(empty)'}\n\n--- phone log (warnings + errors, this app only) ---\n${native || '(none, or browser)'}\n`;
}

/** Copies to the clipboard. Resolves true/false. Falls back to a hidden textarea + execCommand. */
export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {}
  try {
    const a = document.createElement('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok;
  } catch { return false; }
}
