"""Random-click ("monkey") test: taps random buttons / rows for N steps and reports any JS error.
Run: SEED=1 N=400 python3 tests/monkey.py
Same server + demo library as smoke.py (needs: pip install playwright + a Chromium).
v42: seeds 1-4, 250-400 clicks each = 0 errors."""
import http.server, threading, pathlib, json, sys, os
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'tests' / 'out'; OUT.mkdir(exist_ok=True)
MAP = {'/@capacitor/core': 'tests/stubs/capacitor-core.js', '/@capacitor/app': 'tests/stubs/capacitor-app.js'}

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        path = self.path.split('?')[0]
        dest = self.headers.get('Sec-Fetch-Dest', '')
        if path == '/':
            html = (ROOT / 'index.html').read_text().replace('<script type="module"',
                '<script type="importmap">{"imports":{"@capacitor/core":"/@capacitor/core","@capacitor/app":"/@capacitor/app"}}</script>'
                '<link rel="stylesheet" href="/src/styles/tokens.css"><link rel="stylesheet" href="/src/styles/app.css">\n<script type="module"')
            return self._send(200, 'text/html', html.encode())
        if path in MAP: return self._send(200, 'text/javascript', (ROOT / MAP[path]).read_bytes())
        f = ROOT / path.lstrip('/')
        if not f.is_file(): return self._send(404, 'text/plain', b'nf')
        if f.suffix == '.css': return self._send(200, 'text/css', f.read_bytes()) if dest == 'style' else self._send(200, 'text/javascript', b'export default 1;')
        if f.suffix == '.json': return self._send(200, 'text/javascript', b'export default ' + f.read_bytes())   # main.js imports package.json (Vite does this natively, a bare browser cannot)
        return self._send(200, 'text/javascript' if f.suffix == '.js' else 'application/octet-stream', f.read_bytes())
    def _send(self, code, ctype, body):
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/'
import pw_helper; exe = pw_helper.chromium_exe()
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    page = ctx.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'status of 404' not in m.text else None)   # 404 = favicon; real 404s are caught by the response hook below
    page.on('response', lambda r: errors.append(f'{r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else None)
    page.goto(URL); page.wait_for_selector('#main .tabbar, #tabs')
    ev = page.evaluate
    ids = lambda: ev("__lf.Native.state.queue.map(t=>t.id)")
    upcoming_titles = lambda: ev("(()=>{const s=__lf.Native.state;return s.queue.slice(s.index+1).map(t=>t.title)})()")
    sheet_titles = lambda: ev("[...document.querySelectorAll('#sheet .qlist .row.song b')].map(b=>b.textContent)")


    import random
    random.seed(int(os.environ.get("SEED", "1")))
    errs = []
    page.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)[:300]))
    page.on("console", lambda m: errs.append("CONSOLE " + m.text[:300]) if m.type == "error" else None)
    page.on("dialog", lambda d: d.dismiss())
    page.reload(); page.wait_for_timeout(500)
    seen = {}
    for i in range(int(os.environ.get("N", "250"))):
        els = page.query_selector_all("[data-act]:visible, .row:visible, .tab:visible, #tabs button:visible")
        if not els: page.keyboard.press("Escape"); continue
        e = random.choice(els)
        try:
            act = e.get_attribute("data-act") or e.get_attribute("class")
            seen[act] = seen.get(act, 0) + 1
            before = len(errs)
            e.click(timeout=1500, force=True)
            page.wait_for_timeout(60)
            if len(errs) > before: print("ERR after click", act, "->", errs[before:]);
        except Exception as ex:
            pass
        if random.random() < 0.05: page.keyboard.press("Escape")
    print("clicked kinds:", len(seen)); print("TOTAL ERRORS", len(errs), "PAGE/HTTP ERRORS (whole run, incl. first load)", len(errors))
    for x in errs[:15]: print(x)
    for x in errors[:15]: print("PAGE/HTTP " + x)
    sys.exit(1 if (errs or errors) else 0)   # BUG-440: page errors fail the run; BUG #43: so do page/console/HTTP>=400 errors seen from the first load on
