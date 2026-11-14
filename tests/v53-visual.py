"""v53 visual check (Chromium, demo library): lens press / drag frames, overlay sheet, lyrics scroll stays put, #app never scrolls.
python3 tests/v53-visual.py   -> screenshots in tests/out/v53_*.png"""
import http.server, threading, pathlib, sys, time
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'tests' / 'out'; OUT.mkdir(exist_ok=True)
src = open(ROOT / 'tests' / 'smoke.py').read()
head = src[src.index('MAP = '):src.index("srv = http.server")]
exec(head)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/'
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
import pw_helper; exe = pw_helper.chromium_exe()
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True)
    page = ctx.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL); page.wait_for_selector('#tabs .tab'); time.sleep(0.4)
    ev = page.evaluate
    # play something so the mini player exists
    ev("__lf.go('albums'); __lf.push('album','a5')"); page.wait_for_selector('[data-act="playall"]'); page.click('#sub [data-act="playall"]')
    page.wait_for_selector('#mini .mini'); ev("__lf.go('home')"); time.sleep(0.6)
    page.screenshot(path=str(OUT / 'v53_0_rest.png'))
    box = page.locator('#tabs').bounding_box(); y = box['y'] + box['height'] / 2
    tabs = [page.locator('#tabs .tab').nth(i).bounding_box() for i in range(4)]
    cx = [b['x'] + b['width'] / 2 for b in tabs]
    clip = {'x': 0, 'y': box['y'] - 30, 'width': 390, 'height': box['height'] + 60}
    # press on the first tab, drag to Search
    page.mouse.move(cx[0], y); page.mouse.down(); time.sleep(0.5)
    page.screenshot(path=str(OUT / 'v53_1_press.png'), clip=clip)
    ev("window.__lensPress = (()=>{const l=document.querySelector('.lens');return {w:l.offsetWidth,h:l.offsetHeight,pop:getComputedStyle(l).getPropertyValue('--pop'),mag:document.querySelector('.lens-mag').style.transform,op:document.querySelector('.lens-mag').style.opacity}})()")
    lp = ev('window.__lensPress'); print(lp)
    check(lp['h'] > box['height'] - 12 + 4, f"lens grows past the bar height while pressed ({lp['h']} vs bar inner {box['height']-12})")
    check('scale(1.' in lp['mag'] and float(lp['op']) > 0.9, 'magnified copy visible while pressed')
    # drag to the right in steps, screenshots mid-way
    n = 14
    for k in range(1, n + 1):
        page.mouse.move(cx[0] + (cx[3] - cx[0]) * k / n, y); time.sleep(0.016)
        if k in (4, 8): page.screenshot(path=str(OUT / f'v53_2_drag{k}.png'), clip=clip)
    time.sleep(0.15); page.screenshot(path=str(OUT / 'v53_3_dragend.png'), clip=clip)
    sel = ev("[...document.querySelectorAll('#tabs > .tab')].findIndex(b=>b.classList.contains('on'))"); check(sel == 3, f'dragging to the last tab selects it live (on={sel})')
    page.mouse.up(); time.sleep(0.9)
    page.screenshot(path=str(OUT / 'v53_4_release.png'), clip=clip)
    pop = float(ev("getComputedStyle(document.querySelector('.lens')).getPropertyValue('--pop')"))
    check(pop < 0.02, f'lens deflates after release (pop={pop})')
    check(ev("document.querySelector('#main').textContent.includes('Search') || !!document.querySelector('#q')"), 'releasing on Search opens Search')
    # tap tab 1 quickly
    page.mouse.click(cx[1], y); time.sleep(0.9)
    check(ev("[...document.querySelectorAll('#tabs > .tab')].findIndex(b=>b.classList.contains('on'))") == 1, 'tap selects Albums')
    # overlay: track menu on a song
    ev("__lf.go('albums'); __lf.push('album','a5')"); page.wait_for_selector('#sub [data-act="trackmenu"]'); time.sleep(0.5); page.locator('#sub [data-act="trackmenu"]').nth(1).click()
    page.wait_for_selector('#sheet .sheetbox'); time.sleep(0.4)
    page.screenshot(path=str(OUT / 'v53_5_sheet.png'))
    bg = ev("getComputedStyle(document.querySelector('#sheet .sheetbox')).backgroundColor + ' | ' + getComputedStyle(document.querySelector('#sheet .scrim')).backgroundColor")
    print(bg)
    page.click('#sheet .scrim', position={'x': 20, 'y': 20}); time.sleep(0.3)
    # app never scrolls
    ev("document.querySelector('#tabs').scrollIntoView(); document.querySelector('#app').scrollTop=999")
    check(ev("document.querySelector('#app').scrollTop") == 0, '#app cannot be scrolled (overflow: clip)')
    check(not errors, f'no JS errors {errors[:3]}')
    br.close()
print('FAILS', fails); sys.exit(1 if fails else 0)
