# BUG #31 / #32: loads the real app.css into Chromium and checks computed styles.
# #31: .lstop caption (em), name (b) and .meta must get their rules from the real markup (lstats.js topCard).
# #32: rows with [data-liquid] / .cluster / .actions must keep vertical panning (touch-action pan-y), not none.
import sys, pathlib
from playwright.sync_api import sync_playwright
import pw_helper
css = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
html = f"""<!doctype html><html><head><style>{css}</style></head><body>
<button class="lstop" id=t><span class="cover"></span><span class="meta" id=m><em id=e>Top song</em><b id=b>Name</b><span id=s>3 plays</span></span></button>
<div class="actions" id=a data-liquid></div><div class="cluster" id=c></div>
</body></html>"""
fails = []
with sync_playwright() as pw:
    exe = pw_helper.chromium_exe()
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    page = br.new_page(); page.set_content(html)
    g = lambda i, p: page.evaluate("([i,p]) => getComputedStyle(document.getElementById(i))[p]", [i, p])
    checks = [('e', 'display', 'block'), ('e', 'textTransform', 'uppercase'), ('b', 'display', 'block'), ('m', 'minWidth', '0px'), ('m', 'flexGrow', '1'),
              ('a', 'touchAction', 'pan-y'), ('c', 'touchAction', 'pan-y')]
    for i, p, want in checks:
        got = g(i, p); ok = got == want
        print(('OK  ' if ok else 'FAIL'), i, p, got, '(want ' + want + ')')
        if not ok: fails.append((i, p))
    br.close()
sys.exit(1 if fails else 0)
