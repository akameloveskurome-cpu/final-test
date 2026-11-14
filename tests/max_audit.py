"""Stress audit: Max preset, hammer tab bar / button rows / toggles / buttons / rows, report worst scale + anything leaving its container.
python3 tests/max_audit.py"""
import http.server, threading, pathlib, sys, time, json
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
src = open(ROOT / 'tests' / 'smoke.py').read(); exec(src[src.index('MAP = '):src.index("srv = http.server")])
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start(); URL = f'http://127.0.0.1:{port}/'
sys.path.insert(0, str(ROOT / 'tests')); import pw_helper; exe = pw_helper.chromium_exe()
MON = """
window.__w = {scale:{}, lens:[], knob:[]};
(() => { const tick = () => {
  for (const el of document.querySelectorAll('button,.mini,.card,.row,.setrow,.chip,.gtile,.searchpill,.toggle,.lens')) {
    const m = getComputedStyle(el).transform; if (m && m !== 'none') { const a = m.match(/matrix\\(([^)]+)\\)/); if (a) { const v = a[1].split(',').map(Number), sx = Math.hypot(v[0], v[1]), sy = Math.hypot(v[2], v[3]); const k = (el.className + '').split(' ')[0] || el.tagName; window.__w.scale[k] = Math.max(window.__w.scale[k] || 1, sx, sy, 1/Math.min(sx, sy)); } } }
  for (const l of document.querySelectorAll('.lens')) { const root = l.parentElement, a = l.getBoundingClientRect(), b = root.getBoundingClientRect(); if (a.width && (a.left < b.left - 2 || a.right > b.right + 2 || a.top < b.top - 2 || a.bottom > b.bottom + 2)) window.__w.lens.push((root.className + '').split(' ')[0] + ' ' + [a.left-b.left, a.top-b.top, a.right-b.right, a.bottom-b.bottom].map(Math.round)); }
  for (const t of document.querySelectorAll('.toggle')) { const r = t.getBoundingClientRect(); if (!r.width) continue; const cs = getComputedStyle(t); const kl = parseFloat(cs.getPropertyValue('--kl')), kr = parseFloat(cs.getPropertyValue('--kr')), kh = parseFloat(cs.getPropertyValue('--kh')); if (kl < 0 || kr < 0 || kh > 30) window.__w.knob.push([kl, kr, kh].join('/')); }
  requestAnimationFrame(tick); }; tick(); })();
"""
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    page = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True).new_page(); ev = page.evaluate; errs = []
    page.on('pageerror', lambda e: errs.append(str(e)[:200]))
    page.goto(URL); page.wait_for_selector('#tabs .tab'); time.sleep(0.5)
    ev("import('/src/animcfg.js').then(m => m.setAnim(m.PRESETS.max))"); ev("__lf.go('albums'); __lf.push('album','a5')")
    page.wait_for_selector('#sub [data-act="playall"]'); page.click('#sub [data-act="playall"]'); page.wait_for_selector('#mini .mini'); ev("__lf.go('home')"); ev(MON); time.sleep(0.5)
    def press(sel_or_box, dx=0, dy=0, hold=0.12, steps=3):
        b = sel_or_box if isinstance(sel_or_box, dict) else page.locator(sel_or_box).first.bounding_box()
        if not b: return
        x, y = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
        page.mouse.move(x, y); page.mouse.down(); time.sleep(hold); page.mouse.move(x + dx, y + dy, steps=steps); time.sleep(0.1); page.mouse.up(); time.sleep(0.35)
    for _ in range(3):   # tab bar: flicks left/right/outside
        bx = [page.locator('#tabs .tab').nth(i).bounding_box() for i in range(4)]
        press(bx[0], dx=330, steps=2, hold=0.0); press(bx[3], dx=-330, steps=2, hold=0.0); press(bx[1], dx=200, dy=-200, steps=3); press(bx[2], dx=-400, dy=60, steps=2)
    for sel in ('#mini .mini', '#mini .mb', '.chip', '.gbtn', '.sbtn'):
        for dx, dy in ((60, -40), (-300, 100), (0, 0)): press(sel, dx, dy)
    for k in ('settings', 'animation', 'homeset'):
        ev("__lf.go('home')"); ev(f"__lf.push('{k}')"); time.sleep(0.5)
        for i in range(min(page.locator('.toggle').count(), 8)):
            t = page.locator('.toggle').nth(i); t.scroll_into_view_if_needed(); press(t.bounding_box(), dx=60, steps=2); press(t.bounding_box(), dx=-60, steps=2, hold=0.0)
        for r in page.locator('.setrow').all()[:5]:
            try: press(r.bounding_box(), 20, 0, 0.05)
            except Exception: pass
            ev("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())")
    ev("document.querySelector('#sheet').innerHTML=''"); ev("__lf.go('home')"); ev("__lf.openNP()"); time.sleep(0.8)
    for sel in ('#np .bottom button', '#np .actions button', '#np .scrub'):
        for bt in page.locator(sel).all()[:6]:
            try: press(bt.bounding_box(), 50, 0, 0.1); ev("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())")
            except Exception: pass
    w = ev('window.__w'); print('MAXSCALE', json.dumps({k: round(v, 3) for k, v in sorted(w['scale'].items(), key=lambda x: -x[1])[:8]})); print('LENS out of root:', sorted(set(w['lens']))[:8]); print('KNOB out:', sorted(set(w['knob']))[:8]); print('ERRORS', errs); br.close()
