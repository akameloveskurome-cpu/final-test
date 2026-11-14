"""Extreme-settings audit (v208): sets every Animation slider to its maximum, its minimum and a few mixed
combinations through the REAL slider input handler (so the CSS variables --spring, --liq, --lq-dur, --fringe are
set too), then checks the things a user sees break first:
  - toggle knob (::after) leaving its track while it springs
  - button / chip / tab text overflowing its own box
  - tab bar lens leaving the bar, tab / button / toggle leaving the screen at rest
  - uncaught JS errors
  - worst transform scale on any control
Run: python3 tests/glass_extremes.py   (exit 1 when a check fails)"""
import http.server, threading, pathlib, sys, time, json
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
src = open(ROOT / 'tests' / 'smoke.py').read(); exec(src[src.index('MAP = '):src.index("srv = http.server")])
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start(); URL = f'http://127.0.0.1:{port}/'
sys.path.insert(0, str(ROOT / 'tests')); import pw_helper; exe = pw_helper.chromium_exe()

# (name, {slider key: value}) ; missing keys keep their default
CASES = [
  ('max', 'max'),
  ('top-of-every-slider', {'pillWobbleV': 200, 'pillWobbleH': 200, 'pillStretch': 200, 'pillSize': 150, 'magnify': 200, 'bounce': 200, 'speed': 200, 'jelly': 200, 'knob': 200, 'fringe': 250}),
  ('min', 'min'),
  ('mix-fast-bouncy', {'speed': 200, 'bounce': 200, 'pillWobbleV': 200, 'pillWobbleH': 200, 'jelly': 200, 'knob': 200}),
  ('mix-slow-flat', {'speed': 50, 'bounce': 30, 'pillStretch': 200, 'pillSize': 150, 'magnify': 200, 'fringe': 250}),
  ('watery', 'watery'),
]
SLIDERS = ['pillWobbleV', 'pillWobbleH', 'pillStretch', 'pillSize', 'magnify', 'bounce', 'speed', 'jelly', 'knob', 'fringe']
MIN = {'pillWobbleV': 0, 'pillWobbleH': 0, 'pillStretch': 0, 'pillSize': 50, 'magnify': 0, 'bounce': 30, 'speed': 50, 'jelly': 0, 'knob': 0, 'fringe': 0}
MAX = {'pillWobbleV': 200, 'pillWobbleH': 200, 'pillStretch': 200, 'pillSize': 150, 'magnify': 200, 'bounce': 200, 'speed': 200, 'jelly': 200, 'knob': 200, 'fringe': 250}

MON = """
window.__w = {scale:{}, lens:[], knob:[], text:[], off:[], knobSamples:0};
(() => { const tick = () => {
  for (const el of document.querySelectorAll('button,.mini,.card,.row,.setrow,.chip,.gtile,.searchpill,.toggle,.lens')) {
    const m = getComputedStyle(el).transform; if (m && m !== 'none') { const a = m.match(/matrix\\(([^)]+)\\)/); if (a) { const v = a[1].split(',').map(Number), sx = Math.hypot(v[0], v[1]), sy = Math.hypot(v[2], v[3]); const k = (el.className + '').split(' ')[0] || el.tagName; window.__w.scale[k] = Math.max(window.__w.scale[k] || 1, sx, sy, 1/Math.min(sx, sy)); } } }
  for (const l of document.querySelectorAll('.lens')) { const root = l.parentElement, a = l.getBoundingClientRect(), b = root.getBoundingClientRect(); if (a.width && (a.left < b.left - 2 || a.right > b.right + 2 || a.top < b.top - 2 || a.bottom > b.bottom + 2)) window.__w.lens.push((root.className + '').split(' ')[0]); }
  for (const t of document.querySelectorAll('.toggle')) { const r = t.getBoundingClientRect(); if (!r.width || !t.offsetParent) continue; const cs = getComputedStyle(t, '::after'); const l = parseFloat(cs.left), rr = parseFloat(cs.right); window.__w.knobSamples++; if (!isNaN(l) && !isNaN(rr) && (l < -0.5 || rr < -0.5 || l + rr > 0 && false)) window.__w.knob.push([Math.round(l), Math.round(rr)].join('/')); }
  requestAnimationFrame(tick); }; tick(); })();
"""
TEXT_CHECK = """(() => { const hs = el => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; }; const out = []; for (const el of document.querySelectorAll('.tab span, .chip, .gbtn, .actions button, .np .bottom button, .toggle-label, .row .tx b, .setrow .tx b')) {
  if (!el.offsetParent) continue; const r = el.getBoundingClientRect(); if (!r.width) continue;
  if (hs(el)) continue; const over = el.scrollWidth - el.clientWidth; if (over > 2 && getComputedStyle(el).overflow !== 'visible') out.push('clip:' + (el.className + '').split(' ')[0]); 
  const par = el.parentElement && el.parentElement.getBoundingClientRect(); if (par && (r.right > par.right + 3 || r.left < par.left - 3)) out.push('out:' + (el.className + '').split(' ')[0] + ':' + (el.textContent || '').trim().slice(0, 12)); }
  return out; })()"""
OFF_CHECK = """(() => { const hs = el => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; }; const out = [], vw = innerWidth, vh = innerHeight; for (const el of document.querySelectorAll('.tab,.gbtn,.sbtn,.toggle,.chip,.cluster button')) { if (!el.offsetParent || hs(el)) continue; const r = el.getBoundingClientRect(); if (!r.width) continue; if (r.right < -2 || r.left > vw + 2 || r.bottom < -2 || r.top > vh + 2) out.push((el.className + '').split(' ')[0]); } return out.slice(0, 6); })()"""

def run_case(pw, name, spec):
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    page = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True).new_page(); ev = page.evaluate; errs = []
    page.on('pageerror', lambda e: errs.append(str(e)[:160]))
    page.goto(URL); page.wait_for_selector('#tabs .tab'); time.sleep(0.4)
    ev("__lf.go('home'); __lf.push('animation')"); time.sleep(0.5)
    if spec == 'max' or spec == 'min' or spec == 'watery':
        if spec == 'min':
            vals = MIN
        elif spec == 'max':
            vals = MAX
        else:
            vals = {}
        if spec == 'watery':
            ev("document.querySelector('[data-act=\"anim-preset\"][data-p=\"watery\"]').click()")
        else:
            vals = vals or {}
            for k in SLIDERS:
                ev(f"(() => {{ const i = document.querySelector('input[data-ak=\"{k}\"]'); i.value = {vals[k]}; i.dispatchEvent(new Event('input', {{bubbles:true}})); }})()")
    else:
        for k in SLIDERS:
            v = spec.get(k, 100)
            ev(f"(() => {{ const i = document.querySelector('input[data-ak=\"{k}\"]'); i.value = {v}; i.dispatchEvent(new Event('input', {{bubbles:true}})); }})()")
    ev(MON); time.sleep(0.3)
    assert ev("document.documentElement.dataset.motion") != 'reduce', 'Reduce Motion must be off for this audit'
    # screen tour: every screen with toggles / buttons, pressing each one, dragging, releasing
    tours = [('home', None), ('settings', None), ('animation', None), ('homeset', None)]
    for tab, push in tours:
        ev(f"__lf.go('home'); __lf.push('{tab}')" if tab != 'home' else "__lf.go('home')"); time.sleep(0.5)
        for i in range(min(page.locator('.toggle').count(), 6)):
            t = page.locator('.toggle').nth(i)
            # never flip Reduce Motion / Increase Contrast: that turns every spring off and would hide the effects under test
            if ev("(i => { const row = document.querySelectorAll('.toggle')[i].closest('.row,.setrow,.animdock-r'); return /reduce|motion|contrast/i.test(row ? row.textContent : ''); })(" + str(i) + ")"): continue
            try:
                t.scroll_into_view_if_needed(); b = t.bounding_box(); x, y = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
                page.mouse.move(x, y); page.mouse.down(); time.sleep(0.05); page.mouse.move(x + 30, y, steps=3); page.mouse.up()
                time.sleep(0.6); text = ev(TEXT_CHECK)
            except Exception:
                text = []
        ev("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())")
    # tab bar hammering (flicks + outside drags) and button rows
    ev("__lf.go('home')"); time.sleep(0.4)
    for _ in range(2):
        bx = [page.locator('#tabs .tab').nth(i).bounding_box() for i in range(4)]
        for (src_, dx, dy) in ((0, 330, 0), (3, -330, 0), (1, 200, -200), (2, -400, 60)):
            b = bx[src_]; x, y = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
            page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x + dx, y + dy, steps=3); time.sleep(0.05); page.mouse.up(); time.sleep(0.4)
    ev("document.querySelector('#sheet').innerHTML=''; __lf.go('home')"); time.sleep(0.5)
    if __import__('os').environ.get('GE_DEBUG'):
        b = page.locator('.gbtn').first.bounding_box() if page.locator('.gbtn').count() else None
        print('DBG gbtn', b, page.evaluate(f"(() => {{ const e = document.elementFromPoint({b['x'] + b['width'] / 2 if b else 0}, {b['y'] + b['height'] / 2 if b else 0}); return e && (e.tagName + '.' + e.className); }})()") if b else 'no gbtn', page.evaluate("document.body.className + ' / screen=' + (document.querySelector('#sub')||{}).className"))
    for sel in ('.gbtn', '.sbtn', '.chip', '.mini .mb'):
        for bt in page.locator(sel).all()[:3]:
            try:
                b = bt.bounding_box(); x, y = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
                page.mouse.move(x, y); page.mouse.down(); time.sleep(0.08); page.mouse.move(x + 40, y + 20, steps=2); page.mouse.up(); time.sleep(0.5)
            except Exception as ex:
                errs.append('press ' + sel + ': ' + str(ex)[:80])
    ev("__lf.openNP()"); time.sleep(0.8)
    for sel in ('#np .bottom button', '#np .actions button'):
        for bt in page.locator(sel).all()[:5]:
            try:
                b = bt.bounding_box(); x, y = b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
                page.mouse.move(x, y); page.mouse.down(); time.sleep(0.05); page.mouse.move(x + 60, y, steps=3); page.mouse.up(); time.sleep(0.4)
            except Exception: pass
    ev("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())"); ev("__lf.go('home')"); time.sleep(1.2)
    w = ev('window.__w'); text_end = ev(TEXT_CHECK); off = ev(OFF_CHECK)
    br.close()
    return {'case': name, 'maxScale': round(max(w['scale'].values() or [1]), 3), 'knobOut': sorted(set(w['knob']))[:5], 'lensOut': sorted(set(w['lens']))[:5],
            'textOut': sorted(set(text_end))[:6], 'offScreen': off, 'errors': errs[:3], 'scaleMap': {k: round(v, 3) for k, v in w['scale'].items()}, 'knobSamples': w['knobSamples']}

if __name__ == '__main__':
    results = []
    with sync_playwright() as pw:
        for name, spec in CASES:
            results.append(run_case(pw, name, spec)); print(json.dumps(results[-1]))
    bad = [r for r in results if r['knobOut'] or r['lensOut'] or r['textOut'] or r['offScreen'] or r['errors'] or r['maxScale'] > 1.15]
    print('FAILED CASES:', [r['case'] for r in bad] or 'none')
    sys.exit(1 if bad else 0)
