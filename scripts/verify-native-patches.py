#!/usr/bin/env python3
"""BUG-280 (owner Option A): fail the build when a text patch of the generated android/ project did not apply.
Run by scripts/install-native.sh after all patches. Exit 1 with one line per missing patch. Run from the repo root."""
import os, re, sys
A = os.environ.get('LF_ANDROID_DIR', 'android')
bad = []
def rd(p):
    try: return open(os.path.join(A, p), encoding='utf-8').read()
    except OSError: bad.append('missing file: %s/%s' % (A, p)); return ''
man = rd('app/src/main/AndroidManifest.xml'); gr = rd('app/build.gradle'); st = rd('app/src/main/res/values/styles.xml')
for n in ['exoplayer', 'session', 'common']:
    if 'androidx.media3:media3-%s:' % n not in gr: bad.append('gradle: media3-%s dependency' % n)
if os.path.exists('signing/liquid-dark.keystore') and 'liquid-dark.keystore' not in gr: bad.append('gradle: signing config')
if os.environ.get('LF_VERSION_CODE', '').isdigit() and not re.search(r'versionCode\s+%s\b' % os.environ['LF_VERSION_CODE'], gr): bad.append('gradle: versionCode')
try:
    import json; vn = json.load(open('package.json'))['version']
    if not re.search(r'versionName\s+"%s"' % re.escape(vn), gr): bad.append('gradle: versionName')
except (OSError, KeyError, ValueError): bad.append('package.json version unreadable')
for n in ['FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK', 'FOREGROUND_SERVICE_DATA_SYNC', 'POST_NOTIFICATIONS', 'WAKE_LOCK',
          'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', 'QUERY_ALL_PACKAGES', 'BLUETOOTH_CONNECT', 'MANAGE_EXTERNAL_STORAGE', 'REQUEST_INSTALL_PACKAGES']:
    if 'android.permission.%s"' % n not in man: bad.append('manifest: permission %s' % n)
for k, label in [('.PlaybackService', 'PlaybackService service'), ('MediaButtonReceiver', 'MediaButtonReceiver'), ('<queries>', 'queries block'),
                 ('.LiquidWidget', 'LiquidWidget receiver'), ('.NowPlayingWidget', 'NowPlayingWidget receiver'), ('.UpdateDownloadService', 'UpdateDownloadService'),
                 ('.UpdateInstallActivity', 'UpdateInstallActivity'), ('androidx.core.content.FileProvider', 'FileProvider'), ('@xml/file_paths', 'FileProvider paths'),
                 ('android:screenOrientation', 'portrait lock'), ('android:largeHeap', 'largeHeap'), ('android:hardwareAccelerated', 'hardwareAccelerated')]:
    if k not in man: bad.append('manifest: %s' % label)
for n in ['Albums', 'Artists', 'Shuffle', 'Search', 'Favorites', 'Recent', 'Playlists', 'Genres']:
    if '.LiquidTiles$%s"' % n not in man: bad.append('manifest: LiquidTiles$%s receiver' % n)
for n in ['Day', 'Week', 'Month', 'All', 'Daily']:
    if '.StatsWidgets$%s"' % n not in man: bad.append('manifest: StatsWidgets$%s receiver' % n)
if 'lf_black' not in st: bad.append('res: black splash theme (styles.xml)')
if 'lf_update_files' not in rd('app/src/main/res/xml/file_paths.xml'): bad.append('res: file_paths.xml update path')
for root, _, files in os.walk('native-android/res'):
    for f in files:
        rel = os.path.relpath(os.path.join(root, f), 'native-android/res')
        if not os.path.exists(os.path.join(A, 'app/src/main/res', rel)): bad.append('res not copied: %s' % rel)
for f in os.listdir('native-android'):
    if f.endswith('.java') and not os.path.exists(os.path.join(A, 'app/src/main/java/com/liquid/flacplayer', f)): bad.append('java not copied: %s' % f)
if bad:
    sys.stderr.write('ERROR (BUG-280): the Android project patches did not all apply, build stopped:\n' + ''.join('  - %s\n' % b for b in bad))
    sys.exit(1)
print('All Android project patches verified (BUG-280)')
