# Run: ROOT=<project dir> python3 tests/blink_card_check.py  (prints how often the notification card is torn out in 5 s)
"""Mechanism check: call the notification card every second with the SAME picture (same id), count rebuilds.
Run against the original tree (ROOT env) and the fixed tree."""
import os, sys, http.server, threading, pathlib, re
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(os.environ['ROOT'])
APP_STUB = b"export const App = { addListener: () => {}, minimizeApp: () => {}, getInfo: async () => ({ build: '1500000000', version: '0.208.0' }) };"
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/':
            html = (ROOT / 'index.html').read_text().replace('<script type="module"', '<script type="importmap">{"imports":{"@capacitor/core":"/@capacitor/core","@capacitor/app":"/@capacitor/app"}}</script><link rel="stylesheet" href="/src/styles/tokens.css"><link rel="stylesheet" href="/src/styles/app.css">\n<script type="module"')
            return self._send(200, 'text/html', html.encode())
        if path == '/@capacitor/core': return self._send(200, 'text/javascript', (ROOT / 'tests/stubs/capacitor-core.js').read_bytes())
        if path == '/@capacitor/app': return self._send(200, 'text/javascript', APP_STUB)
        f = ROOT / path.lstrip('/')
        if not f.is_file(): return self._send(404, 'text/plain', b'nf')
        if f.suffix == '.css': return self._send(200, 'text/css', f.read_bytes()) if self.headers.get('Sec-Fetch-Dest','') == 'style' else self._send(200, 'text/javascript', b'export default 1;')
        if f.suffix == '.json': return self._send(200, 'text/javascript', b'export default ' + f.read_bytes())
        if f.suffix == '.js': return self._send(200, 'text/javascript', f.read_text().replace('import.meta.env', '({VITE_REPO:"o/r",VITE_BRANCH:"main",VITE_CODE_ID:"aaaaaaaaaaaa"})').encode())
        return self._send(200, 'application/octet-stream', f.read_bytes())
    def _send(self, code, ctype, body):
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
import pw_helper; exe = pw_helper.chromium_exe()
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    page = br.new_context(viewport={'width': 390, 'height': 844}).new_page()
    page.goto(f'http://127.0.0.1:{port}/'); page.wait_for_selector('#main .tabbar, #tabs', timeout=20000)
    page.evaluate("""() => { window.__n = 0; new MutationObserver(ms => { for (const m of ms) for (const n of m.removedNodes) if (n.nodeType===1 && n.classList.contains('sheetbox')) window.__n++; }).observe(document.getElementById('sheet'), {childList:true}); }""")
    # the same picture (same id), a fresh blob URL each second, exactly like a poll that downloads it again
    page.evaluate("""() => { const gif = new Blob([new Uint8Array([71,73,70,56,57,97,1,0,1,0,0,0,0,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59])], {type:'image/gif'});
      window.__tick = setInterval(() => { const src = URL.createObjectURL(gif); window.__lf.notifSheet({ src, id: 'same.s1', stamp: 's1' }, false); }, 1000); }""")
    page.wait_for_timeout(5000)
    print(os.environ['ROOT'], '-> sheetbox rebuilt', page.evaluate('window.__n'), 'times in 5 s')
    br.close()
