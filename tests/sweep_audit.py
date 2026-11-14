import http.server, threading, pathlib, sys, time
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
src = open(ROOT / 'tests' / 'smoke.py').read(); exec(src[src.index('MAP = '):src.index("srv = http.server")])
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start(); URL = f'http://127.0.0.1:{port}/'
sys.path.insert(0, str(ROOT / 'tests')); import pw_helper; exe = pw_helper.chromium_exe()
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    page = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True).new_page(); ev = page.evaluate; errs = []
    page.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)[:200]))
    page.on('response', lambda r: errs.append('HTTP %s %s' % (r.status, r.url)) if r.status >= 400 else None)
    page.goto(URL); page.wait_for_selector('#tabs .tab'); time.sleep(0.6)
    ev("__lf.go('albums'); __lf.push('album','a5')"); page.wait_for_selector('#sub [data-act=\"playall\"]'); page.click('#sub [data-act=\"playall\"]'); time.sleep(0.5)
    for k in 'playlists favorites recentPlayed topPlayed mixAll albHome songs artists genres albumsAll homecustom homeset bgset animation lysize lyranim settings lstats lall'.split():
        try:
            ev("__lf.go('home')"); ev(f"__lf.push('{k}')"); time.sleep(0.5)
            for sc in ev("[...document.querySelectorAll('#sub .screen, #sub .screen *')].filter(e=>e.scrollWidth>e.clientWidth+2 && getComputedStyle(e).overflowX!=='auto' && getComputedStyle(e).overflowX!=='scroll' && e.clientWidth>0).slice(0,3).map(e=>e.className+' '+e.scrollWidth+'>'+e.clientWidth)"): errs.append(f'H-OVERFLOW {k}: {sc}')
        except Exception as e: errs.append(f'{k}: {str(e)[:120]}')
    ev("__lf.go('home')"); ev("__lf.openNP()"); time.sleep(0.8)
    for a in ('lyrics', 'queue', 'sleep', 'more', 'ab'):
        try:
            b = page.locator(f'#np [data-act="{a}"]').first
            if b.count(): b.click(); time.sleep(0.5); ev("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())"); ev("document.querySelector('#lyr')&&document.querySelector('#lyr').classList.remove('open')"); time.sleep(0.3)
        except Exception as e: errs.append(f'np {a}: {str(e)[:100]}')
    print('\n'.join(errs) or 'CLEAN'); br.close()
