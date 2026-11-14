"""Writes docs/screenshots/*.png from the demo library (npm run screenshots runs this and screenshots_v146.py, which writes the stats-banner and background-allow ones). Same tiny server as smoke.py.
Chromium smoke test of the real UI (browser mock player, demo library). Needs: pip install playwright + a Chromium.
Run from the project root:  python3 tests/screenshots.py   (saves screenshots to docs/screenshots/)
It serves src/ with a tiny server: '@capacitor/*' -> tests/stubs, `import './x.css'` -> empty module (the css is linked normally)."""
import http.server, threading, pathlib, json, sys, os
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
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
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    page = ctx.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'status of 404' not in m.text else None)   # 404 = favicon; real 404s are caught by the response hook below
    page.on('response', lambda r: errors.append(f'{r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else None)
    page.goto(URL); page.wait_for_selector('#main .tabbar, #tabs')
    ev = page.evaluate
    SH = ROOT / 'docs' / 'screenshots'; SH.mkdir(exist_ok=True)
    for f in SH.glob('*.png'): f.unlink()
    pg = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2).new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('#tabs'); q = pg.evaluate; pg.wait_for_timeout(1200); demo_pics.seed(pg, URL); pg.wait_for_timeout(300)
    # v104: the demo songs only carry one lyric line, which makes the lyrics pages look empty. For the pictures only, give them a short synced verse (the app code is not touched).
    VERSES = {
        't10': ['Red tail lamps along the avenue', 'Every window hums a quiet tune', 'We were chasing the last of the light', 'Somewhere past the edge of the moon', 'Hold the line, let the engine sing', 'Hold the line, we are almost home', 'Turn it up till the city blurs', 'Red tail lamps and the radio low'],
        't1': ['Tidewater, carry us home', 'Silver on the water tonight', 'Every wave a lantern in the dark', 'Tidewater, carry us home', 'Slow the tide and stay a while', 'We will find the shore by the light'],
        't4': ['Tidewater, carry us home', 'North bound on an empty road', 'Streetlamps counting down the miles', 'Tidewater, carry us home', 'The morning is a window, wide open', 'Keep driving, keep the dawn in sight'],
        't15': ['Windows down and the radio low', 'Warm air moving through the hair', 'Every mile a softer promise', 'Golden hour on the hood', 'Sing it loud, nobody knows', 'Windows down and the radio low'],
        't20': ['I keep your number in the static', 'Dial tone humming through the night', 'Paper bound and out of range', 'I keep your number in the static', 'Say my name across the wire', 'We could still be in tune'],
    }
    lrc = lambda lines: chr(10).join('[%02d:%02d.00]%s' % (i * 5 // 60, i * 5 % 60, ln) for i, ln in enumerate(lines))
    pg.evaluate("([v]) => import('/src/data.js').then(m => m.tracks.forEach(t => { if (v[t.id]) t.lyric = v[t.id]; }))", [{k: lrc(v) for k, v in VERSES.items()}])
    def lit(n=3):   # tap a lyric line: it becomes the current (highlighted) one and the page scrolls to it
        pg.wait_for_selector('#lyrbody .ln'); pg.wait_for_timeout(500)
        pg.click(f'#lyrbody [data-li="{n}"]'); pg.wait_for_timeout(900)
    shot = lambda n, w=700: (pg.wait_for_timeout(w), pg.evaluate("document.activeElement && document.activeElement.blur && document.activeElement.blur()"), pg.screenshot(path=str(SH / (n + '.png'))))
    shot('home')
    q("__lf.go('albums')"); shot('albums')
    q("__lf.push('album','a5')"); pg.wait_for_selector('#sub [data-act="playall"]'); shot('album')
    q("__lf.go('library')"); shot('library')
    q("__lf.go('search')"); q("__lf.setQuery('red')"); shot('search')
    q("__lf.go('albums'); __lf.push('album','a5')"); pg.wait_for_selector('#sub [data-act="playall"]'); pg.click('#sub [data-act="playall"]'); q("__lf.openNP()"); shot('now-playing', 1200)
    pg.click('#np [data-act="lyrics"]'); lit(); shot('lyrics', 900); pg.click('#lyr [data-act="lyr-close"]'); pg.wait_for_timeout(300)
    pg.click('#np .art'); pg.wait_for_selector('#cvv'); shot('cover-viewer'); pg.wait_for_timeout(400); pg.click('#cvv'); pg.wait_for_timeout(200)
    pg.click('#np [data-act="queue"]'); pg.wait_for_selector('#sheet .qlist'); shot('up-next'); q("document.querySelector('#sheet .scrim').click()"); pg.wait_for_timeout(300)
    pg.click('#np [data-act="sleep"]'); pg.wait_for_selector('#sheet [data-act="sl-min"]'); shot('sleep-timer'); pg.click('#sheet [data-min="30"]'); pg.wait_for_selector('#np .sleeppill'); shot('sleep-running', 900)
    pg.click('#np [data-act="trackmenu"]'); pg.wait_for_selector('#sheet [data-act="tm-info"]'); shot('track-menu'); pg.click('#sheet [data-act="tm-info"]'); pg.wait_for_timeout(600); shot('song-info', 900)
    q("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())"); pg.wait_for_timeout(300)
    pg.click('#np [data-act="fav"]'); pg.wait_for_timeout(400)
    q("document.querySelector('#np [data-act=close-np]').click()"); pg.wait_for_timeout(600)
    q("__lf.go('library'); __lf.push('favorites')"); shot('favorites')
    q("__lf.push('settings')"); shot('settings')
    pg.mouse.move(195, 400); pg.mouse.wheel(0, 650); shot('settings-more')
    q("document.querySelector('.lf-credit-box').scrollIntoView({block:'center'})"); shot('credits')   # v146: Settings > About > Credits (plain box until a picture is uploaded)
    q("__lf.push('animation')"); shot('animation-studio')
    q("document.querySelector('#sub [data-act=back]').click()"); pg.wait_for_timeout(500)
    q("document.querySelector('#sub .screen').scrollTop = 150"); pg.wait_for_timeout(300)
    q("document.querySelector('[data-act=lyricstyle]').click()"); pg.wait_for_selector('#sheet [data-v="cover"]'); shot('background-style', 500); q("document.querySelector('#sheet [data-v=cover]').click()"); pg.wait_for_timeout(300); q("__lf.Native.cancelSleepTimer()"); pg.wait_for_timeout(600); q("__lf.openNP()"); shot('now-playing-cover', 1500)
    pg.click('#np [data-act="lyrics"]'); lit(); shot('lyrics-cover', 900)
    # v93: the same page on other album covers (each album's cover colour becomes the lyrics background)
    for name, aid in (('lyrics-blue', 'a1'), ('lyrics-green', 'a2'), ('lyrics-orange', 'a6'), ('lyrics-amber', 'a8')):
        q("document.querySelector('#lyr [data-act=lyr-close]').click()"); pg.wait_for_timeout(400)
        q("document.querySelector('#np [data-act=close-np]').click()"); pg.wait_for_timeout(600)
        q(f"__lf.go('albums'); __lf.push('album','{aid}')"); pg.wait_for_selector('#sub [data-act="playall"]'); pg.click('#sub [data-act="playall"]'); q("__lf.openNP()"); pg.wait_for_timeout(800)
        pg.click('#np [data-act="lyrics"]'); lit(); shot(name, 900)
    # v102: the library scan card (src/scanview.js), driven with a fake progress event (the browser demo has no real folder scan)
    q("document.querySelector('#lyr [data-act=lyr-close]').click()"); pg.wait_for_timeout(400)
    q("document.querySelector('#np [data-act=close-np]').click()"); pg.wait_for_timeout(600)
    q("__lf.go('home')"); pg.wait_for_timeout(500)
    # v104: the two popups (src/main.js notifSheet / updSheet, same markup the phone uses). The picture is a stand-in drawn here; on the phone it is the one in notification-popup-gif-pic/.
    pic = pg.evaluate("""() => { const c = document.createElement('canvas'); c.width = c.height = 720; const x = c.getContext('2d');
      const r = (a, b, w, h, k) => { x.beginPath(); x.roundRect(a, b, w, h, k); };
      r(0, 0, 720, 720, 120); x.fillStyle = '#0b0b0d'; x.fill();
      const g = x.createRadialGradient(360, 330, 20, 360, 330, 360); g.addColorStop(0, 'rgba(250,36,60,.85)'); g.addColorStop(.55, 'rgba(250,36,60,.25)'); g.addColorStop(1, 'rgba(250,36,60,0)');
      x.fillStyle = g; x.fillRect(0, 0, 720, 720);
      r(150, 150, 420, 420, 110); x.fillStyle = 'rgba(255,255,255,.08)'; x.fill(); x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,.35)'; x.stroke();
      x.fillStyle = '#FA243C'; x.beginPath(); x.ellipse(325, 470, 52, 40, -0.35, 0, 7); x.fill(); x.fillRect(360, 230, 28, 235);
      x.beginPath(); x.moveTo(388, 230); x.quadraticCurveTo(470, 260, 465, 360); x.quadraticCurveTo(440, 300, 388, 300); x.fill();
      return c.toDataURL('image/png'); }""")
    pic = demo_pics.data_url('notif.jpg')
    pg.evaluate("([src]) => { __lf.notifSheet({ src }, true); const el = document.querySelector('#sheet .popimg'); const go = () => { el.style.setProperty('--ar', 1); el.style.setProperty('--nw', 720); el.dataset.ready = '1'; }; if (el.complete) go(); else el.onload = go; }", [pic])
    shot('popup-notifications', 900)
    q("document.querySelector('#sheet').innerHTML = ''"); pg.wait_for_timeout(300)
    q("__lf.updSheet()"); shot('update-available', 700)
    q("document.querySelector('#sheet').innerHTML = ''"); pg.wait_for_timeout(300)
    pg.evaluate("import('/src/scanview.js').then(m => { m.scanView.start(); m.scanView.update({ done: 2310, total: 4310, phase: 'read', found: 4310, name: 'Red Engine', cover: '' }); })")
    shot('scan', 1800)
    # v120: the screens added in v119 (Home settings, See All, your own Home section, lyrics animation, Now Playing cover size)
    q("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())"); pg.wait_for_timeout(300)
    pg.evaluate("import('/src/scanview.js').then(m => m.scanView.hide())"); pg.wait_for_timeout(400)
    q("__lf.go('home')"); pg.wait_for_timeout(500)
    q("__lf.push('homeset')"); pg.wait_for_timeout(600); shot('home-settings')
    q("document.querySelector('#sub .screen').scrollTop = 700"); pg.wait_for_timeout(300); shot('home-sections', 400)
    q("__lf.go('home')"); pg.wait_for_timeout(400)
    q("__lf.push('mixAll', 'daily')"); pg.wait_for_timeout(600); shot('see-all-mix')
    q("__lf.go('home')"); pg.wait_for_timeout(400)
    q("__lf.push('albHome', 'added')"); pg.wait_for_timeout(600); shot('see-all-albums')
    q("__lf.go('home')"); pg.wait_for_timeout(400)
    q("__lf.push('homeset')"); pg.wait_for_timeout(500)
    pg.fill('#hscnew', 'Night drive'); pg.click('[data-act="hs-cnew"]'); pg.wait_for_timeout(3600)
    shot('home-own-section')
    q("__lf.go('home')"); pg.wait_for_timeout(400)
    q("__lf.push('lyranim')"); pg.wait_for_timeout(600); shot('lyrics-animation')
    q("__lf.go('home')"); pg.wait_for_timeout(400)
    q("__lf.push('settings')"); pg.wait_for_timeout(500)
    q("document.querySelector('[data-npnum]').scrollIntoView({block:'center'})"); pg.wait_for_timeout(400); shot('cover-size')
    # v132: pictures and GIFs in a playlist (any size). Sample files are made here: a moving GIF, a very large PNG (4096 x 3072) and a small tall JPEG.
    from PIL import Image, ImageDraw
    PICS = ROOT / 'tests' / 'out' / 'pics'; PICS.mkdir(parents=True, exist_ok=True)
    frames = []
    for k in range(12):
        im = Image.new('RGB', (480, 480)); d = ImageDraw.Draw(im)
        for y in range(480): d.line([(0, y), (480, y)], fill=(200 - y // 4, 20 + y // 8, 60 + y // 3))
        x = 60 + k * 30; d.ellipse([x - 55, 190, x + 55, 300], fill=(255, 235, 200)); frames.append(im)
    frames[0].save(PICS / 'night-drive.gif', save_all=True, append_images=frames[1:], duration=90, loop=0)
    big = Image.new('RGB', (4096, 3072)); bd = ImageDraw.Draw(big)
    for y in range(0, 3072, 8): bd.rectangle([0, y, 4096, y + 8], fill=(20 + y // 16, 40 + y // 24, 120 + y // 20))
    bd.ellipse([1300, 700, 2800, 2200], fill=(255, 120, 90)); big.save(PICS / 'sunset-4096x3072.png')
    tall = Image.new('RGB', (360, 900)); td = ImageDraw.Draw(tall)
    for y in range(900): td.line([(0, y), (360, y)], fill=(30 + y // 6, 160 - y // 10, 200 - y // 8))
    tall.save(PICS / 'tall-poster.jpg', quality=90); demo_pics.override_samples(PICS)
    q("__lf.go('home')"); pg.wait_for_timeout(400)
    q("__lf.push('playlist','p3')"); pg.wait_for_selector('#sub [data-act=\"plmenu\"]'); pg.wait_for_timeout(500)
    pg.click('#sub [data-act=\"plmenu\"]'); pg.wait_for_selector('#sheet [data-act=\"pp-edit\"]'); shot('playlist-menu')
    pg.click('#sheet [data-act=\"pp-edit\"]'); pg.wait_for_selector('#sheet [data-act=\"pp-add\"]'); shot('playlist-picture-sheet')   # v145c: ONE picture per playlist, chosen in one simple sheet
    with pg.expect_file_chooser() as fc: pg.click('#sheet [data-act=\"pp-add\"]')
    fc.value.set_files([str(PICS / 'night-drive.gif')])
    pg.wait_for_selector('#sub .detail-art img'); pg.wait_for_timeout(900); shot('playlist-pictures', 900)
    check(q("document.querySelector('#sub .detail-art img') !== null"), 'v145c: the chosen picture is the playlist cover')
    # v132: the update popup with a picture / GIF from update-popup-gif-pic/ (here the sample GIF; in the app it is fetched from GitHub)
    q("document.querySelector('#sheet').innerHTML = ''"); pg.wait_for_timeout(300)
    q("__lf.updSheet()"); q("__lf.updPicSet('/tests/out/pics/night-drive.gif')"); pg.wait_for_selector('#sheet .popimg[data-ready]'); shot('update-popup-picture', 900)
    check(q("document.querySelector('#sheet .sheetbox').classList.contains('updcard')"), 'v132: the update popup shows the picture card')
    q("document.querySelector('#sheet').innerHTML = ''"); pg.wait_for_timeout(200)
    # v134: your own background picture / GIF (Settings > Home > Background picture or GIF). A dusk picture of an odd size (2400 x 1350) is chosen; it must show on Home, Library, Albums, an album and Settings.
    bgp = PICS / 'dusk-2400x1350.jpg'; bg = Image.new('RGB', (2400, 1350)); bgd = ImageDraw.Draw(bg)
    for y in range(1350): bgd.line([(0, y), (2400, y)], fill=(40 + y // 14, 30 + y // 40, 110 + y // 9 if y < 700 else 190 - (y - 700) // 6))
    bgd.ellipse([1500, 380, 2000, 880], fill=(255, 170, 110)); bgd.ellipse([-300, 900, 1400, 1700], fill=(30, 20, 70)); bgd.ellipse([900, 1000, 2700, 1800], fill=(60, 30, 90)); bg.save(bgp, quality=90); demo_pics.override_bg(bgp)
    q("__lf.go('home')"); pg.wait_for_timeout(300); q("__lf.push('settings')"); pg.wait_for_selector('#sub [data-act=\"bgopen\"]'); q("document.querySelector('#sub [data-act=\"bgopen\"]').click()"); pg.wait_for_selector('#sub [data-act=\"bgpick\"]')
    with pg.expect_file_chooser() as fc: pg.click('#sub [data-act=\"bgpick\"]')
    fc.value.set_files(str(bgp)); pg.wait_for_selector('html[data-bg=\"1\"]'); pg.wait_for_selector('#sub .bgprev'); pg.wait_for_timeout(600); shot('background-settings', 500)
    check(q("document.documentElement.dataset.bg") == '1', 'v134: a picture is set as the background')
    q("__lf.go('home')"); pg.wait_for_timeout(700); shot('background-home', 600)
    q("document.querySelector('[data-tab=\"library\"]').click()"); pg.wait_for_timeout(600); shot('background-library', 600)
    q("document.querySelector('[data-tab=\"albums\"]').click()"); pg.wait_for_timeout(600); shot('background-albums', 600)
    for sel, name in [('#app', 'app'), ('#main', 'main')]:
        check(q(f"getComputedStyle(document.querySelector('{sel}')).backgroundImage.includes('blob:')" if name == 'app' else "getComputedStyle(document.querySelector('#main')).backgroundColor") in (True, 'rgba(0, 0, 0, 0)'), f'v134: {name} shows the picture (pages are see-through)')
    q("document.querySelector('[data-tab=\"home\"]').click()"); pg.wait_for_timeout(300)
    q("__lf.push('settings')"); pg.wait_for_selector('#sub [data-act=\"bgopen\"]'); q("document.querySelector('#sub [data-act=\"bgopen\"]').click()"); pg.wait_for_selector('#sub [data-act=\"bgrm\"]'); q("document.querySelector('#sub [data-act=\"bgrm\"]').click()"); pg.wait_for_timeout(300)
    check(q("document.documentElement.dataset.bg") is None, 'v134: removing the background puts the plain black back')
    q("__lf.go('home')"); pg.wait_for_timeout(300)
    # v136: the artist screen button and the sheet say "photo or GIF" (screenshots 44 and 45)
    pg.evaluate("import('/src/data.js').then(m => __lf.push('artist', m.artists.find(a => !/&/.test(a))))"); pg.wait_for_selector('#sub [data-act="apic-edit"]'); shot('artist-photo-or-gif')
    pg.click('#sub [data-act="apic-edit"]'); shot('artist-photo-sheet', 800)
    print('errors', errors)

    br.close()
    sys.exit(1 if (fails or errors) else 0)   # BUG-439: a FAIL or a page error fails the run
