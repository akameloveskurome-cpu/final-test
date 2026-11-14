"""Screen recording (v208): touch every liquid glass control in the app with the dummy demo library, plus the
animation sliders, presets, toggles, export and import of the settings.
Output: docs/screen-recordings/06-liquid-glass-settings.mp4   Run from the project root: python3 tests/record_settings_v208.py
Needs playwright + chromium (same as tests/rec_common.py) and ffmpeg. The songs are the dummy demo library (names and lyrics are made up)."""
import sys, pathlib, subprocess, tempfile
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from rec_common import *   # ROOT, URL, exe, OUT, new_page, R, sync_playwright

def slide(pg, key, target, steps=8, pause=70):
    cur = int(float(pg.evaluate(f"document.querySelector('input[data-ak=\"{key}\"]').value")))
    for i in range(1, steps + 1):
        v = round(cur + (target - cur) * i / steps)
        pg.evaluate(f"(()=>{{const s=document.querySelector('input[data-ak=\"{key}\"]'); s.value={v}; s.dispatchEvent(new Event('input',{{bubbles:true}}));}})()")
        pg.wait_for_timeout(pause)

def press(pg, box, dx=0, dy=0, hold=0.1):
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    pg.mouse.move(x, y); pg.mouse.down(); pg.wait_for_timeout(int(hold * 1000))
    if dx or dy: pg.mouse.move(x + dx, y + dy, steps=10)
    pg.wait_for_timeout(110); pg.mouse.up(); pg.wait_for_timeout(550)

def touch_all(pg, sel, limit=6, dx=24):
    """press each visible control of this kind once (a short drag, then release)."""
    for el in pg.locator(sel).all()[:limit]:
        try:
            b = el.bounding_box()
            if b and b['width'] > 0: press(pg, b, dx=dx, hold=0.07)
        except Exception: pass

def close_sheets(pg):
    pg.evaluate("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())"); pg.wait_for_timeout(400)

def main():
    vdir = pathlib.Path(tempfile.mkdtemp(prefix='rec208_'))
    exported = pathlib.Path(tempfile.mkdtemp(prefix='exp208_')) / 'liquid-dark-settings.json'
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
        ctx, pg, errors = new_page(br, video_dir=vdir)
        # 1. a dummy album plays: mini player, transport row and tab bar on screen
        pg.evaluate("__lf.go('albums'); __lf.push('album','a5')"); pg.wait_for_timeout(900)
        pg.click('#sub [data-act="playall"]'); pg.wait_for_selector('#mini .mini'); pg.wait_for_timeout(900)
        # 2. the mini player and the glass buttons on the album screen
        touch_all(pg, '#mini .mini', limit=1, dx=-80)
        R(pg)
        # 3. every tab bar pill: flicks, drags out and back, and a tap on each tab
        for tab in ('albums', 'library', 'search', 'home'):
            bx = [pg.locator('#tabs .tab').nth(i).bounding_box() for i in range(4)]
            press(pg, bx[0], dx=300, hold=0.05); press(pg, bx[3], dx=-300, hold=0.05); press(pg, bx[1], dx=160, dy=-120, hold=0.1)
            pg.evaluate(f"__lf.go('{tab}')"); pg.wait_for_timeout(700)
            touch_all(pg, '#sub .chip, #sub .gbtn, #sub .card, #sub .row', limit=4, dx=40)
            pg.evaluate("__lf.go('home')"); pg.wait_for_timeout(500)
        # 4. Home: the glass chips, cards and quick buttons
        touch_all(pg, '.quick .chip, .quick .gbtn, .quick button', limit=6, dx=30)
        touch_all(pg, '.lshome, .resume, .gtile', limit=3, dx=30)
        close_sheets(pg); R(pg)
        # 5. Settings > Animation: sliders move live, the test bar reacts, the presets, then the spring demo
        pg.evaluate("__lf.go('home'); __lf.push('settings')"); pg.wait_for_timeout(800)
        pg.evaluate("__lf.push('animation')"); pg.wait_for_timeout(1000)
        for key, target in (('speed', 120), ('bounce', 130), ('jelly', 105), ('pillStretch', 120), ('magnify', 110), ('fringe', 130)):
            slide(pg, key, target); pg.wait_for_timeout(300)
        bx = [pg.locator('#demobar .tab').nth(i).bounding_box() for i in range(4)]
        press(pg, bx[0], dx=260, hold=0.05); press(pg, bx[2], dx=-200, hold=0.05); press(pg, bx[1], hold=0.1)
        touch_all(pg, '.animchips .chip', limit=4, dx=20)
        pg.locator('[data-act="anim-preset"][data-p="max"]').first.click(); pg.wait_for_timeout(1300)
        pg.locator('[data-act="anim-preset"][data-p="default"]').first.click(); pg.wait_for_timeout(900)
        # 6. Lyrics animation screen: its chips and sliders
        pg.evaluate("__lf.go('home'); __lf.push('settings')"); pg.wait_for_timeout(700)
        pg.evaluate("__lf.push('lyranim')"); pg.wait_for_timeout(900)
        touch_all(pg, '.animchips .chip', limit=3, dx=20)
        pg.wait_for_timeout(300)
        # 7. Settings toggles (accessibility switches are left alone so the springs stay on)
        pg.evaluate("__lf.go('home'); __lf.push('settings')"); pg.wait_for_timeout(800)
        for name in ('Lens refraction', 'Album info', 'Big covers', 'Red highlight'):
            row = pg.locator('.setrow, .row', has_text=name).first
            if row.count():
                t = row.locator('.toggle').first
                if t.count():
                    t.scroll_into_view_if_needed(); press(pg, t.bounding_box(), dx=20, hold=0.07); pg.wait_for_timeout(500)
                    press(pg, t.bounding_box(), dx=-20, hold=0.07); pg.wait_for_timeout(500)
        # 8. Export, then Import with that file: the import sheet, the glass row visible, all ticked, applied
        with pg.expect_download() as dl:
            pg.locator('[data-act="setexport"]').first.click()
        dl.value.save_as(exported); pg.wait_for_timeout(1000)
        with pg.expect_file_chooser() as fc:
            pg.locator('[data-act="setimport"]').first.click()
        fc.value.set_files(str(exported)); pg.wait_for_timeout(1500)
        glass = pg.locator('#sheet .picklist .row', has_text='Liquid glass').first
        if glass.count(): glass.scroll_into_view_if_needed(); pg.wait_for_timeout(1400)
        pg.locator('[data-act="set-all"]').first.click(); pg.wait_for_timeout(1000)
        pg.locator('[data-act="setimport-ok"]').first.click(); pg.wait_for_timeout(2400)
        R(pg); pg.evaluate("__lf.go('home')"); pg.wait_for_timeout(1000)
        ctx.close(); video = pg.video.path(); br.close()
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / '06-liquid-glass-settings.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(video), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23', str(dest)], check=True)
    print('wrote', dest, 'page errors:', errors[:3])
    return 0 if not errors else 1

if __name__ == '__main__':
    sys.exit(main())
