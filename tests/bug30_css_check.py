# BUG #30: a doubled ::after::after makes the whole selector list invalid, so the rule is dropped in browsers.
# Loads the real rule line from a stylesheet into Chromium and checks that the inherited radius is applied.
import sys, pathlib
from playwright.sync_api import sync_playwright
import pw_helper
css_file = pathlib.Path(sys.argv[1])
rule = [l for l in css_file.read_text(encoding='utf-8').split('\n') if '.lstop.lq-on' in l and 'border-radius:inherit' in l][0]
html = f"""<!doctype html><html><head><style>{rule}</style></head><body>
<div id=lo class=lstop style="border-radius:12px;width:40px;height:40px;position:absolute"><span></span></div>
<div id=ro class=row style="border-radius:9px;width:40px;height:40px;position:absolute;top:60px"></div>
<style>.row.lq-on,.lstop.lq-on{{position:relative}}</style>
<div id=lq class="lstop lq-on" style="border-radius:12px;width:40px;height:40px;position:absolute;top:120px"></div>
<div id=rq class="row lq-on" style="border-radius:9px;width:40px;height:40px;position:absolute;top:180px"></div>
</body></html>"""
with sync_playwright() as pw:
    exe = pw_helper.chromium_exe()
    br = pw.chromium.launch(executable_path=str(exe) if exe else None, args=['--no-sandbox'])
    page = br.new_page()
    page.set_content(html)
    rules = page.evaluate("() => document.styleSheets[0].cssRules.length")
    radius = {k: page.evaluate(f"() => getComputedStyle(document.getElementById('{k}'), '::after').borderTopLeftRadius") for k in ['lq', 'rq']}
    print(css_file.name, '| rules parsed:', rules, '| ::after radius lstop:', radius['lq'], '| row:', radius['rq'])
    br.close()
