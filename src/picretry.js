// Shared retry gate for live artwork. The manifest can still be checked on its
// normal one-second cadence, but the same broken image is not downloaded every
// second. A changed stamp immediately opens the gate for the new asset.
export function createPicRetryGate({ baseMs = 5000, maxMs = 5 * 60 * 1000 } = {}) {
  if (!(+baseMs > 0)) baseMs = 5000; if (!(+maxMs > 0)) maxMs = 5 * 60 * 1000;   // BUG-367
  let stamp = '', failures = 0, retryAt = 0;
  const reset = next => { stamp = String(next || ''); failures = 0; retryAt = 0; };
  return {
    canTry(next, now = Date.now()) {
      next = String(next || '');
      if (next && next !== stamp) reset(next);
      return !retryAt || now >= retryAt || retryAt - now > 3600e3 * 6;   // BUG-366: a clock moved far back must not keep the gate shut
    },
    fail(next, now = Date.now()) {
      next = String(next || '');
      if (next && next !== stamp) reset(next);
      failures++;
      const delayMs = Math.min(maxMs, baseMs * (2 ** Math.min(failures - 1, 16)));
      retryAt = now + delayMs;
      return { stamp, failures, delayMs, retryAt };
    },
    succeed(next) {
      next = String(next || '');
      if (!next || next === stamp) reset('');
    },
    clear() { reset(''); },
    snapshot() { return { stamp, failures, retryAt }; },
  };
}

/** BUG #2 (same guard as splashpic.js, BUG-196): a 404 for a picture manifest means "folder emptied" only while another file of the same repo (update/latest.json) still answers;
 *  a wrong branch, a private repo or a captive page also say 404. -> true only when the repo is reachable. */
export async function manifest404IsGone(fetchFn, repo, branch) {
  try { const u = await fetchFn(`https://raw.githubusercontent.com/${repo}/${branch}/update/latest.json?v=` + Date.now(), { cache: 'no-store' }); return !!(u && u.ok); } catch { return false; }
}
