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
SH = ROOT / 'docs' / 'screenshots'; SH.mkdir(exist_ok=True)
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    pg = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2).new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('#tabs'); q = pg.evaluate; pg.wait_for_timeout(1200); demo_pics.seed(pg, URL)
    shot = lambda n, w=700: (pg.wait_for_timeout(w), pg.evaluate("document.activeElement && document.activeElement.blur && document.activeElement.blur()"), pg.screenshot(path=str(SH / (n + '.png'))))
    def scene(name, fn):
        try:
            fn(); print('PASS', name)
        except Exception as e:
            print('FAIL', name, str(e)[:200]); fails.append(name)
    def s50():  # v148: Listening Stats (the hour chart, the Today / week / month view)
        q("__lf.go('home')"); pg.wait_for_timeout(400); q("__lf.push('lstats')"); shot('listening-stats', 1000)
    def s51():  # v148: lyrics text size is a free slider
        q("__lf.go('home')"); pg.wait_for_timeout(400); q("__lf.push('lysize')"); shot('lyrics-size-slider')
    def s52():  # v148: Genres (the chips, one per genre)
        q("__lf.go('home')"); pg.wait_for_timeout(400); q("__lf.push('genres')"); shot('genres')
    def s53():  # v148: playlists list
        q("__lf.go('home')"); pg.wait_for_timeout(400); q("__lf.push('playlists')"); shot('playlists')
    def s54():  # v148: custom sleep timer (type 1:30 or 90)
        q("__lf.go('home')"); pg.wait_for_timeout(400); q("__lf.go('albums'); __lf.push('album','a5')"); pg.wait_for_selector('#sub [data-act="playall"]'); pg.click('#sub [data-act="playall"]'); q("__lf.openNP()"); pg.wait_for_timeout(800)
        pg.click('#np [data-act="sleep"]'); pg.wait_for_selector('#slcustom'); pg.fill('#slcustom', '1:30'); shot('sleep-custom', 400)
    def s55():  # Immersive album cover (Settings > Immersive album cover) on Now Playing
        q("document.querySelector('#sheet').innerHTML = ''"); q("document.querySelectorAll('#np, #lyr').forEach(e => e.classList.remove('open'))"); pg.wait_for_timeout(400)
        q("__lf.go('home')"); pg.wait_for_timeout(300); q("__lf.push('settings')"); pg.wait_for_timeout(500)
        q("document.querySelector('[data-k=\"npImmersive\"]').click()"); pg.wait_for_timeout(400)
        q("__lf.go('albums'); __lf.push('album','a5')"); pg.wait_for_timeout(600)
        q("document.querySelector('#sub [data-act=\"playall\"]').click()"); pg.wait_for_timeout(600)
        q("__lf.openNP()"); shot('immersive-cover', 1200)
        q("document.querySelector('#np [data-act=close-np]').click()"); pg.wait_for_timeout(400)
        q("__lf.go('home')"); pg.wait_for_timeout(300); q("__lf.push('settings')"); pg.wait_for_timeout(400)
        q("document.querySelector('[data-k=\"npImmersive\"]').click()"); pg.wait_for_timeout(300)
    def s56():  # Listening Snapshot (share picture): the stats screen's snapshot button
        q("document.querySelector('#sheet').innerHTML = ''"); q("document.querySelectorAll('#np, #lyr').forEach(e => e.classList.remove('open'))"); pg.wait_for_timeout(400)
        q("__lf.go('home')"); pg.wait_for_timeout(400); q("__lf.push('lstats')"); pg.wait_for_timeout(900)
        q("document.querySelector('.lssnap').click()"); shot('listening-snapshot', 1200)
    def R():  # clean start for each scene: no sheet, no open Now Playing / lyrics, Home tab
        q("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())"); q("document.querySelector('#sheet').innerHTML = ''")
        q("document.querySelectorAll('#np, #lyr').forEach(e => e.classList.remove('open'))"); q("__lf.go('home')"); pg.wait_for_timeout(500)
    def lstats_range(name, label, n):
        def f():
            R(); q("__lf.push('lstats')"); pg.wait_for_timeout(700)
            if label != 'Daily': pg.get_by_text(label, exact=True).first.click(); pg.wait_for_timeout(500)
            shot(n, 600)
        return f
    def s57(): lstats_range('d', 'Daily', 'listening-stats-daily')()
    def s58(): lstats_range('w', 'Weekly', 'listening-stats-weekly')()
    def s59(): lstats_range('m', 'Monthly', 'listening-stats-monthly')()
    def s60(): lstats_range('y', 'Yearly', 'listening-stats-yearly')()
    def s61(): lstats_range('o', 'Overall', 'listening-stats-overall')()
    def s62():  # Listening Snapshot: the share picture is drawn and shown in a sheet
        R(); q("__lf.push('lstats')"); pg.wait_for_timeout(700); q("document.querySelector('.lssnap').click()"); pg.wait_for_timeout(2500); shot('listening-snapshot', 600)
    def s63():  # Lyrics colour picker (Now Playing > ... > Lyrics colour), needs the cover lyrics background
        R(); q("__lf.push('settings')"); pg.wait_for_timeout(500); q("document.querySelector('[data-act=\"lyricstyle\"]').click()"); pg.wait_for_selector('#sheet [data-v=\"cover\"]'); q("document.querySelector('#sheet [data-v=cover]').click()"); pg.wait_for_timeout(300)
        R(); q("__lf.go('albums'); __lf.push('album','a5')"); pg.wait_for_timeout(600); q("document.querySelector('#sub [data-act=\"playall\"]').click()"); pg.wait_for_timeout(500); q("__lf.openNP()"); pg.wait_for_timeout(800)
        q("document.querySelector('#np [data-act=\"trackmenu\"]').click()"); pg.wait_for_selector('#sheet [data-act=\"tm-lycol\"]'); q("document.querySelector('#sheet [data-act=\"tm-lycol\"]').click()"); pg.wait_for_selector('#sheet .lycrow'); shot('lyrics-colour-picker', 600)
        R(); q("__lf.push('settings')"); pg.wait_for_timeout(500); q("document.querySelector('[data-act=\"lyricstyle\"]').click()"); pg.wait_for_selector('#sheet [data-v=\"classic\"]'); q("document.querySelector('#sheet [data-v=classic]').click()"); pg.wait_for_timeout(300)
    def plain(name, screen, n, js=None):
        def f():
            R(); q(f"__lf.push('{screen}')" if js is None else js); pg.wait_for_timeout(800); shot(n, 500)
        return f
    def s64(): plain('songs', 'songs', 'songs')()
    def s65(): plain('top', 'topPlayed', 'top-played')()
    def s66(): plain('recent', 'recentPlayed', 'recent-played')()
    def s67(): plain('artists', 'artists', 'artists')()
    def s68(): plain('albumsAll', 'albumsAll', 'albums-all')()
    def s69(): plain('homecustom', 'homecustom', 'home-customise')()
    def s70(): plain('playlists', 'playlists', 'playlists-screen')()
    def s71():  # Settings > Bluetooth / earphones
        R(); q("__lf.push('settings')"); pg.wait_for_timeout(500); q("document.querySelector('[data-act=\"btopen\"]').click()"); pg.wait_for_timeout(900); shot('bluetooth', 400)
        q("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())")
    def s72():  # Settings > Equalizer
        R(); q("__lf.push('settings')"); pg.wait_for_timeout(500); q("document.querySelector('[data-act=\"eqopen\"]').click()"); pg.wait_for_timeout(900); shot('equalizer', 400)
        q("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())")
    def s73():  # Settings > add a widget
        R(); q("__lf.push('settings')"); pg.wait_for_timeout(500); q("document.querySelector('[data-act=\"addwidget\"]').click()"); pg.wait_for_timeout(900); shot('add-widget', 400)
        q("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())")
    def s74():  # Settings > Home screen > Background picture (empty, no picture chosen)
        R(); q("__lf.push('bgset')"); pg.wait_for_timeout(800); shot('background-settings-empty', 400)

    for n, f in [(n, globals()['s' + n]) for n in ['51','52','53','54','55','57','58','59','60','61','62','63','64','65','66','67','68','69','70','71','72','73','74']]:
        scene(n, f)
    print('errors', errors); print('FAILS', fails)
    br.close()
sys.exit(1 if fails else 0)
