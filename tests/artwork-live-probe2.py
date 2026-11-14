# Artwork live probe 2: background-allow card (native hacked on): shown once, picture swapped in place. Run: python3 tests/artwork-live-probe2.py
import http.server, threading, pathlib, sys, json, base64, re, os
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
MAP = {'/@capacitor/core': 'tests/stubs/capacitor-core.js', '/@capacitor/app': 'tests/stubs/capacitor-app.js'}
APP_STUB = b"export const App = { addListener: () => {}, minimizeApp: () => {}, getInfo: async () => ({ build: '1500000000', version: '0.208.0' }) };"
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/':
            html = (ROOT / 'index.html').read_text().replace('<script type="module"',
              '<script type="importmap">{"imports":{"@capacitor/core":"/@capacitor/core","@capacitor/app":"/@capacitor/app"}}</script>'
              '<link rel="stylesheet" href="/src/styles/tokens.css"><link rel="stylesheet" href="/src/styles/app.css">\n<script type="module"')
            return self._send(200, 'text/html', html.encode())
        if path == '/@capacitor/app': return self._send(200, 'text/javascript', APP_STUB)
        if path in MAP: return self._send(200, 'text/javascript', (ROOT / MAP[path]).read_bytes())
        f = ROOT / path.lstrip('/')
        if not f.is_file(): return self._send(404, 'text/plain', b'nf')
        if f.suffix == '.css': return self._send(200, 'text/css', f.read_bytes()) if self.headers.get('Sec-Fetch-Dest','') == 'style' else self._send(200, 'text/javascript', b'export default 1;')
        if f.suffix == '.json': return self._send(200, 'text/javascript', b'export default ' + f.read_bytes())
        if f.suffix == '.js':   # a bare browser has no import.meta.env: give it the same values the GitHub build sets
            src = f.read_text().replace('import.meta.env', '({VITE_REPO:"owner/liquid-dark",VITE_BRANCH:"main",VITE_CODE_ID:"aaaaaaaaaaaa"})')
            return self._send(200, 'text/javascript', src.encode())
        return self._send(200, 'application/octet-stream', f.read_bytes())
    def _send(self, code, ctype, body):
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/'

import zlib, struct, time
def png(w,h,rgb):
    raw=b''.join(b'\x00'+bytes(rgb)*w for _ in range(h))
    def ch(t,d): c=struct.pack('>I',len(d))+t+d; return c+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw))+ch(b'IEND',b'')
FOLD={'notification-popup-gif-pic':None,'update-popup-gif-pic':None,'splash-pic':None,'credit-gif-pic':None,'background-allow-gif-pic':None,'stats-banner-gif-pic':None,'app-logo-pic':None}
hits={k:[] for k in FOLD}; T0=time.time()
def setpic(folder,name,stamp,color):
    FOLD[folder]={'name':name,'stamp':stamp,'png':png(60,40,color)}
def route(r):
    u=r.request.url; m=__import__('re').match(r'https://raw.githubusercontent.com/owner/liquid-dark/main/([^/]+)/([^?]+)',u)
    if not m: return r.fulfill(status=404,body='nf')
    f,n=m.group(1),m.group(2); d=FOLD.get(f)
    if n=='latest.json':
        hits.setdefault(f,[]).append(time.time()-T0)
        if not d: return r.fulfill(status=404,body='nf')
        return r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps({'name':d['name'],'stamp':d['stamp'],'commit':d['stamp']}))
    if d and n==d['name']: return r.fulfill(status=200,content_type='image/png',headers={'Access-Control-Allow-Origin':'*'},body=d['png'])
    r.fulfill(status=404,body='nf')
for f in FOLD: setpic(f,'a.png','s1',(255,0,0))
FOLD['update-popup-gif-pic']=None
with sync_playwright() as pw:
    import pw_helper
    from pw_wait import wait_for
    exe = pw_helper.chromium_exe()
    br=pw.chromium.launch(executable_path=str(exe) if exe else None,args=['--no-sandbox']); ctx=br.new_context(viewport={'width':390,'height':844}); page=ctx.new_page()
    errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.route('https://raw.githubusercontent.com/**',route)
    page.goto(URL); page.wait_for_selector('#main .tabbar, #tabs'); ev=page.evaluate
    page.wait_for_timeout(1500)
    # dismiss any popup sheet
    ev("document.querySelector('#sheet')&&(document.querySelector('#sheet [data-act=\"popup-close\"],#sheet [data-act=\"close\"]')||{click(){}}).click()")
    # Home: banner
    ev("__lf.go('home')"); page.wait_for_timeout(1500)
    ev("""window.__m={}; const watch=(k,sel)=>{const root=document.body; window.__m[k]={src:0,rm:0,add:0}; new MutationObserver(ms=>{for(const m of ms){ if(m.type==='attributes'&&m.target.matches&&m.target.matches(sel)) window.__m[k].src++; for(const n of m.removedNodes) if(n.nodeType===1&&(n.matches(sel)||n.querySelector(sel))) window.__m[k].rm++; for(const n of m.addedNodes) if(n.nodeType===1&&(n.matches(sel)||n.querySelector(sel))) window.__m[k].add++; }}).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});}; watch('banner','#lf-statban img, #lf-statban'); watch('credit','#lf-credit-gif-pic'); watch('logo','#lf-about-logo'); watch('popup','.popimg')""")
    base={k:len(v) for k,v in hits.items()}; t=time.time(); page.wait_for_timeout(5000); el=time.time()-t
    print('HOME 5s manifest hits/sec:',{k:round((len(v)-base[k])/el,2) for k,v in hits.items()})
    print('banner still after 5s:',ev("window.__m.banner"), 'img:',ev("!!document.querySelector('#lf-statban img')"))
    # latency: banner
    t=time.time(); setpic('stats-banner-gif-pic','b.png','s2',(0,255,0))
    wait_for(page, "(()=>{const i=document.querySelector('#lf-statban img');return i&&i.complete&&i.naturalWidth>0&&window.__m.banner.src>=1})()",timeout=10000); print('banner change latency s:',round(time.time()-t,2), ev("window.__m.banner"))
    # settings about
    for fn in ("__lf.go('settings')","__lf.push('settings')"):
        try: ev(fn); page.wait_for_selector('#lf-about-logo, #lf-credit-gif-pic',timeout=2500,state='attached'); break
        except Exception: pass
    page.wait_for_timeout(1500)
    print('about present:',ev("[!!document.getElementById('lf-about-logo'),!!document.getElementById('lf-credit-gif-pic')]"),'logo/credit src',ev("[(document.getElementById('lf-about-logo')||{}).src||'',(document.getElementById('lf-credit-gif-pic')||{}).src||'']"))
    ev("window.__m.credit={src:0,rm:0,add:0};window.__m.logo={src:0,rm:0,add:0}")
    page.wait_for_timeout(5000); print('about still 5s:',ev("[window.__m.credit,window.__m.logo]"))
    for k,fo,sel in (('credit','credit-gif-pic','lf-credit-gif-pic'),('logo','app-logo-pic','lf-about-logo')):
        prev=ev("document.getElementById('%s').src"%sel); t=time.time(); setpic(fo,'c.png','s3',(0,0,255))
        try:
            wait_for(page, "a=>{const i=document.getElementById(a[0]);return i&&i.complete&&i.naturalWidth>0&&i.src!==a[1]}",arg=[sel,prev],timeout=10000); print(k,'change latency s:',round(time.time()-t,2),ev("window.__m['%s']"%k))
        except Exception as e: print(k,'NO UPDATE in 10s')
    try: ev("Object.defineProperty(__lf.Native,'isNative',{value:true,configurable:true}); __lf.Native.isBackgroundAllowed=async()=>({allowed:true}); __lf.Native.openBackgroundSettings=async()=>({})")
    except Exception as e: print('native hack failed',e)
    ev("window.__bg={src:0,rm:0,add:0}; new MutationObserver(ms=>{for(const m of ms){ if(m.type==='attributes'&&m.target.classList&&m.target.classList.contains('bgimg')) window.__bg.src++; for(const n of m.removedNodes) if(n.nodeType===1&&(n.id==='lf-bgallow'||(n.querySelector&&n.querySelector('#lf-bgallow')))) window.__bg.rm++; for(const n of m.addedNodes) if(n.nodeType===1&&n.id==='lf-bgallow') window.__bg.add++; }}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src']})")
    ev("localStorage.removeItem('lf.bgAllowSeen')")
    t=time.time(); b0=len(hits['background-allow-gif-pic'])
    try:
        page.wait_for_selector('#lf-bgallow',timeout=25000,state='attached'); print('bgallow card appeared after s:',round(time.time()-t,2),'(wait gate 10s from page load)')
    except Exception: print('bgallow card NEVER appeared')
    page.wait_for_timeout(4000); print('bgallow polls/s while open:',round((len(hits['background-allow-gif-pic'])-b0)/(time.time()-t),2),'mutations (add/rm/src):',ev('window.__bg'))
    prev=ev("(document.querySelector('#lf-bgallow .bgimg')||{}).src||''"); t=time.time(); setpic('background-allow-gif-pic','z.png','s9',(255,255,0))
    try:
        wait_for(page, "p=>{const i=document.querySelector('#lf-bgallow .bgimg');return i&&i.src!==p&&i.complete&&i.naturalWidth>0}",arg=prev,timeout=10000); print('bgallow swap latency s:',round(time.time()-t,2),ev('window.__bg'))
    except Exception: print('bgallow swap NO UPDATE')
    print('errors',errs[:3]); br.close()
srv.shutdown()
