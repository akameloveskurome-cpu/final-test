// v210: battery-helper card (Accessibility). Shows on every open while Liquid Dark's accessibility service is OFF.
// Allow opens Settings > Accessibility. Not now closes it for this open only; it comes back on the next open.
// Order (main.js startPopup): this card comes before the notification card, and bgallow.js waits for it before the background card.
import { Native } from './native.js';
let shownThisOpen = false, hiddenAt = 0, onDone = () => {};
export function setAssistDone(fn) { onDone = typeof fn === 'function' ? fn : () => {}; }
try { document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (hiddenAt && Date.now() - hiddenAt >= 10000) shownThisOpen = false;   // a new open
}); } catch {}
export function assistCardOpen() { return !!document.getElementById('lf-assist'); }
export async function maybeShowAssist() {
  if (!Native.isNative || shownThisOpen || assistCardOpen() || document.hidden) return false;
  let on = true;
  try { on = !!(await Native.batteryAssistStatus()).enabled; } catch {}
  if (on) return false;
  shownThisOpen = true;
  build();
  return true;
}
function close() { const o = document.getElementById('lf-assist'); if (o) o.remove(); onDone(); }
function build() {
  const o = document.createElement('div');
  o.id = 'lf-assist'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
  o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;';
  o.innerHTML = '<div style="max-width:420px;color:#fff;font-family:system-ui,sans-serif;text-align:center;">'
    + '<h2 style="margin:0 0 12px;font-size:22px;">Turn on the battery helper</h2>'
    + '<p style="font-size:16px;line-height:1.5;margin:0 0 16px;">Liquid Dark uses Android\'s Accessibility setting for one thing: after you tap <b>Allow</b> on the background card, it opens <b>Battery usage</b> for you on this app\'s App info page.</p>'
    + '<p style="font-size:15px;line-height:1.5;margin:0 0 22px;">It does not read other apps, and it does not turn the switch on for you. Tap <b>Allow</b>, then turn on <b>Liquid Dark</b> in Accessibility.</p>'
    + '<button data-as="go" style="width:100%;padding:14px;font-size:17px;border:0;border-radius:12px;background:#ff3b5c;color:#fff;margin-bottom:10px;">Allow</button>'
    + '<button data-as="later" style="width:100%;padding:12px;font-size:15px;border:0;border-radius:12px;background:#222;color:#bbb;">Not now</button></div>';
  o.addEventListener('click', e => {
    const b = e.target.closest('[data-as]'); if (!b) return;
    if (b.dataset.as === 'go') { try { Native.openAccessibilitySettings().catch(() => {}); } catch {} }
    close();
  });
  document.body.appendChild(o);
}
