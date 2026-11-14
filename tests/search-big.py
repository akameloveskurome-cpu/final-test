"""Chromium test of Search with a BIG library (6,000 songs, 20 of them with 60,000-character lyrics).
Checks: the last word of a 60k lyric is found, EVERY match is shown (no cap), fast typing never leaves stale rows, keystrokes stay cheap.
Run from the project root:  python3 tests/search-big.py   (needs: pip install playwright + a Chromium)"""
import http.server, threading, pathlib, sys, json, time
from playwright.sync_api import sync_playwright
import pw_helper; exe = pw_helper.chromium_exe()
ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent).resolve()
MAP = {'/@capacitor/core': 'tests/stubs/capacitor-core.js', '/@capacitor/app': 'tests/stubs/capacitor-app.js'}
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        path = self.path.split('?')[0]; dest = self.headers.get('Sec-Fetch-Dest', '')
        if path == '/':
            html = (ROOT / 'index.html').read_text().replace('<script type="module"',
                '<script type="importmap">{"imports":{"@capacitor/core":"/@capacitor/core","@capacitor/app":"/@capacitor/app"}}</script><link rel="stylesheet" href="/src/styles/tokens.css"><link rel="stylesheet" href="/src/styles/app.css">\n<script type="module"')
            return self._send(200, 'text/html', html.encode())
        if path in MAP: return self._send(200, 'text/javascript', (ROOT / MAP[path]).read_bytes())
        f = ROOT / path.lstrip('/')
        if not f.is_file(): return self._send(404, 'text/plain', b'nf')
        if f.suffix == '.css': return self._send(200, 'text/css', f.read_bytes()) if dest == 'style' else self._send(200, 'text/javascript', b'export default 1;')
        if f.suffix == '.json': return self._send(200, 'text/javascript', b'export default ' + f.read_bytes())
        return self._send(200, 'text/javascript' if f.suffix == '.js' else 'application/octet-stream', f.read_bytes())
    def _send(self, c, t, b):
        self.send_response(c); self.send_header('Content-Type', t); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/'
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

BUILD = """
async () => {
  const d = await import('/src/data.js');
  const words = 'love night light fire dream heart rain sky road home time wind star gold blue river stone dance song fade'.split(' ');
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const mk = n => { let o = []; let len = 0; while (len < n) { const w = words[Math.floor(rnd() * words.length)] + (rnd() < .02 ? ' &' : rnd() < .02 ? ' <b>' : ''); o.push(w); len += w.length + 1; } return o.join(' '); };
  const raw = [];
  for (let i = 0; i < 6000; i++) {
    const big = i % 300 === 0;                       // 20 songs with 60,000-char lyrics
    let lyric = mk(big ? 60000 : 1500 + (i % 7) * 400);
    if (i === 4200) lyric = mk(60000) + ' zyxwvuendword';   // the LAST word of a very long lyric
    raw.push({ uri: 'content://x/tree/p%3A/document/p%3AMusic%2FD' + (i % 500) + '%2Fsong' + i + '.flac', album: 'Album ' + Math.floor(i / 12), artist: 'Artist ' + (i % 300), albumArtist: '', aaTag: false, title: 'Song ' + i + (i % 3 ? ' alpha' : ''), dur: 200, bits: 16, khz: 44.1, genre: 'Rock', lyric, track: (i % 12) + 1, disc: 1, year: 2000 + (i % 20) });
  }
  d.setLibrary(raw);
  return { tracks: d.tracks.length, big: d.tracks.filter(t => t.lyric.length >= 60000).length };
}
"""
TYPE = """
(q) => { const i = document.querySelector('#q'); i.value = q; const t0 = performance.now(); i.dispatchEvent(new Event('input', { bubbles: true })); return performance.now() - t0; }
"""
COUNT = """() => ({ songs: document.querySelectorAll('#results .row.song b').length, rows: document.querySelectorAll('#results .row').length, heads: [...document.querySelectorAll('#results h2.sec')].map(h => h.textContent) })"""
EXPECT = """
(q) => { q = q.toLowerCase(); return import('/src/data.js').then(d => { const un = d.unesc; const has = s => un(s).toLowerCase().includes(q);
  return { S: d.tracks.filter(t => has(t.title)).length, Ly: d.tracks.filter(t => t.lyric && has(t.lyric)).length, A: d.artists.filter(a => has(a)).length, L: d.albums.filter(a => has(a.title + ' ' + a.artist)).length }; }); }
"""
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    page = br.new_context(viewport={'width': 390, 'height': 844}).new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'status of 404' not in m.text else None)
    page.goto(URL); page.wait_for_selector('#main .tabbar, #tabs')
    info = page.evaluate(BUILD); print('library:', info)
    page.evaluate("__lf.go('search')"); page.wait_for_selector('#q')

    # 1. last word of a 60,000-char lyric
    page.evaluate(TYPE, 'zyxwvuendword'); page.wait_for_timeout(300)
    c = page.evaluate(COUNT)
    check(c['songs'] == 1 and 'Lyrics' in c['heads'], f'last word of a 60k-char lyric finds exactly that song: {c}')
    check(page.evaluate("document.querySelector('#results .row.song b')?.textContent") == 'Song 4200', 'it is Song 4200')

    # 2. heavy one-letter search: main-thread block per keystroke, and every match shows up in the end
    t_first = page.evaluate(TYPE, 'a'); 
    exp = page.evaluate(EXPECT, 'a'); total = exp['S'] + exp['Ly'] + exp['A'] + exp['L']
    last = -1
    for _ in range(100):
        page.wait_for_timeout(100); n = page.evaluate(COUNT)['rows']
        if n == last and n >= total: break
        last = n
    got = page.evaluate(COUNT)
    print('one-letter search: blocked the main thread for %.0f ms; rows=%d expected=%d (%s)' % (t_first, got['rows'], total, exp))
    check(got['rows'] == total, 'EVERY match is shown (no 200 cap)')
    check(len(got['heads']) == len(set(got['heads'])), 'no duplicated section headings')

    # 3. fast typing: stale slices must not leak into the final result
    for q in ['a', 'so', 'son', 'song', 'song 1']: page.evaluate(TYPE, q)   # 'a' starts 16k rows of slices; the later queries must cancel them
    exp = page.evaluate(EXPECT, 'song 1'); total = exp['S'] + exp['Ly'] + exp['A'] + exp['L']
    
    for _ in range(60):
        page.wait_for_timeout(100)
        if page.evaluate(COUNT)['rows'] >= total: break
    page.wait_for_timeout(500); got = page.evaluate(COUNT)
    check(total > 1000 and got['rows'] == total and len(got['heads']) == len(set(got['heads'])), f"fast typing ends with exactly the final query's results ({got['rows']} vs {total})")

    # 4. clear the box: recent searches / browse come back, no stale rows
    page.evaluate(TYPE, ''); page.wait_for_timeout(400)
    check(page.evaluate("document.querySelectorAll('#results .row.song').length") == 0 and page.evaluate("!!document.querySelector('#results .genre-grid')"), 'empty query shows Browse Library and no leftover rows')

    # 5. no match
    page.evaluate(TYPE, 'qqqzzzxxx'); page.wait_for_timeout(200)
    check('No results' in page.evaluate("document.querySelector('#results').textContent"), 'no-match message')

    # 6. keystroke cost on a long-lyric library (typing a normal word)
    ts = [page.evaluate(TYPE, q) for q in ['l', 'lo', 'lov', 'love', 'love ', 'love f', 'love fi', 'love fir', 'love fire']]
    print('keystroke main-thread ms:', [round(x) for x in ts])
    check(not errors, f'no JS errors {errors[:3]}')
    br.close()
print('FAILS:', fails); sys.exit(1 if fails else 0)
