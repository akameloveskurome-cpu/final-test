"""AI-sandbox only. Type-checks the T18 block (background scan + progress event) of LiquidNative.java against hand-made API stubs
(no Android SDK here; no `javac` binary, but `java --module jdk.compiler/com.sun.tools.javac.Main` works). Stubs are from memory: only trust it for
"does it compile", not for runtime behaviour. Same idea as tests/java-probe.py. Run from the project root: python3 tests/java-probe-scan.py"""
import subprocess, sys, tempfile, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = (ROOT / 'native-android' / 'LiquidNative.java').read_text(encoding='utf-8')
A, B = '  /* ---------- T18:', '  /* ---------- T6: playlists'
tmp = pathlib.Path(tempfile.mkdtemp())
def w(path, src):
    f = tmp / path; f.parent.mkdir(parents=True, exist_ok=True); f.write_text(src)
w('android/net/Uri.java', 'package android.net; public class Uri { public static Uri parse(String s){return null;} }')
w('android/util/Log.java', 'package android.util; public class Log { public static int w(String a,String b){return 0;} public static int i(String a,String b){return 0;} public static int e(String a,String b,Throwable t){return 0;} }')
w('android/os/Process.java', 'package android.os; public class Process { public static final int THREAD_PRIORITY_BACKGROUND=10; public static final int THREAD_PRIORITY_DEFAULT=0; public static final int THREAD_PRIORITY_FOREGROUND=-2; public static final void setThreadPriority(int p){} }')
w('android/content/Context.java', 'package android.content; public class Context { public static final int MODE_PRIVATE=0; public SharedPreferences getSharedPreferences(String n,int m){return null;} public java.io.File getFilesDir(){return null;} }')
w('android/content/SharedPreferences.java', 'package android.content; public interface SharedPreferences { String getString(String k,String d); }')
w('org/json/JSONException.java', 'package org.json; public class JSONException extends Exception { private static final long serialVersionUID = 1L; }')
w('org/json/JSONArray.java', 'package org.json; public class JSONArray { public JSONArray(){} }')
# real android.org.json.JSONObject: put(...) throws JSONException; opt* / has / remove / keys do not
w('org/json/JSONObject.java', 'package org.json; public class JSONObject { public JSONObject(){} public JSONObject optJSONObject(String k){return null;} public long optLong(String k){return 0;} public String optString(String k){return "";} public String optString(String k,String d){return d;} public boolean has(String k){return false;} public Object remove(String k){return null;} public java.util.Iterator<String> keys(){return null;} public JSONObject put(String k,Object v) throws JSONException {return this;} public JSONObject put(String k,long v) throws JSONException {return this;} public JSONObject put(String k,boolean v) throws JSONException {return this;} public JSONObject put(String k,JSONObject v) throws JSONException {return this;} }')
w('com/getcapacitor/JSArray.java', 'package com.getcapacitor; public class JSArray extends org.json.JSONArray {}')
w('com/getcapacitor/JSObject.java', 'package com.getcapacitor; public class JSObject extends org.json.JSONObject { public JSObject(){} public JSObject put(String k,int v){return this;} public JSObject put(String k,String v){return this;} public JSObject put(String k,Object v){return this;} }')   # real JSObject.put does NOT throw
w('com/getcapacitor/PluginMethod.java', 'package com.getcapacitor; import java.lang.annotation.*; @Retention(RetentionPolicy.RUNTIME) public @interface PluginMethod {}')
w('com/getcapacitor/PluginCall.java', 'package com.getcapacitor; public class PluginCall { public boolean getBoolean(String k, boolean d){return d;} public void resolve(JSObject o){} public void reject(String m){} }')
w('com/getcapacitor/Plugin.java', 'package com.getcapacitor; public class Plugin { public android.content.Context getContext(){return null;} protected void notifyListeners(String e, JSObject d){} }')
w('LiquidTiles.java', 'import android.content.Context; final class LiquidTiles { static void save(Context c, com.getcapacitor.JSArray a){} }')
fake = '''
  private static class Doc { String uri, name, dir; long m, s; }
  private final java.util.Map<String, String> folderCoverPath = new java.util.HashMap<>(), albumCover = new java.util.HashMap<>();\n  private final java.util.concurrent.ConcurrentHashMap<String, Object> folderLocks = new java.util.concurrent.ConcurrentHashMap<>();   // BUG-098 field the real scan() clears\n  private static final long SCAN_WORKER_MB = 20;   // BUG-052 constant read by the real scanThreads()\n  private static boolean isAudioName(String n) { return true; }
  private static class Prefs { String getString(String k, String d){return d;} }
  private Prefs prefs() { return new Prefs(); }
  private java.io.File cacheFile() { return null; }
  private JSONObject loadCache() throws Exception { return new JSONObject(); }
  private List<Doc> walk(Uri tree) { return new ArrayList<>(); }
  private String lrcFor(Doc d, String title, String artist) { return null; }
  private final java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.locks.ReentrantLock> albumLocks = new java.util.concurrent.ConcurrentHashMap<>();
  private String lrcSignature() { return ""; }
  private final java.util.Map<String, String> lrcStamp = new java.util.HashMap<>();
  private static String stripExt(String n) { return n; }
  private JSONObject readTrack(Uri u, String name, String dirId) throws Exception { return null; }
  private String lrcPlain(String u) { return ""; }
  private String folderCover(String dir) { return ""; }
  private JSONObject readFlac(Uri u, String name, String dirId) throws Exception { return null; }
  private JSArray tracksFrom(JSONObject o) throws Exception { return new JSArray(); }
'''
body = SRC[SRC.index(A):SRC.index(B)]
ST = '  private static int scanThreads()'
i = SRC.index(ST); j = SRC.index('\n  }\n', i) + len('\n  }\n')
body += '\n' + SRC[i:j]   # the real scanThreads() (heap-budget floor is checked by tests/native-android.test.mjs)
w('ScanSizing.java', (ROOT / 'native-android' / 'ScanSizing.java').read_text(encoding='utf-8').replace('package com.liquid.flacplayer;', ''))
w('CoverCleanup.java', (ROOT / 'native-android' / 'CoverCleanup.java').read_text(encoding='utf-8').replace('package com.liquid.flacplayer;', ''))   # pure java.io: the real file is compiled
w('Probe.java', 'import android.content.Context; import android.net.Uri; import android.util.Log; import com.getcapacitor.*; import org.json.*;\nimport java.io.*; import java.nio.charset.StandardCharsets; import java.util.*; import java.util.concurrent.*; import java.util.concurrent.atomic.AtomicInteger;\npublic class Probe extends Plugin {\n    static final ExecutorService LIB_POOL = Executors.newCachedThreadPool();   // stub: the real pool is outside the extracted region\n' + fake + body + '}\n')
(tmp / 'out').mkdir()
files = [str(p) for p in tmp.rglob('*.java')]
r = subprocess.run(['java', '--module', 'jdk.compiler/com.sun.tools.javac.Main', '-proc:none', '-d', str(tmp / 'out')] + files, capture_output=True, text=True)
print(r.stdout + r.stderr or 'javac: no output')
print('JAVA PROBE (T18 scan)', 'OK' if r.returncode == 0 else 'FAILED'); sys.exit(r.returncode)
