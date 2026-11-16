// v214: focus and screen-reader rules for the two permission cards ("Allow background activity" and the Accessibility steps).
// While a card is open the app behind it is inert (keyboard, switch and TalkBack cannot reach it), focus moves onto the card's
// main button, and focus goes back to where it was when the card closes. main.js gives us its syncModal() so the app's own
// sheet / Now Playing / lyrics rules stay the only source of truth for the rest of the app.
let resync = () => {};
export function setLayerSync(fn) { resync = typeof fn === 'function' ? fn : () => {}; }   // main.js: syncModal
/** call right after the card is added to the page */
export function enterCard(card, goSelector) {
  try { resync(); } catch {}
  try { const go = card.querySelector(goSelector); if (go) go.focus({ preventScroll: true }); } catch {}
}
/** call right after the card is removed; `opener` = the element that had focus before the card opened */
export function leaveCard(opener) {
  try { resync(); } catch {}
  try { if (opener && opener.isConnected && !opener.closest('[inert]')) opener.focus({ preventScroll: true }); } catch {}
}
