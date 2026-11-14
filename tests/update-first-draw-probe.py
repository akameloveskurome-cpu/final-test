"""Update first-draw probe: prints the timeline of the update popup first draw (picture wait) and saves a screenshot.
Usage: python3 tests/update-first-draw-probe.py [seconds]"""
import http.server, threading, pathlib, sys, json, base64, re, os
GRANTED = os.environ.get('PROBE_GRANTED', '1') == '1'
UPDATE = os.environ.get('PROBE_UPDATE', '1') == '1'
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
SECS = int(sys.argv[1]) if len(sys.argv) > 1 else 6
import io
from PIL import Image, ImageDraw
def mk(color, text):
    im = Image.new('RGB', (600, 340), color); d = ImageDraw.Draw(im); d.text((30, 140), text, fill='white'); d.rectangle((20,20,580,320), outline='white', width=6)
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
IMG1 = mk((200, 40, 90), 'PICTURE ONE  (uploaded first)'); IMG2 = mk((30, 110, 200), 'PICTURE TWO  (new upload)')
GIF = IMG1
MAP = {'/@capacitor/core': 'tests/stubs/capacitor-core.js', '/@capacitor/app': 'tests/stubs/capacitor-app.js'}
APP_STUB = b"export const App = { addListener: () => {}, minimizeApp: () => {}, getInfo: async () => ({ build: '1500000000', version: '0.208.0' }) };"
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/':
            html = (ROOT / 'index.html').read_text().replace('<script type="module"',
              '<script type="importmap">{"imports":{"@capacitor/core":"/@capacitor/core","@capacitor/app":"/@capacitor/app"}}</script>'
              '<link rel="stylesheet" href="/src/styles/tokens.css"><link rel="stylesheet" href="/src/styles/app.css">\n<script type="module"')
            return self._send(200, 'text/html', html.encode())
        if path == '/@capacitor/app': return self._send(200, 'text/javascript', APP_STUB)
        if path in MAP: return self._send(200, 'text/javascript', (ROOT / MAP[path]).read_bytes())
        f = ROOT / path.lstrip('/')
        if not f.is_file(): return self._send(404, 'text/plain', b'nf')
        if f.suffix == '.css': return self._send(200, 'text/css', f.read_bytes()) if self.headers.get('Sec-Fetch-Dest','') == 'style' else self._send(200, 'text/javascript', b'export default 1;')
        if f.suffix == '.json': return self._send(200, 'text/javascript', b'export default ' + f.read_bytes())
        if f.suffix == '.js':   # a bare browser has no import.meta.env: give it the same values the GitHub build sets
            src = f.read_text().replace('import.meta.env', '({VITE_REPO:"owner/liquid-dark",VITE_BRANCH:"main",VITE_CODE_ID:"aaaaaaaaaaaa"})')
            return self._send(200, 'text/javascript', src.encode())
        return self._send(200, 'application/octet-stream', f.read_bytes())
    def _send(self, code, ctype, body):
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/'
INIT = """
window.__rebuilds = []; window.__removed = 0; window.__t0 = performance.now();
const hook = () => { const s = document.getElementById('sheet'); if (!s || s.__hooked) return; s.__hooked = true;
  new MutationObserver(ms => { for (const m of ms) {
    if (m.addedNodes.length) window.__rebuilds.push(Math.round(performance.now() - window.__t0));
    for (const n of m.removedNodes) if (n.nodeType === 1 && n.classList && n.classList.contains('sheetbox')) window.__removed++;
  } }).observe(s, { childList: true });
};
new MutationObserver(hook).observe(document, { childList: true, subtree: true }); hook();
"""
NATIVE_INIT = '''
window.__NATIVE__ = true; const GRANTED_JS = %s;
window.__PLUGIN__ = new Proxy({}, { get: (t, k) => async (...a) => ({
  notificationStatus: { granted: GRANTED_JS }, canInstallUpdates: { allowed: true },
  getUpdateStatus: { status: 'downloading', pct: 40 }, downloadUpdate: {}, installDownloadedUpdate: {},
  readJson: null, writeJson: {}, getLaunch: {}, getLibrary: { tracks: [], folders: [] },
}[k] ?? {}) });
'''
NATIVE_INIT = NATIVE_INIT.replace('%s', 'true' if GRANTED else 'false')
import pw_helper; exe = pw_helper.chromium_exe()
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    if os.environ.get('PROBE_QUOTA') == '1': ctx.add_init_script("const _s=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){ if (String(k).startsWith('lf.popup')) throw new DOMException('quota','QuotaExceededError'); return _s.call(this,k,v); };")
    ctx.add_init_script(NATIVE_INIT)
    ctx.add_init_script(INIT)
    import time
    DELAY = float(os.environ.get('DELAY', '3'))
    page = ctx.new_page(); errs = []
    def route(r):
        u = r.request.url
        if 'update/latest.json' in u: return r.fulfill(status=200, content_type='application/json', body=json.dumps({"code": "bbbbbbbbbbbb", "vcode": 1500000100, "apk": "liquid-dark.apk", "sha256": "a"*64}))
        if 'update-popup-gif-pic/latest.json' in u: return r.fulfill(status=200, content_type='application/json', body=json.dumps({"name": "p1.png", "stamp": "s1"}))
        if 'update-popup-gif-pic/p1.png' in u:
            time.sleep(DELAY); return r.fulfill(status=200, content_type='image/png', body=IMG1)
        return r.fulfill(status=404, body='nf')
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.route(re.compile(r'https://(raw\.githubusercontent\.com|api\.github\.com)/.*'), route)
    page.add_init_script("""window.__log=[]; const t0=performance.now(); let last='';
setInterval(()=>{ const b=document.querySelector('#sheet .sheetbox[data-upd]'); const st=b?(b.querySelector('.popimg')?'box+picture':'box plain'):'no box'; if(st!==last){ last=st; window.__log.push([Math.round((performance.now()-t0)/100)/10, st]); } },50);""")
    page.goto(URL); page.wait_for_selector('#main .tabbar, #tabs', timeout=20000)
    page.wait_for_timeout(int((DELAY + 6) * 1000) if DELAY < 20 else 30000)
    log = page.evaluate('window.__log'); print(f'[delay {DELAY}s] timeline (seconds, state):', log, 'errors:', errs[:3])
    out = pw_helper.out_dir()
    if DELAY < 20: page.screenshot(path=str(out / 'update_box_after_picture_confirmed.png'))
    br.close()
