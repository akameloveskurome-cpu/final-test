"""Blink probe: serves the app, fakes GitHub manifests, and counts how often the
notification / popup sheet is torn down and rebuilt while the app sits still.
Usage: python3 tests/blink_probe.py [seconds]"""
import http.server, threading, pathlib, sys, json, base64, re, os
GRANTED = os.environ.get('PROBE_GRANTED', '1') == '1'
UPDATE = os.environ.get('PROBE_UPDATE', '1') == '1'
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
SECS = int(sys.argv[1]) if len(sys.argv) > 1 else 6
GIF = (ROOT / "tests" / "fixtures" / "blink-probe.gif").read_bytes()
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
    page = ctx.new_page(); errs = []; fetches = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    reqlog = []
    def route(r):
        u = r.request.url
        reqlog.append(u.split('?')[0].split('/main/')[-1] + ' ' + str(len(reqlog)))
        if 'update/latest.json' in u and not UPDATE: return r.fulfill(status=404, body='nf')
        if 'update/latest.json' in u: return r.fulfill(status=200, content_type='application/json', body=json.dumps({"code": "bbbbbbbbbbbb", "vcode": 1500000100, "apk": "liquid-dark.apk", "sha256": "a"*64}))
        if 'update-popup-gif-pic/latest.json' in u: return r.fulfill(status=200, content_type='application/json', body=json.dumps({"name": "pic.gif", "stamp": "u1"}))
        if 'update-popup-gif-pic/pic.gif' in u: return r.fulfill(status=200, content_type='image/gif', body=GIF)
        if 'notification-popup-gif-pic/latest.json' in u: return r.fulfill(status=200, content_type='application/json', body=json.dumps({"name": "pic.gif", "stamp": "s1"}))
        if 'notification-popup-gif-pic/pic.gif' in u:
            fetches.append(round(0)); return r.fulfill(status=200, content_type='image/gif', body=GIF)
        return r.fulfill(status=404, body='nf')
    page.route(re.compile(r'https://(raw\.githubusercontent\.com|api\.github\.com)/.*'), route)
    page.goto(URL); page.wait_for_selector('#main .tabbar, #tabs', timeout=20000); page.wait_for_timeout(SECS * 1000)
    rebuilds = page.evaluate('window.__rebuilds')
    sheet = page.evaluate("document.getElementById('sheet').innerHTML.length")
    print(f"sheet rebuilds in {SECS}s: {len(rebuilds)}  times(ms): {rebuilds[:20]}")
    print("sheet open now:", sheet > 0, " popup image fetches:", len(fetches))
    print("box removals (sheetbox torn out):", page.evaluate('window.__removed || 0'))
    print("requests seen:", [x for x in reqlog if "update" in x or "popup" in x][:12])
    print("errors:", errs[:5])
    page.screenshot(path=str(pw_helper.out_dir() / 'probe.png'))   # BUG #42: out_dir() creates the folder and honours $LF_OUT
    br.close()
