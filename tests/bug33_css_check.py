# BUG #33 (Chromium): the tap-glint hosts .mini .mb and .searchpill must be position:relative, so the glint ::after (inset:0) covers only the pressed control, not .mini / an ancestor. Usage: python3 -I tests/bug33_css_check.py <project dir>
import sys
from playwright.sync_api import sync_playwright
css=open(sys.argv[1]+'/src/styles/app.css',encoding='utf-8').read()
html='<style>'+css+'</style><div id="app"><div class="mini"><button class="mb">x</button></div><div class="searchpill"><input></div></div>'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); pg.set_content(html)
    for sel in ['.mini .mb','.searchpill','.mini']:
        print(sel, pg.evaluate("s=>getComputedStyle(document.querySelector(s)).position",sel))
    b.close()
