// L5: lens refraction for the tab bubble (optional, Settings > Display options > Lens refraction).
// An SVG displacement filter used as `backdrop-filter: url(#lf-lens)`: near the rim of the pill the content behind it is pulled from a
// little further out (glass edge), the middle stays untouched. The displacement map is drawn once on a canvas (lensPixels is pure: tested in Node).
// Works where the WebView supports SVG filters in backdrop-filter (Chromium: yes); elsewhere the CSS rule is ignored and the plain glass stays.

/** RGBA pixels (w*h*4) of the displacement map of a pill. R / G = 128 + 127 * (x / y direction of the pull) * strength; strength is 0 in the middle, 1 at the rim. */
export function lensPixels(w = 128, h = 48, rim = 0.55) {
  const px = new Uint8ClampedArray(w * h * 4), r = h / 2, hw = w / 2 - r;   // the pill = a segment of length 2*hw, thickened by r
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = x + 0.5 - w / 2, cy = y + 0.5 - h / 2;
    const sx = Math.max(-hw, Math.min(hw, cx));                // nearest point on the segment
    const dx = cx - sx, dy = cy, dist = Math.hypot(dx, dy) || 1e-6;
    const depth = r - dist;                                    // > 0 inside the pill, 0 at the rim
    const t = Math.max(0, 1 - depth / (r * rim)), f = t * t;   // 0 in the middle, 1 at the rim
    const i = (y * w + x) * 4;
    px[i] = Math.round(128 + 127 * f * (dx / dist)); px[i + 1] = Math.round(128 + 127 * f * (dy / dist)); px[i + 2] = 128; px[i + 3] = 255;
  }
  return px;
}

/** Adds the hidden <svg> with the filter `#lf-lens` once. Safe to call twice. Returns true when it was added. */
export function initLens(doc = document, scale = 16) {
  if (doc.getElementById('lf-lens-svg')) return false;
  let href = '';
  try {
    const w = 128, h = 48, c = doc.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h); img.data.set(lensPixels(w, h)); g.putImageData(img, 0, 0);
    href = c.toDataURL('image/png');
  } catch { return false; }
  const d = doc.createElement('div'); d.id = 'lf-lens-svg'; d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  d.innerHTML = `<svg width="0" height="0" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><filter id="lf-lens" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">`
    + `<feImage href="${href}" xlink:href="${href}" preserveAspectRatio="none" result="map"/>`
    + `<feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`;
  doc.body.appendChild(d); return true;
}
