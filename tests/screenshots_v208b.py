"""A few README screenshots (docs/screenshots/*.png) using the dummy-data pictures in tests/fixtures/demo-pics/p1-p6.jpg.
Same demo setup as record_v208.py (Oshi no Ko themed names), 2x. Run from the project root: python3 tests/screenshots_v208b.py"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from rec_common import *
SH = ROOT / 'docs' / 'screenshots'; SH.mkdir(parents=True, exist_ok=True)
fails = []
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    ctx, pg, errors = new_page(br)
    q = pg.evaluate
    def shot(n, w=900): pg.wait_for_timeout(w); pg.evaluate("document.activeElement && document.activeElement.blur && document.activeElement.blur()"); pg.screenshot(path=str(SH / (n + '.png'))); print('wrote', n)
    def scene(n, f):
        try: R(pg); f()
        except Exception as e: print('FAIL', n, str(e)[:200]); fails.append(n)
    scene('home', lambda: shot('home', 1200))
    def s02(): q("__lf.go('albums')"); shot('albums', 1200)
    scene('albums', s02)
    def s06(): play_album(pg, 'a1'); q("__lf.openNP()"); shot('now-playing', 1500)
    scene('now-playing', s06)
    def s18():
        q("__lf.push('settings')"); pg.wait_for_timeout(600); q("document.querySelector('[data-act=\"lyricstyle\"]').click()"); pg.wait_for_selector('#sheet [data-v="classic"]')
        q("document.querySelector('#sheet [data-v=classic]').click()"); pg.wait_for_timeout(600); q("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())"); q("document.querySelector('#sheet').innerHTML = ''"); q("__lf.go('home')"); pg.wait_for_timeout(400)
        q("__lf.go('albums'); __lf.push('album','a5')"); pg.wait_for_timeout(700); play_album(pg, 'a5'); q("__lf.openNP()"); pg.wait_for_timeout(800)
        q("document.querySelector('#np [data-act=\"lyrics\"]').click()"); pg.wait_for_timeout(1200)
        q("document.querySelector('#lyrbody [data-li=\"2\"]').click()"); shot('lyrics', 1800)
    scene('lyrics', s18)
    def s55():
        q("__lf.push('settings')"); pg.wait_for_timeout(700); q("document.querySelector('[data-k=\"npImmersive\"]').click()"); pg.wait_for_timeout(500)
        q("__lf.go('home')"); pg.wait_for_timeout(400); play_album(pg, 'a1'); q("__lf.openNP()"); shot('immersive-cover', 2000)
    scene('immersive-cover', s55)
    def s67(): q("__lf.push('artists')"); shot('artists', 1200)
    scene('artists', s67)
    print('errors', errors, 'FAILS', fails)
    br.close()
sys.exit(1 if fails else 0)
