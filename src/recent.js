/* T25: recent searches (newest first, no limit on how many or how long). Pure. */
export const cleanRecent = a => {   // BUG-364: same rule as addRecent (collapse spaces, case-insensitive de-dup)
  const out = [], seen = new Set();
  for (const x of (Array.isArray(a) ? a : [])) {
    if (typeof x !== 'string') continue;
    const s = x.trim().replace(/\s+/g, ' '), k = s.toLowerCase();
    if (!s || seen.has(k)) continue;
    seen.add(k); out.push(s);
  }
  return out;
};
export function addRecent(list, q) {
  const s = String(q ?? '').trim().replace(/\s+/g, ' ');
  if (!s || (s.length < 2 && /^[\x00-\x7f]*$/.test(s))) return cleanRecent(list);   // BUG-363: one CJK character is a whole word
  return [s, ...cleanRecent(list).filter(x => x.toLowerCase() !== s.toLowerCase())];
}
