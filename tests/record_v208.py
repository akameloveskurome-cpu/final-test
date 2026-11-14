"""Screen recordings of the app (docs/screen-recordings/*.mp4). Uses the demo library, with its names and lyrics
replaced by an Oshi no Ko theme at run time (this script only; src/data.js and the screenshots are not changed).
Needs: pip install playwright + a Chromium, and ffmpeg. Run from the project root: python3 tests/record_v208.py"""
import http.server, threading, pathlib, sys, subprocess, shutil, tempfile
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
        if f.suffix == '.json': return self._send(200, 'text/javascript', b'export default ' + f.read_bytes())
        return self._send(200, 'text/javascript' if f.suffix == '.js' else 'application/octet-stream', f.read_bytes())
    def _send(self, code, ctype, body):
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/'

import pw_helper; exe = pw_helper.chromium_exe()
import demo_pics
OUT = ROOT / 'docs' / 'screen-recordings'; OUT.mkdir(parents=True, exist_ok=True)

# Oshi no Ko theme (original names and lyrics; the characters are from the show, the songs are made up for this demo).
THEME_JS = r"""async () => {
  const d = await import('/src/data.js');
  const A = { a1: ['Starlight Stage', 'Ai Hoshino'], a2: ['Twin Stars', 'B-Komachi'], a3: ['Ruby Sparkle', 'Ruby Hoshino'],
    a4: ['Aqua Afterglow', 'Aqua Hoshino'], a5: ['Behind the Mask Sessions', 'Ai Hoshino'], a6: ['Spotlight Diary', 'B-Komachi'],
    a7: ['Encore Glass', 'Ruby Hoshino'], a8: ['Dear Fans', 'Ai Hoshino'] };
  const TT = { t1: 'Stage Lights', t2: 'Smile Bloom', t3: 'Starlight Diary', t4: 'Encore Night', t5: 'Backstage Hearts',
    t6: 'Velvet Spotlight', t7: 'Curtain Call', t8: 'Afterglow Idol', t9: 'Heartbeat Count', t10: 'Ruby Sparkle',
    t11: 'Mask Off, Heart On', t12: 'Hidden Smile', t13: 'Rehearsal Room', t14: 'Last Verse', t15: 'Tide of Cheers',
    t16: 'Neon Dream', t17: 'Satin Stage', t18: 'Glass Heart', t19: 'Glasswork Dawn', t20: 'Dear Fans' };
  const LY = {
    t1: ['Under the lights, I open my heart', 'One step forward, the whole room sings', 'Stage lights, stay with me tonight', 'Every smile a promise I keep', 'Stage lights, carry me home'],
    t4: ['Under the spotlight, I shine for you', 'Count to three and the music starts', 'Every fan a star in the dark', 'Encore, encore, let the night go on', 'Under the spotlight, I shine for you'],
    t10: ['Every light I chase begins with you', 'Ruby red across the stage', 'Sparkle in my eyes, a little brighter', 'Hold the beat and never look away', 'Every light I chase begins with you'],
    t15: ['Every cheer, a star I hold', 'Hands up high, the tide comes in', 'Voices rising, one bright song', 'Every cheer, a star I hold', 'Carry the night until the dawn'],
    t20: ['I keep your name inside my heart', 'Thank you for the nights you came', 'Wave your lights, I see you all', 'Dear fans, this song is for you', 'I keep your name inside my heart'],
  };
  const lrc = lines => lines.map((ln, i) => '[' + String(Math.floor(i * 5 / 60)).padStart(2, '0') + ':' + String(i * 5 % 60).padStart(2, '0') + '.00]' + ln).join('\n');
  d.albums.forEach(a => { if (A[a.id]) { a.title = A[a.id][0]; a.artist = A[a.id][1]; } });
  d.tracks.forEach(t => { if (TT[t.id]) t.title = TT[t.id]; if (LY[t.id]) t.lyric = lrc(LY[t.id]); });
  const names = [...new Set(d.albums.map(a => a.artist))];
  d.artists.splice(0, d.artists.length, ...names);
  const PL = { p1: 'Stage Night', p2: "Ai's Favorites", p3: 'Tour Bus' };
  d.playlists.forEach(p => { if (PL[p.id]) p.name = PL[p.id]; });
  return true;
}"""

def new_page(br, video_dir=None, name=None):
    kw = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    if video_dir is not None:
        kw.update(record_video_dir=str(video_dir), record_video_size={'width': 390, 'height': 844})
    ctx = br.new_context(**kw); pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('#tabs'); pg.wait_for_timeout(900)
    demo_pics.seed(pg, URL)
    pg.evaluate(THEME_JS); pg.wait_for_timeout(200)
    pg.evaluate("__lf.go('home')"); pg.wait_for_timeout(700)
    return ctx, pg, errors

def R(pg):   # clean state: no sheet, no open Now Playing / lyrics, Home tab
    pg.evaluate("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())"); pg.evaluate("document.querySelector('#sheet').innerHTML = ''")
    pg.evaluate("document.querySelectorAll('#np, #lyr').forEach(e => e.classList.remove('open'))"); pg.evaluate("__lf.go('home')"); pg.wait_for_timeout(600)

def play_album(pg, aid):
    pg.evaluate(f"__lf.go('albums'); __lf.push('album','{aid}')"); pg.wait_for_selector('#sub [data-act="playall"]', timeout=20000)
    pg.wait_for_timeout(500); pg.evaluate("document.querySelector('#sub [data-act=\"playall\"]').click()"); pg.wait_for_timeout(700)

def tour(pg):
    pg.wait_for_timeout(1500)                        # Home
    pg.evaluate("__lf.go('albums')"); pg.wait_for_timeout(1200)
    pg.evaluate("__lf.push('album','a1')"); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelector('#sub [data-act=\"playall\"]').click()"); pg.wait_for_timeout(800)
    pg.evaluate("__lf.openNP()"); pg.wait_for_timeout(2000)                       # Now Playing
    pg.evaluate("document.querySelector('#np [data-act=\"lyrics\"]').click()"); pg.wait_for_timeout(1500)   # Lyrics
    pg.evaluate("document.querySelector('#lyrbody [data-li=\"3\"]').click()"); pg.wait_for_timeout(2000)
    pg.evaluate("document.querySelector('#lyr [data-act=\"lyr-close\"]').click()"); pg.wait_for_timeout(600)
    pg.evaluate("document.querySelector('#np [data-act=\"queue\"]').click()"); pg.wait_for_timeout(1500)   # Up Next
    pg.evaluate("document.querySelectorAll('#sheet .scrim').forEach(x=>x.click())"); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('#np [data-act=\"sleep\"]').click()"); pg.wait_for_timeout(1200)   # Sleep timer
    pg.evaluate("document.querySelector('#sheet [data-min=\"30\"]').click()"); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelector('#np [data-act=close-np]').click()"); pg.wait_for_timeout(1000)
    pg.evaluate("__lf.go('library'); __lf.push('genres')"); pg.wait_for_timeout(2000)   # Genres
    pg.evaluate("__lf.go('home'); __lf.push('playlists')"); pg.wait_for_timeout(2000)   # Playlists
    pg.evaluate("__lf.go('home')"); pg.wait_for_timeout(1000)
    pg.evaluate("__lf.push('settings')"); pg.wait_for_timeout(1500)                 # Settings
    pg.mouse.move(195, 500); pg.mouse.wheel(0, 500); pg.wait_for_timeout(1500)
    pg.evaluate("__lf.push('lyranim')"); pg.wait_for_timeout(1800)                 # Lyrics animation
    pg.evaluate("__lf.go('home')"); pg.wait_for_timeout(800)

def finish(ctx, pg, errors, out_name):
    vid = pg.video.path(); ctx.close()
    dst = OUT / out_name
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(vid), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(dst)], check=True)
    print('wrote', dst.name, dst.stat().st_size // 1024, 'KB', 'errors', errors)
    return errors

fails = []
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    tmp = pathlib.Path(tempfile.mkdtemp(prefix='lfrec-'))

    # 1) full app tour
    ctx, pg, errors = new_page(br, tmp / 'tour')
    tour(pg); fails += finish(ctx, pg, errors, '01-app-tour.mp4')

    # 2) Now Playing with synced lyrics
    ctx, pg, errors = new_page(br, tmp / 'lyrics')
    pg.evaluate("__lf.go('albums'); __lf.push('album','a5')"); pg.wait_for_timeout(900)
    play_album(pg, 'a5'); pg.evaluate("__lf.openNP()"); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelector('#np [data-act=\"lyrics\"]').click()"); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelector('#lyrbody [data-li=\"2\"]').click()"); pg.wait_for_timeout(2500)
    pg.evaluate("document.querySelector('#lyrbody [data-li=\"4\"]').click()"); pg.wait_for_timeout(2500)
    fails += finish(ctx, pg, errors, '02-lyrics.mp4')

    # 3) Immersive album cover
    ctx, pg, errors = new_page(br, tmp / 'immersive')
    pg.evaluate("__lf.go('home'); __lf.push('settings')"); pg.wait_for_timeout(900)
    pg.evaluate("document.querySelector('[data-k=\"npImmersive\"]').click()"); pg.wait_for_timeout(800)
    pg.evaluate("__lf.go('home')"); pg.wait_for_timeout(500)
    play_album(pg, 'a1'); pg.evaluate("__lf.openNP()"); pg.wait_for_timeout(2500)
    fails += finish(ctx, pg, errors, '03-immersive-cover.mp4')

    # 4) Library: songs, genres, playlists
    ctx, pg, errors = new_page(br, tmp / 'library')
    pg.evaluate("__lf.go('library')"); pg.wait_for_timeout(1500)
    pg.evaluate("__lf.push('songs')"); pg.wait_for_timeout(2200)
    pg.evaluate("__lf.go('home'); __lf.push('genres')"); pg.wait_for_timeout(2200)
    pg.evaluate("__lf.go('home'); __lf.push('playlists')"); pg.wait_for_timeout(2200)
    fails += finish(ctx, pg, errors, '04-library.mp4')

    # 5) Settings and sleep timer
    ctx, pg, errors = new_page(br, tmp / 'settings')
    pg.evaluate("__lf.push('settings')"); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelector('[data-k=\"npImmersive\"]') && 0"); pg.wait_for_timeout(300)
    pg.mouse.move(195, 500); pg.mouse.wheel(0, 500); pg.wait_for_timeout(1500)
    pg.evaluate("__lf.push('animation')"); pg.wait_for_timeout(1800)
    pg.evaluate("__lf.go('home'); __lf.push('lysize')"); pg.wait_for_timeout(1800)
    fails += finish(ctx, pg, errors, '05-settings.mp4')

    br.close()
shutil.rmtree(tmp, ignore_errors=True)
print('FAILS', fails)
sys.exit(1 if any(fails) else 0)
