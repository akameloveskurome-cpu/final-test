// T16: in-app log. Keeps every line (errors, warnings, uncaught problems) so the user can paste them to an AI.
// Imported FIRST in main.js so it sees everything. No UI here; Settings > "Copy log" uses buildReport().
const lines = [];
const stamp = () => new Date().toISOString().replace('T', ' ').slice(5, 23);   // BUG-140: with the date
const text = a => { try { return a instanceof Error ? (a.stack || a.message) : typeof a === 'string' ? a : (a === undefined || typeof a === 'function' || typeof a === 'symbol') ? String(a) : JSON.stringify(a, ((anc) => function (k, v) { if (typeof v === 'object' && v) { while (anc.length && anc[anc.length - 1] !== this) anc.pop(); if (anc.includes(v)) return '[circular]'; anc.push(v); } return typeof v === 'bigint' ? String(v) : v; })([])); } catch { return String(a); } };   // BUG-405 / BUG #1: only a value on the current path is circular (a repeated, non-circular reference is printed)
export function logLine(level, ...args) {
  lines.push(`${stamp()} ${level} ${args.map(text).join(' ')}`);
  if (lines.length > 2000) lines.splice(0, lines.length - 2000);   // BUG-140: keep the last 2000 lines
}
for (const [fn, lv] of [['error', 'E'], ['warn', 'W']]) {
  const orig = console[fn].bind(console);
  console[fn] = (...a) => { logLine(lv, ...a); orig(...a); };
}
addEventListener('error', e => logLine('E', 'uncaught:', e.message, e.filename ? `(${String(e.filename).split('/').pop()}:${e.lineno})` : ''));
addEventListener('unhandledrejection', e => logLine('E', 'promise:', e.reason));

/** Text block to paste to an AI. `extra` = { native: string, info: object } from main.js. */
export function buildReport({ native = '', info = {} } = {}) {
  const head = Object.entries({ app: 'Liquid Dark', time: new Date().toISOString(), ua: navigator.userAgent, ...info }).map(([k, v]) => `${k}: ${v}`).join('\n');
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
