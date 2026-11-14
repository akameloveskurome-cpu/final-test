// Pure text helpers (no DOM). Library strings are stored HTML-escaped (see data.js); un() reverses it.
export const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const un = s => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
export const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
