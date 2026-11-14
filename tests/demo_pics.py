"""Screenshot / recording helper: fills the demo library with the sample pictures in tests/fixtures/demo-pics/ (p1-p6.jpg, the user's own dummy-data pictures) (album covers, artist photos, genre pictures, profile picture)
by writing them into the app's OWN storage (IndexedDB + the small localStorage marks) before the app starts, then reloading. The app code is never touched."""
import base64, pathlib, shutil
from PIL import Image
D = pathlib.Path(__file__).resolve().parent / 'fixtures' / 'demo-pics'
ALB = ['p1.jpg', 'p2.jpg', 'p3.jpg', 'p4.jpg', 'p5.jpg', 'p6.jpg', 'p1.jpg', 'p3.jpg']        # a1..a8
ART = ['p4.jpg', 'p1.jpg', 'p2.jpg', 'p5.jpg', 'p3.jpg', 'p6.jpg', 'p2.jpg', 'p4.jpg']
GEN = ['p3.jpg', 'p5.jpg', 'p1.jpg', 'p2.jpg', 'p6.jpg', 'p4.jpg', 'p5.jpg', 'p1.jpg']
PROFILE, BG = 'p1.jpg', 'p3.jpg'
MIME = {'.jpg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif'}
def _b64(n): return base64.b64encode((D / n).read_bytes()).decode()
def _f(n): return {'b': _b64(n), 'type': MIME[pathlib.Path(n).suffix]}
def data_url(n): return 'data:%s;base64,%s' % (MIME[pathlib.Path(n).suffix], _b64(n))
def override_samples(pics):   # playlist picture + update-popup picture
    shutil.copy(D / 'ai.gif', pics / 'night-drive.gif')
def override_bg(path):
    Image.open(D / BG).convert('RGB').save(path, quality=92)
def override_banner(path): shutil.copy(D / 'banner.png', path)

JS = r"""async (P) => {
  const d = await import('/src/data.js');
  const put = (db, k, f) => new Promise((res, rej) => { const bin = atob(f.b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const r = indexedDB.open(db, 1); r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put({ __lfb: 1, buf: u.buffer, type: f.type, name: '' }, k); t.oncomplete = () => { r.result.close(); res(); }; t.onerror = () => rej(t.error); }; r.onerror = () => rej(r.error); });
  const albp = {}, apics = {}, gp = {}, jobs = [];
  d.albums.forEach((a, i) => { albp[a.id] = 1; jobs.push(put('lf-albumpics', a.id, P.alb[i % P.alb.length])); });
  d.artists.forEach((n, i) => { apics[n] = 'gif:1'; jobs.push(put('lf-artistgifs', n, P.art[i % P.art.length])); });
  [...new Set(d.albums.map(a => a.genre))].forEach((g, i) => { gp[g] = 1; jobs.push(put('lf-genrepics', g, P.gen[i % P.gen.length])); });
  jobs.push(put('lf-profile', 'media', P.pf));
  await Promise.all(jobs);
  const L = (k, v) => localStorage.setItem(k, v);
  L('lf.albpics', JSON.stringify(albp)); L('lf.apics', JSON.stringify(apics)); L('lf.gpics', JSON.stringify(gp)); L('lf.haspf', '1');
}"""

def seed(pg, url, bg=False):
    pg.evaluate(JS, {'alb': [_f(n) for n in ALB], 'art': [_f(n) for n in ART], 'gen': [_f(n) for n in GEN], 'pf': _f(PROFILE)})
    pg.reload(); pg.wait_for_selector('#tabs'); pg.wait_for_timeout(3500)
