#!/usr/bin/env python3
"""Remove android:icon / android:roundIcon from the <application> tag so Android
shows its own generic icon. No logo is bundled into the APK."""
import re, sys
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else 'android/app/src/main/AndroidManifest.xml')
src = path.read_text(encoding='utf-8')
masked = re.sub(r'<!--.*?-->', lambda m: ' ' * len(m.group(0)), src, flags=re.DOTALL)
m = re.search(r'<application\b[^>]*>', masked, re.IGNORECASE | re.DOTALL)
if not m:
    sys.exit('no-launcher-icon: <application> not found in ' + str(path))
tag = re.sub(r'\s+android:(?:icon|roundIcon)\s*=\s*(["\']).*?\1', '', src[m.start():m.end()], flags=re.DOTALL)
path.write_text(src[:m.start()] + tag + src[m.end():], encoding='utf-8')
print('no-launcher-icon: no launcher icon set (Android generic icon).')
