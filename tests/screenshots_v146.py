"""Writes docs/screenshots/ (stats banner empty ... background-allow picture); run: npm run screenshots (second half). Needs: pip install playwright + a Chromium.
It serves src/ with a tiny server: '@capacitor/*' -> tests/stubs, `import './x.css'` -> empty module (the css is linked normally)."""
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
fails = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

import pw_helper; exe = pw_helper.chromium_exe()
import demo_pics
from PIL import Image, ImageDraw
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    pg = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2).new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('#tabs'); q = pg.evaluate; pg.wait_for_timeout(1200); demo_pics.seed(pg, URL)
    SH = ROOT / 'docs' / 'screenshots'; SH.mkdir(exist_ok=True)
    shot = lambda n, w=700: (pg.wait_for_timeout(w), pg.evaluate("document.activeElement && document.activeElement.blur && document.activeElement.blur()"), pg.screenshot(path=str(SH / (n + '.png'))))
    PICS = ROOT / 'tests' / 'out' / 'pics'; PICS.mkdir(parents=True, exist_ok=True)
    im = Image.new('RGB', (1200, 400)); d = ImageDraw.Draw(im)
    for x in range(1200): d.line([(x, 0), (x, 400)], fill=(250 - x // 8, 36 + x // 30, 60 + x // 10))
    d.ellipse([480, 90, 720, 330], fill=(255, 235, 220)); im.save(PICS / 'banner.png'); demo_pics.override_banner(PICS / 'banner.png')
    q("__lf.go('home')"); pg.wait_for_timeout(600)
    q("document.querySelector('#lf-statban').scrollIntoView({block:'center'})")
    check(q("document.querySelector('#lf-statban') !== null") and q("document.querySelector('#lf-statban img') === null"), 'v146: the stats banner box is there and empty without a picture')
    shot('stats-banner-empty', 500)
    import base64
    b64 = base64.b64encode((PICS / 'banner.png').read_bytes()).decode()
    pg.evaluate("(s) => __lf.banDemo(s)", 'data:image/png;base64,' + b64)
    pg.wait_for_selector('#lf-statban img'); shot('stats-banner-picture', 600)
    check(q("document.querySelectorAll('#lf-statban img').length") == 1, 'v146: one picture inside the stats banner')
    pg.evaluate("() => __lf.bgAllowDemo('')"); shot('background-allow-plain', 600)
    q("document.querySelector('#lf-bgallow').remove()")
    pg.evaluate("(s) => __lf.bgAllowDemo(s)", 'data:image/png;base64,' + b64); pg.wait_for_selector('#lf-bgallow .bgimg'); shot('background-allow-picture', 700)
    print('errors', errors); print('FAILS', fails)
    br.close()
sys.exit(1 if fails else 0)
