// Shared UI state, settings, toast and the click-action registry. Every other module imports from here.
export const $ = s => document.querySelector(s);
export const S = { tab: 'home', stack: [], query: '', plEdit: false };   // current tab, screen stack [{t,id}], search text, playlist edit mode

/* data-act registry: a feature calls reg({ 'act-name': (dataset, button, event) => ... }); main.js dispatches clicks to it */
export const A = {};
export const reg = o => Object.assign(A, o);

/* settings (persisted in localStorage 'lf.settings') */
const DEF = { style: 'blackred', contrast: false, motion: false, lyricSize: 'Large', autoplay: true };
export const set = { ...DEF };
try { Object.assign(set, JSON.parse(localStorage.getItem('lf.settings') || '{}')); } catch {}
export function applySettings() {
  const h = document.documentElement;
  h.dataset.style = set.style; h.dataset.contrast = set.contrast ? '1' : '0'; h.dataset.motion = set.motion ? 'reduce' : '';
  h.style.setProperty('--lyric-size', { Small: '20px', Medium: '23px', Large: '26px' }[set.lyricSize]);
  try { localStorage.setItem('lf.settings', JSON.stringify(set)); } catch {}
}

export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1800);
}
