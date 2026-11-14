// T9: pure LRC parser (no DOM, no Capacitor), so it can be unit-tested in Node.
// Handles [mm:ss.xx] (and [mm:ss:xx]), several stamps on one line, [offset:+/-ms],
// enhanced <mm:ss.xx> word stamps, metadata tags ([ti:], [ar:] ...) and plain text.

const STAMP = /^\[(\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?)\]/;
const WORD_SPLIT = /<(\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?)>/;

export const toSec = s => {
  const m = String(s).match(/^(\d+):(\d+)(?:[.:](\d+))?$/);
  return m && +m[2] < 60 ? +m[1] * 60 + +m[2] + (m[3] ? +('0.' + m[3]) : 0) : null;
};

// "<00:01.00>Hello <00:01.50>world" -> [{t, w:'Hello '}, {t, w:'world'}]; null when the line has no word stamps
function wordsOf(rest, base) {
  const p = rest.split(WORD_SPLIT);
  if (p.length < 3) return null;
  const out = []; let t = base;
  for (let k = 0; k < p.length; k++) {
    if (k % 2) { const v = toSec(p[k]); if (v != null) t = v; }
    else if (p[k]) out.push({ t, w: p[k] });
  }
  return out;
}

export function parseLrc(src) {
  const text = String(src ?? '').replace(/^\uFEFF/, '').replace(/\r/g, '');
  let offset = 0, synced = false;
  const out = [];
  for (const raw of text.split('\n')) {   // BUG-365: the [offset:] tag counts wherever it stands in the file
    const o = raw.trim().match(/^\[offset:\s*([+-]?\d+)\]$/i);
    if (o) offset = +o[1] / 1000;
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const off = line.match(/^\[offset:\s*([+-]?\d+)\]$/i);
    if (off) { offset = +off[1] / 1000; continue; }
    const stamps = []; let rest = line, m;
    while ((m = rest.match(STAMP)) && toSec(m[1]) != null) { stamps.push(toSec(m[1])); rest = rest.slice(m[0].length); }   // BUG-373: [00:75] is not a time (it stays lyric text, not a silently dropped line)
    if (!stamps.length) {
      if (/^\[(ti|ar|al|au|by|re|ve|length|la|id|hash|tool|offset|total|#):.*\]$/i.test(line)) continue;      // metadata tag, not a lyric line
      out.push({ t: null, text: line, words: null });
      continue;
    }
    const base = stamps[0] ?? 0;
    const words = wordsOf(rest, base);
    const txt = words ? words.map(x => x.w).join('').trim() : rest.trim();
    for (const s of stamps) {
      if (s == null) continue;
      synced = true;
      const d = s - base;   // B8: word times belong to the FIRST stamp; every repeat is shifted by its own distance
      out.push({ t: Math.max(0, s - offset), text: txt, words: words ? words.map(x => ({ t: Math.max(0, x.t + d - offset), w: x.w })) : null });
    }
  }
  // BUG-212: an unstamped line keeps its place: it takes the time of the line above it
  let lastT = 0;
  const filled = out.map(l => (l.t != null ? (lastT = l.t, l) : { ...l, t: lastT }));
  const lines = synced
    ? filled.sort((a, b) => a.t - b.t)
    : out;
  return { synced, lines };
}

// index of the last timed line whose time has been reached (-1 before the first line)
export function currentIndex(lines, pos) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= pos) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}
