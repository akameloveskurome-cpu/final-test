"""Round trip in two fresh browser profiles (v208): set the animation, liquid glass and lyrics animation values and the
Lens refraction switch on device A, export through the Settings button, then import the file on device B (empty storage),
tick everything and check the values come back. Also prints the groups in the file and the labels in the import sheet.
Run: python3 tests/settings_roundtrip.py   (exit 1 when a value does not come back)"""
import importlib.util, time, json, pathlib, sys
import os
ROOT=pathlib.Path(__file__).resolve().parent.parent; os.chdir(ROOT)
spec=importlib.util.spec_from_file_location('ge',str(ROOT/'tests'/'glass_extremes.py')); ge=importlib.util.module_from_spec(spec); spec.loader.exec_module(ge)
from playwright.sync_api import sync_playwright
CUSTOM={'speed':75,'bounce':60,'jelly':30,'pillStretch':115,'fringe':140,'magnify':85}
def set_slider(page,k,v):
    page.evaluate(f"(()=>{{const i=document.querySelector('input[data-ak=\"{k}\"]'); i.value={v}; i.dispatchEvent(new Event('input',{{bubbles:true}}));}})()")
with sync_playwright() as pw:
    br=pw.chromium.launch(executable_path=str(ge.exe) if ge.exe else None,args=['--no-sandbox'])
    # ---- device A: set custom values, export
    ctxA=br.new_context(viewport={'width':390,'height':844},has_touch=True,accept_downloads=True); pa=ctxA.new_page(); errs=[]
    pa.on('pageerror',lambda e: errs.append(str(e)[:150]))
    pa.goto(ge.URL); pa.wait_for_selector('#tabs .tab'); time.sleep(0.4)
    pa.evaluate("__lf.go('home'); __lf.push('animation')"); time.sleep(0.6)
    for k,v in CUSTOM.items(): set_slider(pa,k,v)
    time.sleep(0.3)
    pa.evaluate("__lf.go('home'); __lf.push('lyranim')"); time.sleep(0.6)
    lyk=pa.locator('input[data-lyk]').first; lk=lyk.get_attribute('data-lyk'); pa.evaluate(f"(()=>{{const i=document.querySelector('input[data-lyk=\"{lk}\"]'); i.value=20; i.dispatchEvent(new Event('input',{{bubbles:true}}));}})()")
    pa.evaluate("__lf.go('home'); __lf.push('settings')"); time.sleep(0.6)
    tog=pa.locator('.toggle').filter(has=pa.locator('xpath=ancestor::*[contains(@class,"row") or contains(@class,"setrow")][1]')) 
    row=pa.locator('.setrow', has_text='Lens refraction').first
    row.locator('.toggle').click(); time.sleep(0.3)
    time.sleep(1.5)  # settings are saved after the finger pauses
    stored=pa.evaluate("localStorage.getItem('lf.settings')")
    print('A stored anim:', json.loads(stored)['anim'], 'refract:', json.loads(stored)['refract'], 'lyAnim:', json.loads(stored).get('lyAnim',{}).get(lk))
    with pa.expect_download() as dl:
        pa.locator('[data-act="setexport"]').first.click()
    d=dl.value; path=pathlib.Path(os.environ.get('LF_OUT','/tmp'))/'exported.json'; d.save_as(path)
    out=json.loads(path.read_text())
    print('FILE name', d.suggested_filename, 'groups:', sorted(out['settings'].keys()))
    print('FILE anim:', out['settings'].get('anim'))
    print('FILE refract:', out['settings'].get('refract'), 'lyAnim:', out['settings'].get('lyAnim'))
    ctxA.close()
    # ---- device B: brand new profile, import
    ctxB=br.new_context(viewport={'width':390,'height':844},has_touch=True); pb=ctxB.new_page(); berrs=[]
    pb.on('pageerror',lambda e: berrs.append(str(e)[:150]))
    pb.goto(ge.URL); pb.wait_for_selector('#tabs .tab'); time.sleep(0.4)
    print('B before stored anim:', pb.evaluate("localStorage.getItem('lf.settings')"))
    pb.evaluate("__lf.go('home'); __lf.push('settings')"); time.sleep(0.6)
    with pb.expect_file_chooser() as fc:
        pb.locator('[data-act="setimport"]').first.click()
    fc.value.set_files(str(path)); time.sleep(0.8)
    labels=pb.locator('#sheet .picklist b').all_inner_texts()
    print('IMPORT SHEET LABELS:', labels)
    pb.locator('[data-act="set-all"]').first.click(); time.sleep(0.3)
    print('ok button enabled:', pb.locator('[data-act="setimport-ok"]').is_enabled())
    with pb.expect_navigation(timeout=5000) as nv:
        pb.locator('[data-act="setimport-ok"]').first.click()
    time.sleep(1.5)
    pb.evaluate("__lf.go('home'); __lf.push('animation')"); time.sleep(0.6)
    got={k: pb.evaluate(f"document.querySelector('input[data-ak=\"{k}\"]').value") for k in CUSTOM}
    print('B after import sliders:', got)
    print('B expected          :', {k:str(v) for k,v in CUSTOM.items()})
    pb.evaluate("__lf.go('home'); __lf.push('settings')"); time.sleep(0.6)
    print('B refract toggle on?', pb.locator('.setrow', has_text='Lens refraction').first.locator('.toggle').evaluate("e=>e.classList.contains('on')"))
    print('B lyAnim', pb.evaluate(f"JSON.parse(localStorage.getItem('lf.settings')).lyAnim && JSON.parse(localStorage.getItem('lf.settings')).lyAnim['{lk}']"))
    print('errors A', errs, 'B', berrs)
    ok = all(str(got[k]) == str(CUSTOM[k]) for k in CUSTOM)
    br.close()
    sys.exit(0 if ok and not errs and not berrs else 1)
