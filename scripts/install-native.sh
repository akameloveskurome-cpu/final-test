#!/usr/bin/env bash
# Copies the Java plugin into the generated android/ project. Safe to run every build (idempotent).
set -e
D=android/app/src/main/java/com/liquid/flacplayer
mkdir -p "$D"
cp native-android/*.java "$D/"
echo "Native plugin installed into $D"

# T15: black splash + widget resources (our own resources over the Capacitor defaults; the launcher icon comes from app-logo-pic/ via scripts/apply-app-logo.py)
mkdir -p android/app/src/main/res
cp -r native-android/res/. android/app/src/main/res/
echo "Splash + widget resources copied"

# T14 (v43, public repo): the signing key is NOT in the repo. CI writes it from the GitHub secret KEYSTORE_BASE64 into
# signing/liquid-dark.keystore before this script runs. The workflow stops with an error when either secret is missing, so a CI build
# is never debug-signed. The check below only matters when this script is run by hand without a key (that build uses Android's own
# throw-away debug key: it installs fine, but a later APK cannot update over it, you must uninstall first).
# v141: the key file was renamed liquid-flac.keystore -> liquid-dark.keystore. An older workflow file still writes the old name:
# accept either, so the order in which the workflow file and the project zip are uploaded can never leave a build unsigned by our key.
if [ ! -f signing/liquid-dark.keystore ] && [ -f signing/liquid-flac.keystore ]; then cp signing/liquid-flac.keystore signing/liquid-dark.keystore; fi
if [ ! -f signing/liquid-dark.keystore ]; then
  echo "WARNING: no signing/liquid-dark.keystore: a manual build will use the default debug key (CI stops earlier and never gets here). Add the KEYSTORE_BASE64 + KEYSTORE_PASSWORD secrets (see signing/README.md)." >&2
fi

# T4: Media3 dependencies + service + permissions; T14: stable signing; T15: black splash theme (all idempotent)
python3 - <<'PY'
import re, os
g = 'android/app/build.gradle'; s = open(g).read()
if 'media3' not in s:
    deps = ''.join('    implementation "androidx.media3:media3-%s:1.3.1"\n' % n for n in ['exoplayer', 'session', 'common'])
    assert 'dependencies {\n' in s; s = s.replace('dependencies {\n', 'dependencies {\n' + deps, 1)
# T14: sign the debug build with our own key (same key every build = updates install over the old app); password comes from the environment, never from the repo
if os.path.exists('signing/liquid-dark.keystore') and 'liquid-dark.keystore' not in s:
    s += '''

// T14: stable signing (added by scripts/install-native.sh)
android {
    signingConfigs {
        liquid {
            storeFile file("$rootDir/../signing/liquid-dark.keystore")
            storePassword System.getenv("LF_STORE_PASSWORD")
            keyAlias "liquid dark"
            keyPassword System.getenv("LF_STORE_PASSWORD")
        }
    }
    buildTypes {
        debug { signingConfig signingConfigs.liquid }
        release { signingConfig signingConfigs.liquid }
    }
}
'''
open(g, 'w').write(s)

m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
if 'PlaybackService' not in s:
    svc = '<service android:name=".PlaybackService" android:foregroundServiceType="mediaPlayback" android:exported="true"><intent-filter><action android:name="androidx.media3.session.MediaSessionService"/></intent-filter><intent-filter><action android:name="android.intent.action.MEDIA_BUTTON"/></intent-filter></service>\n    '
    assert '</application>' in s and '</manifest>' in s
    s = s.replace('</application>', svc + '</application>', 1); open(m, 'w').write(s)
# BUG-158: each permission is checked on its own, so a partial earlier run still gets the missing ones
s = open(m).read()
missing = [n for n in ['FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK', 'POST_NOTIFICATIONS', 'WAKE_LOCK'] if ('android.permission.%s"' % n) not in s]
if missing:
    s = s.replace('</manifest>', ''.join('<uses-permission android:name="android.permission.%s"/>\n    ' % n for n in missing) + '</manifest>', 1); open(m, 'w').write(s)

# BUG-223: the app is portrait-only (its layout and the system-bar insets are made for portrait)
m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
if 'screenOrientation' not in s and 'android:name=".MainActivity"' in s:
    s = s.replace('android:name=".MainActivity"', 'android:name=".MainActivity" android:screenOrientation="portrait"', 1); open(m, 'w').write(s)

# v119 part 2: an earphone button pressed while the app is closed. The system hands the key to this receiver, which starts PlaybackService (which then
# puts the last queue back from resume.json). Idempotent.
m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
if 'MediaButtonReceiver' not in s:
    r = '<receiver android:name="androidx.media3.session.MediaButtonReceiver" android:exported="true"><intent-filter><action android:name="android.intent.action.MEDIA_BUTTON"/></intent-filter></receiver>\n    '
    assert '</application>' in s
    s = s.replace('</application>', r + '</application>', 1); open(m, 'w').write(s)

# v56/v57: the Equalizer row finds the phone's Real Sound Technology page in its Settings app: Android 11+ hides other apps unless the manifest says so
m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
if '<queries>' not in s:
    q = ('<queries>\n        <intent><action android:name="android.media.action.DISPLAY_AUDIO_EFFECT_CONTROL_PANEL"/></intent>\n'
         '        <intent><action android:name="android.settings.SOUND_SETTINGS"/></intent>\n'
         '        <intent><action android:name="android.intent.action.MAIN"/></intent>\n'
         '        <package android:name="com.dolby.daxappui"/>\n    </queries>\n    '
         '<uses-permission android:name="android.permission.QUERY_ALL_PACKAGES"/>\n    ')
    assert '<application' in s
    s = s.replace('<application', q + '<application', 1); open(m, 'w').write(s)

# v82: Bluetooth device names + battery % (Android 12+ asks the user once; older Android needs nothing at runtime)
m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
if 'BLUETOOTH_CONNECT' not in s:
    s = s.replace('</manifest>', '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>\n    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30"/>\n</manifest>', 1); open(m, 'w').write(s)

# v106: "All files access" (find .lrc files anywhere) + legacy storage read for older Android
m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
if 'MANAGE_EXTERNAL_STORAGE' not in s:
    s = s.replace('</manifest>', '<uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>\n</manifest>', 1); open(m, 'w').write(s)

# v106: home screen widget (song, artist, prev / play-pause / next)
m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
if 'LiquidWidget' not in s:
    r = '<receiver android:name=".LiquidWidget" android:exported="true"><intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE"/></intent-filter><meta-data android:name="android.appwidget.provider" android:resource="@xml/lf_widget_info"/></receiver>\n    '
    assert '</application>' in s; s = s.replace('</application>', r + '</application>', 1); open(m, 'w').write(s)

# v107: more home screen widgets (Albums, Artists, Shuffle, Search, Favorites)
m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
rows = [('Albums', 'Albums', 'lf_grid_info'), ('Artists', 'Artists', 'lf_artists_info'), ('Shuffle', 'Shuffle', 'lf_shuffle_info'), ('Search', 'Search', 'lf_search_info'), ('Favorites', 'Favorites', 'lf_favorites_info'), ('Recent', 'Recently played', 'lf_recent_info'), ('Playlists', 'Playlists', 'lf_playlists_info'), ('Genres', 'Genres', 'lf_genres_info')]
r = ''.join('<receiver android:name=".LiquidTiles$%s" android:label="Liquid %s" android:exported="true"><intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE"/></intent-filter><meta-data android:name="android.appwidget.provider" android:resource="@xml/%s"/></receiver>\n    ' % (n, l, x) for n, l, x in rows if 'LiquidTiles$' + n + '"' not in s)
if r:
    assert '</application>' in s; s = s.replace('</application>', r + '</application>', 1); open(m, 'w').write(s)

# T15: splash = plain black (the default is a white/grey Capacitor logo image)
st = 'android/app/src/main/res/values/styles.xml'
try:
    s = open(st).read()
    if 'lf_black' not in s:
        s2 = s.replace('@drawable/splash', '@color/lf_black')
        if s2 != s:
            # Android 12+ system splash: black background
            s2 = re.sub(r'(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)', r'\1\n        <item name="android:windowSplashScreenBackground">@color/lf_black</item>\n        <item name="android:windowSplashScreenAnimatedIcon">@drawable/lf_splash_icon</item>\n        <item name="android:windowSplashScreenAnimationDuration">700</item>', s2, 1)
            open(st, 'w').write(s2); print('Splash patched (black)')
        else: print('WARNING: styles.xml has no @drawable/splash; splash left as is')
except FileNotFoundError:
    print('WARNING: styles.xml not found; splash left as is')
# Performance: let the app use a bigger Java heap (more RAM) and keep GPU drawing on (both idempotent; never duplicate an attribute)
m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
add = ''
if 'android:largeHeap' not in s: add += ' android:largeHeap="true"'
if 'android:hardwareAccelerated' not in s: add += ' android:hardwareAccelerated="true"'
if add:
    assert '<application' in s
    s = s.replace('<application', '<application' + add, 1); open(m, 'w').write(s); print('Manifest: largeHeap + hardwareAccelerated')
# v142: downloads must outlive the WebView/app task. The foreground dataSync service owns the
# network request, and the notification's Install action opens a tiny verified installer activity.
m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
if 'UpdateDownloadService' not in s:
    svc = '<service android:name=".UpdateDownloadService" android:exported="false" android:stopWithTask="false" android:foregroundServiceType="dataSync"/>\n    '
    s = s.replace('</application>', svc + '</application>', 1)
if 'UpdateInstallActivity' not in s:
    act = '<activity android:name=".UpdateInstallActivity" android:exported="false" android:excludeFromRecents="true" android:theme="@android:style/Theme.Translucent.NoTitleBar"/>\n    '
    s = s.replace('</application>', act + '</application>', 1)
for permission in ['FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_DATA_SYNC', 'POST_NOTIFICATIONS', 'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS']:
    tag = '<uses-permission android:name="android.permission.%s"/>' % permission
    if tag not in s:
        s = s.replace('</manifest>', tag + '\n</manifest>', 1)
open(m, 'w').write(s)

print('Media3 + manifest + signing + icon patched')
# v118: in-app update: permission to install APKs + the FileProvider that hands the downloaded APK to Android's installer
m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
if 'REQUEST_INSTALL_PACKAGES' not in s:
    s = s.replace('</manifest>', '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>\n</manifest>', 1)
if 'FileProvider' not in s:
    s = s.replace('</application>', '<provider android:name="androidx.core.content.FileProvider" android:authorities="${applicationId}.fileprovider" android:exported="false" android:grantUriPermissions="true"><meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths"/></provider></application>', 1)
open(m, 'w').write(s)
os.makedirs('android/app/src/main/res/xml', exist_ok=True)
open('android/app/src/main/res/xml/file_paths.xml', 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android"><external-path name="my_images" path="."/><cache-path name="my_cache_images" path="."/><files-path name="lf_update_files" path="update/"/></paths>\n')

# v118: every build gets a rising versionCode (CI run number) + the package.json version name, so Android always sees a real update
g = 'android/app/build.gradle'; s = open(g).read()
vc = os.environ.get('LF_VERSION_CODE', '')
if vc.isdigit():
    s = re.sub(r'versionCode\s+\d+', 'versionCode ' + vc, s, count=1)
    import json; vn = json.load(open('package.json'))['version']
    s = re.sub(r'versionName\s+"[^"]*"', 'versionName "%s"' % vn, s, count=1)
    open(g, 'w').write(s)
else:
    # BUG-156: a hand build (no CI run number) still gets the right version name; the versionCode is left as it is, with a warning
    import json; vn = json.load(open('package.json'))['version']
    s = re.sub(r'versionName\s+"[^"]*"', 'versionName "%s"' % vn, s, count=1)
    open(g, 'w').write(s)
    __import__('sys').stderr.write('warning: LF_VERSION_CODE not set; versionCode not changed (BUG-156)\n')


# v145: listening-statistics home screen widgets (Today, This week, This month, Everything)
m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
rows = [('Day', 'Listening: Today', 'lf_stats_day_info'), ('Week', 'Listening: This week', 'lf_stats_week_info'), ('Month', 'Listening: This month', 'lf_stats_month_info'), ('All', 'Listening: Everything', 'lf_stats_all_info'), ('Daily', 'Listening: Daily', 'lf_stats_daily_info')]
r = ''.join('<receiver android:name=".StatsWidgets$%s" android:label="Liquid %s" android:exported="true"><intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>%s</intent-filter><meta-data android:name="android.appwidget.provider" android:resource="@xml/%s"/></receiver>\n    ' % (n, l, ('<action android:name="android.intent.action.DATE_CHANGED"/><action android:name="android.intent.action.TIME_SET"/><action android:name="android.intent.action.TIMEZONE_CHANGED"/>' if n == 'Day' else ''), x) for n, l, x in rows if 'StatsWidgets$' + n + '"' not in s)
if r:
    assert '</application>' in s; s = s.replace('</application>', r + '</application>', 1); open(m, 'w').write(s)
# v148: large Now Playing widget (cover, song, artist, album, prev / play-pause / next)
m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
if '.NowPlayingWidget' not in s:
    r = '<receiver android:name=".NowPlayingWidget" android:label="Liquid Now Playing (large)" android:exported="true"><intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE"/></intent-filter><meta-data android:name="android.appwidget.provider" android:resource="@xml/lf_nowplaying_info"/></receiver>\n    '
    assert '</application>' in s; s = s.replace('</application>', r + '</application>', 1); open(m, 'w').write(s)
PY

# BUG-280: stop the build when any patch above silently did not apply (set -e makes a failed check stop the script)
python3 scripts/verify-native-patches.py

# v210: battery-helper accessibility service (Liquid Dark only; it taps Battery usage on its own App info page after Allow, never more)
python3 - <<'PY'
m = 'android/app/src/main/AndroidManifest.xml'; s = open(m).read()
if 'BatteryAssistService' not in s:
    svc = '<service android:name=".BatteryAssistService" android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE" android:exported="false" android:label="Liquid Dark"><intent-filter><action android:name="android.accessibilityservice.AccessibilityService"/></intent-filter><meta-data android:name="android.accessibilityservice" android:resource="@xml/lf_battery_assist"/></service>\n    '
    assert '</application>' in s
    s = s.replace('</application>', svc + '</application>', 1); open(m, 'w').write(s)
print('battery helper service registered')
PY
