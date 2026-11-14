// v150: custom pictures / GIFs / videos survive closing the app.
// A File picked from the phone can be stored in IndexedDB as a REFERENCE to the picked file; after the app is swiped away that reference can go dead
// and the picture shows blank. So the bytes themselves are stored (an ArrayBuffer): a copy that no longer depends on anything outside the app.
// Old entries (stored as a Blob) still load, and are rewritten as bytes the first time they can be read (see healBlob).

/** Blob/File -> a plain object holding its bytes (structured-cloneable). Anything that cannot be read is returned unchanged. */
export async function packBlob(b) {
  if (!b || typeof b.arrayBuffer !== 'function') return b;
  try { const buf = await b.arrayBuffer(); return { __lfb: 1, buf, type: String(b.type || ''), name: String(b.name || '') }; } catch { return b; }
}

/** What IndexedDB returned -> a Blob (or null). Understands the new bytes form and the old Blob form. */
export function unpackBlob(v) {
  if (!v) return null;
  if (v.__lfb === 1 && v.buf) { try { return new Blob([v.buf], { type: v.type || '' }); } catch { return null; } }
  return typeof Blob !== 'undefined' && v instanceof Blob ? v : null;   // BUG-372: only a real Blob (not any {size,type} object)
}

/** True when the stored value is the old Blob form (it should be rewritten as bytes). */
export const isLegacy = v => !!v && v.__lfb !== 1 && typeof v.arrayBuffer === 'function';
