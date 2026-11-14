"""Self audit: records a video of the app (Chromium, demo library) while pressing / dragging everything, logs JS errors and any out-of-bounds wobble.
python3 tests/rec_audit.py  -> tests/out/rec/*.webm + report on stdout"""
import http.server, threading, pathlib, sys, time, json
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'tests' / 'out' / 'rec'; OUT.mkdir(parents=True, exist_ok=True)
src = open(ROOT / 'tests' / 'smoke.py').read()
exec(src[src.index('MAP = '):src.index("srv = http.server")])
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/'
sys.path.insert(0, str(ROOT / 'tests'))
import pw_helper; exe = pw_helper.chromium_exe()
MON = """
window.__bad = []; window.__max = {};
(() => {
  const vw = innerWidth, vh = innerHeight;
  const seen = new Set();
  const tick = () => {
    for (const el of document.querySelectorAll('.tabbar,.lens,.mini,.toggle,.gbtn,.sbtn,.chip,.setrow,.row,.card,.np .bottom button,.cluster,.cluster button,.mini .mb,.searchpill,.gtile')) {
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      const cls = (el.className + '').split(' ')[0] || el.tagName;
      if (r.left < -1 || r.right > vw + 1) { const k = cls + ' x ' + Math.round(r.left) + '/' + Math.round(r.right); if (!seen.has(cls + 'x')) { seen.add(cls + 'x'); window.__bad.push('OUT-X ' + k); } }
      const m = getComputedStyle(el).transform; if (m && m !== 'none') { const a = m.match(/matrix\\(([^)]+)\\)/); if (a) { const v = a[1].split(',').map(Number); const sx = Math.hypot(v[0], v[1]), sy = Math.hypot(v[2], v[3]); const mx = Math.max(sx, sy, 1 / Math.min(sx, sy)); window.__max[cls] = Math.max(window.__max[cls] || 1, mx); } }
    }
    const l = document.querySelector('.lens'), t = document.querySelector('.tabbar');
    if (l && t) { const a = l.getBoundingClientRect(), b = t.getBoundingClientRect(); if (a.width && (a.left < b.left - 1 || a.right > b.right + 1 || a.top < b.top - 1 || a.bottom > b.bottom + 1)) { if (!seen.has('lens')) { seen.add('lens'); window.__bad.push('LENS outside bar ' + [a.left, a.top, a.right, a.bottom].map(Math.round) + ' vs ' + [b.left, b.top, b.right, b.bottom].map(Math.round)); } } }
    for (const tg of document.querySelectorAll('.toggle')) { const r = tg.getBoundingClientRect(), cs = getComputedStyle(tg, '::after'); }
    requestAnimationFrame(tick);
  }; tick();
})();
"""
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, record_video_dir=str(OUT), record_video_size={'width': 390, 'height': 844})
    page = ctx.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append('PAGEERR ' + str(e)))
    page.on('console', lambda m: errors.append('CONSOLE ' + m.text) if m.type == 'error' else None)
    page.goto(URL); page.wait_for_selector('#tabs .tab'); time.sleep(0.5); ev = page.evaluate
    ev(MON)
    ev("__lf.go('albums'); __lf.push('album','a5')"); page.wait_for_selector('#sub [data-act=\"playall\"]'); page.click('#sub [data-act=\"playall\"]')
    page.wait_for_selector('#mini .mini'); ev("__lf.go('home')"); time.sleep(0.5)
    box = page.locator('#tabs').bounding_box(); y = box['y'] + box['height'] / 2
    cx = [(lambda b: b['x'] + b['width'] / 2)(page.locator('#tabs .tab').nth(i).bounding_box()) for i in range(4)]
    def drag(a, b, n=12, hold=0.3):
        page.mouse.move(cx[a], y); page.mouse.down(); time.sleep(hold)
        for k in range(1, n + 1): page.mouse.move(cx[a] + (cx[b] - cx[a]) * k / n, y); time.sleep(0.016)
        time.sleep(0.2); page.mouse.up(); time.sleep(0.8)
    # tab bar: taps, slow drag, FAST flick both ways, drag outside the bar vertically
    for i in (1, 2, 3, 0): page.mouse.click(cx[i], y); time.sleep(0.7)
    drag(0, 3); drag(3, 0, n=3, hold=0.05); drag(0, 3, n=2, hold=0.0)
    page.mouse.move(cx[1], y); page.mouse.down(); time.sleep(0.2); page.mouse.move(cx[3], y - 140, steps=3); time.sleep(0.3); page.mouse.up(); time.sleep(0.8)
    # mini player + buttons
    for sel in ('#mini .mini', '#mini .mini .mb'):
        try:
            b = page.locator(sel).first.bounding_box(); page.mouse.move(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2); page.mouse.down(); time.sleep(0.25)
            page.mouse.move(b['x'] + b['width'] / 2 + 40, b['y'] + b['height'] / 2 - 30, steps=4); time.sleep(0.2); page.mouse.up(); time.sleep(0.8)
        except Exception as e: errors.append('MINI ' + str(e)[:100])
    # settings: toggles, rows
    ev("__lf.go('home')"); time.sleep(0.3); ev("__lf.push('settings')"); time.sleep(0.8)
    n = page.locator('.toggle').count(); print('toggles', n)
    for i in range(min(n, 8)):
        t = page.locator('.toggle').nth(i); t.scroll_into_view_if_needed(); b = t.bounding_box()
        if not b: continue
        page.mouse.move(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2); page.mouse.down(); time.sleep(0.15)
        page.mouse.move(b['x'] + b['width'] + 30, b['y'] + b['height'] / 2, steps=4); time.sleep(0.15); page.mouse.up(); time.sleep(0.5)
        page.mouse.click(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2); time.sleep(0.5)
    for r in page.locator('.setrow').all()[:4]:
        try:
            b = r.bounding_box(); page.mouse.click(b['x'] + 60, b['y'] + b['height'] / 2); time.sleep(0.5)
            ev("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())"); time.sleep(0.3)
        except Exception as e: pass
    page.mouse.wheel(0, 900); time.sleep(0.5)
    # animation studio at MAX preset
    ev("localStorage.clear()")
    # Now Playing + lyrics
    ev("document.querySelector('#sheet').innerHTML=''"); ev("__lf.go('home')"); ev("__lf.openNP()"); time.sleep(0.9)
    for sel in ('#np .bottom button', '#np .actions button'):
        for bt in page.locator(sel).all()[:6]:
            try:
                b = bt.bounding_box(); page.mouse.move(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2); page.mouse.down(); time.sleep(0.15); page.mouse.up(); time.sleep(0.4)
                ev("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())"); time.sleep(0.2)
            except Exception as e: pass
    time.sleep(0.5)
    print('BAD', json.dumps(ev('window.__bad'), indent=0)); print('MAXSCALE', json.dumps({k: round(v, 3) for k, v in ev('window.__max').items()}))
    print('ERRORS', errors)
    ctx.close(); br.close()
