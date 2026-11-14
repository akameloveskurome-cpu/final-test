"""Chromium smoke test of the real UI (browser mock player, demo library). Needs: pip install playwright + a Chromium.
Run from the project root:  python3 tests/smoke.py   (saves screenshots to tests/out/)
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
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    page = ctx.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'status of 404' not in m.text else None)   # 404 = favicon; real 404s are caught by the response hook below
    page.on('response', lambda r: errors.append(f'{r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else None)
    page.goto(URL); page.wait_for_selector('#main .tabbar, #tabs')
    ev = page.evaluate
    ids = lambda: ev("__lf.Native.state.queue.map(t=>t.id)")
    upcoming_titles = lambda: ev("(()=>{const s=__lf.Native.state;return s.queue.slice(s.index+1).map(t=>t.title)})()")
    sheet_titles = lambda: ev("[...document.querySelectorAll('#sheet .qlist .row.song b')].map(b=>b.textContent)")

    # 1. album page -> Shuffle button
    ev("__lf.go('albums'); __lf.push('album','a5')"); page.wait_for_selector('[data-act="shuffleall"]')
    page.click('#sub [data-act="shuffleall"]')
    st = ev("({shuffle:__lf.Native.state.shuffle, n:__lf.Native.state.queue.length, i:__lf.Native.state.index, playing:__lf.Native.state.playing})")
    check(st['shuffle'] and st['n'] == 5 and st['i'] == 0 and st['playing'], f'Shuffle button: shuffle on, 5 songs queued, playing ({st})')
    check(len(set(ids())) == 5, 'every song exactly once')
    page.wait_for_selector('#mini .mini'); check(True, 'mini player shows')

    # 2. Up Next sheet matches the queue order
    ev("__lf.openNP()"); page.click('#np [data-act="queue"]'); page.wait_for_selector('#sheet .qlist')
    check(sheet_titles() == upcoming_titles(), f'Up Next sheet order == player queue order ({sheet_titles()})')
    page.screenshot(path=str(OUT / 'smoke_up_next_shuffled.png'))

    # 3. shuffle off while the sheet is open: sheet refreshes by itself, order is the album order
    ev("__lf.Native.setShuffle(false)"); page.wait_for_timeout(100)
    check(sheet_titles() == upcoming_titles(), 'sheet refreshed after shuffle off (same as queue)')
    s = ev("(()=>{const s=__lf.Native.state;return {shuffle:s.shuffle,orig:s.orig.length}})()"); check(not s['shuffle'] and s['orig'] == 0, 'shuffle off, undo list cleared')

    # 4. tap an upcoming song in Up Next with shuffle ON: jumps there, order of the rest unchanged
    ev("__lf.Native.setShuffle(true)"); page.wait_for_timeout(100)
    before = ids(); page.click('#sheet [data-act="q-play"][data-qi="2"]'); page.wait_for_timeout(100)
    same = ids()[:len(before)] == before      # Autoplay fill may APPEND songs when fewer than 3 are left (T8 part 2), so compare the original part
    check(same and ev("__lf.Native.state.index") == 2, f'Up Next tap: jumps to the song, queue order NOT reshuffled (idx {ev("__lf.Native.state.index")}, same order {same})')

    # 5. restart: session comes back paused
    cur = ev("__lf.Native.current().title"); q_before = ids(); pos = ev("__lf.Native.state.pos")
    ev("document.dispatchEvent(new Event('visibilitychange'))"); page.wait_for_timeout(900)
    page.reload(); page.wait_for_selector('#tabs'); page.wait_for_timeout(500)
    st = ev("({q:__lf.Native.state.queue.map(t=>t.id), i:__lf.Native.state.index, playing:__lf.Native.state.playing, shuffle:__lf.Native.state.shuffle, t:__lf.Native.current()&&__lf.Native.current().title})")
    check(st['q'] == q_before and st['i'] == 2 and not st['playing'] and st['shuffle'], f'after reload: queue, index, shuffle restored, paused ({st["t"]})')
    check(page.inner_text('#mini .meta b') == cur, 'after reload: mini player shows the same song')
    page.screenshot(path=str(OUT / 'smoke_restored_mini.png'))

    # 6. resume plays it
    page.click('#mini [data-act="pp"]'); page.wait_for_timeout(600)
    check(ev("__lf.Native.state.playing") and ev("__lf.Native.state.pos") > 0, 'tap play: resumes the restored song')

    # 7. clear queue keeps only the current song, and that is what gets remembered
    ev("__lf.Native.clearQueue()"); page.wait_for_timeout(900)
    check(json.loads(ev("localStorage.getItem('lf.session')"))['ids'].__len__() == 1, 'cleared queue is saved as one song')

    # 8. T17: Settings > Playlists > Export (browser mock = file download) and Import (file chooser). Import ADDS, name clash gets (2).
    ev("__lf.push('settings')"); page.wait_for_selector('[data-act="plexport"]')
    n0 = ev("JSON.parse(localStorage.getItem('lf.playlists')||'null')"); n0 = len(n0) if n0 else None
    page.click('[data-act="plexport"]'); page.wait_for_selector('[data-act="xp-go"][data-f="json"]')
    with page.expect_download() as dl: page.click('[data-act="xp-go"][data-f="json"]')
    f = dl.value; check(f.suggested_filename == 'liquid-dark-playlists.json', f'export downloads {f.suggested_filename}')
    data = json.loads(pathlib.Path(f.path()).read_text())
    npl = len(data['playlists']); check(data['kind'] == 'playlists' and npl >= 1 and all(isinstance(p['songs'], list) for p in data['playlists']), f'export file has {npl} playlists with songs')
    page.screenshot(path=str(OUT / 'smoke_settings_playlists.png'), full_page=False)
    with page.expect_file_chooser() as fc: page.click('[data-act="plimport"]')
    fc.value.set_files(f.path()); page.wait_for_timeout(600)
    toast = page.inner_text('#toast'); check(toast.startswith('Imported') and 'songs matched' in toast, f'import toast: {toast}')
    saved = json.loads(ev("localStorage.getItem('lf.playlists')")); names = [p['name'] for p in saved]
    check(len(saved) == 2 * npl and sum(n.endswith(' (2)') for n in names) == npl, f'import added {npl} playlists (saved), clashes renamed ({names})')
    check(all(len(a['ids']) == len(b['ids']) for a, b in zip(saved[:npl], saved[npl:])), 'imported playlists have the same songs as the originals')

    # 9. T19: favorites. Heart on Now Playing, Library > Favorites, track menu toggle, survives a reload, red heart only when on.
    ev("__lf.go('library')"); page.wait_for_selector('[data-k="favorites"]')
    page.click('[data-k="favorites"]'); page.wait_for_selector('#sub h1')
    check('No favorites yet' in page.inner_text('#sub'), 'Favorites screen starts empty with a hint')
    ev("__lf.go('albums'); __lf.push('album','a5')"); page.wait_for_selector('[data-act="playall"]')
    page.click('#sub [data-act="playall"]'); ev("__lf.openNP()"); page.wait_for_selector('#np [data-act="fav"]')
    check('fav' not in page.get_attribute('#np [data-act="fav"]', 'class').split(), 'heart is grey while the song is not a favorite')
    title1 = ev("__lf.Native.current().title")
    page.click('#np [data-act="fav"]'); page.wait_for_timeout(150)
    check('fav' in page.get_attribute('#np [data-act="fav"]', 'class').split() and page.inner_text('#toast') == 'Added to Favorites', 'tap heart: red heart + toast')
    page.screenshot(path=str(OUT / 'smoke_np_heart.png'))
    page.click('#np [data-act="next"]'); page.wait_for_timeout(750)   # the transport row eats one stray click for 600 ms after a press (glidebar.js eatClick); a real tap comes later than that
    page.click('#np [data-act="trackmenu"]'); page.wait_for_selector('#sheet [data-act="tm-fav"]')
    check(page.inner_text('#sheet [data-act="tm-fav"]') == 'Add to Favorites', 'track menu offers Add to Favorites for a non-favorite')
    page.click('#sheet [data-act="tm-fav"]'); page.wait_for_timeout(150)
    saved = json.loads(ev("localStorage.getItem('lf.favorites')")); check(len(saved) == 2 and saved[0] == ev("__lf.Native.current().id"), f'two favorites saved, newest first ({saved})')
    ev("document.querySelector('#np').classList.remove('open')")
    ev("__lf.go('library'); __lf.push('favorites')"); page.wait_for_selector('#sub [data-act="shuffleall"]')
    rows = ev("[...document.querySelectorAll('#sub .row.song b')].map(b=>b.textContent)")
    check(len(rows) == 2 and rows[1] == title1, f'Favorites lists both songs, newest first ({rows})')
    page.screenshot(path=str(OUT / 'smoke_favorites.png'))
    page.click('#sub [data-act="playall"]'); page.wait_for_timeout(150)
    favids = json.loads(ev("localStorage.getItem('lf.favorites')"))
    check(ids()[:2] == favids and ev("__lf.Native.current().title") == rows[0], f'Play on Favorites queues the favorites first, in order ({ids()[:2]}; Autoplay fill may append after them)')
    page.reload(); page.wait_for_selector('#tabs'); page.wait_for_timeout(400)
    ev("__lf.go('library'); __lf.push('favorites')"); page.wait_for_selector('#sub [data-act="playall"]')
    check(ev("document.querySelectorAll('#sub .row.song').length") == 2, 'favorites survive a reload')
    ev("__lf.openNP()"); page.wait_for_selector('#np [data-act="trackmenu"]'); page.click('#np [data-act="trackmenu"]'); page.wait_for_selector('#sheet [data-act="tm-fav"]')
    check(page.inner_text('#sheet [data-act="tm-fav"]') == 'Remove from Favorites', 'track menu says Remove for a favorite')
    page.click('#sheet [data-act="tm-fav"]'); page.wait_for_timeout(150)
    check(ev("document.querySelectorAll('#sub .row.song').length") == 1 and len(json.loads(ev("localStorage.getItem('lf.favorites')"))) == 1, 'removing refreshes the open Favorites list and the saved file')

    # 10. T18: Settings has the auto-check switch (default on) and it toggles + persists.
    ev("document.querySelector('#np').classList.remove('open')"); page.wait_for_timeout(600)   # v50: Now Playing was left open here; the extra Settings row moved the switch under its cover
    ev("__lf.push('settings')"); page.wait_for_selector('[data-k="autoCheck"]')
    check('on' in page.get_attribute('[data-k="autoCheck"]', 'class').split(), 'auto-check switch is ON by default')
    page.click('[data-k="autoCheck"]'); page.wait_for_timeout(100)
    check(json.loads(ev("localStorage.getItem('lf.settings')"))['autoCheck'] is False, 'switch off is saved')
    page.screenshot(path=str(OUT / 'smoke_settings_library.png'))

    # 11. T20: Recently / Most Played. Own page with a FAKE CLOCK, so 30 s of listening takes no real time.
    p2 = br.new_context(viewport={'width': 390, 'height': 844}).new_page()
    p2.on('pageerror', lambda e: errors.append(str(e)))
    p2.clock.install(); p2.goto(URL); p2.wait_for_selector('#tabs'); e2 = p2.evaluate
    stats = lambda: json.loads(e2("localStorage.getItem('lf.stats')") or '{}')
    e2("__lf.go('albums'); __lf.push('album','a5')"); p2.wait_for_selector('#sub [data-act="playall"]'); p2.click('#sub [data-act="playall"]')
    first = e2("__lf.Native.current().id")
    p2.clock.run_for(12000); check(stats() == {}, 'T20: 12 s of listening is not a play')
    e2("__lf.Native.next()"); second = e2("__lf.Native.current().id"); p2.clock.run_for(12000)
    check(stats() == {} and second != first, 'T20: skipping around (12 s + 12 s on different songs) is not a play')
    p2.clock.run_for(20000)
    st = stats(); check(list(st) == [second] and st[second]['plays'] == 1, f'T20: after 30+ s the current song has exactly 1 play ({st})')
    p2.clock.run_for(20000); check(stats()[second]['plays'] == 1, 'T20: listening on does not count the same play twice')
    e2("__lf.go('library'); __lf.push('recentPlayed')"); p2.wait_for_selector('#sub [data-act="playall"]')
    check(e2("document.querySelectorAll('#sub .row.song').length") == 1, 'T20: Recently Played lists the song')
    e2("__lf.go('library'); __lf.push('topPlayed')"); p2.wait_for_selector('#sub [data-act="playall"]')
    check(e2("document.querySelector('#sub .row.song .dur').textContent") == '1 play', 'T20: Most Played shows "1 play"')
    p2.screenshot(path=str(OUT / 'smoke_most_played.png'))
    e2("__lf.push('settings')"); p2.wait_for_selector('[data-act="stats-clear"]'); p2.click('[data-act="stats-clear"]'); p2.click('[data-act="stats-clear-ok"]'); p2.wait_for_timeout(100)
    check(stats() == {}, 'T20: Clear play history empties the saved stats')

    # 12. T10 leftover: the Canvas element must survive Now Playing re-renders (play/pause) instead of being rebuilt (a rebuilt <video> restarts from 0).
    gif = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
    c3 = br.new_context(viewport={'width': 390, 'height': 844}); c3.add_init_script("localStorage.setItem('lf.canvas', JSON.stringify({'a:a5': '%s'})); localStorage.setItem('lf.canvasOn','1');" % gif)
    p3 = c3.new_page(); p3.on('pageerror', lambda e: errors.append(str(e))); p3.goto(URL); p3.wait_for_selector('#tabs'); e3 = p3.evaluate
    e3("__lf.Native.fileUrl = p => p"); e3("__lf.go('albums'); __lf.push('album','a5')"); p3.wait_for_selector('#sub [data-act="playall"]'); p3.click('#sub [data-act="playall"]')
    e3("__lf.openNP()"); e3("__lf.Native.pause()"); p3.wait_for_selector('#np .cvmedia')
    e3("document.querySelector('#np .cvmedia').dataset.keep = '1'")
    e3("__lf.Native.resume()"); p3.wait_for_timeout(100); e3("__lf.Native.pause()"); p3.wait_for_timeout(100)
    check(e3("document.querySelector('#np .cvmedia').dataset.keep") == '1', 'T10: the Canvas element is the SAME node after play/pause re-renders (not rebuilt)')
    e3("__lf.Native.next()"); p3.wait_for_timeout(100)
    check(e3("!!document.querySelector('#np .cvmedia')"), 'T10: Canvas still shows after next song (album level)')

    # 13. T21 + T22. Own page with a FAKE CLOCK. sleep timer: button, sheet, pill countdown, cancel, fires and pauses, end-of-song.
    p4 = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2).new_page()
    p4.on('pageerror', lambda e: errors.append(str(e)))
    p4.clock.install(); p4.goto(URL); p4.wait_for_selector('#tabs'); e4 = p4.evaluate
    e4("__lf.push('settings')")
    e4("__lf.go('albums'); __lf.push('album','a5')"); p4.wait_for_selector('#sub [data-act="playall"]'); p4.click('#sub [data-act="playall"]'); e4("__lf.Native.setRepeat('all')"); e4("__lf.openNP()")
    p4.wait_for_selector('#np [data-act="sleep"]'); check('sleeppill' not in p4.inner_html('#np'), 'T22: no pill while no timer runs')
    p4.click('#np [data-act="sleep"]'); p4.wait_for_selector('#sheet [data-act="sl-min"]')
    check(e4("[...document.querySelectorAll('#sheet [data-act=\"sl-min\"]')].map(b=>b.dataset.min).join()") == '15,30,45,60' and e4("!!document.querySelector('#sheet [data-act=\"sl-song\"]')") and not e4("!!document.querySelector('#sheet [data-act=\"sl-off\"]')"), 'T22: sheet offers 15/30/45/60 + End of this song, no "Turn off" yet')
    p4.wait_for_timeout(500)
    p4.screenshot(path=str(OUT / 'smoke_sleep_sheet.png'))
    p4.click('#sheet [data-min="15"]'); p4.wait_for_selector('#np .sleeppill')
    check(p4.inner_text('#toast') == 'Sleep timer: 15 minutes', 'T22: toast says 15 minutes')
    check(p4.inner_text('#sleeptxt').startswith('15:00') or p4.inner_text('#sleeptxt').startswith('14:59'), f"T22: pill starts at 15:00 ({p4.inner_text('#sleeptxt')})")
    p4.clock.run_for(61000); check(p4.inner_text('#sleeptxt').split('.')[0] in ('14:00', '13:59', '13:58', '13:57'), f"T22: pill counts down ({p4.inner_text('#sleeptxt')})")
    check('on' in p4.get_attribute('#np [data-act="sleep"].slbtn', 'class').split(), 'T22: the moon button is red while a timer runs')
    p4.wait_for_timeout(900)   # let the Now Playing slide-in finish (CSS runs in real time)
    p4.screenshot(path=str(OUT / 'smoke_sleep_pill.png'))
    p4.click('#np [data-act="sleep"].slbtn'); p4.wait_for_selector('#sheet [data-act="sl-off"]'); p4.click('#sheet [data-act="sl-off"]'); p4.wait_for_timeout(100)
    check(not e4("!!document.querySelector('#np .sleeppill')") and e4("__lf.Native.sleepState().active") is False, 'T22: Turn off timer removes the pill')
    p4.clock.fast_forward(20 * 60000); check(e4("__lf.Native.state.playing") is True, 'T22: a cancelled timer does not pause')
    p4.click('#np [data-act="sleep"]'); p4.click('#sheet [data-min="30"]'); p4.wait_for_selector('#np .sleeppill')
    p4.clock.fast_forward(30 * 60000 + 2000)
    check(e4("__lf.Native.state.playing") is False and not e4("!!document.querySelector('#np .sleeppill')") and 'music stopped' in p4.inner_text('#toast'), 'T22: when time is up music pauses, pill goes, toast says stopped')
    e4("__lf.Native.resume()"); p4.click('#np [data-act="sleep"]'); p4.click('#sheet [data-act="sl-song"]'); p4.wait_for_selector('#np .sleeppill')
    check(p4.inner_text('#sleeptxt') == 'Stops after this song', 'T22: end-of-song pill text')
    cur = e4("__lf.Native.current().id"); e4("__lf.Native.seek(__lf.Native.current().dur - 1)"); p4.clock.run_for(2000)   # jump near the end: the mock ticks 0.25 s, fast_forward would fire its tick only once
    check(e4("__lf.Native.state.playing") is False and e4("__lf.Native.current().id") != cur and not e4("__lf.Native.sleepState().active"), 'T22: end of song: stopped after that song (next one is loaded, paused), timer cleared')

    # v90: cover viewer + press-and-hold lyrics
    pp = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2).new_page(); pp.on('pageerror', lambda e: errors.append(str(e)))
    pp.goto(URL); pp.wait_for_selector('#tabs'); q = pp.evaluate
    q("__lf.go('albums'); __lf.push('album','a5')"); pp.wait_for_selector('#sub [data-act="playall"]')
    # album page cover tap -> viewer
    pp.click('#sub .detail-art .cover'); pp.wait_for_selector('#cvv'); check(True, 'album page: tap cover opens viewer')
    check(q("document.querySelectorAll('#cvv > *').length") == 1, 'viewer holds only the cover')
    pp.wait_for_timeout(400); pp.click('#cvv'); pp.wait_for_timeout(100); check(not q("!!document.querySelector('#cvv')"), 'tap closes viewer')
    pp.click('#sub [data-act="playall"]'); q("__lf.openNP()"); pp.wait_for_selector('#np .art'); pp.wait_for_timeout(900)
    pp.click('#np .art'); pp.wait_for_selector('#cvv'); check(True, 'NP: normal tap opens cover viewer')
    check(not q("document.querySelector('#lyr')?.classList.contains('open')"), 'NP: tap does not open lyrics')
    pp.screenshot(path=str(OUT / 'cover_viewer.png'))
    pp.wait_for_timeout(400); pp.click('#cvv'); pp.wait_for_timeout(100)
    b = pp.locator('#np .art').bounding_box(); pp.mouse.move(b['x']+b['width']/2, b['y']+b['height']/2); pp.mouse.down(); pp.wait_for_timeout(700); pp.mouse.up(); pp.wait_for_timeout(200)
    check(q("document.querySelector('#lyr')?.classList.contains('open')") and not q("!!document.querySelector('#cvv')"), 'NP: long press opens lyrics (no viewer)')
    q("document.querySelector('[data-act=lyr-close]').click()")
    q("(()=>{const s=JSON.parse(localStorage.getItem('lf.settings')||'{}');s.coverLyrics=false;localStorage.setItem('lf.settings',JSON.stringify(s))})()")
    pp.reload(); pp.wait_for_selector('#tabs'); q("__lf.go('albums'); __lf.push('album','a5')"); pp.wait_for_selector('#sub [data-act="playall"]'); pp.click('#sub [data-act="playall"]'); q("__lf.openNP()"); pp.wait_for_timeout(900)
    b = pp.locator('#np .art').bounding_box(); pp.mouse.move(b['x']+b['width']/2, b['y']+b['height']/2); pp.mouse.down(); pp.wait_for_timeout(700); pp.mouse.up(); pp.wait_for_timeout(200)
    check(not q("document.querySelector('#lyr')?.classList.contains('open')") and q("!!document.querySelector('#cvv')"), 'option off: long press only opens the viewer (tap behaviour)')

    # step 14: T23 sort + letter sections (BUG-436: the A-Z rail is gone), T25 recent searches
    page.reload(); page.wait_for_selector('#main .tabbar, #tabs'); ev("__lf.go('albums')"); page.wait_for_selector('#main .sortbtn')
    check(page.inner_text('#main .sortbtn') == 'Sort: Name - ascending' and ev("document.querySelectorAll('#main .lsec').length") > 1, 'T23: Albums has Sort button and letter sections (no A-Z rail any more)')
    page.click('#main .sortbtn'); page.click('#sheet [data-v="year_desc"]'); page.wait_for_selector('#main .sortbtn')
    check(page.inner_text('#main .sortbtn') == 'Sort: Year - descending' and ev("document.querySelectorAll('#main .lsec').length") == 0, 'T23: Year sort has no letters')
    ev("__lf.push('songs')"); page.wait_for_selector('#sub .sortbtn'); page.click('#sub .sortbtn'); page.click('#sheet [data-v="dur"]'); page.wait_for_selector('#sub .song')
    durs = ev("[...document.querySelectorAll('#sub .song .dur')].map(e=>{const [m,s]=e.textContent.split(':');return +m*60+ +s})")
    check(durs == sorted(durs, reverse=True), 'T23: Songs sorted by Duration (longest first)')
    ev("__lf.Native.setShuffle(false)"); page.wait_for_timeout(100); page.click('#sub .song >> nth=1'); page.wait_for_timeout(100); check(ev("__lf.Native.state.queue[1].id") == ev("document.querySelectorAll('#sub .song')[1].dataset.tid"), 'T23: playing from Songs follows the shown order')
    page.reload(); page.wait_for_selector('#main .tabbar, #tabs'); ev("__lf.go('albums')"); page.wait_for_selector('#main .sortbtn')
    check(page.inner_text('#main .sortbtn') == 'Sort: Year - descending', 'T23: sort choice is remembered after a restart')
    ev("__lf.go('search')"); page.wait_for_selector('#q'); page.fill('#q', 'glass'); page.press('#q', 'Enter'); page.fill('#q', ''); page.dispatch_event('#q', 'input')
    check('glass' in page.inner_text('#results') and 'Recent Searches' in page.inner_text('#results'), 'T25: Enter saves a recent search and the empty search lists it')
    page.click('#results [data-act="recent-q"]'); check(page.input_value('#q') == 'glass' and ev("document.querySelectorAll('#results .song').length") > 0, 'T25: tapping a recent search reuses it')
    page.fill('#q', ''); page.dispatch_event('#q', 'input'); page.click('#results [data-act="recent-clear"]'); check('Recent Searches' not in page.inner_text('#results'), 'T25: Clear empties the recent searches')

    # step 15: T12 A-B loop + T27 equalizer row
    page.reload(); page.wait_for_selector('#main .tabbar, #tabs'); ev("__lf.go('albums'); __lf.push('album','a5')"); page.wait_for_selector('[data-act="shuffleall"]')
    ev("__lf.Native.play(__lf.Native.state.queue.length?__lf.Native.state.queue:[],0)"); ev("(()=>{const a=document.querySelector('[data-tid]'); if(a) a.click();})()"); page.wait_for_timeout(200); ev("__lf.openNP()"); page.wait_for_selector('#np .abbtn')
    ev("(()=>{__lf.Native.seek(10); document.querySelector('#np .abbtn').click();})()");  # seek + tap in ONE call: a slow Playwright click let the mock player run on, so B landed late (this was the "flaky" A-B check)
    check(page.inner_text('#np .abbtn') == 'A-' and ev("getComputedStyle(document.querySelector('#abA')).display") == 'block', 'T12: A-B tap 1 sets A and shows the marker')
    ev("(()=>{__lf.Native.seek(20); document.querySelector('#np .abbtn').click();})()");
    check(page.inner_text('#np .abbtn') == 'A-B' and ev("getComputedStyle(document.querySelector('#abB')).display") == 'block', 'T12: A-B tap 2 sets B')
    ev("__lf.Native.seek(19.9)"); page.wait_for_timeout(1200); pos = ev("__lf.Native.state.pos"); check(10 <= pos < 12.5, f'T12: passing B jumps back to A (pos {pos})')
    page.click('#np .abbtn'); check(page.inner_text('#np .abbtn') == 'A-B' and ev("document.querySelector('#np .abbtn').classList.contains('on')") is False, 'T12: A-B tap 3 clears the loop')
    ev("__lf.Native.next()"); page.wait_for_timeout(200); check(ev("getComputedStyle(document.querySelector('#abA')).display") == 'none', 'T12: a new song starts without a loop')

    # step 16: T26 accessibility: every icon-only button has a name, switches have roles, live region exists
    page.evaluate("__lf.openNP()"); page.wait_for_timeout(300)
    bad = page.evaluate("""[...document.querySelectorAll('button')].filter(b => !(b.textContent||'').trim() && !b.getAttribute('aria-label')).map(b => b.dataset.act || b.className)""")
    check(not bad, f'T26: icon-only buttons without a name: {bad}')
    check(page.evaluate("!!document.querySelector('#live[aria-live=polite]')"), 'T26: live region')

    # step 17 removed in v51 (Library health deleted)

    # step 18: T12 drag handles (playlist edit mode + Up Next). Real mouse = pointer events, like a finger.
    ev("localStorage.clear()")   # start from a clean app like a standalone run: state left by the 17 steps before (restored mini player, sort / health choices) made the two drag checks flake
    page.reload(); page.wait_for_selector('#main .tabbar, #tabs'); ev("__lf.go('library'); __lf.push('playlist','p2')"); page.wait_for_selector('#sub [data-act="plmenu"]')
    page.click('#sub [data-act="plmenu"]'); page.click('#sheet [data-act="pl-edit"]'); page.wait_for_selector('#sub .plrow .dh'); page.wait_for_timeout(800)   # let the screen finish sliding in, or the boxes we aim at are still moving
    order = lambda: ev("[...document.querySelectorAll('#sub .plrow .song')].map(e=>e.dataset.tid)")
    check(order() == ['t10', 't11', 't12', 't13', 't14'], 'T12: playlist in edit mode shows drag handles'); 
    def still(sel):   # wait until the box stops moving (slide-in / re-render): a drag started on a moving row is what made these checks flake
        last = None
        for _ in range(40):
            bb = page.locator(sel).bounding_box()
            if bb and last and all(abs(bb[k] - last[k]) < 0.5 for k in ('x', 'y', 'width', 'height')): return
            last = bb; page.wait_for_timeout(100)
    def reveal(sel):   # root cause of the flaky upward drag: the mini player / tab bar floats over the lower rows, so the press landed on the mini player and no drag started. Scroll the handle clear of the floating bars, then wait until a hit test at its centre really returns it (no fixed sleep).
        page.evaluate("""s => { const h = document.querySelector(s); if (!h) return; const bars = ['#mini .mini', '.tabbar'].map(q => document.querySelector(q)).filter(Boolean).map(b => b.getBoundingClientRect().top); const lim = Math.min(innerHeight, ...bars) - 12, d = h.getBoundingClientRect().bottom - lim; if (d > 0) { let n = h.parentElement; while (n && n.scrollHeight <= n.clientHeight + 1) n = n.parentElement; if (n) n.scrollTop += d; } }""", sel)
        page.wait_for_function("""s => { const h = document.querySelector(s); if (!h) return false; const r = h.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && h.contains(e); }""", arg=sel)
    def drag(src_sel, dst_sel, steps=8):
        reveal(src_sel); still(src_sel); still(dst_sel)
        a = page.locator(src_sel).bounding_box(); b = page.locator(dst_sel).bounding_box()
        page.mouse.move(a['x'] + a['width'] / 2, a['y'] + a['height'] / 2); page.mouse.down(); page.wait_for_timeout(50)
        page.mouse.move(a['x'] + a['width'] / 2, b['y'] + b['height'] / 2, steps=steps)
        mid = ev("!!document.querySelector('.dragging')"); page.mouse.up(); page.wait_for_function("!document.querySelector('.dragging, .dropat')"); return mid
    mid = drag('#sub .plrow[data-drow="0"] .dh', '#sub .plrow[data-drow="2"] .row'); page.wait_for_timeout(150)
    check(mid and order() == ['t11', 't12', 't10', 't13', 't14'], f'T12: dragging the first playlist song below the third reorders it ({order()})')
    check(ev("(JSON.parse(localStorage.getItem('lf.playlists')||'null')||[]).some(p=>(p.ids||[]).join(',')==='t11,t12,t10,t13,t14')"), 'T12: (persisted through savePl)')
    drag('#sub .plrow[data-drow="3"] .dh', '#sub .plrow[data-drow="0"] .row'); page.wait_for_timeout(150)
    check(order() == ['t13', 't11', 't12', 't10', 't14'], f'T12: dragging upwards works ({order()})')
    n = order(); a = page.locator('#sub .plrow[data-drow="1"] .dh').bounding_box(); page.mouse.move(a['x'] + 5, a['y'] + 5); page.mouse.down(); page.mouse.move(a['x'] + 5, a['y'] + 8); page.mouse.up(); page.wait_for_timeout(100)
    check(order() == n and not ev("!!document.querySelector('.dragging')"), 'T12: a tap on the handle without moving changes nothing')
    page.click('#sub .plrow[data-drow="0"] [data-act="pl-rm"]'); page.wait_for_timeout(100); check(len(order()) == 4, 'T12: remove button still works next to the handle')
    ev("__lf.go('albums'); __lf.push('album','a5')"); page.wait_for_selector('#sub [data-act="playall"]'); page.click('#sub [data-act="playall"]'); page.wait_for_timeout(100)
    ev("__lf.Native.setShuffle(false)"); ev("__lf.openNP()"); page.click('#np [data-act="queue"]'); page.wait_for_selector('#sheet .qlist .dh'); page.wait_for_timeout(800)
    for _ in range(20):   # autoplay fill / restore may still be adding songs: wait until the queue stops changing
        before = upcoming_titles(); page.wait_for_timeout(250)
        if upcoming_titles() == before: break
    page.wait_for_selector('#sheet .songwrap[data-drow="3"] .row'); before = upcoming_titles()
    drag('#sheet .songwrap[data-drow="1"] .dh', '#sheet .songwrap[data-drow="3"] .row'); page.wait_for_timeout(150)
    after = upcoming_titles()
    check(after[:3] == [before[1], before[2], before[0]] and sheet_titles() == after, f'T12: Up Next drag moves the song in the real queue and the sheet matches (before {before}, after {after})')
    check(ev("document.querySelectorAll('#sheet .qlist .sr').length") > 0 and ev("[...document.querySelectorAll('#sheet .qlist [data-act=\"q-up\"]')].every(b=>b.getAttribute('aria-label')==='Move up')"), 'T12: arrows stay as hidden, labelled buttons for TalkBack')

    check(not errors, f'no console / page errors {errors[:3]}')
    br.close()
srv.shutdown()
print('\nSMOKE', 'FAILED' if fails else 'OK'); sys.exit(1 if fails else 0)
