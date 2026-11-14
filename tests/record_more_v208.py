"""Two extra screen recordings (06-search.mp4, 07-listening-stats.mp4) in docs/screen-recordings/. Same setup and quality as record_v208.py.
Needs: pip install playwright + a Chromium, and ffmpeg. Run from the project root: python3 tests/record_more_v208.py"""
import sys, pathlib, tempfile, shutil
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from rec_common import *

def finish(ctx, pg, errors, out_name):
    vid = pg.video.path(); ctx.close(); dst = OUT / out_name
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(vid), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(dst)], check=True)
    print('wrote', dst.name, dst.stat().st_size // 1024, 'KB', 'errors', errors); return errors

fails = []
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    tmp = pathlib.Path(tempfile.mkdtemp(prefix='lfrec-'))

    # 6) Search
    ctx, pg, errors = new_page(br, tmp / 'search')
    pg.evaluate("__lf.go('search')"); pg.wait_for_timeout(1500)
    for q in ['st', 'star', 'ruby', 'glass', 'dear fans', '']:
        pg.evaluate(f"__lf.setQuery({q!r})"); pg.wait_for_timeout(2200)
    pg.evaluate("__lf.go('home')"); pg.wait_for_timeout(800)
    fails += finish(ctx, pg, errors, '06-search.mp4')

    # 7) Listening stats: Daily / Weekly / Monthly / Yearly / Overall
    ctx, pg, errors = new_page(br, tmp / 'stats')
    pg.evaluate("__lf.push('lstats')"); pg.wait_for_timeout(2000)
    for label in ['Weekly', 'Monthly', 'Yearly', 'Overall', 'Daily']:
        pg.get_by_text(label, exact=True).first.click(); pg.wait_for_timeout(2300)
    pg.mouse.move(195, 500); pg.mouse.wheel(0, 500); pg.wait_for_timeout(1500)
    fails += finish(ctx, pg, errors, '07-listening-stats.mp4')
    br.close()
shutil.rmtree(tmp, ignore_errors=True); print('FAILS', fails)
