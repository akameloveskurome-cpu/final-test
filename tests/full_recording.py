"""Full-app screen recording (Chromium, demo library): every tab, button and toggle, with a touch dot. python3 tests/full_recording.py -> tests/out/full/*.webm"""
import http.server, threading, pathlib, sys, time, json
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'tests' / 'out' / 'full'; OUT.mkdir(parents=True, exist_ok=True)
src = open(ROOT / 'tests' / 'smoke.py').read(); exec(src[src.index('MAP = '):src.index("srv = http.server")])
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start(); URL = f'http://127.0.0.1:{port}/'
sys.path.insert(0, str(ROOT / 'tests')); import pw_helper; exe = pw_helper.chromium_exe()
DOT = """(()=>{const d=document.createElement('div');d.id='tdot';d.style.cssText='position:fixed;z-index:99999;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.35);border:2px solid #fff;pointer-events:none;left:-50px;top:-50px;transition:left .18s,top .18s,transform .1s';document.body.appendChild(d);
addEventListener('mousemove',e=>{d.style.left=e.clientX+'px';d.style.top=e.clientY+'px'},true);addEventListener('mousedown',()=>d.style.transform='scale(.7)',true);addEventListener('mouseup',()=>d.style.transform='scale(1)',true);})()"""
log = []; errs = []
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, record_video_dir=str(OUT), record_video_size={'width': 585, 'height': 1266})
    pg = ctx.new_page(); ev = pg.evaluate
    pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)[:160]))
    pg.goto(URL); pg.wait_for_selector('#tabs .tab'); time.sleep(0.8); ev(DOT)
    def tap(loc, hold=0.08, wait=0.55, name=''):
        try:
            if isinstance(loc, str): loc = pg.locator(loc).first
            loc.scroll_into_view_if_needed(timeout=1500); b = loc.bounding_box()
            if not b or b['y'] > 830 or b['y'] + b['height'] < 14: return False
            x, y = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
            pg.mouse.move(x, y, steps=6); pg.mouse.down(); time.sleep(hold); pg.mouse.up(); time.sleep(wait); log.append('ok ' + name); return True
        except Exception as e: log.append('SKIP ' + name + ' ' + str(e)[:60]); return False
    def closeall():
        ev("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())"); time.sleep(0.4)
        ev("document.querySelector('#sheet').innerHTML=''")
    def swipe(y0, y1, n=8):
        pg.mouse.move(195, y0); pg.mouse.down()
        for k in range(1, n + 1): pg.mouse.move(195, y0 + (y1 - y0) * k / n); time.sleep(0.02)
        pg.mouse.up(); time.sleep(0.4)
    # ---- 1. tabs + tab bar drag
    tabs = lambda i: pg.locator('#tabs .tab').nth(i)
    for i in (1, 2, 3, 0): tap(tabs(i), name=f'tab{i}')
    b0, b3 = tabs(0).bounding_box(), tabs(3).bounding_box(); y = b0['y'] + b0['height'] / 2
    pg.mouse.move(b0['x'] + 30, y); pg.mouse.down(); time.sleep(.3)
    for k in range(1, 13): pg.mouse.move(b0['x'] + 30 + (b3['x'] - b0['x']) * k / 12, y); time.sleep(.03)
    pg.mouse.up(); time.sleep(.8); tap(tabs(0), name='tab0 again')
    # ---- 2. Home: scroll, see-all, chips, buttons
    for _ in range(2): swipe(600, 250); 
    swipe(250, 650); swipe(250, 650)
    for sel in ('.seeall', '.chip', '[data-act="shuffle"]'):
        for i in range(min(pg.locator(sel).count(), 4)):
            if tap(pg.locator(sel).nth(i), name=f'home {sel} {i}'): closeall(); ev("__lf.go('home')"); time.sleep(.3)
    # ---- 3. library screens
    for k in ('playlists', 'favorites', 'recentPlayed', 'songs', 'artists', 'genres', 'albumsAll'):
        ev("__lf.go('library')"); time.sleep(.3); ev(f"__lf.push('{k}')"); time.sleep(.8); swipe(600, 300); swipe(300, 600)
        for i in range(min(pg.locator('#sub .row').count(), 2)): tap(pg.locator('#sub .row').nth(i), name=f'{k} row{i}'); closeall()
    # ---- 4. album + play + mini player
    ev("__lf.go('albums')"); time.sleep(.5); ev("__lf.push('album','a5')"); time.sleep(.8)
    tap('#sub [data-act="playall"]', name='play all'); time.sleep(.8)
    for sel in ('#sub [data-act="shuffle"]', '#sub .row.song', '#sub .row.song:nth-of-type(3)'): tap(sel, name=sel); time.sleep(.3)
    ev("__lf.go('home')"); time.sleep(.5)
    mb = pg.locator('#mini .mb'); 
    for i in range(mb.count()): tap(mb.nth(i), name=f'mini button {i}')
    tap('#mini .mini', hold=.25, name='mini open NP'); time.sleep(.9)
    # ---- 5. Now Playing: every button
    ev("__lf.openNP()"); time.sleep(.8)
    acts = ev("[...new Set([...document.querySelectorAll('#np [data-act]')].map(e=>e.dataset.act))]"); log.append('NP acts ' + ','.join(acts))
    skip = {'close-np'}
    for a in acts:
        if a in skip: continue
        ev("document.querySelector('#np').classList.add('open')"); tap(f'#np [data-act="{a}"]', name=f'NP {a}'); time.sleep(.5)
        ev("document.querySelectorAll('#lyr.open [data-act=back],#lyr.open .gbtn').forEach((e,i)=>i===0&&e.click())"); time.sleep(.3)
        ev("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())"); time.sleep(.3)
        ev("document.querySelector('#sheet').innerHTML=''"); ev("document.querySelector('#lyr')&&document.querySelector('#lyr').classList.remove('open')")
    for sel in ('#np .scrub', '#np .scrub'): 
        b = pg.locator(sel).first.bounding_box()
        if b: pg.mouse.move(b['x'] + 20, b['y'] + b['height'] / 2); pg.mouse.down(); [ (pg.mouse.move(b['x'] + 20 + 200 * k / 10, b['y'] + b['height'] / 2), time.sleep(.04)) for k in range(11)]; pg.mouse.up(); time.sleep(.6)
    ev("document.querySelector('#np').classList.remove('open')"); time.sleep(.6)
    # ---- 6. search
    closeall(); ev("document.querySelectorAll('#np,#lyr').forEach(e=>e.classList.remove('open'))"); ev("__lf.go('search')"); time.sleep(.8)
    try: pg.locator('#q').first.click(timeout=4000); pg.keyboard.type('red', delay=120); time.sleep(1.2)
    except Exception as e: log.append('SKIP search ' + str(e)[:60])
    for i in range(min(pg.locator('#main .row').count(), 2)): tap(pg.locator('#main .row').nth(i), name=f'search row{i}'); closeall()
    ev("__lf.go('home')")
    # ---- 7. Settings: every toggle twice, every row
    ev("__lf.push('settings')"); time.sleep(.9); ev("document.querySelector('#sub .screen').scrollTop=0"); time.sleep(.3)
    n = pg.locator('#sub .toggle').count(); log.append(f'toggles {n}')
    for i in range(n):
        t = pg.locator('#sub .toggle').nth(i); tap(t, name=f'toggle{i}a', wait=.45); tap(t, name=f'toggle{i}b', wait=.45)
        if pg.locator('#sub .toggle').count() != n: break
    ev("document.querySelector('#sub .screen').scrollTop=0"); time.sleep(.3)
    rows = pg.locator('#sub .setrow[data-act], #sub button.setrow'); log.append(f'setting rows {rows.count()}')
    for i in range(min(rows.count(), 24)):
        r = pg.locator('#sub .setrow[data-act], #sub button.setrow').nth(i)
        if tap(r, name=f'setting row{i}', wait=.6):
            closeall(); st = ev("(window.__lf&&1)"); top = ev("document.querySelector('#sub .screen h1, #sub .screen .top')?.textContent||''")
            if 'Settings' not in (top or 'Settings'): ev("document.querySelector('#sub [data-act=back],#sub .gbtn')?.click()"); time.sleep(.5)
    # ---- 8. Animation studio: Max preset, drag tab bar + toggles
    ev("__lf.go('home')"); ev("__lf.push('animation')"); time.sleep(.8)
    for lab in ('Watery', 'Max liquid', 'Calm', 'Default'):
        loc = pg.get_by_text(lab, exact=True).first; tap(loc, name=f'preset {lab}', wait=.4)
        for i in range(2): tap(pg.locator('#sub .toggle').nth(i), name=f'anim toggle {i}', wait=.3)
        tp = pg.locator('.animdock .tab, #tabs .tab').first
    ev("import('/src/animcfg.js').then(m=>m.setAnim(m.PRESETS.max))")
    for i in (1, 2, 3, 0): tap(tabs(i), name=f'max tab{i}', wait=.35)
    ev("import('/src/animcfg.js').then(m=>m.setAnim(m.PRESETS.default))")
    ev("__lf.go('home')"); time.sleep(1)
    print('\n'.join(log[-400:])); print('ERRORS', errs); print('SKIPS', sum(1 for l in log if l.startswith('SKIP')), 'OKS', sum(1 for l in log if l.startswith('ok')))
    ctx.close(); br.close()
