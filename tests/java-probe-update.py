"""AI-sandbox only. Compile-probes LiquidNative's v142 update bridge methods against tiny Android/Capacitor stubs.
It validates the bridge method signatures and Java syntax; it is not a substitute for an Android Gradle build or device test."""
import pathlib, subprocess, tempfile, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = (ROOT / 'native-android' / 'LiquidNative.java').read_text(encoding='utf-8')
START, END = '  /* ---------- v142: persistent, background automatic updates.', '  /* ---------- T10: Canvas.'
body = SRC[SRC.index(START):SRC.index(END)]
tmp = pathlib.Path(tempfile.mkdtemp())
def w(path, src):
    f = tmp / path; f.parent.mkdir(parents=True, exist_ok=True); f.write_text(src)
w('android/os/Build.java', 'package android.os; public class Build { public static final String MANUFACTURER="Test", BRAND="Test"; public static class VERSION { public static final int SDK_INT = 26; } }')
w('android/provider/Settings.java', 'package android.provider; public class Settings { public static final String ACTION_MANAGE_UNKNOWN_APP_SOURCES = "a"; }')
w('android/net/Uri.java', 'package android.net; public class Uri { public static Uri parse(String s) { return null; } }')
w('android/util/Log.java', 'package android.util; public class Log { public static int e(String a, String b) { return 0; } public static int e(String a, String b, Throwable t) { return 0; } }')
w('android/content/Intent.java', '''package android.content; public class Intent { public static final String ACTION_VIEW = "v", ACTION_MAIN = "m0", CATEGORY_HOME = "h"; public static final int FLAG_GRANT_READ_URI_PERMISSION = 1, FLAG_ACTIVITY_NEW_TASK = 2; public Intent(String a) {} public Intent(String a, android.net.Uri u) {} public Intent addFlags(int f) { return this; } public Intent addCategory(String c) { return this; } public Intent setDataAndType(android.net.Uri u, String t) { return this; } }''')
w('android/content/SharedPreferences.java', 'package android.content; public interface SharedPreferences { int getInt(String k, int d); String getString(String k, String d); }')
w('android/content/pm/PackageManager.java', 'package android.content.pm; public class PackageManager { public boolean canRequestPackageInstalls() { return true; } }')
w('android/content/ContentResolver.java', 'package android.content; public class ContentResolver { }')
w('android/content/Context.java', '''package android.content; public class Context { public android.content.pm.PackageManager getPackageManager() { return null; } public String getPackageName() { return "com.liquid.flacplayer"; } public void startActivity(Intent i) {} }''')
w('androidx/core/content/FileProvider.java', 'package androidx.core.content; public class FileProvider { public static android.net.Uri getUriForFile(android.content.Context c, String a, java.io.File f) { return null; } }')
w('org/json/JSONObject.java', 'package org.json; public class JSONObject { public JSONObject put(String k, Object v) { return this; } public JSONObject put(String k, int v) { return this; } public JSONObject put(String k, boolean v) { return this; } }')
w('com/getcapacitor/JSObject.java', 'package com.getcapacitor; public class JSObject extends org.json.JSONObject { public JSObject() {} }')
w('com/getcapacitor/PluginMethod.java', 'package com.getcapacitor; import java.lang.annotation.*; @Retention(RetentionPolicy.RUNTIME) public @interface PluginMethod {}')
w('com/getcapacitor/PluginCall.java', '''package com.getcapacitor; public class PluginCall { public String getString(String n, String d) { return d; } public void resolve(JSObject o) {} public void resolve() {} public void reject(String m) {} }''')
w('com/getcapacitor/Plugin.java', 'package com.getcapacitor; public class Plugin { public android.content.Context getContext() { return null; } }')
w('com/liquid/flacplayer/UpdateSupport.java', '''package com.liquid.flacplayer; public class UpdateSupport { public static void cleanInstalled(android.content.Context c){} public static final String STATUS_READY="ready", STATUS_QUEUED="queued", STATUS_DOWNLOADING="downloading", STATUS_FAILED="failed", STATUS_UNKNOWN="unknown"; public static boolean validTarget(long b,String s){return true;} public static String identity(long b,String s){return "";} public static String state(android.content.Context c){return "";} public static String targetId(android.content.Context c){return "";} public static String targetSha(android.content.Context c){return "";} public static long targetBuild(android.content.Context c){return 0;} public static long archiveVersionCode(android.content.Context c,java.io.File f){return 1;} public static long installedVersionCode(android.content.Context c){return 1;} public static String verifyApk(android.content.Context c,long b,String s){return null;} public static void markFailed(android.content.Context c,String i,String e){} public static android.content.SharedPreferences prefs(android.content.Context c){return null;} public static java.io.File apkFile(android.content.Context c,long b,String s){return null;} }''')
w('com/liquid/flacplayer/UpdateDownloadService.java', '''package com.liquid.flacplayer; public class UpdateDownloadService { public static boolean isRunning(){return false;} public static void enqueue(android.content.Context c,String u,long b,String s){} public static void resumeSaved(android.content.Context c){} }''')
# stubs for the battery-optimisation / OEM settings code that now sits inside the extracted range (later w() calls replace the first versions above)
w('android/os/PowerManager.java', 'package android.os; public class PowerManager { public boolean isIgnoringBatteryOptimizations(String p) { return true; } }')
w('android/app/ActivityManager.java', 'package android.app; public class ActivityManager { public boolean isBackgroundRestricted() { return false; } }')
w('android/app/AppOpsManager.java', 'package android.app; public class AppOpsManager { public static final int MODE_ALLOWED=0, MODE_IGNORED=1, MODE_ERRORED=2, MODE_DEFAULT=3; public int unsafeCheckOpNoThrow(String op, int uid, String pkg) { return 0; } public int checkOpNoThrow(String op, int uid, String pkg) { return 0; } }')
w('android/os/Process.java', 'package android.os; public class Process { public static int myUid() { return 0; } }')
w('android/provider/Settings.java', 'package android.provider; public class Settings { public static final String ACTION_MANAGE_UNKNOWN_APP_SOURCES = "a", ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS = "b", ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS = "c", ACTION_APPLICATION_DETAILS_SETTINGS = "d"; public static final String ACTION_ACCESSIBILITY_SETTINGS = \"g\"; public static class Secure { public static final String ENABLED_ACCESSIBILITY_SERVICES = \"x\"; public static String getString(Object r, String k) { return null; } } }')
w('android/content/Intent.java', '''package android.content; public class Intent { public static final String ACTION_VIEW = "v", ACTION_MAIN = "m0", CATEGORY_HOME = "h"; public static final int FLAG_GRANT_READ_URI_PERMISSION = 1, FLAG_ACTIVITY_NEW_TASK = 2; public Intent() {} public Intent(String a) {} public Intent(String a, android.net.Uri u) {} public Intent addFlags(int f) { return this; } public Intent addCategory(String c) { return this; } public Intent setDataAndType(android.net.Uri u, String t) { return this; } public Intent setData(android.net.Uri u) { return this; } public Intent setClassName(String a, String b) { return this; } public Intent putExtra(String k, String v) { return this; } public Intent setComponent(ComponentName c) { return this; } }''')
w('android/content/Context.java', '''package android.content; public class Context { public android.content.ContentResolver getContentResolver() { return null; } public static final String POWER_SERVICE = "power"; public static final String APP_OPS_SERVICE = "appops"; public static final String ACTIVITY_SERVICE="activity"; public Object getSystemService(String n) { return null; } public android.content.pm.PackageManager getPackageManager() { return null; } public String getPackageName() { return "com.liquid.flacplayer"; } public void startActivity(Intent i) {} }''')
# stubs for the OnePlus background-settings page (ComponentName, package scan, Log.i / Log.w, LIB_POOL); later w() calls replace the earlier versions
w('android/util/Log.java', 'package android.util; public class Log { public static int i(String a,String b){return 0;} public static int w(String a,String b){return 0;} public static int e(String a,String b,Throwable t){return 0;} public static int e(String a,String b){return 0;} }')
w('android/content/ComponentName.java', 'package android.content; public class ComponentName { public ComponentName(String p, String c) {} public String flattenToShortString() { return ""; } }')
w('android/content/pm/ApplicationInfo.java', 'package android.content.pm; public class ApplicationInfo { public static final int FLAG_SYSTEM = 1, FLAG_UPDATED_SYSTEM_APP = 128; public int flags; }')
w('android/content/pm/ActivityInfo.java', 'package android.content.pm; public class ActivityInfo { public String name, packageName; public boolean exported, enabled; public ApplicationInfo applicationInfo; public CharSequence loadLabel(PackageManager pm) { return ""; } }')
w('android/content/pm/PackageInfo.java', 'package android.content.pm; public class PackageInfo { public String packageName; public ActivityInfo[] activities; public ApplicationInfo applicationInfo; }')
w('android/content/pm/PackageManager.java', 'package android.content.pm; public class PackageManager { public static final int GET_ACTIVITIES = 1; public boolean canRequestPackageInstalls() { return true; } public java.util.List<PackageInfo> getInstalledPackages(int f) { return null; } }')
w('android/widget/Toast.java', 'package android.widget; public class Toast { public static final int LENGTH_SHORT = 0; public static final int LENGTH_LONG = 1; public static Toast makeText(android.content.Context c, CharSequence s, int d) { return new Toast(); } public void show() {} }')
wrapper = '''package com.liquid.flacplayer;
import java.io.*; import java.util.*; import android.content.*; import android.net.Uri; import android.util.Log; import com.getcapacitor.*;
public class LiquidNativeProbe extends Plugin {
  static final java.util.concurrent.ExecutorService LIB_POOL = null;
  static class FakeAct { void startActivity(Intent i) {} void runOnUiThread(Runnable r) { r.run(); } void finishAndRemoveTask() {} boolean moveTaskToBack(boolean b) { return true; } }
  FakeAct getActivity() { return new FakeAct(); }
  private static String eqNorm(String s) { return s == null ? "" : s.toLowerCase(java.util.Locale.ROOT).replace(" ", "").replace("_", ""); }
  private static boolean eqSystemApp(android.content.pm.ApplicationInfo a) { return a != null; }
''' + body + '\n}\n'
w('com/liquid/flacplayer/LiquidNativeProbe.java', wrapper)
out = tmp / 'out'; out.mkdir()
files = [str(p) for p in tmp.rglob('*.java')]
import shutil
JAVAC = ['javac'] if shutil.which('javac') else ['java', '--module', 'jdk.compiler/com.sun.tools.javac.Main']   # no javac binary in some sandboxes: the JDK module does the same job
r = subprocess.run(JAVAC + ['-proc:none', '-d', str(out)] + files, capture_output=True, text=True)
print(r.stdout + r.stderr or 'javac: no output')
print('JAVA UPDATE BRIDGE PROBE', 'OK' if r.returncode == 0 else 'FAILED')
sys.exit(r.returncode)
