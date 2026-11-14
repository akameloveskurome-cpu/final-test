"""AI-sandbox only. T10 leftover (delete replaced / removed Canvas files). Two checks on native-android/LiquidNative.java:
 (1) RUNS the pure static method unusedCanvasFiles() for real (plain JDK, no Android) on several cases;
 (2) type-checks pruneCanvasFiles() + saveCanvas() against hand-made API stubs (from memory: trust it for "compiles", not for behaviour).
Uses `java --module jdk.compiler/com.sun.tools.javac.Main` (no javac binary here). Run from the project root: python3 tests/java-probe-canvas.py"""
import subprocess, sys, tempfile, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = (ROOT / 'native-android' / 'LiquidNative.java').read_text(encoding='utf-8')
A, B, C = '  /** T10 leftover:', '  /** Deletes the copied Canvas files', '  /* ---------- T11: Song Info.'
pure = SRC[SRC.index(A):SRC.index(B)]
block = SRC[SRC.index(B):SRC.index(C)]
tmp = pathlib.Path(tempfile.mkdtemp()); (tmp / 'out').mkdir()
def w(path, src):
    f = tmp / path; f.parent.mkdir(parents=True, exist_ok=True); f.write_text(src)
def javac(files):
    r = subprocess.run(['java', '--module', 'jdk.compiler/com.sun.tools.javac.Main', '-proc:none', '-d', str(tmp / 'out')] + files, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr

# (1) real run of the pure method
w('Pure.java', 'import java.util.*;\npublic class Pure {\n' + pure + '''
  static int bad = 0;
  static void eq(String what, Object got, Object want) { boolean ok = got.equals(want); System.out.println((ok ? "PASS " : "FAIL ") + what + (ok ? "" : " got=" + got + " want=" + want)); if (!ok) bad++; }
  public static void main(String[] a) {
    eq("nothing kept: every file is unused", unusedCanvasFiles(Arrays.asList(), new String[] { "a.mp4", "b.gif" }), Arrays.asList("a.mp4", "b.gif"));
    eq("kept files stay", unusedCanvasFiles(Arrays.asList("/data/user/0/app/files/canvas/a.mp4"), new String[] { "a.mp4", "b.gif" }), Arrays.asList("b.gif"));
    eq("everything kept: nothing to delete", unusedCanvasFiles(Arrays.asList("/x/canvas/a.mp4", "/x/canvas/b.gif"), new String[] { "a.mp4", "b.gif" }), Arrays.asList());
    eq("same file used by a song AND an album is kept once", unusedCanvasFiles(Arrays.asList("/x/canvas/a.mp4", "/x/canvas/a.mp4"), new String[] { "a.mp4" }), Arrays.asList());
    eq("null entries in the map are ignored", unusedCanvasFiles(Arrays.asList((String) null, "/x/canvas/a.mp4"), new String[] { "a.mp4", "c.webp" }), Arrays.asList("c.webp"));
    eq("a path with the same name in another folder still keeps the file (name match)", unusedCanvasFiles(Arrays.asList("/other/a.mp4"), new String[] { "a.mp4" }), Arrays.asList());
    eq("a longer name is NOT confused with a shorter one", unusedCanvasFiles(Arrays.asList("/x/canvas/ca.mp4"), new String[] { "a.mp4", "ca.mp4" }), Arrays.asList("a.mp4"));
    eq("windows style separators", unusedCanvasFiles(Arrays.asList("C:\\\\x\\\\a.mp4"), new String[] { "a.mp4", "z.mp4" }), Arrays.asList("z.mp4"));
    eq("empty folder", unusedCanvasFiles(Arrays.asList("/x/a.mp4"), new String[] {}), Arrays.asList());
    if (bad > 0) System.exit(1);
  }
}
''')
rc, out = javac([str(tmp / 'Pure.java')])
if rc: print(out); print('JAVA PROBE (canvas) FAILED to compile the pure method'); sys.exit(1)
r = subprocess.run(['java', '-cp', str(tmp / 'out'), 'Pure'], capture_output=True, text=True); print(r.stdout + r.stderr)
if r.returncode: print('JAVA PROBE (canvas) FAILED'); sys.exit(1)

# (2) compile check of pruneCanvasFiles + saveCanvas
w('android/util/Log.java', 'package android.util; public class Log { public static int w(String a,String b){return 0;} }')
w('android/content/Context.java', 'package android.content; public class Context { public java.io.File getFilesDir(){return null;} }')
w('org/json/JSONArray.java', 'package org.json; public class JSONArray { }')
w('org/json/JSONObject.java', 'package org.json; public class JSONObject { public String optString(String k,String d){return d;} public java.util.Iterator<String> keys(){return null;} }')
w('com/getcapacitor/JSObject.java', 'package com.getcapacitor; public class JSObject extends org.json.JSONObject { }')
w('com/getcapacitor/PluginMethod.java', 'package com.getcapacitor; import java.lang.annotation.*; @Retention(RetentionPolicy.RUNTIME) public @interface PluginMethod {}')
w('com/getcapacitor/PluginCall.java', 'package com.getcapacitor; public class PluginCall { public JSObject getObject(String n){return null;} public void resolve(){} public void reject(String m){} }')
w('com/getcapacitor/Plugin.java', 'package com.getcapacitor; public class Plugin { public android.content.Context getContext(){return null;} }')
w('Probe.java', 'import android.util.Log; import com.getcapacitor.*; import org.json.*;\nimport java.io.*; import java.nio.charset.StandardCharsets; import java.util.*;\npublic class Probe extends Plugin {\n  private File canvasFile() { return null; }\n  private File canvasBak() { return null; }\n  private JSONObject readCanvasFile(File f) { return null; }\n  private volatile boolean canvasReadFailed = false;\n' + pure + block + '}\n')
rc, out = javac([str(p) for p in tmp.rglob('*.java') if p.name != 'Pure.java'])
print(out or 'javac: no output'); print('JAVA PROBE (canvas)', 'OK' if rc == 0 else 'FAILED'); sys.exit(rc)
