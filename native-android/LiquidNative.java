package com.liquid.flacplayer;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.EOFException;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMetadataRetriever;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import android.content.ComponentName;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.core.content.ContextCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.google.common.util.concurrent.ListenableFuture;

/** Ticket T3: pick music folder (SAF), scan for .flac / .mp3 / .m4a / .aac, read their tags, cache by mtime+size. FLAC is parsed by hand; MP3 / AAC go through Android's MediaMetadataRetriever. */
@CapacitorPlugin(name = "LiquidNative", permissions = { @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" }), @Permission(alias = "storage", strings = { "android.permission.READ_EXTERNAL_STORAGE" }), @Permission(alias = "bluetooth", strings = { "android.permission.BLUETOOTH_CONNECT" }) })
public class LiquidNative extends Plugin {
  private static class Doc { String uri, name, dir; long m, s; }

  private SharedPreferences prefs() { return getContext().getSharedPreferences("liquid", Context.MODE_PRIVATE); }
  private File cacheFile() { return new File(getContext().getFilesDir(), "library-v9.json"); }   // v94: v9 = MP3 / AAC tracks + embedded-lyrics search text (old v8 is dropped, so one full rescan). v64: v8 = also stores COMPOSER (Sort albums by Composer). Before: Bug 3: v7 = the cache that holds aaTag + the real album-artist tag. Bump this name whenever readFlac() starts storing something new (unchanged files are never re-read); old v3-v6 files are deleted in loadCache()

  @PluginMethod
  public void pickFolder(PluginCall call) {
    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
    startActivityForResult(call, i, "pickResult");
  }

  @ActivityCallback
  private void pickResult(PluginCall call, ActivityResult r) {
    if (call == null) return;
    if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null || r.getData().getData() == null) { call.reject("cancelled"); return; }
    Uri tree = r.getData().getData();
    try { getContext().getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION); }
    catch (SecurityException e) { Log.w("LiquidNative", "cannot keep access to the folder: " + e); call.reject("could not keep access to that folder"); return; }
    String oldTree = prefs().getString("tree", null);   // Bug 18: let go of the previous folder (Android keeps only ~128 persisted grants per app)
    if (oldTree != null && !oldTree.equals(tree.toString())) {
      try { getContext().getContentResolver().releasePersistableUriPermission(Uri.parse(oldTree), Intent.FLAG_GRANT_READ_URI_PERMISSION); }
      catch (Exception e) { Log.w("LiquidNative", "could not release the old folder: " + e); }
    }
    prefs().edit().putString("tree", tree.toString()).apply();
    cacheFile().delete();
    JSObject o = new JSObject(); o.put("uri", tree.toString()); call.resolve(o);
  }

  /* v156: the saved library is read + parsed on a background thread the moment the plugin loads (before the page even asks), then kept in memory
   * and reused until library-v9.json changes (a scan rewrites it, so the stamp changes). getLibrary() then answers at once instead of parsing a big JSON on demand. */
  private final Object warmLock = new Object();
  private java.util.concurrent.Future<Object[]> warm;   // { stamp String, tracks JSArray }
  private Object[] warmDone;                           // last finished { stamp, tracks }

  private String cacheStamp() { File f = cacheFile(); return f.exists() ? f.lastModified() + ":" + f.length() : "none"; }

  private Object[] readLibraryNow() {
    String st = cacheStamp(); JSArray ta;
    try { ta = tracksFrom(loadCache()); } catch (Exception e) { ta = new JSArray(); }
    return new Object[] { st, ta };
  }

  private void warmLibrary() {
    synchronized (warmLock) {
      if (warm != null && !warm.isDone()) return;
      warm = LIB_POOL.submit(new java.util.concurrent.Callable<Object[]>() {
        @Override public Object[] call() { android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_DISPLAY); Object[] r; try { r = readLibraryNow(); } finally { android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_DEFAULT); } synchronized (warmLock) { warmDone = r; } return r; }
      });
    }
  }

  /** BUG-391: artwork lookups and first-time copies to lfart/ run here, on several cores, never on the main thread. */
  private static final ExecutorService ART_POOL = Executors.newFixedThreadPool(Math.max(2, Runtime.getRuntime().availableProcessors()), new ThreadFactory() {
    @Override public Thread newThread(Runnable r) { Thread t = new Thread(r, "lf-art"); t.setDaemon(true); return t; }
  });

  private static final ExecutorService LIB_POOL = Executors.newCachedThreadPool(new ThreadFactory() {
    @Override public Thread newThread(Runnable r) { Thread t = new Thread(r, "lf-lib-warm"); t.setDaemon(true); return t; }
  });

  @Override
  public void load() {
    super.load();
    try { warmLibrary(); } catch (Throwable ignored) { }   // starts parsing the saved library right away, in parallel with the page loading
  }

  @PluginMethod
  public void getLibrary(final PluginCall call) {
    // v156: Capacitor runs plugin methods one after another on ONE thread; waiting for the library there held up every other call at start (pictures, playlists, plays). Now it waits on its own thread.
    LIB_POOL.execute(new Runnable() { @Override public void run() { getLibraryNow(call); } });
  }

  private void getLibraryNow(PluginCall call) {
    JSObject o = new JSObject();
    boolean cached = cacheFile().exists();   // v149: JS shows the big scan card only when there is NO saved library yet
    Object[] got = null;
    try {
      String now = cacheStamp();
      synchronized (warmLock) { if (warmDone != null && warmDone[0].equals(now)) got = warmDone; }
      if (got == null) {   // not ready yet (or the file changed): wait for the background read if one is running, else read now
        java.util.concurrent.Future<Object[]> f; synchronized (warmLock) { f = warm; }
        if (f != null) { try { Object[] r = f.get(); if (r != null && r[0].equals(now)) got = r; } catch (Exception ignored) { } }
        if (got == null) { got = readLibraryNow(); synchronized (warmLock) { warmDone = got; } }
      }
    } catch (Throwable t) { got = new Object[] { "none", new JSArray() }; }
    final JSArray ta = (JSArray) got[1];
    o.put("tracks", ta); o.put("cached", cached);
    o.put("hasFolder", prefs().getString("tree", null) != null);
    call.resolve(o);   // v149: answer first; the widget pictures are refreshed afterwards (they used to delay every start)
    if (ta.length() > 0) new Thread(new Runnable() { @Override public void run() { try { LiquidTiles.save(getContext(), ta); } catch (Throwable ignored) { } } }, "lf-tiles").start();
  }

  /* ---------- T18: scan on a background thread, with progress events ----------
   * scan() returns at once; the work runs in "lf-scan" and the call is resolved when it is done (so playback and other plugin calls stay responsive).
   * Event onScanProgress {done,total}: first with done=0 (total is known after the walk), then about every 25 files, and a last one at done=total.
   * Result: { tracks, added (files read from disk), reused, newSongs (never seen before), removed (in the old cache, gone now), touched (kept songs whose .lrc / cover changed) }.
   * A second scan() while one is running is rejected with "busy" (JS ignores that). */
  private final java.util.concurrent.atomic.AtomicBoolean scanning = new java.util.concurrent.atomic.AtomicBoolean(false);

  private final Object progLock = new Object();
  private long lastProgNs = 0;
  private volatile String progName = "", progCover = "";   // v101: file just finished / newest cover just saved (the scan animation shows them)

  private void scanProgress(int done, int total) { scanProgress(done, total, "read", 0, false); }

  /** v101: at most one event per 70 ms (a fast scan used to flood the bridge: one event per 25 files). `force` = always send (first / last / phase change).
   *  Event: { done, total, phase: "walk" | "read" | "save", found (walk only), name (last file), cover (newest saved cover path, once) }. */
  private void scanProgress(int done, int total, String phase, int found, boolean force) {
    long now = System.nanoTime();
    synchronized (progLock) {
      if (!force && now - lastProgNs < 70_000_000L) return;
      lastProgNs = now;
    }
    JSObject o = new JSObject(); o.put("done", done); o.put("total", total); o.put("phase", phase);
    if (found > 0) o.put("found", found);
    String nm = progName; if (nm != null && !nm.isEmpty()) o.put("name", nm);
    String cv = progCover; if (cv != null && !cv.isEmpty()) { o.put("cover", cv); progCover = ""; }
    notifyListeners("onScanProgress", o);
  }

  @PluginMethod
  public void scan(PluginCall call) {
    final String ts = prefs().getString("tree", null);
    if (ts == null) { call.reject("no folder"); return; }
    if (!scanning.compareAndSet(false, true)) { call.reject("busy"); return; }
    Thread th = new Thread(new Runnable() {
      @Override public void run() {
        try { runScan(call, ts); }
        catch (Throwable t) { Log.e("LiquidNative", "scan died", t); try { call.reject("scan failed: " + t); } catch (Throwable ignored) { } }   // an Error (e.g. out of memory) must still resolve the call, or JS stays 'scanning' forever
        finally { scanning.set(false); }
      }
    }, "lf-scan");
    th.start();
  }

  private void runScan(PluginCall call, String ts) {
    try {
      Uri tree = Uri.parse(ts);
      final JSONObject old = loadCache(), fresh = new JSONObject();
      int reused, added, newSongs, touched;
      albumCover.clear(); folderCoverPath.clear(); folderLocks.clear(); progName = ""; progCover = "";
      scanProgress(0, 0, "walk", 0, true);
      List<Doc> docs = walk(tree);
      final int total = docs.size();
      scanProgress(0, total, "read", 0, true);
      // v101: when no .lrc file was added / removed / edited since the last scan, an unchanged song keeps the .lrc it had (no name matching, no .lrc header reads for the whole library)
      final String lrcSigNow = lrcSignature();
      JSONObject oldMeta = old.optJSONObject("__meta");
      final boolean lrcSame = oldMeta != null && lrcSigNow.equals(oldMeta.optString("lrcSig", ""));
      final JSONObject[] res = new JSONObject[total];
      final boolean forceArt = call.getBoolean("forceArt", false);   // BUG-332: the Refresh art button re-checks every song's folder picture
      final AtomicInteger doneC = new AtomicInteger(), reusedC = new AtomicInteger(), addedC = new AtomicInteger(), newC = new AtomicInteger(), touchedC = new AtomicInteger();
      final int nth = scanThreads();   // v101: the work is mostly WAITING on the storage provider, so more threads than cores (v77: 2-6) keep it busy
      ExecutorService pool = Executors.newFixedThreadPool(nth, new ThreadFactory() {
        @Override public Thread newThread(final Runnable r) { return new Thread(new Runnable() { @Override public void run() { android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_FOREGROUND); r.run(); } }, "lf-scan-w"); }   // v101: was BACKGROUND, which Android runs in a throttled CPU group (the audio thread has its own urgent priority, so the music is safe)
      });
      for (int di = 0; di < total; di++) {
        final Doc d = docs.get(di); final int idx = di;
        pool.execute(new Runnable() { @Override public void run() {
        try {
            JSONObject prev = old.optJSONObject(d.uri);
            if (prev != null && "true".equals(prev.optString("skip")) && prev.optLong("m") == d.m && prev.optLong("s") == d.s && (d.m != 0 || d.s != 0)) { res[idx] = prev; }   // BUG-344: a file the scan cannot use is not opened again while it is unchanged
            else if (prev != null && prev.optLong("m") == d.m && prev.optLong("s") == d.s && (d.m != 0 || d.s != 0)) {   // BUG-379: m = 0 and s = 0 means "provider gave no time / size": re-read the file
              JSONObject pt = prev.optJSONObject("t");
              if (pt != null) {
                String lrBefore = pt.optString("lrc", ""), cvBefore = pt.optString("cover", "");
                String lr = lrcSame ? (lrBefore.isEmpty() ? null : lrBefore) : lrcFor(d, pt.optString("title", ""), pt.optString("artist", "")); if (lr != null) pt.put("lrc", lr); else pt.remove("lrc");
                // BUG-332: a folder picture (cover.jpg / folder.jpg) is checked on every scan. A cover that came from the folder (coverSrc "folder") follows
                // the picture when it is replaced or removed. Embedded art is never replaced here (forceArt is passed by the Refresh art button; the check runs on every scan anyway).
                { String fc = folderCover(d.dir), cvNow = pt.optString("cover", ""), src = pt.optString("coverSrc", "");
                  if (!fc.isEmpty() && (cvNow.isEmpty() || "folder".equals(src)) && !fc.equals(cvNow)) { pt.put("cover", fc); pt.put("coverSrc", "folder"); }
                  else if (fc.isEmpty() && "folder".equals(src)) { pt.remove("cover"); pt.remove("coverSrc"); } }
                // .lrc text makes the song searchable by lyrics. Bug 9a: "lyricLrc" remembers WHICH .lrc version (modified time:size) the cached text came from,
                // so an edited .lrc is re-read and a deleted one stops feeding the search text.
                String stamp = lr == null ? "" : lrcStamp.containsKey(lr) ? lrcStamp.get(lr) : "", from = pt.optString("lyricLrc", "");
                boolean fill = false;
                if (!from.isEmpty()) {
                  if (lr == null) { pt.put("lyric", ""); pt.remove("lyricLrc"); fill = true; }
                  else if (!from.equals(stamp)) { String lp = lrcPlain(lr); pt.put("lyric", lp); if (lp.isEmpty()) pt.remove("lyricLrc"); else pt.put("lyricLrc", stamp); fill = true; }
                } else if (lr != null && pt.optString("lyric", "").isEmpty()) {
                  String lp = lrcPlain(lr); if (!lp.isEmpty()) { pt.put("lyric", lp); pt.put("lyricLrc", stamp); fill = true; }
                }
                if (fill || !lrBefore.equals(pt.optString("lrc", "")) || !cvBefore.equals(pt.optString("cover", ""))) touchedC.incrementAndGet();
                progCover = pt.optString("cover", "");   // v101: kept songs feed the scan animation too
              }
              res[idx] = prev; reusedC.incrementAndGet();
            } else {
              JSONObject t = readTrack(Uri.parse(d.uri), d.name, d.dir);
              if (t != null) {
                if (!t.has("cover")) { String fc = folderCover(d.dir); if (!fc.isEmpty()) { t.put("cover", fc); t.put("coverSrc", "folder"); } } // no picture inside the FLAC: use cover.jpg / folder.jpg
                progCover = t.optString("cover", "");   // v101: newest cover for the scan animation
                t.put("uri", d.uri);
                String lrN = lrcFor(d, t.optString("title", ""), t.optString("artist", ""));
                if (lrN != null) { t.put("lrc", lrN); if (t.optString("lyric", "").isEmpty()) { String lp = lrcPlain(lrN); if (!lp.isEmpty()) { t.put("lyric", lp); t.put("lyricLrc", lrcStamp.containsKey(lrN) ? lrcStamp.get(lrN) : ""); } } }
                JSONObject e = new JSONObject(); e.put("m", d.m); e.put("s", d.s); e.put("t", t);
                res[idx] = e; addedC.incrementAndGet();
                if (prev == null) newC.incrementAndGet();
              } else {
                // BUG-344: remembered as 'cannot be used' (no track, so the song list ignores it): the next scan skips it while its time and size are unchanged
                JSONObject ng = new JSONObject(); ng.put("m", d.m); ng.put("s", d.s); ng.put("skip", true); res[idx] = ng;
              }
            }
          } catch (Exception ex) { Log.w("LiquidNative", "scan: skipped " + d.name + ": " + ex); if (res[idx] == null) res[idx] = old.optJSONObject(d.uri); }   // BUG-49: a failed read keeps the cached song instead of dropping it

          catch (Throwable ex2) { Log.w("LiquidNative", "scan: skipped " + d.name + ": " + ex2); if (res[idx] == null) res[idx] = old.optJSONObject(d.uri); }
          progName = stripExt(d.name);
          int dn = doneC.incrementAndGet(); scanProgress(dn, total, "read", 0, dn == total);
        } });
      }
      pool.shutdown();
      try { pool.awaitTermination(6, TimeUnit.HOURS); } catch (InterruptedException ie) { pool.shutdownNow(); throw new java.io.IOException("scan interrupted"); }
      scanProgress(total, total, "save", 0, true);
      for (int di = 0; di < total; di++) if (res[di] != null) fresh.put(docs.get(di).uri, res[di]);
      JSONObject meta = new JSONObject(); meta.put("lrcSig", lrcSigNow); fresh.put("__meta", meta);   // v101: no "t" inside, so tracksFrom() skips it
      reused = reusedC.get(); added = addedC.get(); newSongs = newC.get(); touched = touchedC.get();
      int removed = 0;
      for (Iterator<String> it = old.keys(); it.hasNext(); ) if (!fresh.has(it.next())) removed++;
      File ctmp = new File(getContext().getFilesDir(), "library-v9.tmp");
      try (FileOutputStream f = new FileOutputStream(ctmp)) { f.write(fresh.toString().getBytes(StandardCharsets.UTF_8)); f.getFD().sync(); }   // BUG-270: flushed to disk before it replaces the cache
      if (!ctmp.renameTo(cacheFile())) { cacheFile().delete(); if (!ctmp.renameTo(cacheFile())) throw new java.io.IOException("could not replace the library cache; the old one was removed and the new scan stays in library-v9.tmp, so the next start does a full rescan"); }   // BUG-270: never written in place (a cut-off write would leave a broken cache); BUG #26: the message no longer claims the old cache survives the delete-then-rename fallback
      new File(getContext().getFilesDir(), "library-v2.json").delete();
      JSObject o = new JSObject();
      JSArray fa = tracksFrom(fresh); o.put("tracks", fa); LiquidTiles.save(getContext(), fa); o.put("added", added); o.put("reused", reused);
      o.put("newSongs", newSongs); o.put("removed", removed); o.put("touched", touched);
      call.resolve(o);
      // BUG-378: only after a successful scan and a saved cache: delete scan covers that nothing refers to (fresh cache + widget picture overrides). Runs off the plugin thread; user pictures / GIFs live elsewhere and are never touched.
      final String refText = fresh.toString() + "\n" + getContext().getSharedPreferences("liquid", Context.MODE_PRIVATE).getString("wOv", "{}");
      LIB_POOL.execute(new Runnable() { @Override public void run() { try { int gone = CoverCleanup.clean(new File(getContext().getFilesDir(), "covers"), refText, System.currentTimeMillis()); if (gone > 0) Log.i("LiquidNative", "covers: removed " + gone + " unused"); } catch (Throwable t) { Log.w("LiquidNative", "covers cleanup skipped: " + t); } } });
    } catch (Exception e) { Log.e("LiquidNative", "scan failed", e); call.reject("scan failed: " + e.getMessage()); }
  }

  /* ---------- T6: playlists (filesDir/playlists.json = { "playlists": [ { id, name, ids: [trackId] } ] }) ---------- */
  private File plFile() { return new File(getContext().getFilesDir(), "playlists.json"); }

  private File plBak() { return new File(getContext().getFilesDir(), "playlists.bak"); }

  /** Parses a playlists file; returns null when it is missing or broken. */
  private JSONArray readPlaylistsFile(File file) {
    try (FileInputStream f = new FileInputStream(file)) {
      ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] b = new byte[65536]; int n;
      while ((n = f.read(b)) > 0) bo.write(b, 0, n);
      return new JSONObject(bo.toString("UTF-8")).optJSONArray("playlists");
    } catch (Exception e) { return null; }
  }

  @PluginMethod
  public void getPlaylists(PluginCall call) {
    JSObject o = new JSObject();
    JSONArray arr = readPlaylistsFile(plFile());
    if (arr == null) arr = readPlaylistsFile(plBak());   // T17: main file is damaged -> the copy of the previous save
    if (arr == null) arr = new JSONArray();
    o.put("playlists", arr); call.resolve(o);
  }

  @PluginMethod
  public void savePlaylists(PluginCall call) {
    try {
      JSArray arr = call.getArray("playlists"); if (arr == null) arr = new JSArray();
      JSONObject root = new JSONObject(); root.put("playlists", arr);
      File tmp = new File(getContext().getFilesDir(), "playlists.tmp");
      if (readPlaylistsFile(plFile()) != null) {   // T17: cheap safety, the last good version stays as playlists.bak
        try (FileInputStream in = new FileInputStream(plFile()); FileOutputStream out = new FileOutputStream(plBak())) { byte[] b = new byte[65536]; int n; while ((n = in.read(b)) > 0) out.write(b, 0, n); }
        catch (Exception e) { Log.w("LiquidNative", "playlists.bak failed: " + e); }
      }
      try (FileOutputStream f = new FileOutputStream(tmp)) { f.write(root.toString().getBytes(StandardCharsets.UTF_8)); }
      if (!tmp.renameTo(plFile())) { try (FileOutputStream f = new FileOutputStream(plFile())) { f.write(root.toString().getBytes(StandardCharsets.UTF_8)); } }
      call.resolve();
    } catch (Exception e) { call.reject("save failed: " + e.getMessage()); }
  }

  private JSArray tracksFrom(JSONObject cache) throws Exception {
    JSArray a = new JSArray();
    for (Iterator<String> it = cache.keys(); it.hasNext(); ) { JSONObject e = cache.optJSONObject(it.next()); if (e != null && e.optJSONObject("t") != null) { JSONObject t = e.getJSONObject("t"); t.put("added", e.optLong("m")); a.put(t); } }
    return a;
  }

  private JSONObject loadCache() {
    new File(getContext().getFilesDir(), "library-v3.json").delete(); new File(getContext().getFilesDir(), "library-v4.json").delete(); new File(getContext().getFilesDir(), "library-v5.json").delete(); new File(getContext().getFilesDir(), "library-v6.json").delete(); new File(getContext().getFilesDir(), "library-v6.tmp").delete(); new File(getContext().getFilesDir(), "library-v7.json").delete(); new File(getContext().getFilesDir(), "library-v7.tmp").delete(); new File(getContext().getFilesDir(), "library-v8.json").delete(); new File(getContext().getFilesDir(), "library-v8.tmp").delete();   // T21 / T25: old caches are not used any more (first launch rescans)
    try (FileInputStream f = new FileInputStream(cacheFile())) {
      ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] b = new byte[65536]; int n;
      while ((n = f.read(b)) > 0) bo.write(b, 0, n);
      return new JSONObject(bo.toString("UTF-8"));
    } catch (Exception e) { return new JSONObject(); }
  }

  /** v107: the tab a widget tap asked for ("" = none). */
  @PluginMethod
  public void getLaunch(PluginCall call) { JSObject o = new JSObject(); o.put("tab", MainActivity.pendTab); MainActivity.pendTab = ""; call.resolve(o); }

  /** v106: ask Android to pin the widget on the home screen (Android 8+). Older phones: JS tells the user to long-press the home screen. */
  @PluginMethod
  public void addWidget(PluginCall call) {
    JSObject o = new JSObject(); boolean ok = false;
    try {
      android.appwidget.AppWidgetManager m = android.appwidget.AppWidgetManager.getInstance(getContext());
      if (Build.VERSION.SDK_INT >= 26 && m.isRequestPinAppWidgetSupported()) { Class<?> k = LiquidWidget.class; String kd = call.getString("kind", ""); for (Class<?> x : LiquidTiles.ALL) if (x.getSimpleName().equalsIgnoreCase(kd)) k = x; for (Class<?> x : StatsWidgets.ALL) if ("stats".concat(x.getSimpleName()).equalsIgnoreCase(kd)) k = x; if ("nowplaying".equalsIgnoreCase(kd)) k = NowPlayingWidget.class; ok = m.requestPinAppWidget(new ComponentName(getContext(), k), null, null); }
    } catch (Exception e) { Log.w("LiquidNative", "widget pin failed: " + e); }
    o.put("requested", ok); call.resolve(o);
  }

  /* ---------- v106: "All files access" (Android 11+: MANAGE_EXTERNAL_STORAGE; older: READ_EXTERNAL_STORAGE). With it, .lrc files are found in every folder of the phone. ---------- */
  private boolean allFilesOn() {
    if (Build.VERSION.SDK_INT >= 30) return android.os.Environment.isExternalStorageManager();
    return ContextCompat.checkSelfPermission(getContext(), "android.permission.READ_EXTERNAL_STORAGE") == android.content.pm.PackageManager.PERMISSION_GRANTED;
  }

  @PluginMethod
  public void allFilesStatus(PluginCall call) { JSObject o = new JSObject(); o.put("granted", allFilesOn()); call.resolve(o); }

  @PluginMethod
  public void requestAllFiles(PluginCall call) {
    if (allFilesOn()) { allFilesStatus(call); return; }
    if (Build.VERSION.SDK_INT >= 30) {
      Intent i = new Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
      try { startActivityForResult(call, i, "allFilesResult"); }
      catch (Exception e) { startActivityForResult(call, new Intent(android.provider.Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION), "allFilesResult"); }
    } else requestPermissionForAlias("storage", call, "storageResult");
  }

  @ActivityCallback
  private void allFilesResult(PluginCall call, ActivityResult r) { if (call != null) allFilesStatus(call); }

  @PermissionCallback
  private void storageResult(PluginCall call) { allFilesStatus(call); }

  /** v106: every .lrc anywhere on the phone's storage (outside the chosen music folder too: Download, Screenshots, ...). Added to the library-wide list; `seen` = ids already found through the music folder. */
  private void walkExternalLrcs(java.util.Set<String> seen) {
    if (!allFilesOn()) return;
    List<File> roots = new ArrayList<>(); List<String> keys = new ArrayList<>();
    roots.add(android.os.Environment.getExternalStorageDirectory()); keys.add("primary:");
    File[] vols = new File("/storage").listFiles();
    if (vols != null) for (File v : vols) { String n = v.getName(); if (!n.equals("emulated") && !n.equals("self") && v.isDirectory()) { roots.add(v); keys.add(n + ":"); } }
    for (int ri = 0; ri < roots.size(); ri++) {
      File root = roots.get(ri); String key = keys.get(ri); String rootPath = root.getAbsolutePath();
      Deque<File> st = new ArrayDeque<>(); st.push(root);
      while (!st.isEmpty()) {
        File dir = st.pop(); File[] kids = dir.listFiles(); if (kids == null) continue;
        String dp = dir.getAbsolutePath();
        if (dp.equals(rootPath + "/Android/data") || dp.equals(rootPath + "/Android/obb")) continue;
        for (File f : kids) {
          String n = f.getName();
          if (f.isDirectory()) { if (!n.startsWith(".") && f.getAbsolutePath().length() < 600) st.push(f); }
          else if (n.toLowerCase(Locale.ROOT).endsWith(".lrc") && f.length() > 0) {
            String rel = f.getAbsolutePath().substring(rootPath.length()); if (rel.startsWith("/")) rel = rel.substring(1);
            if (seen.contains(key + rel)) continue;
            String uri = Uri.fromFile(f).toString(), base = n.substring(0, n.length() - 4);
            allLrcs.add(new String[] { normName(base), uri, coreName(base), base });
            lrcStamp.put(uri, f.lastModified() + ":" + f.length());
          }
        }
      }
    }
  }

  private List<Doc> walk(Uri tree) throws java.io.IOException {
    ContentResolver cr = getContext().getContentResolver();
    List<Doc> out = new ArrayList<>(); Deque<String> dirs = new ArrayDeque<>();
    dirs.push(DocumentsContract.getTreeDocumentId(tree));
    folderImg.clear(); lrcs.clear(); lrcStamp.clear(); allLrcs.clear(); lrcHead.clear();
    final java.util.Set<String> seenIds = new java.util.HashSet<>();
    String[] cols = { DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_LAST_MODIFIED, DocumentsContract.Document.COLUMN_SIZE };
    while (!dirs.isEmpty()) {
      final String curDir = dirs.pop();
      Uri kids = DocumentsContract.buildChildDocumentsUriUsingTree(tree, curDir);
      try (Cursor c = cr.query(kids, cols, null, null, null)) {
        if (c == null) throw new java.io.IOException("cannot read folder " + curDir);   // never treat an unreadable folder as empty (SD card removed): abort, keep the old cache
        while (c.moveToNext()) {
          String id = c.getString(0), name = c.getString(1), mime = c.getString(2);
          if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) dirs.push(id);
          else if (name != null && isAudioName(name)) {
            Doc d = new Doc(); d.uri = DocumentsContract.buildDocumentUriUsingTree(tree, id).toString(); d.name = name; d.dir = curDir; d.m = c.getLong(3); d.s = c.getLong(4); out.add(d);
            progName = stripExt(name); scanProgress(0, 0, "walk", out.size(), false);   // v101: the animation counts the songs found so far
          } else if (name != null) {
            if (name.toLowerCase(Locale.ROOT).endsWith(".lrc")) {
              List<String[]> lr = lrcs.get(curDir); if (lr == null) { lr = new ArrayList<>(); lrcs.put(curDir, lr); }   // (computeIfAbsent needs API 24)
              String lrUri = DocumentsContract.buildDocumentUriUsingTree(tree, id).toString();
              String[] lent = new String[] { normName(name.substring(0, name.length() - 4)), lrUri, coreName(name.substring(0, name.length() - 4)), name.substring(0, name.length() - 4) };
              lr.add(lent); allLrcs.add(lent); seenIds.add(id);
              lrcStamp.put(lrUri, c.getLong(3) + ":" + c.getLong(4));   // Bug 9a: modified time + size of the .lrc
            }
            int rk = imgRank(name);
            if (rk >= 0) { String[] have = folderImg.get(curDir); if (have == null || rk < Integer.parseInt(have[0])) folderImg.put(curDir, new String[] { String.valueOf(rk), DocumentsContract.buildDocumentUriUsingTree(tree, id).toString() }); }
          }
        }
      }
    }
    walkExternalLrcs(seenIds);   // v106
    return out;
  }

  /* ---------- T4c step 3: cover art. Pictures are saved as filesDir/covers/<hash>.jpg (max ~600 px), never inside library-v5.json. ---------- */
  private final Map<String, String[]> folderImg = new HashMap<>();   // dirId -> { rank, image doc uri }
  private final Map<String, String> lrcStamp = new HashMap<>();   // Bug 9a: .lrc document uri -> "modified:size", per scan
  private final Map<String, String[]> lrcHead = new java.util.concurrent.ConcurrentHashMap<>();   // v95: .lrc uri -> { normalised [ti:], normalised [ar:] }, read lazily (first 4 KB)
  private final List<String[]> allLrcs = new ArrayList<>();   // v95: every .lrc of the library { normalised name, uri, name without track number }, for lookups by title / artist
  private final Map<String, List<String[]>> lrcs = new HashMap<>();   // T9: dirId -> { normalised name, document uri, name without track number } of .lrc files
  private final Map<String, String> folderCoverPath = new java.util.concurrent.ConcurrentHashMap<>();   // BUG-98 / BUG-393: concurrent, locked per folder
  private final java.util.concurrent.ConcurrentHashMap<String, Object> folderLocks = new java.util.concurrent.ConcurrentHashMap<>(); // dirId -> saved cover path ("" = none), per scan
  /** v101: fingerprint of the library's .lrc files (count + names + modified time + size); equal = no .lrc changed. */
  private String lrcSignature() {
    long sum = 0; for (String[] c : allLrcs) { String st = lrcStamp.get(c[1]); sum += (c[1] + ":" + (st == null ? "" : st)).hashCode() & 0xffffffffL; }
    return allLrcs.size() + ":" + sum;
  }
  private final Map<String, String> albumCover = new java.util.concurrent.ConcurrentHashMap<>();      // "albumartist|album" -> saved cover path, per scan (read each album's picture once)

  /** 0 = best name. cover > folder > front > albumart > album, jpg / jpeg / png only. -1 = not a cover image. */
  private static int imgRank(String name) {
    String n = name.toLowerCase(Locale.ROOT); int dot = n.lastIndexOf('.'); if (dot < 0) return -1;
    String ext = n.substring(dot + 1), base = n.substring(0, dot);
    if (!(ext.equals("jpg") || ext.equals("jpeg") || ext.equals("png"))) return -1;
    String[] order = { "cover", "folder", "front", "albumart", "album" };
    for (int i = 0; i < order.length; i++) if (base.equals(order[i])) return i;
    for (String k : new String[] { "artwork", "art", "cover art", "coverart", "poster", "thumb", "scan" }) if (base.equals(k)) return order.length;
    return order.length + 1;   // any other picture in the folder: last resort
  }

  /** Bug 4: repeated Vorbis comments. ARTIST / GENRE / ALBUMARTIST keep EVERY distinct value, joined with "; " (the app already splits on ";"), so featured artists and extra
   *  genres reach the library like they do in Song Info. Any other key keeps its first non-empty value (an empty first copy no longer hides a filled second one). */
  private static final java.util.Set<String> MULTI_TAGS = new java.util.HashSet<>(java.util.Arrays.asList("ARTIST", "GENRE", "ALBUMARTIST", "ALBUM ARTIST", "ALBUM_ARTIST", "COMPOSER"));
  private static void putTag(Map<String, String> tag, String k, String v) {
    String old = tag.get(k);
    if (old == null || old.trim().isEmpty()) { if (old == null || !v.trim().isEmpty()) tag.put(k, v); return; }
    if (!MULTI_TAGS.contains(k) || v.trim().isEmpty()) return;
    for (String part : old.split("\\s*;\\s*")) if (part.equalsIgnoreCase(v.trim())) return;   // the same value twice adds nothing
    tag.put(k, old + "; " + v.trim());
  }

  /** T25: COMPILATION=1 (or true / yes). */
  private static boolean isComp(Map<String, String> tag) { String c = tag.get("COMPILATION"); c = c == null ? "" : c.trim(); return c.equals("1") || c.equalsIgnoreCase("true") || c.equalsIgnoreCase("yes"); }
  /** C8: the album-artist tag under any of its three spellings (null = not tagged). */
  private static String aaTag(Map<String, String> tag) {
    // BUG-381: a blank value is no album-artist tag (the compilation fallback then works)
    for (String k : new String[] { "ALBUMARTIST", "ALBUM ARTIST", "ALBUM_ARTIST" }) {
      String v = tag.get(k);
      if (v != null && !v.trim().isEmpty()) return v;
    }
    return null;
  }
  private static String albumKey(Map<String, String> tag, String dirId) {
    String al = tag.get("ALBUM"); if (al == null || al.isEmpty()) return null;
    String aa = aaTag(tag) != null ? aaTag(tag) : isComp(tag) ? "Various Artists" : tag.containsKey("ARTIST") ? tag.get("ARTIST") : "";
    return (dirId + "|" + aa + "|" + al).toLowerCase(Locale.ROOT);   // the folder is part of the key: same-named albums in two folders never share a cover
  }

  private byte[] readBytes(Uri u, int max) throws Exception {
    try (InputStream in = getContext().getContentResolver().openInputStream(u)) {
      ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] b = new byte[65536]; int n;
      while ((n = in.read(b)) > 0) { bo.write(b, 0, n); if (bo.size() > max) return null; }
      return bo.toByteArray();
    }
  }

  /** Decodes the picture, shrinks it to about 600 px, saves it as <hash of the original bytes>.jpg. Returns the absolute path or null. */
  private String saveCover(byte[] data) {
    try {
      byte[] h = MessageDigest.getInstance("SHA-1").digest(data); StringBuilder nm = new StringBuilder();
      for (int i = 0; i < 8; i++) nm.append(String.format(Locale.ROOT, "%02x", h[i] & 0xff));
      File dir = new File(getContext().getFilesDir(), "covers"); dir.mkdirs();
      File f = new File(dir, nm + ".jpg");
      if (f.exists() && f.length() > 0) return f.getAbsolutePath();
      BitmapFactory.Options bo = new BitmapFactory.Options(); bo.inJustDecodeBounds = true; BitmapFactory.decodeByteArray(data, 0, data.length, bo);
      if (bo.outWidth <= 0 || bo.outHeight <= 0) return null;
      int ss = 1; while (Math.max(bo.outWidth, bo.outHeight) / (ss * 2) >= 600) ss *= 2;
      BitmapFactory.Options dec = new BitmapFactory.Options(); dec.inSampleSize = ss; dec.inPreferredConfig = Bitmap.Config.ARGB_8888;
      Bitmap bm = BitmapFactory.decodeByteArray(data, 0, data.length, dec); if (bm == null) return null;
      File tmp = new File(dir, nm + "." + Thread.currentThread().getId() + ".tmp");   // BUG-90: unique temp name per thread
      try (FileOutputStream out = new FileOutputStream(tmp)) {
        if (bm.hasAlpha()) { Bitmap flat = Bitmap.createBitmap(bm.getWidth(), bm.getHeight(), Bitmap.Config.ARGB_8888); android.graphics.Canvas cv0 = new android.graphics.Canvas(flat); cv0.drawColor(0xFFFFFFFF); cv0.drawBitmap(bm, 0, 0, null); bm.recycle(); bm = flat; }   // BUG-99: transparent PNG covers get a white background, not black
        bm.compress(Bitmap.CompressFormat.JPEG, 88, out);
      }
      bm.recycle();
      return tmp.renameTo(f) ? f.getAbsolutePath() : null;
    } catch (Exception | OutOfMemoryError e) { Log.w("LiquidNative", "cover not saved: " + e); return null; }
  }

  /** cover.jpg / folder.jpg ... of a folder, saved once per scan. "" = none. */
  private String folderCover(String dirId) {
    if (dirId == null) return "";
    String c = folderCoverPath.get(dirId); if (c != null) return c;
    Object lk = new Object(), old = folderLocks.putIfAbsent(dirId, lk); if (old != null) lk = old;   // one lock per folder: other folders are not held up
    synchronized (lk) { return folderCoverLocked(dirId); }
  }
  private String folderCoverLocked(String dirId) {
    String c = folderCoverPath.get(dirId); if (c != null) return c;
    String path = ""; String[] fi = folderImg.get(dirId);
    if (fi != null) {
      try { byte[] b = readBytes(Uri.parse(fi[1]), 12_000_000); if (b != null) { String sp = saveCover(b); if (sp != null) path = sp; } }   // BUG-91: a folder picture over 12 MB is skipped (BUG-052: was 16 MB) (the songs stay in the library)
      catch (Exception | OutOfMemoryError e) { Log.w("LiquidNative", "folder cover unreadable: " + e); }
    }
    folderCoverPath.put(dirId, path); return path;
  }

  /** Reads the 4-byte "fLaC" marker, skipping a leading ID3v2 tag if present. */
  private static boolean readFlacMagic(DataInputStream in) throws Exception {
    byte[] m = new byte[4]; in.readFully(m);
    if (m[0] == 'I' && m[1] == 'D' && m[2] == '3') {
      byte[] h = new byte[6]; in.readFully(h);
      long sz = ((h[2] & 0x7fL) << 21) | ((h[3] & 0x7fL) << 14) | ((h[4] & 0x7fL) << 7) | (h[5] & 0x7fL);
      if ((h[1] & 0x10) != 0) sz += 10;   // footer present
      skip(in, sz);
      in.readFully(m);
    }
    return m[0] == 'f' && m[1] == 'L' && m[2] == 'a' && m[3] == 'C';
  }

  private static void skip(DataInputStream in, long n) throws Exception {
    while (n > 0) { long k = in.skip(n); if (k <= 0) { if (in.read() < 0) throw new EOFException(); k = 1; } n -= k; }
  }

  private static int num(String s) {
    if (s == null) return 0; int i = 0; while (i < s.length() && Character.isDigit(s.charAt(i)) && i < 4) i++;
    try { return i == 0 ? 0 : Integer.parseInt(s.substring(0, i)); } catch (Exception e) { return 0; }
  }

  /* ---------- MP3 / AAC (v93) ---------- */
  private static boolean isFlacName(String n) { return n != null && n.toLowerCase(Locale.ROOT).endsWith(".flac"); }
  /** .flac, .mp3, .m4a, .aac (AAC lives in .m4a containers or raw ADTS .aac files). */
  private static boolean isAudioName(String n) {
    if (n == null) return false; String l = n.toLowerCase(Locale.ROOT);
    return l.endsWith(".flac") || l.endsWith(".mp3") || l.endsWith(".m4a") || l.endsWith(".aac");
  }
  private static boolean isLossyName(String n) { return isAudioName(n) && !isFlacName(n); }
  private static String stripExt(String n) { return n.replaceAll("(?i)\\.(flac|mp3|m4a|aac)$", ""); }

  private JSONObject readTrack(Uri uri, String fileName, String dirId) throws Exception {
    return isFlacName(fileName) ? readFlac(uri, fileName, dirId) : readLossy(uri, fileName, dirId);
  }

  private static void lossyPut(Map<String, String> tag, MediaMetadataRetriever mr, String key, int code) {
    String v = null; try { v = mr.extractMetadata(code); } catch (Exception ignored) { }
    if (v != null && !v.trim().isEmpty()) putTag(tag, key, v.trim());
  }

  /** ID3 / MP4 tags through Android. DATE can come as "20120101T000000.000Z": keep YYYY-MM-DD. */
  private static Map<String, String> lossyTags(MediaMetadataRetriever mr) {
    Map<String, String> tag = new java.util.LinkedHashMap<>();
    lossyPut(tag, mr, "TITLE", MediaMetadataRetriever.METADATA_KEY_TITLE);
    lossyPut(tag, mr, "ARTIST", MediaMetadataRetriever.METADATA_KEY_ARTIST);
    lossyPut(tag, mr, "ALBUM", MediaMetadataRetriever.METADATA_KEY_ALBUM);
    lossyPut(tag, mr, "ALBUMARTIST", MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST);
    lossyPut(tag, mr, "COMPOSER", MediaMetadataRetriever.METADATA_KEY_COMPOSER);
    lossyPut(tag, mr, "LYRICIST", MediaMetadataRetriever.METADATA_KEY_WRITER);
    lossyPut(tag, mr, "GENRE", MediaMetadataRetriever.METADATA_KEY_GENRE);
    lossyPut(tag, mr, "DATE", MediaMetadataRetriever.METADATA_KEY_DATE);
    lossyPut(tag, mr, "YEAR", MediaMetadataRetriever.METADATA_KEY_YEAR);
    lossyPut(tag, mr, "TRACKNUMBER", MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER);
    lossyPut(tag, mr, "DISCNUMBER", MediaMetadataRetriever.METADATA_KEY_DISC_NUMBER);
    lossyPut(tag, mr, "COMPILATION", MediaMetadataRetriever.METADATA_KEY_COMPILATION);
    for (String k : new String[] { "DATE", "YEAR" }) {
      String v = tag.get(k);
      if (v != null && v.matches("^\\d{8}T.*")) tag.put(k, v.substring(0, 4) + "-" + v.substring(4, 6) + "-" + v.substring(6, 8));
    }
    return tag;
  }

  /** { sampleRate, channels } and the audio mime ("" when unknown), read with MediaExtractor. */
  private Object[] lossyFormat(Uri uri) {
    int rate = 0, ch = 0; String mime = "";
    MediaExtractor ex = new MediaExtractor();
    try {
      ex.setDataSource(getContext(), uri, null);
      for (int i = 0; i < ex.getTrackCount(); i++) {
        MediaFormat f = ex.getTrackFormat(i); String m = f.getString(MediaFormat.KEY_MIME);
        if (m != null && m.startsWith("audio/")) {
          mime = m;
          if (f.containsKey(MediaFormat.KEY_SAMPLE_RATE)) rate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE);
          if (f.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) ch = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
          break;
        }
      }
    } catch (Exception e) { Log.w("LiquidNative", "audio format not read: " + e); }
    finally { try { ex.release(); } catch (Exception ignored) { } }
    return new Object[] { rate, ch, mime };
  }

  private static String lossyLabel(String fileName, String mime) {
    if (mime.equals("audio/mpeg")) return "MP3";
    if (mime.equals("audio/mp4a-latm")) return "AAC";
    if (mime.equals("audio/alac")) return "ALAC";   // BUG #27: file-info path is not gated by readLossy, so name the real codec instead of "AAC"
    if (mime.equals("audio/opus")) return "Opus";
    if (mime.equals("audio/vorbis")) return "Vorbis";
    return fileName.toLowerCase(Locale.ROOT).endsWith(".mp3") ? "MP3" : "AAC";
  }

  /* ---------- v94: embedded lyrics of MP3 / AAC. ID3v2 (USLT, SYLT, TXXX LYRICS) at the start of the file, or the MP4 "(c)lyr" atom of .m4a. Read on demand + once per new file for search. ---------- */
  private static String id3Text(byte[] b, int off, int end, int enc) {
    if (off >= end) return "";
    java.nio.charset.Charset cs = enc == 1 ? StandardCharsets.UTF_16 : enc == 2 ? StandardCharsets.UTF_16BE : enc == 3 ? StandardCharsets.UTF_8 : StandardCharsets.ISO_8859_1;
    return new String(b, off, end - off, cs);
  }

  /** Index just after the terminator of a string that starts at `from` (1 byte for Latin-1 / UTF-8, 2 aligned bytes for UTF-16). */
  private static int id3Term(byte[] b, int from, int end, int enc) {
    if (enc == 1 || enc == 2) { for (int i = from; i + 1 < end; i += 2) if (b[i] == 0 && b[i + 1] == 0) return i + 2; return end; }
    for (int i = from; i < end; i++) if (b[i] == 0) return i + 1;
    return end;
  }

  private static String lrcStampOf(long ms) {
    long cs = ms / 10, m = cs / 6000, sec = (cs / 100) % 60, c = cs % 100;
    return String.format(Locale.ROOT, "[%02d:%02d.%02d]", m, sec, c);
  }

  private static final java.util.regex.Pattern TS_RE = java.util.regex.Pattern.compile("\\[\\d{1,3}:\\d{2}");

  /** Picks the best lyrics out of Vorbis / APE / MP4 style tags, whatever the key is called (LYRICS, UNSYNCEDLYRICS, SYNCEDLYRICS, "SYNCED LYRICS",
   *  LYRICS_SYNCED, LYRICS-ENG, LYRIC ...; LYRICIST is not lyrics). Order: tagged as synced > text with [mm:ss] stamps > plain (key LYRICS first). null = none. */
  private static String lyricsFromTags(Map<String, String> tag) {
    String sync = null, stamped = null, plain = null, plainExact = null;
    for (Map.Entry<String, String> e : tag.entrySet()) {
      String v = e.getValue(); if (v == null || v.trim().isEmpty()) continue;
      String k = e.getKey().toUpperCase(Locale.ROOT).replaceAll("[^A-Z]", "");
      if (!(k.contains("LYRICS") || (k.contains("LYRIC") && !k.contains("LYRICIST")))) continue;
      boolean unsynced = k.contains("UNSYNC");
      if (!unsynced && k.contains("SYNC")) { if (sync == null) sync = v; }
      else if (TS_RE.matcher(v).find()) { if (stamped == null) stamped = v; }
      else if (k.equals("LYRICS")) { if (plainExact == null) plainExact = v; }
      else if (plain == null) plain = v;
    }
    return sync != null ? sync : stamped != null ? stamped : plainExact != null ? plainExact : plain;
  }

  /** Reads the first `max` bytes of a file (all of it when smaller). */
  private byte[] headOf(Uri u, int max) throws Exception { return readHead(u, max); }

  private static int findId3(byte[] b, int from, int limit) {
    for (int i = from; i + 10 <= Math.min(b.length, limit); i++) {
      if (b[i] == 'I' && b[i + 1] == 'D' && b[i + 2] == '3' && (b[i + 3] & 0xff) >= 2 && (b[i + 3] & 0xff) <= 4 && (b[i + 4] & 0xff) != 0xff
          && (b[i + 6] & 0x80) == 0 && (b[i + 7] & 0x80) == 0 && (b[i + 8] & 0x80) == 0 && (b[i + 9] & 0x80) == 0) return i;
    }
    return -1;
  }

  /** Lyrics frames of ONE ID3v2 tag that starts at `off` and lies completely inside `all`. out[0] = end of the tag. */
  private String id3LyricsAt(byte[] all, int off, int[] out, Uri uri) {
    int ver = all[off + 3] & 0xff, fl = all[off + 5] & 0xff;
    long sz = ((all[off + 6] & 0x7fL) << 21) | ((all[off + 7] & 0x7fL) << 14) | ((all[off + 8] & 0x7fL) << 7) | (all[off + 9] & 0x7fL);
    out[0] = (int) Math.min((long) all.length, off + 10 + sz + ((fl & 0x10) != 0 ? 10 : 0));
    byte[] raw = java.util.Arrays.copyOfRange(all, off + 10, (int) Math.min((long) all.length, off + 10 + sz));
    if ((fl & 0x80) != 0 && ver < 4) {   // tag-wide unsynchronisation: FF 00 -> FF
      ByteArrayOutputStream bo = new ByteArrayOutputStream(raw.length);
      for (int i = 0; i < raw.length; i++) { bo.write(raw[i]); if ((raw[i] & 0xff) == 0xFF && i + 1 < raw.length && raw[i + 1] == 0) i++; }
      raw = bo.toByteArray();
    }
    int pos = 0;
    if ((fl & 0x40) != 0 && ver >= 3 && raw.length >= 4) {   // extended header
      long es = ver == 4 ? (((raw[0] & 0x7fL) << 21) | ((raw[1] & 0x7fL) << 14) | ((raw[2] & 0x7fL) << 7) | (raw[3] & 0x7fL)) : (((raw[0] & 0xffL) << 24) | ((raw[1] & 0xffL) << 16) | ((raw[2] & 0xffL) << 8) | (raw[3] & 0xffL)) + 4;
      pos = (int) Math.min(es, raw.length);
    }
    String sylt = null, uslt = null, txxx = null;
    int idLen = ver == 2 ? 3 : 4, hdr = ver == 2 ? 6 : 10;
    while (pos + hdr <= raw.length) {
      if (raw[pos] == 0) break;   // padding
      String id = new String(raw, pos, idLen, StandardCharsets.ISO_8859_1);
      long fs;
      if (ver == 2) fs = ((raw[pos + 3] & 0xffL) << 16) | ((raw[pos + 4] & 0xffL) << 8) | (raw[pos + 5] & 0xffL);
      else if (ver == 3) fs = ((raw[pos + 4] & 0xffL) << 24) | ((raw[pos + 5] & 0xffL) << 16) | ((raw[pos + 6] & 0xffL) << 8) | (raw[pos + 7] & 0xffL);
      else {   // v2.4: sizes are syncsafe, but some taggers write plain sizes: take the syncsafe one only when it lands on a valid frame
        fs = ((raw[pos + 4] & 0x7fL) << 21) | ((raw[pos + 5] & 0x7fL) << 14) | ((raw[pos + 6] & 0x7fL) << 7) | (raw[pos + 7] & 0x7fL);
        long plainSz = ((raw[pos + 4] & 0xffL) << 24) | ((raw[pos + 5] & 0xffL) << 16) | ((raw[pos + 6] & 0xffL) << 8) | (raw[pos + 7] & 0xffL);
        if (plainSz != fs) {
          int a1 = (int) Math.min((long) raw.length, pos + hdr + fs), a2 = (int) Math.min((long) raw.length, pos + hdr + plainSz);
          boolean ok1 = a1 + 4 > raw.length || raw[a1] == 0 || Character.isUpperCase((char) raw[a1]) || Character.isDigit((char) raw[a1]);
          boolean ok2 = a2 + 4 <= raw.length && (raw[a2] == 0 || Character.isUpperCase((char) raw[a2]) || Character.isDigit((char) raw[a2]));
          if (!ok1 && ok2) fs = plainSz;
        }
      }
      int fstart = pos + hdr, fend = (int) Math.min((long) raw.length, fstart + fs);
      int f1 = ver >= 3 ? raw[pos + 8] & 0xff : 0, f2 = ver >= 3 ? raw[pos + 9] & 0xff : 0;
      pos = fend;
      if (fs <= 0 || fend <= fstart) continue;
      boolean skipFrame = false, unsync = false;
      if (ver == 3 && (f2 & 0xC0) != 0) skipFrame = true;   // compressed / encrypted
      // BUG-382: a grouping flag puts one group-id byte in front of the frame data (v2.3 flag 0x20, v2.4 flag 0x40). Skip it before the data-length field (v2.4 order).
      if (ver == 3 && (f2 & 0x20) != 0) fstart += 1;
      if (ver == 4) { if ((f2 & 0x0C) != 0) skipFrame = true; if ((f2 & 0x40) != 0) fstart += 1; if ((f2 & 0x01) != 0) fstart += 4; unsync = (f2 & 0x02) != 0; }
      if (skipFrame || fstart >= fend) continue;
      boolean wanted = id.equals("USLT") || id.equals("ULT") || id.equals("SYLT") || id.equals("SLT") || id.equals("TXXX") || id.equals("TXX");
      if (!wanted) continue;
      byte[] fb = java.util.Arrays.copyOfRange(raw, fstart, fend);
      if (unsync) { ByteArrayOutputStream bo = new ByteArrayOutputStream(fb.length); for (int i = 0; i < fb.length; i++) { bo.write(fb[i]); if ((fb[i] & 0xff) == 0xFF && i + 1 < fb.length && fb[i + 1] == 0) i++; } fb = bo.toByteArray(); }
      if (fb.length < 2) continue;
      int enc = fb[0] & 0xff; if (enc > 3) enc = 0;
      if (id.equals("USLT") || id.equals("ULT")) {
        if (fb.length < 5) continue;
        int de = id3Term(fb, 4, fb.length, enc);   // skip 3-byte language, then the descriptor
        String t = id3Text(fb, de, fb.length, enc).replace("\u0000", "").trim();
        if (t.isEmpty() && de > 4) t = id3Text(fb, 4, fb.length, enc).replace("\u0000", "").trim();   // no descriptor terminator written: the whole rest is the text
        if (!t.isEmpty() && uslt == null) uslt = t;
      } else if (id.equals("SYLT") || id.equals("SLT")) {
        if (fb.length < 8) continue;
        int fmt = fb[4] & 0xff;   // 1 = MPEG frames, 2 = milliseconds
        int de = id3Term(fb, 6, fb.length, enc);
        int rate = 0;
        if (fmt == 1) rate = (Integer) lossyFormat(uri)[0];
        if (fmt == 2 || (fmt == 1 && rate > 0)) {
          // BUG-383: samples per frame. AAC (ADTS header right after the tag) = 1024; MP3 Layer III = 1152 (MPEG-1 rates) or 576 (MPEG-2 rates).
          int at = out[0];
          boolean adts = at >= 0 && at + 1 < all.length && (all[at] & 0xff) == 0xFF && ((all[at + 1] & 0xF6) == 0xF0);
          int spf = adts ? 1024 : (rate >= 32000 ? 1152 : 576);
          StringBuilder sb = new StringBuilder(); int i = de;
          while (i < fb.length) {
            int te = id3Term(fb, i, fb.length, enc); if (te + 4 > fb.length) break;
            int tl = (enc == 1 || enc == 2) ? te - 2 : te - 1; if (tl < i) tl = i;
            String line = id3Text(fb, i, tl, enc).replace("\n", "").replace("\r", "");
            long v = ((fb[te] & 0xffL) << 24) | ((fb[te + 1] & 0xffL) << 16) | ((fb[te + 2] & 0xffL) << 8) | (fb[te + 3] & 0xffL);
            long ms = fmt == 2 ? v : Math.round(v * (double) spf * 1000.0 / rate);
            sb.append(lrcStampOf(ms)).append(line).append('\n'); i = te + 4;
          }
          if (sb.toString().trim().length() > 0 && sylt == null) sylt = sb.toString();
        }
      } else {   // TXXX: description, then value
        int de = id3Term(fb, 1, fb.length, enc);
        int dl = (enc == 1 || enc == 2) ? Math.max(1, de - 2) : Math.max(1, de - 1);
        String desc = id3Text(fb, 1, dl, enc).trim();
        String t = id3Text(fb, de, fb.length, enc).replace("\u0000", "").trim();
        if (!t.isEmpty() && desc.toUpperCase(Locale.ROOT).contains("LYRIC") && !desc.toUpperCase(Locale.ROOT).contains("LYRICIST") && txxx == null) txxx = t;
      }
    }
    return sylt != null ? sylt : uslt != null ? uslt : txxx;
  }

  /** ID3v2 tag(s) at the start of the file (also after junk bytes, also several stacked tags). */
  private String readId3Lyrics(Uri uri) throws Exception {
    byte[] buf = headOf(uri, 262144);
    int off = findId3(buf, 0, 131072);
    for (int round = 0; off >= 0 && round < 4; round++) {
      long sz = ((buf[off + 6] & 0x7fL) << 21) | ((buf[off + 7] & 0x7fL) << 14) | ((buf[off + 8] & 0x7fL) << 7) | (buf[off + 9] & 0x7fL);
      if (sz <= 0 || sz > 16_000_000L) break;   // BUG-92: a tag that claims more than 16 MB is not read
      long need = off + 10 + sz + 10;
      if (need > buf.length) { byte[] more = headOf(uri, (int) Math.min(need + 16, (long) Integer.MAX_VALUE)); if (more.length > buf.length) buf = more; }
      int[] next = new int[1];
      String r = id3LyricsAt(buf, off, next, uri);
      if (r != null) return r;
      off = next[0] + 10 <= buf.length && buf[next[0]] == 'I' && buf[next[0] + 1] == 'D' && buf[next[0] + 2] == '3' ? next[0] : -1;   // a second tag right behind the first
    }
    return null;
  }

  private static long le32(byte[] b, int i) { return (b[i] & 0xffL) | ((b[i + 1] & 0xffL) << 8) | ((b[i + 2] & 0xffL) << 16) | ((b[i + 3] & 0xffL) << 24); }

  /** Tags at the END of the file: APEv2 ("Lyrics" items), Lyrics3v2 (LYR field), an ID3v2 tag with a footer. */
  private String readTailLyrics(Uri uri) {
    try (android.os.ParcelFileDescriptor pfd = getContext().getContentResolver().openFileDescriptor(uri, "r");
         FileInputStream fis = new FileInputStream(pfd.getFileDescriptor())) {
      java.nio.channels.FileChannel ch = fis.getChannel(); long len = ch.size();
      // v101: first the last 256 KB only (was 6 MB for EVERY mp3 without lyrics in its head); read more only when the tag at the end says it is bigger
      int n = (int) Math.min(len, 262144L); byte[] t = null; int end = n;
      for (int pass = 0; pass < 2; pass++) {
        ByteBuffer bb = ByteBuffer.allocate(n); long at = len - n;
        while (bb.hasRemaining()) { int r = ch.read(bb, at + bb.position()); if (r <= 0) break; }
        t = bb.array(); end = n;
        if (end >= 128 && t[end - 128] == 'T' && t[end - 127] == 'A' && t[end - 126] == 'G') end -= 128;   // ID3v1
        long need = n - end;
        if (end >= 32 && new String(t, end - 32, 8, StandardCharsets.ISO_8859_1).equals("APETAGEX")) need += le32(t, end - 32 + 12);
        else if (end >= 15 && new String(t, end - 9, 9, StandardCharsets.ISO_8859_1).equals("LYRICS200")) { try { need += 26 + Integer.parseInt(new String(t, end - 15, 6, StandardCharsets.ISO_8859_1).trim()); } catch (Exception ignored) { } }
        else if (end >= 10 && t[end - 10] == '3' && t[end - 9] == 'D' && t[end - 8] == 'I') need += 20 + (((t[end - 4] & 0x7fL) << 21) | ((t[end - 3] & 0x7fL) << 14) | ((t[end - 2] & 0x7fL) << 7) | (t[end - 1] & 0x7fL));
        long cap = Math.min(len, 16_000_000L);   // BUG-97: a footer that claims more than 16 MB is treated as no lyrics (was: bounded only by the file)
        if (need > cap) break;
        if (pass == 1 || need + 64 <= n || n >= cap) break;
        n = (int) Math.min(cap, need + 64);
      }
      java.util.List<Integer> ends = new ArrayList<>(); ends.add(end);
      if (end >= 15 && new String(t, end - 9, 9, StandardCharsets.ISO_8859_1).equals("LYRICS200")) {   // Lyrics3v2: ...LYRICSBEGIN [fields] <6-digit size>LYRICS200
        try {
          int size = Integer.parseInt(new String(t, end - 15, 6, StandardCharsets.ISO_8859_1).trim()), st = end - 15 - size;
          if (st >= 0 && new String(t, st, 11, StandardCharsets.ISO_8859_1).equals("LYRICSBEGIN")) {
            int p = st + 11, fe = end - 15;
            while (p + 8 <= fe) {
              String fid = new String(t, p, 3, StandardCharsets.ISO_8859_1); int fl = Integer.parseInt(new String(t, p + 3, 5, StandardCharsets.ISO_8859_1).trim());
              p += 8; if (fl < 0 || p + fl > fe) break;
              if (fid.equals("LYR") && fl > 0) { String x = new String(t, p, fl, StandardCharsets.ISO_8859_1).trim(); if (!x.isEmpty()) return x; }
              p += fl;
            }
            ends.add(st);
          }
        } catch (Exception ignored) { }
      }
      for (int e : ends) {   // APEv2: 32-byte footer "APETAGEX" right before `e`
        if (e >= 32 && new String(t, e - 32, 8, StandardCharsets.ISO_8859_1).equals("APETAGEX")) {
          long tagSize = le32(t, e - 32 + 12); int count = (int) le32(t, e - 32 + 16);
          int p = (int) (e - tagSize); if (p < 0 || tagSize < 32) continue;
          Map<String, String> items = new java.util.LinkedHashMap<>();
          for (int i = 0; i < count && p + 8 < e - 32; i++) {
            long vs = le32(t, p), fl = le32(t, p + 4); int k = p + 8; while (k < e - 32 && t[k] != 0) k++;
            if (k >= e - 32) break;
            String key = new String(t, p + 8, k - (p + 8), StandardCharsets.UTF_8); int vstart = k + 1;
            if (vs < 0 || vstart + vs > e - 32) break;
            if (((fl >> 1) & 3) == 0) items.put(key, new String(t, vstart, (int) vs, StandardCharsets.UTF_8).replace("\u0000", "\n").trim());
            p = (int) (vstart + vs);
          }
          String r = lyricsFromTags(items); if (r != null) return r;
        }
      }
      if (end >= 10 && t[end - 10] == '3' && t[end - 9] == 'D' && t[end - 8] == 'I') {   // ID3v2 footer: the tag sits in front of it
        long sz = ((t[end - 4] & 0x7fL) << 21) | ((t[end - 3] & 0x7fL) << 14) | ((t[end - 2] & 0x7fL) << 7) | (t[end - 1] & 0x7fL);
        int st = (int) (end - 10 - sz - 10);
        if (st >= 0 && t[st] == 'I' && t[st + 1] == 'D' && t[st + 2] == '3') return id3LyricsAt(t, st, new int[1], uri);
      }
    } catch (Exception | OutOfMemoryError e) { Log.w("LiquidNative", "tail lyrics not read: " + e); }
    return null;
  }

  /** The text of the first "data" atom inside the atom [s, e) (ilst items, freeform "----" items). */
  private static String mp4DataText(java.nio.channels.FileChannel ch, long s, long e) throws Exception {
    long ds = s;
    while (ds + 16 <= e) {
      ByteBuffer d = ByteBuffer.allocate(8); ch.read(d, ds); d.flip(); long dsz = d.getInt() & 0xffffffffL; byte[] dt = new byte[4]; d.get(dt);
      if (dsz < 16 || ds + dsz > e) break;
      if (dt[0] == 'd' && dt[1] == 'a' && dt[2] == 't' && dt[3] == 'a') {
        long tl = dsz - 16; if (tl <= 0 || tl > Integer.MAX_VALUE - 8L) return null;
        ByteBuffer tx = ByteBuffer.allocate((int) tl); ch.read(tx, ds + 16);
        byte[] raw = tx.array(); String x = (raw.length >= 2 && (((raw[0] & 0xff) == 0xFE && (raw[1] & 0xff) == 0xFF))) ? new String(raw, StandardCharsets.UTF_16) : new String(raw, StandardCharsets.UTF_8);
        x = x.trim(); return x.isEmpty() ? null : x;
      }
      ds += dsz;
    }
    return null;
  }

  /** Lyrics of an .m4a / .mp4 family file: (c)lyr, or a freeform "----" item called LYRICS / UNSYNCEDLYRICS / SYNCEDLYRICS ... null = none. */
  private String readMp4Lyrics(Uri uri) {
    try (android.os.ParcelFileDescriptor pfd = getContext().getContentResolver().openFileDescriptor(uri, "r");
         FileInputStream fis = new FileInputStream(pfd.getFileDescriptor())) {
      java.nio.channels.FileChannel ch = fis.getChannel();
      Map<String, String> found = new java.util.LinkedHashMap<>();
      mp4Collect(ch, 0, ch.size(), 0, found);
      return lyricsFromTags(found);
    } catch (Exception | OutOfMemoryError e) { Log.w("LiquidNative", "m4a lyrics not read: " + e); return null; }
  }

  private static void mp4Collect(java.nio.channels.FileChannel ch, long start, long end, int depth, Map<String, String> out) throws Exception {
    long pos = start; ByteBuffer hb = ByteBuffer.allocate(16);
    while (pos + 8 <= end && depth < 8) {
      hb.clear(); hb.limit(16); int got = ch.read(hb, pos); if (got < 8) return; hb.flip();
      long size = hb.getInt() & 0xffffffffL; byte[] tb = new byte[4]; hb.get(tb); int hl = 8;
      if (size == 1) { if (got < 16) return; size = hb.getLong(); hl = 16; } else if (size == 0) size = end - pos;
      if (size < hl) return;
      if (pos + size > end) size = end - pos;   // a box that claims more than the file has: read what is there
      String type = new String(tb, StandardCharsets.ISO_8859_1);
      if ((tb[0] & 0xff) == 0xA9 && tb[1] == 'l' && tb[2] == 'y' && tb[3] == 'r') {
        String x = mp4DataText(ch, pos + hl, pos + size); if (x != null && !out.containsKey("LYRICS")) out.put("LYRICS", x);
      } else if (type.equals("----")) {   // freeform: mean, name, data
        long cs = pos + hl, ce = pos + size; String name = null;
        while (cs + 8 <= ce) {
          ByteBuffer c = ByteBuffer.allocate(8); ch.read(c, cs); c.flip(); long csz = c.getInt() & 0xffffffffL; byte[] ct = new byte[4]; c.get(ct);
          if (csz < 8 || cs + csz > ce) break;
          if (ct[0] == 'n' && ct[1] == 'a' && ct[2] == 'm' && ct[3] == 'e' && csz > 12) { ByteBuffer nb = ByteBuffer.allocate((int) (csz - 12)); ch.read(nb, cs + 12); name = new String(nb.array(), StandardCharsets.UTF_8).trim(); }
          cs += csz;
        }
        if (name != null && name.toUpperCase(Locale.ROOT).contains("LYRIC")) { String x = mp4DataText(ch, pos + hl, pos + size); if (x != null && !out.containsKey(name)) out.put(name, x); }
      } else if (type.equals("moov") || type.equals("udta") || type.equals("ilst") || type.equals("meta")) {
        mp4Collect(ch, pos + hl + (type.equals("meta") ? 4 : 0), pos + size, depth + 1, out);
      }
      pos += size;
    }
  }

  /** Raw embedded lyrics of an MP3 / AAC file (may be LRC-style text), or null. Tries every known place, by file CONTENT (never trusts the extension alone). */
  private String readLossyLyrics(Uri uri, String name) {
    String r = null;
    boolean mp4 = name.toLowerCase(Locale.ROOT).matches(".*\\.(m4a|mp4|m4b|aac)$") && !name.toLowerCase(Locale.ROOT).endsWith(".aac");
    boolean mp3Head = false;   // BUG-146: an ID3 tag or an MPEG frame at the start is never an MP4 (saves one more open of the file)
    try { byte[] h = readHead(uri, 12); if (h.length >= 8 && h[4] == 'f' && h[5] == 't' && h[6] == 'y' && h[7] == 'p') mp4 = true;
      mp3Head = (h.length >= 3 && h[0] == 'I' && h[1] == 'D' && h[2] == '3') || (h.length >= 2 && (h[0] & 0xff) == 0xFF && (h[1] & 0xE0) == 0xE0); } catch (Exception ignored) { }
    if (mp4) r = readMp4Lyrics(uri);
    if (r == null) { try { r = readId3Lyrics(uri); } catch (Exception | OutOfMemoryError e) { Log.w("LiquidNative", "id3 lyrics not read: " + e); } }
    if (r == null) r = readTailLyrics(uri);
    if (r == null && !mp4 && !mp3Head) r = readMp4Lyrics(uri);
    return r == null ? null : r.replace("\r\n", "\n").replace('\r', '\n');
  }

  /** Searchable plain text: timestamps and <word> stamps removed, no length limit. */
  private static String plainLyrics(String x) {
    x = x.replaceAll("<\\d{1,3}:\\d{2}(?:[.:]\\d{1,3})?>", "").replaceAll("\\[[^\\]]*\\]", " ").replaceAll("\\s+", " ").trim();
    return x;
  }

  /** MP3 / AAC (.m4a, .aac): tags, length, bit rate, sample rate and cover through Android's own decoders' metadata readers. null = not playable / empty. */
  private JSONObject readLossy(Uri uri, String fileName, String dirId) throws Exception {
    Map<String, String> tag; long durMs = 0; int kbps = 0; byte[] pic = null;
    MediaMetadataRetriever mr = new MediaMetadataRetriever();
    try {
      mr.setDataSource(getContext(), uri);
      tag = lossyTags(mr);
      String d = mr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION); if (d != null) try { durMs = Long.parseLong(d.trim()); } catch (NumberFormatException ignored) { }
      String b = mr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE); if (b != null) try { kbps = (int) Math.round(Long.parseLong(b.trim()) / 1000.0); } catch (NumberFormatException ignored) { }
      String ak = albumKey(tag, dirId);
      if (ak == null || !albumCover.containsKey(ak)) pic = mr.getEmbeddedPicture();   // each album's picture is read and saved once per scan, like FLAC
    } finally { try { mr.release(); } catch (Exception ignored) { } }
    if (durMs <= 0) return null;
    Object[] fmt = lossyFormat(uri);
    String mime = (String) fmt[2];
    if (!mime.isEmpty() && !mime.equals("audio/mpeg") && !mime.equals("audio/mp4a-latm")) return null;   // e.g. ALAC / Opus in .m4a: Media3 cannot play it here
    if (kbps <= 0) { long sz = sizeOf(uri) - (pic != null ? pic.length : 0); if (sz > 0 && durMs > 0) kbps = (int) Math.round(sz * 8.0 / (durMs / 1000.0) / 1000.0); }   // BUG-147: the embedded cover is not counted as audio
    String cover = null;
    String ak = albumKey(tag, dirId);
    if (pic != null) { cover = saveCover(pic); if (cover != null && ak != null) albumCover.putIfAbsent(ak, cover); }   // BUG-345: the first saved picture of an album wins
    else if (ak != null && albumCover.containsKey(ak)) cover = albumCover.get(ak);
    String base = stripExt(fileName);
    String artist = tag.containsKey("ARTIST") && !tag.get("ARTIST").trim().isEmpty() ? tag.get("ARTIST") : "Unknown Artist";
    String aa = aaTag(tag) != null ? aaTag(tag) : isComp(tag) ? "Various Artists" : "";
    String dateTag = tag.get("DATE"); if (dateTag == null || dateTag.trim().isEmpty()) dateTag = tag.get("YEAR");
    JSONObject t = new JSONObject();
    t.put("title", tag.containsKey("TITLE") && !tag.get("TITLE").isEmpty() ? tag.get("TITLE") : base);
    t.put("artist", artist); t.put("albumArtist", aa); t.put("aaTag", aaTag(tag) != null);
    t.put("album", tag.containsKey("ALBUM") && !tag.get("ALBUM").isEmpty() ? tag.get("ALBUM") : "Unknown Album");
    t.put("genre", tag.containsKey("GENRE") ? tag.get("GENRE") : "");
    t.put("composer", tag.containsKey("COMPOSER") ? tag.get("COMPOSER") : "");
    t.put("year", num(dateTag));
    t.put("track", num(tag.get("TRACKNUMBER"))); t.put("disc", num(tag.get("DISCNUMBER")));
    int rate = (Integer) fmt[0];
    t.put("dur", (int) Math.round(durMs / 1000.0)); t.put("bits", 0); t.put("khz", Math.round(rate / 100.0) / 10.0);
    t.put("fmt", lossyLabel(fileName, mime)); t.put("kbps", kbps);
    String emb = readLossyLyrics(uri, fileName);
    t.put("lyric", emb == null ? "" : plainLyrics(emb));   // v94: embedded lyrics feed the lyrics search
    if (cover != null) t.put("cover", cover);
    return t;
  }

  /** Reads only the metadata blocks at the start of the file (STREAMINFO + VORBIS_COMMENT). */
  /** BUG-89: length in seconds from MediaMetadataRetriever, 0 when unknown. */
  private int retrieverDurSec(Uri uri) {
    MediaMetadataRetriever r = new MediaMetadataRetriever();
    try { r.setDataSource(getContext(), uri); String d = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION); return d == null ? 0 : (int) Math.round(Long.parseLong(d.trim()) / 1000.0); }
    catch (Exception e) { return 0; }
    finally { try { r.release(); } catch (Exception ignored) { } }
  }

  private JSONObject readFlac(Uri uri, String fileName, String dirId) throws Exception {
    long rate = 0, total = 0; int bps = 0; Map<String, String> tag = new HashMap<>();
    byte[] pic = null; long picScore = -1; String reuse = null;
    try (InputStream raw = getContext().getContentResolver().openInputStream(uri);
         DataInputStream in = new DataInputStream(new BufferedInputStream(raw, 65536))) {
      if (!readFlacMagic(in)) return null;
      boolean last = false;
      while (!last) {
        int h = in.readUnsignedByte(); last = (h & 0x80) != 0; int type = h & 0x7f;
        int len = (in.readUnsignedByte() << 16) | (in.readUnsignedByte() << 8) | in.readUnsignedByte();
        if (type == 0 && len >= 18) {
          byte[] b = new byte[len]; in.readFully(b);
          long v = 0; for (int i = 10; i < 18; i++) v = (v << 8) | (b[i] & 0xffL);
          rate = (v >>> 44) & 0xFFFFFL; bps = (int) ((v >>> 36) & 0x1F) + 1; total = v & 0xFFFFFFFFFL;
        } else if (type == 4) {
          byte[] b = new byte[len]; in.readFully(b);
          ByteBuffer bb = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN);
          int vl = bb.remaining() >= 4 ? bb.getInt() : -1; int n = 0;   // BUG-50: a short VORBIS_COMMENT block is malformed, not an exception /* vendor string length is read FIRST, then skipped (T3 fix) */
          if (vl >= 0 && vl <= bb.remaining() - 4) { bb.position(bb.position() + vl); n = bb.getInt(); }
          for (int i = 0; i < n && bb.remaining() >= 4; i++) {
            int l = bb.getInt(); if (l < 0 || l > bb.remaining()) break;
            byte[] s = new byte[l]; bb.get(s); String kv = new String(s, StandardCharsets.UTF_8); int eq = kv.indexOf('=');
            if (eq > 0) putTag(tag, kv.substring(0, eq).toUpperCase(Locale.ROOT), kv.substring(eq + 1).trim());
          }
        } else if (type == 6) { // PICTURE (big endian): type, mime, description, w, h, depth, colours, data
          String ak = albumKey(tag, dirId), known = ak == null ? null : albumCover.get(ak);
          if (known != null) { skip(in, len); if (known != null) reuse = known; }
          else {
            byte[] b = new byte[len]; in.readFully(b);
            try {
              ByteBuffer pb = ByteBuffer.wrap(b); int pt = pb.getInt();
              int ml = pb.getInt(); if (ml < 0 || ml > pb.remaining()) throw new IllegalStateException("bad mime length"); pb.position(pb.position() + ml);
              int dl = pb.getInt(); if (dl < 0 || dl > pb.remaining()) throw new IllegalStateException("bad description length"); pb.position(pb.position() + dl);
              pb.position(pb.position() + 16);
              int pn = pb.getInt();
              if (pn > 0 && pn <= pb.remaining()) {
                long sc = (pt == 3 ? (1L << 40) : 0L) + pn; // front cover wins, otherwise the biggest picture
                if (sc > picScore) { byte[] pd = new byte[pn]; pb.get(pd); pic = pd; picScore = sc; }
              }
            } catch (Exception e) { Log.w("LiquidNative", "bad PICTURE block in " + fileName + ": " + e); }
          }
        } else skip(in, len);
      }
    }
    if (rate == 0) return null;
    String cover = null;
    if (pic != null) { cover = saveCover(pic); String ak = albumKey(tag, dirId); if (cover != null && ak != null) albumCover.putIfAbsent(ak, cover); }
    else if (reuse != null) cover = reuse;
    String base = stripExt(fileName);
    String artist = tag.containsKey("ARTIST") && !tag.get("ARTIST").trim().isEmpty() ? tag.get("ARTIST") : "Unknown Artist";
    boolean comp = isComp(tag);   // T25: COMPILATION=1 without an album artist = Various Artists
    String aa = aaTag(tag) != null ? aaTag(tag) : comp ? "Various Artists" : "";   // C4: no tag = empty (the app picks the main artist); never the track's own "A feat. B"
    String lyr = lyricsFromTags(tag); if (lyr == null) lyr = "";   // v94: any lyrics key (LYRICS, UNSYNCEDLYRICS, SYNCEDLYRICS, LYRICS-ENG ...)
    lyr = plainLyrics(lyr);   // BUG-148: same cleaning as MP3 / AAC ([Chorus] labels removed too)   // LRC text in the tag: search text without timestamps
    JSONObject t = new JSONObject();
    t.put("title", tag.containsKey("TITLE") && !tag.get("TITLE").isEmpty() ? tag.get("TITLE") : base);
    t.put("artist", artist); t.put("albumArtist", aa); t.put("aaTag", aaTag(tag) != null);
    t.put("album", tag.containsKey("ALBUM") && !tag.get("ALBUM").isEmpty() ? tag.get("ALBUM") : "Unknown Album");
    t.put("genre", tag.containsKey("GENRE") ? tag.get("GENRE") : "");
    t.put("composer", tag.containsKey("COMPOSER") ? tag.get("COMPOSER") : "");   // v64
    String dateTag = tag.get("DATE"); if (dateTag == null || dateTag.trim().isEmpty()) dateTag = tag.get("YEAR");   // an empty DATE must not hide a good YEAR
    t.put("year", num(dateTag));
    t.put("track", num(tag.get("TRACKNUMBER"))); t.put("disc", num(tag.get("DISCNUMBER")));
    t.put("dur", total > 0 ? (int) Math.round((double) total / rate) : retrieverDurSec(uri)); t.put("bits", bps);   // BUG-89: unknown total samples = ask the media retriever
    t.put("khz", Math.round(rate / 100.0) / 10.0);
    t.put("lyric", lyr);
    t.put("fmt", "FLAC");
    if (cover != null) t.put("cover", cover);
    return t;
  }

  /* ---------- T4: playback (drives PlaybackService through a MediaController) ---------- */
  private interface Use { void run(Player p); }
  private MediaController mc;
  private final Handler ui = new Handler(Looper.getMainLooper());

  private ListenableFuture<MediaController> pendingController;
  private final List<Use> waiting = new ArrayList<>();

  private void runUse(Use u) { try { u.run(mc); } catch (Throwable t) { Log.w("LiquidNative", "player callback failed: " + t); } }   // BUG-46

  private void withPlayer(Use u) {
    ui.post(() -> {
      if (mc != null) { runUse(u); return; }
      waiting.add(u);                      // one MediaController at a time: later calls wait for the first to connect
      if (pendingController != null) return;
      SessionToken tok = new SessionToken(getContext(), new ComponentName(getContext(), PlaybackService.class));
      final ListenableFuture<MediaController> f = new MediaController.Builder(getContext(), tok).setListener(new MediaController.Listener() {   // BUG-390: when the service disconnects the cached controller is dropped, so the next call builds a fresh one
        @Override public void onDisconnected(MediaController c) { ui.post(() -> { if (mc == c) { ui.removeCallbacks(ticker); try { mc.release(); } catch (Exception ignored) { } mc = null; } }); }
      }).buildAsync();
      pendingController = f;
      f.addListener(() -> {
        pendingController = null;
        try {
          if (mc == null) { mc = f.get(); wire(); }
          List<Use> run = new ArrayList<>(waiting); waiting.clear();
          for (Use w : run) runUse(w);   // BUG-46: one failing callback must not drop the others
        } catch (Exception e) { waiting.clear(); Log.w("LiquidNative", "player service not ready: " + e); }
      }, ContextCompat.getMainExecutor(getContext()));
    });
  }

  /** The WebView / activity is going away: stop the 150 ms loop, drop the service listeners and release the controller. */
  @Override
  protected void handleOnDestroy() {
    ui.removeCallbacks(ticker);
    if (btBat != null) { try { getContext().unregisterReceiver(btBat); } catch (Exception ignored) { } btBat = null; }
    if (btCb != null) { try { ((AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE)).unregisterAudioDeviceCallback(btCb); } catch (Exception ignored) { } btCb = null; }
    PlaybackService.sleepListener = null;
    ListenTracker.onPlayCounted = null;
    waiting.clear();
    if (pendingController != null) { MediaController.releaseFuture(pendingController); pendingController = null; }
    if (mc != null) { try { mc.release(); } catch (Exception e) { Log.w("LiquidNative", "release: " + e); } mc = null; }
    super.handleOnDestroy();
  }

  private void emitState() {
    JSObject o = new JSObject();
    o.put("playing", mc.getPlayWhenReady() && mc.getPlaybackState() != Player.STATE_ENDED && mc.getPlaybackState() != Player.STATE_IDLE);
    notifyListeners("onState", o);
    ui.removeCallbacks(ticker); ui.post(ticker);   // BUG-388: back to the fast loop at once when playback starts
  }

  private final Runnable ticker = new Runnable() {
    @Override public void run() {
      if (mc == null) return;   // released: the loop ends here
      if (mc.isPlaying()) { JSObject o = new JSObject(); o.put("pos", mc.getCurrentPosition() / 1000.0); notifyListeners("onProgress", o); }
      ui.postDelayed(this, mc.isPlaying() ? 150 : 1000);   // BUG-388: only 1 check per second while paused (emitState restarts the fast loop on every state change). v56: the page now extrapolates between reports (bar + lyrics), so fewer bridge messages are enough
    }
  };

  /* ---------- v145/v145b: play counts that survive a paused WebView AND a closed app.
     Plays are counted by ListenTracker inside PlaybackService (exact timer, 10 s of real listening or half the song) and appended to SharedPreferences ("plays", no size limit),
     so they are counted with the app in the background, the screen off or the app swiped away. This plugin only hands them to the page: takePlays() when the page starts / the app
     comes back, and an "onPlayCounted" event right after each play while the app is open. The page no longer counts by itself in the Android app, so nothing is counted twice. ---------- */
  private void hookPlayEvents() {
    ListenTracker.onPlayCounted = () -> ui.post(() -> { try { notifyListeners("onPlayCounted", new JSObject()); } catch (Throwable ignored) { } });
  }

  /** Plays counted natively and not yet acknowledged: { plays: [{ id, ts }] } (oldest first). Does NOT clear them: the page calls ackPlays() once it has SAVED them, so a failed save or a killed app loses nothing. */
  @PluginMethod
  public void takePlays(PluginCall call) {
    JSONArray list;
    synchronized (ListenTracker.PLAYS_LOCK) {
      try { list = new JSONArray(prefs().getString("plays", "[]")); } catch (Exception e) { list = new JSONArray(); }
    }
    JSObject o = new JSObject(); o.put("plays", list); call.resolve(o);
  }

  /** The page saved these plays: remove exactly those ({ plays: [{ id, ts }] }), or everything with { all: true }. Plays added in the meantime stay. */
  @PluginMethod
  public void ackPlays(PluginCall call) {
    boolean all = Boolean.TRUE.equals(call.getBoolean("all", false));
    JSONArray done = call.getArray("plays");
    synchronized (ListenTracker.PLAYS_LOCK) {
      try {
        if (all) prefs().edit().remove("plays").commit();
        else if (done != null && done.length() > 0) {
          java.util.HashSet<String> gone = new java.util.HashSet<>();
          for (int i = 0; i < done.length(); i++) { JSONObject d = done.optJSONObject(i); if (d != null) gone.add(d.optString("id", "") + "|" + d.optLong("ts", 0)); }
          JSONArray cur = new JSONArray(prefs().getString("plays", "[]")), keep = new JSONArray();
          for (int i = 0; i < cur.length(); i++) { JSONObject d = cur.optJSONObject(i); if (d != null && !gone.contains(d.optString("id", "") + "|" + d.optLong("ts", 0))) keep.put(d); }
          prefs().edit().putString("plays", keep.toString()).commit();
        }
      } catch (Exception e) { Log.w("LiquidNative", "ackPlays: " + e); }
    }
    call.resolve();
  }


  /* ---------- Listening statistics: reads of the history database written by ListenTracker (inside PlaybackService). ---------- */
  @Override protected void handleOnStart() { hookPlayEvents(); ListenTracker.setForeground(true); super.handleOnStart(); }
  @Override protected void handleOnStop() { ListenTracker.setForeground(false); super.handleOnStop(); }

  /** { segs: [...] } listening segments overlapping [from, to) (ms). */
  @PluginMethod
  public void getListens(PluginCall call) {
    final long from = call.getLong("from", 0L), to = call.getLong("to", Long.MAX_VALUE / 4);
    new Thread(() -> { try { JSObject o = new JSObject(); o.put("segs", ListenDb.get(getContext()).query(from, to)); call.resolve(o); } catch (Throwable t) { call.reject("History database error: " + t); } }, "lf-listens").start();
  }

  /** { days: [dayNumber, ...] } local days with listening, newest first. */
  @PluginMethod
  public void getListenDays(PluginCall call) {
    new Thread(() -> { try { JSObject o = new JSObject(); o.put("days", ListenDb.get(getContext()).days()); call.resolve(o); } catch (Throwable t) { call.reject("History database error: " + t); } }, "lf-listen-days").start();
  }

  /** { seen: [{i,a,al,aa}] } distinct songs heard before `before`. */
  @PluginMethod
  public void getListenSeen(PluginCall call) {
    final long before = call.getLong("before", 0L);
    new Thread(() -> { try { JSObject o = new JSObject(); o.put("seen", ListenDb.get(getContext()).seen(before)); call.resolve(o); } catch (Throwable t) { call.reject("History database error: " + t); } }, "lf-listen-seen").start();
  }

  /** { from?, to?, ids? }: no field = the whole history. Resolves { removed }. An open (currently playing) segment is deleted too, so a clear during playback may leave the rest of that one stretch uncounted. */
  @PluginMethod
  public void clearListens(PluginCall call) {
    final Long from = call.hasOption("from") ? call.getLong("from") : null, to = call.hasOption("to") ? call.getLong("to") : null;
    final java.util.List<String> ids;
    if (call.hasOption("ids")) { ids = new ArrayList<>(); try { JSONArray a = call.getArray("ids"); for (int i = 0; i < a.length(); i++) ids.add(a.getString(i)); } catch (Exception e) { call.reject("bad ids"); return; } } else ids = null;
    new Thread(() -> { try { JSObject o = new JSObject(); o.put("removed", ListenDb.get(getContext()).clear(from, to, ids)); StatsWidgets.refresh(getContext()); call.resolve(o); } catch (Throwable t) { call.reject("History database error: " + t); } }, "lf-listen-clear").start();
  }

  /** Shares a PNG (base64, no prefix; optional file name) through Android's share sheet. */
  @PluginMethod
  public void shareImage(PluginCall call) {
    try {
      byte[] png = android.util.Base64.decode(call.getString("data", ""), android.util.Base64.DEFAULT);
      if (png.length == 0) { call.reject("no image"); return; }   // BUG-389: nothing to share
      File dir = new File(getContext().getCacheDir(), "share"); dir.mkdirs();
      long cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000; File[] stale = dir.listFiles();   // shared pictures older than a day are not needed any more
      if (stale != null) for (File o : stale) { if (o.isFile() && o.lastModified() < cutoff) o.delete(); }
      String nm = call.getString("name", "").replaceAll("[^A-Za-z0-9._-]", "_");   // the receiving app shows this file name (e.g. liquid-dark-weekly-2026-11-02.png)
      if (!nm.endsWith(".png") || nm.length() < 5 || nm.length() > 80) nm = "lf-" + System.currentTimeMillis() + ".png";
      File f = new File(dir, nm);
      try (FileOutputStream out = new FileOutputStream(f)) { out.write(png); }
      Uri uri = androidx.core.content.FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
      Intent i = new Intent(Intent.ACTION_SEND); i.setType("image/png"); i.putExtra(Intent.EXTRA_STREAM, uri); i.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
      i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      Intent ch = Intent.createChooser(i, "Share"); ch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(ch); call.resolve();
    } catch (Exception e) { call.reject("Could not share: " + e.getMessage()); }
  }

  private void wire() {
    mc.addListener(new Player.Listener() {
      @Override public void onMediaItemTransition(MediaItem m, int reason) {
        JSObject o = new JSObject(); o.put("index", mc.getCurrentMediaItemIndex()); notifyListeners("onTrackChanged", o);
      }
      @Override public void onPlayWhenReadyChanged(boolean r, int why) { emitState(); }
      @Override public void onPlaybackStateChanged(int st) { emitState(); }
    });
    ui.removeCallbacks(ticker);   // never two loops
    ui.post(ticker);
  }

  /** String.join needs API 26; the minSdk is 22. */
  private static String joinWith(String sep, List<String> parts) {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < parts.size(); i++) { if (i > 0) sb.append(sep); sb.append(parts.get(i)); }
    return sb.toString();
  }

  private MediaItem itemFrom(JSONObject it) { return itemFrom(it, null); }

  /** BUG-391: resolves every cover of the given items in parallel on ART_POOL (blocks the CALLING worker/plugin thread only, never the main thread). Songs, albums, artists, genres and playlists keep their own files: nothing is merged, only the already existing artUri rule is run ahead of time. */
  private Map<String, Uri> artReady(Iterable<String> covers) {
    final Map<String, Uri> out = new java.util.concurrent.ConcurrentHashMap<>();
    final java.util.LinkedHashSet<String> uniq = new java.util.LinkedHashSet<>();
    for (String c : covers) if (c != null && !c.isEmpty()) uniq.add(c);
    List<java.util.concurrent.Future<?>> fs = new ArrayList<>();
    for (final String c : uniq) fs.add(ART_POOL.submit(new Runnable() { @Override public void run() { try { Uri u = artUri(c); if (u != null) out.put(c, u); } catch (Throwable t) { Log.w("LiquidNative", "artwork prepare failed: " + t); } } }));
    for (java.util.concurrent.Future<?> f : fs) { try { f.get(); } catch (Exception ignored) { } }
    return out;
  }

  private Map<String, Uri> artReadyFor(org.json.JSONArray items) {
    List<String> cv = new ArrayList<>();
    if (items != null) for (int i = 0; i < items.length(); i++) { JSONObject o = items.optJSONObject(i); if (o != null) cv.add(o.optString("cover", "")); }
    return artReady(cv);
  }

  private MediaItem itemFrom(JSONObject it, Map<String, Uri> ready) {
    MediaMetadata.Builder mb = new MediaMetadata.Builder().setTitle(it.optString("title"))
        .setArtist(it.optString("artist")).setAlbumTitle(it.optString("album")).setAlbumArtist(it.optString("albumArtist").isEmpty() ? it.optString("artist") : it.optString("albumArtist")).setTrackNumber(it.optInt("no", 0) > 0 ? it.optInt("no", 0) : null);   // T24: car / Bluetooth displays read album artist + track no.
    // v54: album + artist travel with the song in every field a notification / lock screen / notch app may read (also while paused)
    String ar = it.optString("artist"), al = it.optString("album");
    mb.setDisplayTitle(it.optString("title")).setSubtitle(ar.isEmpty() ? al : (al.isEmpty() ? ar : ar + " \u2022 " + al)).setDescription(al);
    String cv = it.optString("cover", ""); if (!cv.isEmpty()) { Uri au = ready != null ? ready.get(cv) : artUri(cv); if (au != null) mb.setArtworkUri(au); }
    return new MediaItem.Builder().setUri(it.optString("uri")).setMediaId(it.optString("id")).setMediaMetadata(mb.build()).build();
  }

  /** v153: the address handed to the notification / lock screen for a cover. A custom picture (lfpics) is copied to lfart/ under a name that changes whenever the picture changes, because Android caches artwork BY ADDRESS and would keep showing the old one. */
  private Uri artUri(String c) {
    if (c == null || c.isEmpty()) return null;
    File f = new File(c); if (!f.exists()) return null;
    if (!c.contains("/lfpics/")) return Uri.fromFile(f);
    try {
      File d = new File(getContext().getFilesDir(), "lfart"); d.mkdirs();
      String n = f.getName(); int dot = n.lastIndexOf('.'); if (dot <= 0) return Uri.fromFile(f);
      String base = n.substring(0, dot), ext = n.substring(dot);
      File out = new File(d, base + "_" + f.lastModified() + "_" + f.length() + ext);
      synchronized (base.intern()) {   // BUG-391: parallel preparation: one copy per picture at a time, other pictures run side by side
        if (!out.exists()) {
          File[] old = d.listFiles(); if (old != null) for (File o : old) if (o.getName().startsWith(base + "_")) o.delete();
          File tmp = new File(d, out.getName() + ".part");
          try (java.io.FileInputStream in = new java.io.FileInputStream(f); FileOutputStream os = new FileOutputStream(tmp)) { byte[] b = new byte[65536]; int k; while ((k = in.read(b)) > 0) os.write(b, 0, k); }
          if (!tmp.renameTo(out)) return Uri.fromFile(f);
        }
      }
      return Uri.fromFile(out);
    } catch (Exception e) { Log.w("LiquidNative", "artwork copy failed: " + e); return Uri.fromFile(f); }
  }

  /** v153: { items: [{ id, cover }] } -> every queue song with that id gets that cover in its metadata AT ONCE, the playing one included (a metadata-only change does not interrupt playback), so the notification and lock screen change the moment a picture is set. cover "" = no artwork. */
  /** v157: custom album / artist pictures for the Albums + Artists home screen widgets (see LiquidTiles.setOverrides). */
  /** v159: the app's known artists for the stats widgets (collab split like the app). */
  @PluginMethod
  public void setWidgetArtists(PluginCall call) {
    try { StatsWidgets.setKnown(getContext(), call.getData()); call.resolve(); }
    catch (Exception e) { Log.w("LiquidNative", "setWidgetArtists failed", e); call.reject("setWidgetArtists failed: " + e.getMessage()); }
  }

  @PluginMethod
  public void setWidgetCovers(PluginCall call) {
    try { LiquidTiles.setOverrides(getContext(), call.getObject("covers")); call.resolve(); }
    catch (Exception e) { Log.w("LiquidNative", "setWidgetCovers failed", e); call.reject("setWidgetCovers failed: " + e.getMessage()); }
  }

  @PluginMethod
  public void setArtwork(PluginCall call) {
    try {
      final org.json.JSONArray arr = call.getArray("items");
      final java.util.HashMap<String, String> m = new java.util.HashMap<>();
      if (arr != null) for (int i = 0; i < arr.length(); i++) { JSONObject o = arr.optJSONObject(i); if (o != null) m.put(o.optString("id"), o.optString("cover", "")); }
      call.resolve();
      if (m.isEmpty()) return;
      LIB_POOL.execute(new Runnable() { @Override public void run() {   // BUG-391: pictures are resolved / copied here, the main thread only swaps ready addresses
        final Map<String, Uri> ready = artReady(m.values());
        withPlayer(p -> {
          for (int i = 0; i < p.getMediaItemCount(); i++) {
            MediaItem it = p.getMediaItemAt(i); String c = m.get(it.mediaId); if (c == null) continue;
            Uri nw = c.isEmpty() ? null : ready.get(c), cur = it.mediaMetadata.artworkUri;
            if (nw == null ? cur == null : nw.equals(cur)) continue;
            p.replaceMediaItem(i, it.buildUpon().setMediaMetadata(it.mediaMetadata.buildUpon().setArtworkUri(nw).build()).build());
          }
        });
      } });
    } catch (Exception e) { Log.w("LiquidNative", "setArtwork failed", e); call.reject("setArtwork failed: " + e.getMessage()); }
  }

  // T7: Play Next = right after the current item; Add to Queue = end of the queue.
  @PluginMethod public void addNext(PluginCall call) { addItem(call, true); }
  @PluginMethod public void addToQueue(PluginCall call) { addItem(call, false); }

  private void addItem(PluginCall call, boolean next) {
    try {
      final JSONObject src = call.getObject("item");
      final MediaItem mi = itemFrom(src, artReady(java.util.Collections.singletonList(src.optString("cover", ""))));   // BUG-391
      withPlayer(p -> {
        if (next) p.addMediaItem(Math.min(p.getMediaItemCount(), p.getCurrentMediaItemIndex() + 1), mi);
        else p.addMediaItem(mi);
      });
      call.resolve();
    } catch (Exception e) { Log.e("LiquidNative", "add failed", e); call.reject("add failed: " + e.getMessage()); }
  }

  /* ---------- T9: lyrics. Sidecar .lrc in the same folder (exact name, else fuzzy >= 0.55), else embedded tags. Read on demand. ---------- */
  private static String normName(String s) {
    String n = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return n.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", "");
  }

  private static double ratio(String a, String b) {   // 1 - Levenshtein / longest
    int n = a.length(), m = b.length(); if (n == 0 && m == 0) return 1.0;
    int[] prev = new int[m + 1], cur = new int[m + 1];
    for (int j = 0; j <= m; j++) prev[j] = j;
    for (int i = 1; i <= n; i++) {
      cur[0] = i;
      for (int j = 1; j <= m; j++) cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1));
      int[] t = prev; prev = cur; cur = t;
    }
    return 1.0 - (double) prev[m] / Math.max(n, m);
  }

  /** Name without a leading track number ("01 - Song", "7. Song", "(03) Song"), normalised. */
  private static String coreName(String raw) {
    return normName(raw.replaceFirst("^\\s*\\(?\\d{1,3}\\)?\\s*[-._):]+\\s*|^\\s*\\d{1,3}\\s+", ""));
  }
  private static String digitsOf(String s) { return s.replaceAll("[^0-9]+", " ").trim(); }

  /** v56: which .lrc belongs to this song. The old rule (any name >= 55 % alike) gave "Track 2" the lyrics of "Track 1" and "02 Song B" those of "01 Song A".
   *  Now: exact name, else the same name apart from a track number, else one name ends / starts with the other ("Artist - Song" vs "Song", same digits),
   *  else >= 85 % alike AND the same digits. Anything weaker = no lyrics file (embedded tags are still tried). */
  /* v95: versions. "Song", "Song (Remix)", "Song (Live)", "Song (Instrumental)" are different recordings: their lyrics (and certainly the timings of a synced .lrc) must never be swapped by a fuzzy match.
   * These words mark a different version. Harmless extras (feat. X, Remastered 2011, Album / Single Version, Original Mix) are ignored, so an album track and its single still share lyrics. */
  private static final java.util.Set<String> VERSION_WORDS = new java.util.HashSet<>(java.util.Arrays.asList(
      "remix", "rmx", "remixed", "mix", "live", "acoustic", "instrumental", "inst", "vip", "demo", "cover", "sped", "slowed", "reverb", "nightcore", "karaoke",
      "cappella", "acapella", "bootleg", "rework", "reworked", "flip", "unplugged", "session", "reprise", "dub", "edit", "extended", "stripped", "piano", "orchestral", "mashup", "interlude", "skit", "intro", "outro"));

  /** Sorted version words found in a title / file name ("" = the plain recording). */
  static String versionMarks(String raw) {
    if (raw == null) return "";
    String l = raw.toLowerCase(Locale.ROOT).replace("original mix", " ").replace("original version", " ");
    java.util.TreeSet<String> out = new java.util.TreeSet<>();
    for (String w : l.split("[^\\p{L}\\p{N}]+")) if (VERSION_WORDS.contains(w)) out.add(w);
    return joinWith(",", new ArrayList<>(out));
  }

  /** Title without harmless extras: "(feat. X)", "(Remastered 2011)", "(Album Version)", " - 2011 Remaster". A bracket that names a real version (remix, live ...) stays. */
  static String cleanTitle(String t) {
    if (t == null) return "";
    java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\s*[(\\[]([^)\\]]*)[)\\]]").matcher(t);
    StringBuffer sb = new StringBuffer();
    while (m.find()) {
      String in = m.group(1).toLowerCase(Locale.ROOT);
      boolean harmless = versionMarks(in).isEmpty() && (in.matches("^\\s*(feat|ft|featuring|prod)\\b.*") || in.matches("^\\s*(\\d{4}\\s+)?(digital\\s+)?(remaster(ed)?( version)?(\\s+\\d{4})?|album version|single version|original version|original mix|mono|stereo|explicit|deluxe(\\s+edition)?)\\s*$"));
      m.appendReplacement(sb, harmless ? "" : java.util.regex.Matcher.quoteReplacement(m.group()));
    }
    m.appendTail(sb);
    String r = sb.toString();
    if (versionMarks(r).isEmpty()) r = r.replaceAll("(?i)\\s+-\\s+(\\d{4}\\s+)?(digital\\s+)?remaster(ed)?(\\s+\\d{4})?\\s*$", "").replaceAll("(?i)\\s+-\\s+(feat|ft)\\.?\\s.*$", "");
    return r.trim();
  }

  private String lrcForName(Doc d) {
    List<String[]> list = lrcs.get(d.dir); if (list == null) return null;
    String base = stripExt(d.name), want = normName(base), core = coreName(base);
    String best = null; double bs = 0;
    for (String[] c : list) {
      if (c[0].equals(want)) return c[1];
      double sc = 0;
      if (!core.isEmpty() && c[2].equals(core)) sc = 0.97;
      else if (digitsOf(core).equals(digitsOf(c[2]))) {
        String a = core, b = c[2];
        if (a.length() >= 4 && b.length() >= 4) {
          String sh = a.length() <= b.length() ? a : b, lg = a.length() <= b.length() ? b : a;
          if ((lg.startsWith(sh) || lg.endsWith(sh)) && sh.length() * 2 >= lg.length()) sc = 0.9;
          else { double r = ratio(a, b); if (r >= 0.85) sc = r; }
        }
      }
      if (sc > 0 && !versionMarks(base).equals(versionMarks(c[3]))) sc = 0;   // v95: a remix / live / instrumental file never stands in for another version
      if (sc > bs) { bs = sc; best = c[1]; }
    }
    return best;
  }

  /** v95: which .lrc belongs to this song. 1) by FILE name (rules above), 2) by TITLE / ARTIST in the same folder ("Title.lrc", "Artist - Title.lrc", "Title - Artist.lrc",
   *  also with a track number in front), 3) anywhere in the library, but only "Artist - Title" style names and only when exactly one .lrc fits. */
  private String lrcFor(Doc d, String title, String artist) {
    String r = lrcForName(d); if (r != null) return r;
    String nt = normName(cleanTitle(title)), na = normName(cleanTitle(artist));
    if (nt.length() < 2 && (nt.isEmpty() || nt.charAt(0) < 128)) return null;   // BUG-401: a one-character non-ASCII title (e.g. CJK) is searched too
    final String tMarks = versionMarks(title);
    String[] both = na.isEmpty() ? new String[0] : new String[] { na + nt, nt + na };
    List<String[]> same = lrcs.get(d.dir);
    if (same != null) {
      for (String[] c : same) for (String b : both) if ((c[0].equals(b) || c[2].equals(b)) && versionMarks(c[3]).equals(tMarks)) return c[1];
      for (String[] c : same) if ((c[0].equals(nt) || c[2].equals(nt)) && versionMarks(c[3]).equals(tMarks)) return c[1];
    }
    String hr = lrcByHeader(d, nt, na); if (hr != null) return hr;   // the [ti:] / [ar:] tags inside the .lrc files
    String found = null;
    if (both.length > 0) for (String[] c : allLrcs) {
      boolean hit = false; for (String b : both) if (c[0].equals(b) || c[2].equals(b)) hit = true;
      if (!hit || !versionMarks(c[3]).equals(tMarks)) continue;
      if (found != null && !found.equals(c[1])) return null;   // two different files fit: do not guess
      found = c[1];
    }
    if (found != null) return found;
    // v106: .lrc found outside the music folder (All files access): plain "Title.lrc", only when exactly one such file fits
    for (String[] c : allLrcs) {
      if (!c[1].startsWith("file:") || !(c[0].equals(nt) || c[2].equals(nt)) || !versionMarks(c[3]).equals(tMarks)) continue;
      if (found != null && !found.equals(c[1])) return null;
      found = c[1];
    }
    return found;
  }

  private static final java.util.regex.Pattern LRC_TI = java.util.regex.Pattern.compile("(?im)^\\s*\\[ti:([^\\]]*)\\]"), LRC_AR = java.util.regex.Pattern.compile("(?im)^\\s*\\[ar:([^\\]]*)\\]");

  /** { title, artist } of the [ti:] / [ar:] tags inside a .lrc (normalised, "" when missing). */
  private String[] lrcHeader(String uri) {
    String[] h = lrcHead.get(uri); if (h != null) return h;
    h = new String[] { "", "" };
    try {
      byte[] b = readHead(Uri.parse(uri), 4096); String txt = decodeLrc(b, encOf(b));   // BUG-51: header tags live in the first 4 KB
      java.util.regex.Matcher m = LRC_TI.matcher(txt); if (m.find()) h[0] = normName(m.group(1));
      m = LRC_AR.matcher(txt); if (m.find()) h[1] = normName(m.group(1));
    } catch (Exception ignored) { }
    lrcHead.put(uri, h); return h;
  }

  /** A .lrc whose own [ti:] (and [ar:], when both sides have one) matches the song. Same folder first; library-wide only when exactly one file fits. */
  private String lrcByHeader(Doc d, String nt, String na) {
    List<String[]> same = lrcs.get(d.dir);
    if (same != null) for (String[] c : same) { String[] h = lrcHeader(c[1]); if (h[0].equals(nt) && (na.isEmpty() || h[1].isEmpty() || h[1].equals(na))) return c[1]; }
    if (na.isEmpty()) return null;
    String found = null;
    for (String[] c : allLrcs) {
      String[] h = lrcHeader(c[1]);
      if (!h[0].equals(nt) || !h[1].equals(na)) continue;
      if (found != null && !found.equals(c[1])) return null;
      found = c[1];
    }
    return found;
  }

  /** Plain searchable text of a .lrc file (timestamps / tags stripped, files over 4 MB are skipped); "" when unreadable. */
  private String lrcPlain(String uri) {
    try {
      String x = readText(Uri.parse(uri)).replaceAll("<\\d{1,3}:\\d{2}(?:[.:]\\d{1,3})?>", "").replaceAll("\\[[^\\]]*\\]", " ").replaceAll("\\s+", " ").trim();
      return x;
    } catch (Exception e) { return ""; }
  }

  private String readText(Uri u) throws Exception {
    byte[] b;
    try (InputStream in = getContext().getContentResolver().openInputStream(u)) {
      ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] buf = new byte[16384]; int n;
      while ((n = in.read(buf)) > 0) { bo.write(buf, 0, n); if (bo.size() > 4_000_000) throw new java.io.IOException("lyrics file over 4 MB"); }   // BUG-249: a renamed recording called song.lrc is never read whole (same 4 MB cap as the other .lrc reads)
      b = bo.toByteArray();
    }
    if (b.length >= 3 && (b[0] & 0xff) == 0xEF && (b[1] & 0xff) == 0xBB && (b[2] & 0xff) == 0xBF) return new String(b, 3, b.length - 3, StandardCharsets.UTF_8);
    if (b.length >= 2 && (b[0] & 0xff) == 0xFF && (b[1] & 0xff) == 0xFE) return new String(b, 2, b.length - 2, StandardCharsets.UTF_16LE);
    if (b.length >= 2 && (b[0] & 0xff) == 0xFE && (b[1] & 0xff) == 0xFF) return new String(b, 2, b.length - 2, StandardCharsets.UTF_16BE);
    try { return StandardCharsets.UTF_8.newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b)).toString(); }
    catch (java.nio.charset.CharacterCodingException e) {
      try { return java.nio.charset.Charset.forName("GBK").newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b)).toString(); } catch (Exception x) { try { return new String(b, java.nio.charset.Charset.forName("windows-1252")); } catch (Exception y) { return new String(b, StandardCharsets.ISO_8859_1); } }   // BUG-250: GBK only when the bytes really are GBK, else Windows-1252
    }
  }

  /* embedded lyric tags of one FLAC, read on demand (not cached): SYNCEDLYRICS, then LYRICS, then UNSYNCEDLYRICS */
  private String readVorbisText(Uri uri) throws Exception {
    String ln = displayName(uri), r = null;
    if (isLossyName(ln)) r = readLossyLyrics(uri, ln);
    else { try { r = readFlacLyrics(uri); } catch (Exception e) { Log.w("LiquidNative", "flac lyrics not read: " + e); } }
    if (r == null) { try { r = isLossyName(ln) ? readFlacLyrics(uri) : readLossyLyrics(uri, ln + uri.toString()); } catch (Exception e) { Log.w("LiquidNative", "fallback lyrics not read: " + e); } }   // wrong / unknown extension: look at the content
    return r;
  }

  private String readFlacLyrics(Uri uri) throws Exception {
    Map<String, String> tag = new HashMap<>();
    try (InputStream raw = getContext().getContentResolver().openInputStream(uri);
         DataInputStream in = new DataInputStream(new BufferedInputStream(raw, 65536))) {
      if (!readFlacMagic(in)) return null;
      boolean last = false;
      while (!last) {
        int h = in.readUnsignedByte(); last = (h & 0x80) != 0; int type = h & 0x7f;
        int len = (in.readUnsignedByte() << 16) | (in.readUnsignedByte() << 8) | in.readUnsignedByte();
        if (type == 4) {
          byte[] b = new byte[len]; in.readFully(b);
          ByteBuffer bb = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN);
          int vl = bb.remaining() >= 4 ? bb.getInt() : -1; int n = 0;   // BUG-50: a short VORBIS_COMMENT block is malformed, not an exception
          if (vl >= 0 && vl <= bb.remaining() - 4) { bb.position(bb.position() + vl); n = bb.getInt(); }
          for (int i = 0; i < n && bb.remaining() >= 4; i++) {
            int l = bb.getInt(); if (l < 0 || l > bb.remaining()) break;
            byte[] s = new byte[l]; bb.get(s); String kv = new String(s, StandardCharsets.UTF_8); int eq = kv.indexOf('=');
            if (eq > 0) putTag(tag, kv.substring(0, eq).toUpperCase(Locale.ROOT), kv.substring(eq + 1));
          }
        } else skip(in, len);
      }
    }
    return lyricsFromTags(tag);
  }

  @PluginMethod
  public void getLyrics(PluginCall call) {
    try {
      String lrc = call.getString("lrc", "");
      String text = null;
      if (lrc != null && !lrc.isEmpty()) { try { text = readText(Uri.parse(lrc)); } catch (Exception e) { Log.w("LiquidNative", "lrc unreadable, using embedded lyrics: " + e); } }
      if (text == null || text.trim().isEmpty()) text = readVorbisText(Uri.parse(call.getString("uri", "")));
      JSObject o = new JSObject(); o.put("text", text == null ? "" : text); call.resolve(o);
    } catch (Exception e) { Log.w("LiquidNative", "getLyrics failed: " + e); call.reject("lyrics: " + e.getMessage()); }
  }

  /* ---------- T17: export / import playlists through the system file dialogs. JS builds and parses the text (src/plexport.js). ---------- */
  /** { text, name } -> asks where to save (ACTION_CREATE_DOCUMENT) and writes text there as UTF-8. Rejects "cancelled" if the dialog is closed. */
  @PluginMethod
  public void exportPlaylists(PluginCall call) {
    if (call.getString("text") == null) { call.reject("no text"); return; }
    String name = call.getString("name", "liquid-dark-playlists.json");
    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("application/json"); i.putExtra(Intent.EXTRA_TITLE, name);
    startActivityForResult(call, i, "exportResult");
  }

  @ActivityCallback
  private void exportResult(PluginCall call, ActivityResult r) {
    if (call == null) return;
    if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null || r.getData().getData() == null) { call.reject("cancelled"); return; }
    final Uri target = r.getData().getData();
    new Thread(() -> {   // BUG-47: file I/O off the main thread
      try {
        byte[] bytes = call.getString("text", "").getBytes(StandardCharsets.UTF_8);
        try (java.io.OutputStream out = getContext().getContentResolver().openOutputStream(target, "wt")) {
          if (out == null) throw new Exception("cannot open the file");
          out.write(bytes);
        }
        call.resolve();
      } catch (Exception e) { Log.e("LiquidNative", "export playlists failed", e); call.reject("export failed: " + e.getMessage()); }
    }, "lf-export-pl").start();
  }

  /** -> { text } (the chosen file as UTF-8, max 5 MB). Rejects "cancelled" if the dialog is closed. */
  @PluginMethod
  public void importPlaylists(PluginCall call) {
    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*");   // no MIME filter: some file managers call .json "octet-stream"; JS checks the content
    startActivityForResult(call, i, "importResult");
  }

  @ActivityCallback
  private void importResult(PluginCall call, ActivityResult r) {
    if (call == null) return;
    if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null || r.getData().getData() == null) { call.reject("cancelled"); return; }
    final Uri src = r.getData().getData();
    new Thread(() -> {   // BUG-47: file I/O off the main thread, and the 5 MB limit is enforced
      try (InputStream in = getContext().getContentResolver().openInputStream(src)) {
        if (in == null) throw new Exception("cannot open the file");
        ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] b = new byte[65536]; int n;
        while ((n = in.read(b)) > 0) { bo.write(b, 0, n); if (bo.size() > 5 * 1024 * 1024) throw new Exception("the file is larger than 5 MB"); }
        JSObject o = new JSObject(); o.put("text", bo.toString("UTF-8")); call.resolve(o);
      } catch (Exception e) { Log.e("LiquidNative", "import playlists failed", e); call.reject("import failed: " + e.getMessage()); }
    }, "lf-import-pl").start();
  }

  /* ---------- Backup & transfer: generic save / open through the system file dialogs. JS builds and parses everything (src/plforeign.js, listenio.js, settingsio.js). ---------- */
  /** BUG-48: a save is staged in small pieces (saveFileBegin, then saveFileChunk per ~256 KB), then saveFile asks where to put it and copies the staged file in 64 KB pieces.
   *  No whole file is ever held in memory or sent as one Base64 string. */
  private File exportDir() { File d = new File(getContext().getFilesDir(), "exports"); d.mkdirs(); return d; }
  private File importDir() { return new File(getContext().getFilesDir(), "imports"); }
  // v208: no size limit on import / export files any more (it was 80 MB). The only limits left are the phone's own: free storage, and memory when a plain .json / .csv has to be read as text (an OutOfMemoryError is caught and shown as "file too large to read").

  private File stagedFile(String id) throws Exception {
    if (id == null || !id.matches("[A-Za-z0-9-]{8,64}")) throw new Exception("bad save id");
    return new File(exportDir(), id);
  }

  private void discardStaged(String id) { try { stagedFile(id).delete(); } catch (Exception ignored) { } }

  /** -> { id }: an empty staged file to write the pieces into. */
  @PluginMethod
  public void saveFileBegin(PluginCall call) {
    JSObject o = new JSObject();
    try {
      String id = java.util.UUID.randomUUID().toString();
      File[] old = exportDir().listFiles(); long cut = System.currentTimeMillis() - 3600_000L;   // BUG-48: a save that was killed half way leaves a staged file: remove the ones older than an hour
      if (old != null) for (File x : old) if (x.isFile() && x.lastModified() < cut) x.delete();
      File f = stagedFile(id); if (f.exists()) f.delete();
      if (!f.createNewFile()) throw new Exception("cannot stage the file");
      o.put("id", id); call.resolve(o);
    } catch (Exception e) { call.reject("save failed: " + e.getMessage()); }
  }

  /** { id, base64 } -> appends one piece to the staged file. */
  @PluginMethod
  public void saveFileChunk(PluginCall call) {
    try {
      File f = stagedFile(call.getString("id", ""));
      byte[] part = android.util.Base64.decode(call.getString("base64", ""), android.util.Base64.DEFAULT);
      try (java.io.FileOutputStream out = new java.io.FileOutputStream(f, true)) { out.write(part); }
      call.resolve();
    } catch (Exception e) { call.reject("save failed: " + e.getMessage()); }
  }

  /** { id } -> removes a staged save that will not be used (a failed piece). */
  @PluginMethod
  public void saveFileDiscard(PluginCall call) { discardStaged(call.getString("id", "")); call.resolve(); }

  /** { id, name, mime } -> asks where to save (ACTION_CREATE_DOCUMENT) and copies the staged file there. Rejects "cancelled" if the dialog is closed. */
  @PluginMethod
  public void saveFile(PluginCall call) {
    try {
      if (!stagedFile(call.getString("id", "")).exists()) { call.reject("nothing to save"); return; }
    } catch (Exception e) { call.reject("save failed: " + e.getMessage()); return; }
    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE); i.setType(call.getString("mime", "application/octet-stream")); i.putExtra(Intent.EXTRA_TITLE, call.getString("name", "liquid-dark.txt"));
    startActivityForResult(call, i, "saveFileResult");
  }

  @ActivityCallback
  private void saveFileResult(PluginCall call, ActivityResult r) {
    if (call == null) return;
    final String id = call.getString("id", "");
    if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null || r.getData().getData() == null) { discardStaged(id); call.reject("cancelled"); return; }
    final Uri target = r.getData().getData();
    new Thread(() -> {
      try {
        File f = stagedFile(id);
        try (InputStream in = new FileInputStream(f); java.io.OutputStream out = getContext().getContentResolver().openOutputStream(target, "wt")) {
          if (out == null) throw new Exception("cannot open the file");
          byte[] b = new byte[65536]; int n;
          while ((n = in.read(b)) > 0) out.write(b, 0, n);
        }
        f.delete();
        call.resolve();
      } catch (Exception e) { Log.e("LiquidNative", "saveFile failed", e); discardStaged(id); call.reject("save failed: " + e.getMessage()); }   // BUG-48: the staged copy is freed also when the copy fails
    }, "lf-save-file").start();
  }

  /** { multiple? } -> { files: [{ name, text } | { name, path, zip: true }] }. Text files are decoded here (UTF-8 BOM / UTF-16 / UTF-8 / Windows-1252, like .lrc files).
   *  A .zip is streamed to a private folder and its path is returned: JS reads it from there (no Base64). Rejects "cancelled" if the dialog is closed. No size limit (only the phone's free storage; a plain text file over ~2 GB is refused with a clear message). */
  @PluginMethod
  public void openFiles(PluginCall call) {
    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*");   // no MIME filter: file managers call .json / .m3u8 / .csv all sorts of things; JS checks the content
    if (call.getBoolean("multiple", false)) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
    startActivityForResult(call, i, "openFilesResult");
  }

  @ActivityCallback
  private void openFilesResult(PluginCall call, ActivityResult r) {
    if (call == null) return;
    if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null) { call.reject("cancelled"); return; }
    final ArrayList<Uri> uris = new ArrayList<>();
    if (r.getData().getClipData() != null) { for (int k = 0; k < r.getData().getClipData().getItemCount(); k++) uris.add(r.getData().getClipData().getItemAt(k).getUri()); }
    else if (r.getData().getData() != null) uris.add(r.getData().getData());
    if (uris.isEmpty()) { call.reject("cancelled"); return; }
    new Thread(() -> {
      try {
        File dir = importDir(); releaseImports(); dir.mkdirs();   // the previous picks are freed first
        JSArray files = new JSArray();
        for (Uri u : uris) {
          String name = "file";
          try (Cursor c = getContext().getContentResolver().query(u, new String[] { android.provider.OpenableColumns.DISPLAY_NAME }, null, null, null)) { if (c != null && c.moveToFirst() && c.getString(0) != null) name = c.getString(0); } catch (Exception igno) { }
          File f = new File(dir, java.util.UUID.randomUUID().toString());
          long size = 0;
          try (InputStream in = getContext().getContentResolver().openInputStream(u); java.io.FileOutputStream out = new java.io.FileOutputStream(f)) {
            if (in == null) throw new Exception("cannot open " + name);
            byte[] b = new byte[65536]; int n;
            while ((n = in.read(b)) > 0) { size += n; out.write(b, 0, n); }
          } catch (Exception e) { f.delete(); throw e; }
          JSObject o = new JSObject(); o.put("name", name);
          boolean zip = false;
          try (java.io.RandomAccessFile raf = new java.io.RandomAccessFile(f, "r")) { byte[] h = new byte[4]; zip = raf.read(h) == 4 && h[0] == 'P' && h[1] == 'K' && (h[2] == 3 || h[2] == 5); }
          if (zip) { o.put("path", f.getAbsolutePath()); o.put("zip", true); }   // a .zip: JS reads the file from this path (src/zipread.js)
          else {
            if (size > Integer.MAX_VALUE - 64) throw new Exception(name + " is too large to read as text: split it or put it in a .zip");   // a Java byte[] cannot hold more than about 2 GB
            byte[] all = new byte[(int) size];
            try (java.io.RandomAccessFile raf = new java.io.RandomAccessFile(f, "r")) { raf.readFully(all); }
            o.put("text", decodeLrc(all, encOf(all)));   // BUG-101: UTF-8 BOM / UTF-16 / UTF-8 / Windows-1252 detection, like .lrc files
            f.delete();
          }
          files.put(o);
        }
        JSObject out = new JSObject(); out.put("files", files); call.resolve(out);
      } catch (Throwable e) { releaseImports(); Log.e("LiquidNative", "openFiles failed", e); call.reject("open failed: " + (e instanceof OutOfMemoryError ? "file too large to read" : e.getMessage())); }   // BUG #29: Throwable so an OutOfMemoryError on a big non-zip pick still rejects the JS promise
    }, "lf-open-files").start();
  }

  private void releaseImports() { File[] fs = importDir().listFiles(); if (fs != null) for (File x : fs) x.delete(); }

  /** -> {}: frees the picked files once JS has read them (BUG-48). */
  @PluginMethod
  public void releaseFiles(PluginCall call) { releaseImports(); call.resolve(); }

  /** { rows: [...] } (see ListenDb.importRows) -> { added: [{ i, s, q }] } the rows that were really new. */
  @PluginMethod
  public void importListens(PluginCall call) {
    final JSONArray rows;
    try { rows = call.getArray("rows"); } catch (Exception e) { call.reject("bad rows"); return; }
    if (rows == null) { call.reject("no rows"); return; }
    new Thread(() -> { try { JSObject o = new JSObject(); o.put("added", ListenDb.get(getContext()).importRows(rows)); StatsWidgets.refresh(getContext()); call.resolve(o); } catch (Throwable t) { call.reject("Import failed: " + t); } }, "lf-listen-import").start();
  }


  /* ---------- v142: persistent, background automatic updates.
     UpdateDownloadService owns the foreground download; UpdateSupport stores build-specific files and
     verification metadata so a WebView/process restart cannot lose the ready state. ---------- */
  @PluginMethod
  public void downloadUpdate(final PluginCall call) {
    final String url = call.getString("url", "");
    final String buildText = call.getString("build", "0");
    final String expectedSha = call.getString("sha256", "").toLowerCase(java.util.Locale.US);
    long build = 0;
    try { build = Long.parseLong(buildText); } catch (Exception ignored) {}
    if (!url.startsWith("https://")) { call.reject("the update link is missing or invalid"); return; }
    if (!UpdateSupport.validTarget(build, expectedSha)) {
      call.reject("the update manifest is missing a valid build number or SHA-256 checksum"); return;
    }
    final Context ctx = getContext();
    final String id = UpdateSupport.identity(build, expectedSha);
    String state = UpdateSupport.state(ctx);
    if (id.equals(UpdateSupport.targetId(ctx)) && UpdateSupport.STATUS_READY.equals(state)) {
      String error = UpdateSupport.verifyApk(ctx, build, expectedSha);
      if (error == null) { JSObject out = new JSObject(); out.put("ready", true); out.put("build", build); call.resolve(out); return; }
      UpdateSupport.markFailed(ctx, id, error);
      state = UpdateSupport.STATUS_FAILED;
    }
    if (id.equals(UpdateSupport.targetId(ctx)) &&
        (UpdateSupport.STATUS_QUEUED.equals(state) || UpdateSupport.STATUS_DOWNLOADING.equals(state)) &&
        UpdateDownloadService.isRunning()) {
      JSObject out = new JSObject(); out.put("started", true); out.put("build", build); call.resolve(out); return;
    }
    try {
      UpdateDownloadService.enqueue(ctx, url, build, expectedSha);
      JSObject out = new JSObject(); out.put("started", true); out.put("build", build); call.resolve(out);
    } catch (Exception e) {
      UpdateSupport.markFailed(ctx, id, e.getMessage());
      call.reject("could not start background update download: " + e.getMessage());
    }
  }

  private String vcKey = ""; private long vcVal = 0;

  @PluginMethod
  public void getUpdateStatus(PluginCall call) {
    final Context ctx = getContext();
    UpdateSupport.cleanInstalled(ctx);   // BUG-31 / 179: the installed build's APK files are not kept
    long build = 0;
    try { build = Long.parseLong(call.getString("build", "0")); } catch (Exception ignored) {}
    String sha = call.getString("sha256", "").toLowerCase(java.util.Locale.US);
    JSObject out = new JSObject();
    if (!UpdateSupport.validTarget(build, sha)) {
      out.put("status", UpdateSupport.STATUS_FAILED);
      out.put("error", "The update manifest is missing a valid build number or SHA-256 checksum.");
      call.resolve(out); return;
    }
    String id = UpdateSupport.identity(build, sha);
    String state = id.equals(UpdateSupport.targetId(ctx)) ? UpdateSupport.state(ctx) : UpdateSupport.STATUS_UNKNOWN;
    if (UpdateSupport.STATUS_READY.equals(state)) {
      // Keep the 1-second poll cheap: check that the build-specific file still exists and has the
      // expected APK package/build. The full SHA-256 is rechecked immediately before installation.
      File apk = UpdateSupport.apkFile(ctx, build, sha);
      try {
        if (!apk.isFile() || apk.length() < 1_000_000L) throw new Exception("the downloaded APK is missing or incomplete");
        String ck = apk.getPath() + "|" + apk.lastModified() + "|" + apk.length();   // BUG-56: parse the APK once, not on every 1 s poll
        if (!ck.equals(vcKey)) { vcVal = UpdateSupport.archiveVersionCode(ctx, apk); vcKey = ck; }
        long actualBuild = vcVal;
        long installed = UpdateSupport.installedVersionCode(ctx);
        if (actualBuild != build) throw new Exception("downloaded APK build " + actualBuild + " does not match update build " + build);
        if (actualBuild <= installed) throw new Exception("downloaded APK is no longer newer than the installed build");
      } catch (Exception e) {
        String error = e.getMessage() == null ? "could not verify the downloaded APK" : e.getMessage();
        UpdateSupport.markFailed(ctx, id, error);
        state = UpdateSupport.STATUS_FAILED;
      }
    } else if (UpdateSupport.STATUS_QUEUED.equals(state) || UpdateSupport.STATUS_DOWNLOADING.equals(state)) {
      // A sticky foreground service resumes its saved URL after process reclamation. This also
      // recovers a queued download if Android recreated the activity before it recreated the service.
      if (!UpdateDownloadService.isRunning()) { try { UpdateDownloadService.resumeSaved(ctx); } catch (Throwable t) { /* BUG-30: Android 12+ may refuse a background foreground-service start; the status stays valid */ } }
    }
    out.put("status", state);
    out.put("pct", UpdateSupport.STATUS_UNKNOWN.equals(state) ? -1 : UpdateSupport.prefs(ctx).getInt("pct", -1));   // BUG-55
    if (UpdateSupport.STATUS_FAILED.equals(state)) out.put("error", UpdateSupport.prefs(ctx).getString("error", "Download failed. Tap Retry."));
    if (UpdateSupport.STATUS_READY.equals(state)) { out.put("ready", true); out.put("build", build); }
    if (UpdateSupport.STATUS_QUEUED.equals(state) || UpdateSupport.STATUS_DOWNLOADING.equals(state)) out.put("downloading", true);
    call.resolve(out);
  }

  /* v146: Allow background activity. Opens the app's Battery usage page (the one with "Allow background activity": stock Android 14+, Pixel, Samsung, OnePlus/Oppo/Realme ColorOS, Vivo, Xiaomi...).
     Tries, in order: Android's app battery-usage page, Xiaomi's power page, the one-tap "ignore battery optimizations" dialog, the battery-optimization list, the app info page. */
  private boolean tryStart(Intent i) {
    try { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(i); return true; } catch (Throwable t) { return false; }
  }

  /** v208: "Allow background activity" counts as ON only when BOTH Android signals say so: the app is not battery-optimized (isIgnoringBatteryOptimizations) AND background use is not restricted
   *  (ActivityManager.isBackgroundRestricted, API 28+: the switch on phones such as OnePlus / Oppo / Realme "Battery usage > Allow background activity"). Either one off = OFF = the card is shown on every open.
   *  Returns { allowed, ignoring, restricted } (the two raw signals are for diagnosis). */
  @PluginMethod
  public void isBackgroundAllowed(PluginCall call) {
    boolean ignoring = true, restricted = false;
    try { android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE); ignoring = android.os.Build.VERSION.SDK_INT < 23 || pm.isIgnoringBatteryOptimizations(getContext().getPackageName()); } catch (Throwable ignored) { }
    try { if (android.os.Build.VERSION.SDK_INT >= 28) { android.app.ActivityManager am = (android.app.ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE); restricted = am != null && am.isBackgroundRestricted(); } } catch (Throwable ignored) { }
    // v209c: a third signal for phones whose own "Allow background activity" switch (OnePlus / OPPO / Realme Power consumption controls) is stored as Android's background app-ops (ignored / errored = switch OFF).
    // A phone that has no such app-op, or does not answer, counts as "not blocked" (never shows the card by mistake).
    boolean appOpBlocked = false;
    try {
      android.app.AppOpsManager ao = (android.app.AppOpsManager) getContext().getSystemService("appops");
      if (ao != null) {
        int uid = android.os.Process.myUid(); String own = getContext().getPackageName();
        for (String op : new String[] { "android:run_in_background", "android:run_any_in_background" }) {
          try { int mode = ao.checkOpNoThrow(op, uid, own); if (mode == 1 || mode == 2) appOpBlocked = true; } catch (Throwable ignored) { }
        }
      }
    } catch (Throwable ignored) { }
    Log.i("LiquidNative", "background: allowed check ignoring=" + ignoring + " restricted=" + restricted + " appOpBlocked=" + appOpBlocked);
    // v210c: the switch follows the battery-optimization whitelist (confirmed on OnePlus + OPPO by adb: whitelist entry ON, gone OFF). restricted / appOpBlocked stayed the same in both states, so they are logged only, never decide.
    // v213: BUG FIX. This comment used to sit at the END of the line that also held the resolve call, so the resolve was part of the comment: the call never answered, the JS await never returned
    // and the "Allow background activity" card never opened. Keep the resolve call on its OWN line, and never put code after a // comment (tests/bg-allowed-resolves-v213.test.mjs checks it).
    JSObject o = new JSObject();
    o.put("allowed", ignoring);
    o.put("ignoring", ignoring); o.put("restricted", restricted); o.put("appOpBlocked", appOpBlocked);
    call.resolve(o);
  }

  /** v209: phone-brand pages (Oppo / Realme / OnePlus ColorOS, Vivo / iQOO, Samsung, Huawei / Honor, Xiaomi, Asus...) that hold the app's "Allow background activity" / auto-start / battery switch.
   *  Each one is tried only on that brand (Build.MANUFACTURER / BRAND); a page that does not exist on this phone just fails quietly and the next one is tried. Returns the name of the page that opened, or "". */
  private String openOemBackgroundPage(String pkg) {
    String m = ((android.os.Build.MANUFACTURER == null ? "" : android.os.Build.MANUFACTURER) + " " + (android.os.Build.BRAND == null ? "" : android.os.Build.BRAND)).toLowerCase(java.util.Locale.ROOT);
    java.util.List<String[]> c = new java.util.ArrayList<>();   // { component package, component class }
    if (m.contains("oppo") || m.contains("realme") || m.contains("oneplus")) {
      c.add(new String[]{"com.oplus.battery", "com.oplus.powermanager.fuelgaue.PowerUsageModelActivity"});
      c.add(new String[]{"com.coloros.oppoguardelf", "com.coloros.powermanager.fuelgaue.PowerUsageModelActivity"});
      c.add(new String[]{"com.coloros.oppoguardelf", "com.coloros.powermanager.fuelgaue.PowerConsumptionActivity"});
      c.add(new String[]{"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"});
      c.add(new String[]{"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"});
    }
    if (m.contains("vivo") || m.contains("iqoo")) {
      c.add(new String[]{"com.vivo.abe", "com.vivo.applicationbehaviorengine.ui.ExcessivePowerManagerActivity"});
      c.add(new String[]{"com.iqoo.powersaving", "com.iqoo.powersaving.PowerSavingManagerActivity"});
      c.add(new String[]{"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"});
      c.add(new String[]{"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"});
    }
    if (m.contains("samsung")) {
      c.add(new String[]{"com.samsung.android.lool", "com.samsung.android.sm.battery.ui.usage.CheckableAppListActivity"});
      c.add(new String[]{"com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"});
      c.add(new String[]{"com.samsung.android.sm_cn", "com.samsung.android.sm.ui.battery.BatteryActivity"});
    }
    if (m.contains("huawei") || m.contains("honor")) {
      c.add(new String[]{"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"});
      c.add(new String[]{"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"});
    }
    if (m.contains("xiaomi") || m.contains("redmi") || m.contains("poco")) {
      c.add(new String[]{"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"});
    }
    if (m.contains("asus")) c.add(new String[]{"com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"});
    if (m.contains("tecno") || m.contains("infinix") || m.contains("itel")) c.add(new String[]{"com.transsion.phonemaster", "com.cyin.himgr.autostart.AutoStartActivity"});
    for (String[] x : c) {
      Intent i = new Intent(); i.setClassName(x[0], x[1]); i.putExtra("package_name", pkg); i.putExtra("packageName", pkg);
      if (tryStart(i)) return x[0];
    }
    return "";
  }

  /* ---------- OnePlus / OPPO / Realme (OxygenOS / ColorOS): the app's own "Power consumption controls" page ----------
   * That page (title = the app name; Allow foreground activity / Allow background activity / Allow auto launch / Force stop) is where the switch lives, so on these phones it is tried FIRST,
   * before Android's generic battery page (which on ColorOS / OxygenOS is not that page). Its class name differs between versions, so:
   *   1. the known class names are tried (package name passed as extra and as package: data)
   *   2. otherwise an exported page of a pre-installed battery / power app whose class name says "power consumption" (or "app battery detail") is found at run time and remembered for the session
   * On newer OnePlus / ColorOS the pages of com.oplus.battery are PROTECTED (they need oplus.permission.OPLUS_COMPONENT_SAFE, which a normal app cannot hold: "Permission Denial ... requires oplus.permission.OPLUS_COMPONENT_SAFE"),
   * so step 1 and 2 can fail there. The public way to the very same page is this app's App info (Settings > Apps > App management > Liquid Dark), whose "Battery usage" row is that page: when the direct page
   * does not open, the family goes to App info (not to Android's generic battery page, which is not that page) and the result carries a hint for the toast ("Tap Battery usage...").
   * Other brands (Samsung, Vivo, Xiaomi, Huawei, Pixel...) keep their own order: Android's battery page, then their brand page; only when both fail is the same run-time search tried for them too.
   * Every try and every candidate is written to the app log as "background: ...". If nothing opens, the older order below runs unchanged. */
  private static boolean oplusFamily() {
    String m = ((android.os.Build.MANUFACTURER == null ? "" : android.os.Build.MANUFACTURER) + " " + (android.os.Build.BRAND == null ? "" : android.os.Build.BRAND)).toLowerCase(java.util.Locale.ROOT);
    return m.contains("oneplus") || m.contains("oppo") || m.contains("realme");   // the ColorOS / OxygenOS family: one and the same page
  }

  private boolean bgStart(ComponentName c, String pkg) {
    Intent i = new Intent(); i.setComponent(c);
    i.setData(Uri.parse("package:" + pkg));
    i.putExtra("package_name", pkg); i.putExtra("packageName", pkg); i.putExtra("pkg_name", pkg); i.putExtra("android.intent.extra.PACKAGE_NAME", pkg);
    boolean ok = tryStart(i);
    Log.i("LiquidNative", "background: " + c.flattenToShortString() + (ok ? " opened" : " did not open"));
    return ok;
  }

  private volatile ComponentName oplusPageCache;

  /** An exported page of a pre-installed battery / power app that looks like the per-app power page, or null. Best match first: "power consumption", then "app battery detail / usage". */
  private ComponentName oplusAppPageScan() {
    android.content.pm.PackageManager pm = getContext().getPackageManager();
    List<android.content.pm.PackageInfo> all;
    try { all = pm.getInstalledPackages(android.content.pm.PackageManager.GET_ACTIVITIES); }
    catch (Exception e) { Log.i("LiquidNative", "background: cannot list the apps"); return null; }
    ComponentName best = null; int bestRank = 99;
    List<String> candidates = new ArrayList<>();
    for (android.content.pm.PackageInfo pi : all) {
      if (pi.activities == null || !eqSystemApp(pi.applicationInfo)) continue;
      String pk = eqNorm(pi.packageName);
      if (pk.startsWith("com.android.settings") || pk.startsWith("com.google.android.settings")) continue;   // v209b: Android's OWN Settings app holds the generic \"Battery usage\" page (Unrestricted / Optimized / Restricted), NOT the OnePlus \"Power consumption controls\" page: never pick it
      if (!(pk.contains("battery") || pk.contains("power") || pk.contains("oppoguard") || pk.contains("oplus") || pk.contains("coloros") || pk.contains("oneplus") || pk.contains("settings"))) continue;
      for (android.content.pm.ActivityInfo ai : pi.activities) {
        if (ai.name == null) continue;
        String name = eqNorm(ai.name);
        if (name.contains("advancedpowerusage")) continue;   // v209b: same generic page under any package name
        int rank = (name.contains("powerconsumption") || name.endsWith("powercontrolactivity")) ? 0
                 : (name.contains("appbatterydetail") || name.contains("appbatteryusage") || name.contains("appbatterymanage")) ? 1
                 : (name.contains("batterydetail") || name.contains("powerdetail") || name.contains("powerusagedetail") || (name.contains("fuelgaue") && name.contains("detail"))) ? 2 : -1;
        if (rank < 0) continue;
        if (candidates.size() < 30) candidates.add(ai.packageName + "/" + ai.name + " exported=" + ai.exported);
        if (!ai.exported || !ai.enabled) continue;
        if (rank < bestRank) { bestRank = rank; best = new ComponentName(ai.packageName, ai.name); }
      }
    }
    for (String d : candidates) Log.i("LiquidNative", "background: candidate " + d);
    return best;
  }

  /** Returns the short name of the page that opened, or "". */
  private String openOplusAppPage(String pkg) {
    ComponentName cached = oplusPageCache;
    if (cached != null) { if (bgStart(cached, pkg)) return cached.flattenToShortString(); oplusPageCache = null; }
    String[][] known = {
      { "com.oplus.battery", "com.oplus.powermanager.fuelgaue.PowerControlActivity" },   // owner's OPPO / OnePlus (ColorOS V13.1.0): the page Battery usage opens (dumpsys: com.oplus.battery/...fuelgaue.PowerControlActivity, launched by the system from App info)
      { "com.oplus.battery", "com.oplus.powermanager.fuelgaue.PowerConsumptionActivity" },
      { "com.coloros.oppoguardelf", "com.coloros.powermanager.fuelgaue.PowerConsumptionActivity" } };
    for (String[] k : known) { ComponentName c = new ComponentName(k[0], k[1]); if (bgStart(c, pkg)) { oplusPageCache = c; return c.flattenToShortString(); } }
    ComponentName found = null;
    try { found = oplusAppPageScan(); } catch (Throwable t) { Log.w("LiquidNative", "background: scan failed " + t); }
    if (found != null && bgStart(found, pkg)) { oplusPageCache = found; return found.flattenToShortString(); }
    return "";
  }

  /** Shown when the phone will not open the Battery usage page directly. */
  private static final String HOW_TO_TURN_ON = "Tap Battery usage, then turn on Allow background activity.";   // shorter, so it can be read in the ~2 s the toast stays
  /** v210e: the generic Battery usage page (Unrestricted / Optimized / Restricted, no switch) opened on phones that are not OnePlus / OPPO / Realme. */

  /** v210: set by Allow on the background card; BatteryAssistService taps Battery usage once while this is in the future. */
  static volatile long batteryAssistArmedUntil = 0;

  @PluginMethod
  public void batteryAssistStatus(PluginCall call) {
    boolean on = false;
    try {
      String s = android.provider.Settings.Secure.getString(getContext().getContentResolver(), android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
      on = s != null && s.contains(getContext().getPackageName() + "/" + getContext().getPackageName() + ".BatteryAssistService");
    } catch (Throwable ignored) { }
    JSObject o = new JSObject(); o.put("enabled", on); call.resolve(o);
  }

  @PluginMethod
  public void restrictedStatus(PluginCall call) {
    // v213: is "Allow restricted settings" (Android 13+) already done for this app? "allowed" / "restricted" / "unknown" (the JS then falls back to the steps it remembers).
    // Before Android 13 there is no such lock. A phone that does not know the op answers "unknown", never a wrong "allowed".
    String state = "unknown";
    try {
      if (android.os.Build.VERSION.SDK_INT < 33) state = "allowed";
      else {
        android.app.AppOpsManager am = (android.app.AppOpsManager) getContext().getSystemService(android.content.Context.APP_OPS_SERVICE);
        int mode = am.unsafeCheckOpNoThrow("android:access_restricted_settings", android.os.Process.myUid(), getContext().getPackageName());
        state = mode == android.app.AppOpsManager.MODE_ALLOWED ? "allowed" : mode == android.app.AppOpsManager.MODE_ERRORED ? "restricted" : "unknown";
      }
    } catch (Throwable ignored) { }
    JSObject o = new JSObject(); o.put("state", state); call.resolve(o);
  }

  @PluginMethod
  public void exitApp(PluginCall call) {
    // v213: step 2 of the accessibility cards: Liquid Dark closes itself so the person can long press its icon on the home screen. (Music keeps playing: only the screen closes.)
    JSObject o = new JSObject(); o.put("ok", true); call.resolve(o);
    try {
      getActivity().runOnUiThread(new Runnable() { @Override public void run() {
        // v216: bring the HOME SCREEN to the front FIRST. Closing the app alone makes Android show the previous app in the stack (e.g. YouTube) instead of home.
        try {
          Intent home = new Intent(Intent.ACTION_MAIN);
          home.addCategory(Intent.CATEGORY_HOME);
          home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          getActivity().startActivity(home);
        } catch (Throwable ignored) { }
        // Home is already on top, so closing our screen now cannot reveal another app.
        try { getActivity().finishAndRemoveTask(); } catch (Throwable t) { try { getActivity().moveTaskToBack(true); } catch (Throwable ignored) { } }
      } });
    } catch (Throwable ignored) { }
  }

  @PluginMethod
  public void openAccessibilityList(PluginCall call) {
    // v211: Android's own Accessibility list (Downloaded apps > Liquid Dark). Used for steps 1 and 3 of the accessibility cards.
    boolean ok = tryStart(new Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS));
    JSObject o = new JSObject(); o.put("ok", ok); call.resolve(o);
  }

  @PluginMethod
  public void openAccessibilitySettings(PluginCall call) {
    // v210b: Android 13+ blocks Accessibility for downloaded apps until "Allow restricted settings" is tapped in THIS app's App info (three-dot menu, top right). So this opens App info.
    boolean ok = tryStart(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
    JSObject o = new JSObject(); o.put("ok", ok); call.resolve(o);
  }

  @PluginMethod
  public void openBackgroundSettings(final PluginCall call) {
    // The package scan is slow, so everything runs on LIB_POOL (same reason as BUG-399 for the equalizer); startActivity with NEW_TASK works from any thread.
    batteryAssistArmedUntil = System.currentTimeMillis() + 30000;   // v210: the helper may tap Battery usage (only if the person turned it on)
    LIB_POOL.execute(new Runnable() { @Override public void run() {
      String pkg = getContext().getPackageName();
      Uri u = Uri.parse("package:" + pkg);
      String via = "";
      if (oplusFamily()) {   // OnePlus / OPPO / Realme: the page that Battery usage (in this app's App info) opens, straight away. If the phone protects it, this app's App info, where the Battery usage row is one tap away (the toast says so).
        String page = openOplusAppPage(pkg);
        if (!page.isEmpty()) via = "oplus-app:" + page;
        else if (tryStart(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, u))) via = "app-info";
      }
      if (via.isEmpty()) {
        if (tryStart(new Intent("android.settings.VIEW_ADVANCED_POWER_USAGE_DETAIL", u))) via = "battery-usage";
        else {
          String oem = openOemBackgroundPage(pkg);   // v209: the phone brand's own page (Oppo / Realme / OnePlus, Vivo, Samsung, Huawei, Xiaomi...)
          if (!oem.isEmpty()) via = "oem:" + oem;
          else {
            if (!oplusFamily()) {   // every other brand whose pages above did not open: look for the phone's own per-app power page at run time
              ComponentName found = null;
              try { found = oplusAppPageScan(); } catch (Throwable t) { Log.w("LiquidNative", "background: scan failed " + t); }
              if (found != null && bgStart(found, pkg)) via = "scan:" + found.flattenToShortString();
            }
            Intent mi = new Intent(); mi.setClassName("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity"); mi.putExtra("package_name", pkg); mi.putExtra("package_label", "Liquid Dark");
            if (!via.isEmpty()) { /* the run-time search opened the page */ }
            else if (tryStart(mi)) via = "miui";
            else if (android.os.Build.VERSION.SDK_INT >= 23 && tryStart(new Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, u))) via = "ignore-dialog";
            else if (android.os.Build.VERSION.SDK_INT >= 23 && tryStart(new Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) via = "optimization-list";
            else if (tryStart(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, u))) via = "app-info";
          }
        }
      }
      Log.i("LiquidNative", "background: settings opened via " + (via.isEmpty() ? "nothing" : via));
      JSObject o = new JSObject(); o.put("ok", !via.isEmpty()); o.put("via", via);
      if ("app-info".equals(via)) {   // the person is on App info: a native toast (visible over Settings) tells them the one tap that is left
        o.put("hint", HOW_TO_TURN_ON);
        // ONE short toast (about 2 s) instead of four long ones in a row (it used to stay on screen for about 12 s). A Toast shows over Settings; an app dialog cannot.
        try {
          getActivity().runOnUiThread(new Runnable() { @Override public void run() { android.widget.Toast.makeText(getContext(), HOW_TO_TURN_ON, android.widget.Toast.LENGTH_SHORT).show(); } });
        } catch (Throwable t) { /* no toast: the person still sees App info */ }
      }
      call.resolve(o);
    } });
  }

  @PluginMethod
  public void canInstallUpdates(PluginCall call) {
    boolean ok = android.os.Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
    JSObject o = new JSObject(); o.put("allowed", ok); call.resolve(o);
  }

  @PluginMethod
  public void openInstallSettings(PluginCall call) {
    Context ctx = getContext();
    Intent i = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    try { ctx.startActivity(i); call.resolve(); } catch (Exception e) { Log.e("LiquidNative", "open install settings failed", e); call.reject("cannot open install settings: " + e.getMessage()); }
  }

  @PluginMethod
  public void installDownloadedUpdate(PluginCall call) {
    final Context ctx = getContext();
    final long build = UpdateSupport.targetBuild(ctx);
    final String sha = UpdateSupport.targetSha(ctx);
    final String id = UpdateSupport.targetId(ctx);
    if (!UpdateSupport.validTarget(build, sha) || !id.equals(UpdateSupport.identity(build, sha)) ||
        !UpdateSupport.STATUS_READY.equals(UpdateSupport.state(ctx))) {
      call.reject("no verified downloaded update is ready; download it again"); return;
    }
    String verifyError = UpdateSupport.verifyApk(ctx, build, sha);
    if (verifyError != null) {
      UpdateSupport.markFailed(ctx, id, verifyError);
      call.reject(verifyError + "; download it again"); return;
    }
    if (android.os.Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
      Intent i = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      try { ctx.startActivity(i); } catch (Exception e) { Log.e("LiquidNative", "open install permission page failed", e); }
      JSObject o = new JSObject(); o.put("needsPermission", true); call.resolve(o); return;
    }
    try {
      File apk = UpdateSupport.apkFile(ctx, build, sha);
      Uri uri = androidx.core.content.FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
      Intent i = new Intent(Intent.ACTION_VIEW);
      i.setDataAndType(uri, "application/vnd.android.package-archive");
      i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
      ctx.startActivity(i);
      JSObject o = new JSObject(); o.put("started", true); o.put("build", build); call.resolve(o);
    } catch (Exception e) { Log.e("LiquidNative", "install downloaded update failed", e); call.reject("install failed: " + e.getMessage()); }
  }

  /* ---------- T10: Canvas. The picked file is COPIED into filesDir/canvas/ (keeps working if the original moves). Map persisted in filesDir/canvas.json. ---------- */
  @PluginMethod
  public void pickMedia(PluginCall call) {
    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*");
    i.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "video/*", "image/gif", "image/webp" });
    startActivityForResult(call, i, "mediaResult");
  }

  @ActivityCallback
  private void mediaResult(PluginCall call, ActivityResult r) {
    if (call == null) return;
    if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null || r.getData().getData() == null) { call.reject("cancelled"); return; }
    final Uri src = r.getData().getData();
    // This callback runs on the main thread: the (possibly large) video is copied on a worker thread so the UI never freezes.
    new Thread(new Runnable() {
      @Override public void run() {
        File out = null;
        try {
          String name = "canvas.mp4";
          try (Cursor c = getContext().getContentResolver().query(src, new String[] { android.provider.OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst() && c.getString(0) != null) name = c.getString(0);
          }
          String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
          if (!ext.matches("mp4|webm|gif|webp")) { call.reject("unsupported file: use MP4, WebM, GIF or WebP"); return; }
          File dir = new File(getContext().getFilesDir(), "canvas"); dir.mkdirs();
          out = new File(dir, "c" + Long.toHexString(System.nanoTime()) + "." + ext);
          try (InputStream in = getContext().getContentResolver().openInputStream(src); FileOutputStream f = new FileOutputStream(out)) {
            if (in == null) throw new java.io.IOException("cannot open the picked file");
            byte[] b = new byte[65536]; int n; while ((n = in.read(b)) > 0) f.write(b, 0, n);
          }
          JSObject o = new JSObject(); o.put("path", out.getAbsolutePath()); o.put("name", name); call.resolve(o);
        } catch (Throwable e) {
          Log.e("LiquidNative", "canvas copy failed", e);
          if (out != null) out.delete();   // no half-copied file left behind
          try { call.reject("copy failed: " + e.getMessage()); } catch (Throwable ignored) { }
        }
      }
    }, "lf-canvas-copy").start();
  }

  private File canvasFile() { return new File(getContext().getFilesDir(), "canvas.json"); }

  private File canvasBak() { return new File(getContext().getFilesDir(), "canvas.bak"); }

  /** Parses a Canvas map file. Returns null when the file is missing or broken. */
  private JSONObject readCanvasFile(File file) {
    try (FileInputStream in = new FileInputStream(file)) {
      ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] b = new byte[16384]; int n;
      while ((n = in.read(b)) > 0) bo.write(b, 0, n);
      return new JSONObject(bo.toString("UTF-8"));
    } catch (Exception e) { return null; }
  }

  private volatile boolean canvasReadFailed = false;   // a failed read must never lead to the other Canvas files being pruned

  @PluginMethod
  public void getCanvas(PluginCall call) {
    JSONObject map = null;
    if (!canvasFile().exists()) {
      File tmpF = new File(canvasFile().getPath() + ".tmp");
      if (canvasBak().exists()) { map = readCanvasFile(canvasBak()); if (map == null && tmpF.exists()) map = readCanvasFile(tmpF); }   // BUG-396: json missing but a copy exists (crash between delete and rename): use the copy, never "first use"
      else map = new JSONObject();   // first use: nothing saved yet
    } else {
      map = readCanvasFile(canvasFile());
      if (map == null && canvasBak().exists()) map = readCanvasFile(canvasBak());   // main file damaged: the copy of the previous save
    }
    if (map == null) { canvasReadFailed = true; call.reject("canvas: could not read the saved Canvas list"); return; }
    canvasReadFailed = false;
    JSObject o = new JSObject(); o.put("map", map); call.resolve(o);
  }

  /** T10 leftover: names of files in filesDir/canvas/ that no entry of the Canvas map points to any more (a Canvas was replaced or removed).
   *  Pure (no Android), run for real by tests/java-probe-canvas.py. Matches by file NAME because every copy lives in that one folder. */
  static List<String> unusedCanvasFiles(java.util.Collection<String> keptPaths, String[] present) {
    java.util.Set<String> keep = new java.util.HashSet<>();
    for (String p : keptPaths) {
      if (p == null) continue;
      int i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
      keep.add(i >= 0 ? p.substring(i + 1) : p);
    }
    List<String> out = new ArrayList<>();
    for (String n : present) if (n != null && !keep.contains(n)) out.add(n);
    return out;
  }

  /** Deletes the copied Canvas files the saved map no longer uses. Runs only AFTER the map file was written, never touches anything but plain files in filesDir/canvas/. */
  private void pruneCanvasFiles(JSONObject map) {
    try {
      File dir = new File(getContext().getFilesDir(), "canvas");
      String[] present = dir.list();
      if (present == null) return;
      List<String> keep = new ArrayList<>();
      for (Iterator<String> it = map.keys(); it.hasNext(); ) keep.add(map.optString(it.next(), null));
      for (String n : unusedCanvasFiles(keep, present)) {
        File f = new File(dir, n);
        if (f.isFile() && System.currentTimeMillis() - f.lastModified() < 120_000L) continue;   // BUG-100: a copy made in the last 2 minutes may not be in the saved map yet
        if (f.isFile() && !f.delete()) Log.w("LiquidNative", "canvas: could not delete " + n);
      }
    } catch (Exception e) { Log.w("LiquidNative", "canvas prune failed: " + e); }
  }

  @PluginMethod
  public void saveCanvas(PluginCall call) {
    JSObject m = call.getObject("map");
    try {
      byte[] data = (m == null ? "{}" : m.toString()).getBytes(StandardCharsets.UTF_8);
      if (readCanvasFile(canvasFile()) != null) {   // keep the last good list as canvas.bak
        try (FileInputStream in = new FileInputStream(canvasFile()); FileOutputStream out = new FileOutputStream(canvasBak())) { byte[] b = new byte[16384]; int n; while ((n = in.read(b)) > 0) out.write(b, 0, n); }
        catch (Exception e) { Log.w("LiquidNative", "canvas.bak failed: " + e); }
      }
      File tmp = new File(getContext().getFilesDir(), "canvas.json.tmp");   // atomic: write beside, then rename
      try (FileOutputStream f = new FileOutputStream(tmp)) { f.write(data); f.getFD().sync(); }
      if (!tmp.renameTo(canvasFile())) { canvasFile().delete(); if (!tmp.renameTo(canvasFile())) throw new java.io.IOException("rename failed"); }
    } catch (Exception e) { call.reject("save failed: " + e.getMessage()); return; }
    if (m != null && !canvasReadFailed) pruneCanvasFiles(m);   // a missing map, or a list that could not be read, never means "delete everything"
    canvasReadFailed = false;
    call.resolve();
  }

  /* ---------- T11: Song Info. Raw data only (all Vorbis values per key, STREAMINFO, every PICTURE, the matched .lrc text). Tiles and checks are in src/songinfo.js. ---------- */
  private String displayName(Uri u) {
    try (Cursor c = getContext().getContentResolver().query(u, new String[] { android.provider.OpenableColumns.DISPLAY_NAME }, null, null, null)) {
      if (c != null && c.moveToFirst() && c.getString(0) != null) return c.getString(0);
    } catch (Exception ignored) { }
    return "";
  }

  private long sizeOf(Uri u) {
    try (Cursor c = getContext().getContentResolver().query(u, new String[] { android.provider.OpenableColumns.SIZE }, null, null, null)) {
      if (c != null && c.moveToFirst() && !c.isNull(0)) return c.getLong(0);
    } catch (Exception ignored) { }
    return 0;
  }

  private byte[] readHead(Uri u, int max) throws Exception {
    try (InputStream in = getContext().getContentResolver().openInputStream(u)) {
      ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] buf = new byte[16384]; int n;
      while (bo.size() < max && (n = in.read(buf)) > 0) bo.write(buf, 0, n);
      byte[] all = bo.toByteArray();
      return all.length > max ? java.util.Arrays.copyOf(all, max) : all;
    }
  }

  /* encoding detection in the report's order: UTF-8 BOM, UTF-16, UTF-8, GBK, Latin-1 */
  private static String encOf(byte[] b) {
    if (b.length >= 3 && (b[0] & 0xff) == 0xEF && (b[1] & 0xff) == 0xBB && (b[2] & 0xff) == 0xBF) return "UTF-8 BOM";
    if (b.length >= 2 && (((b[0] & 0xff) == 0xFF && (b[1] & 0xff) == 0xFE) || ((b[0] & 0xff) == 0xFE && (b[1] & 0xff) == 0xFF))) return "UTF-16";
    try { StandardCharsets.UTF_8.newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b)); return "UTF-8"; }
    catch (java.nio.charset.CharacterCodingException e) {
      try { java.nio.charset.Charset.forName("GBK").newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b)); return "GBK"; }
      catch (java.nio.charset.CharacterCodingException x) { return "Latin-1"; }
    }
  }

  private static String decodeLrc(byte[] b, String enc) {
    switch (enc) {
      case "UTF-8 BOM": return new String(b, 3, b.length - 3, StandardCharsets.UTF_8);
      case "UTF-16": return new String(b, StandardCharsets.UTF_16);
      case "GBK": return new String(b, java.nio.charset.Charset.forName("GBK"));
      case "UTF-8": return new String(b, StandardCharsets.UTF_8);
      default: return new String(b, StandardCharsets.ISO_8859_1);
    }
  }

  @PluginMethod
  public void getSongInfo(PluginCall call) {
    try {
      Uri fl = Uri.parse(call.getString("uri", ""));
      JSObject o = new JSObject(), tags = new JSObject(), tech = new JSObject();
      JSArray pics = new JSArray();
      java.util.Map<String, List<String>> vc = new java.util.LinkedHashMap<>();
      long rate = 0, total = 0; int bps = 0, ch = 0, minB = 0, maxB = 0; String md5 = "";
      String dn = displayName(fl);
      if (isLossyName(dn)) {   // v93: MP3 / AAC
        MediaMetadataRetriever mr = new MediaMetadataRetriever(); long durMs = 0; int kbps = 0; byte[] pic = null; Map<String, String> lt;
        try {
          mr.setDataSource(getContext(), fl); lt = lossyTags(mr);
          String d = mr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION); if (d != null) try { durMs = Long.parseLong(d.trim()); } catch (NumberFormatException ignored) { }
          String b = mr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE); if (b != null) try { kbps = (int) Math.round(Long.parseLong(b.trim()) / 1000.0); } catch (NumberFormatException ignored) { }
          pic = mr.getEmbeddedPicture();
        } finally { try { mr.release(); } catch (Exception ignored) { } }
        Object[] lf = lossyFormat(fl);
        for (java.util.Map.Entry<String, String> en : lt.entrySet()) tags.put(en.getKey(), en.getValue());
        String el = readLossyLyrics(fl, dn); if (el != null) tags.put(el.substring(0, Math.min(2000, el.length())).matches("(?s).*\\[\\d{1,3}:\\d{2}([.:]\\d{1,3})?\\].*") ? "SYNCEDLYRICS" : "LYRICS", el);
        if (pic != null) {
          BitmapFactory.Options bo = new BitmapFactory.Options(); bo.inJustDecodeBounds = true; BitmapFactory.decodeByteArray(pic, 0, pic.length, bo);
          JSObject p = new JSObject(); p.put("type", 3); p.put("mime", bo.outMimeType == null ? "" : bo.outMimeType);
          p.put("width", Math.max(bo.outWidth, 0)); p.put("height", Math.max(bo.outHeight, 0)); p.put("depth", 0); p.put("size", pic.length); pics.put(p);
        }
        tech.put("format", lossyLabel(dn, (String) lf[2])); tech.put("bits", 0); tech.put("rate", (Integer) lf[0]); tech.put("channels", (Integer) lf[1]);
        tech.put("samples", 0); tech.put("dur", durMs / 1000.0); tech.put("kbps", kbps); tech.put("size", sizeOf(fl));
        String lrcU = call.getString("lrc", "");
        if (lrcU != null && !lrcU.isEmpty()) {
          Uri lu = Uri.parse(lrcU); byte[] lb = readHead(lu, 4_000_000); String enc = encOf(lb); JSObject lo = new JSObject();
          lo.put("name", displayName(lu)); lo.put("size", sizeOf(lu)); lo.put("encoding", enc); lo.put("text", decodeLrc(lb, enc)); o.put("lrc", lo);
        }
        o.put("tags", tags); o.put("tech", tech); o.put("pics", pics);
        call.resolve(o); return;
      }
      try (InputStream raw = getContext().getContentResolver().openInputStream(fl);
           DataInputStream in = new DataInputStream(new BufferedInputStream(raw, 65536))) {
        if (!readFlacMagic(in)) throw new IllegalStateException("not a FLAC file");
        boolean last = false;
        while (!last) {
          int h = in.readUnsignedByte(); last = (h & 0x80) != 0; int type = h & 0x7f;
          int len = (in.readUnsignedByte() << 16) | (in.readUnsignedByte() << 8) | in.readUnsignedByte();
          if (type == 0 && len >= 34) {                                   // STREAMINFO
            byte[] b = new byte[len]; in.readFully(b);
            minB = ((b[0] & 0xff) << 8) | (b[1] & 0xff); maxB = ((b[2] & 0xff) << 8) | (b[3] & 0xff);
            long v = 0; for (int i = 10; i < 18; i++) v = (v << 8) | (b[i] & 0xffL);
            rate = (v >>> 44) & 0xFFFFFL; ch = (int) ((v >>> 41) & 0x7) + 1; bps = (int) ((v >>> 36) & 0x1F) + 1; total = v & 0xFFFFFFFFFL;
            StringBuilder sb = new StringBuilder();
            for (int i = 18; i < 34; i++) sb.append(String.format(Locale.ROOT, "%02x", b[i] & 0xff));
            md5 = sb.toString();
          } else if (type == 4) {                      // VORBIS_COMMENT: keep every value per key
            byte[] b = new byte[len]; in.readFully(b);
            ByteBuffer bb = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN);
            int vl = bb.remaining() >= 4 ? bb.getInt() : -1; int n = 0;   // BUG-50: a short VORBIS_COMMENT block is malformed, not an exception
            if (vl >= 0 && vl <= bb.remaining() - 4) { bb.position(bb.position() + vl); n = bb.getInt(); }
            for (int i = 0; i < n && bb.remaining() >= 4; i++) {
              int l = bb.getInt(); if (l < 0 || l > bb.remaining()) break;
              byte[] s = new byte[l]; bb.get(s);
              String kv = new String(s, StandardCharsets.UTF_8); int eq = kv.indexOf('=');
              if (eq > 0) { String key = kv.substring(0, eq).toUpperCase(Locale.ROOT); List<String> vl2 = vc.get(key); if (vl2 == null) { vl2 = new ArrayList<>(); vc.put(key, vl2); } vl2.add(kv.substring(eq + 1)); }
            }
          } else if (type == 6) {                     // PICTURE: metadata only (no image bytes kept)
            byte[] b = new byte[len]; in.readFully(b);
            try {
              ByteBuffer pb = ByteBuffer.wrap(b); JSObject p = new JSObject();
              int pt = pb.getInt();
              int ml = pb.getInt(); if (ml < 0 || ml > pb.remaining()) throw new IllegalStateException("bad mime length");
              byte[] mb = new byte[ml]; pb.get(mb);
              int dl = pb.getInt(); if (dl < 0 || dl > pb.remaining()) throw new IllegalStateException("bad description length");
              pb.position(pb.position() + dl);
              int pw = pb.getInt(), ph = pb.getInt(), pd = pb.getInt(); pb.getInt();   // colours
              int pn = pb.getInt();
              p.put("type", pt); p.put("mime", new String(mb, StandardCharsets.US_ASCII));
              p.put("width", pw); p.put("height", ph); p.put("depth", pd); p.put("size", pn);
              pics.put(p);
            } catch (Exception e) { Log.w("LiquidNative", "bad PICTURE block: " + e); }
          } else skip(in, len);
        }
      }
      for (java.util.Map.Entry<String, List<String>> en : vc.entrySet()) tags.put(en.getKey(), joinWith(", ", en.getValue()));
      tech.put("bits", bps); tech.put("rate", (int) rate); tech.put("channels", ch); tech.put("samples", total);
      tech.put("minBlock", minB); tech.put("maxBlock", maxB);
      tech.put("md5", md5.matches("0+") ? "" : md5);
      tech.put("size", sizeOf(fl));
      String lrcUri = call.getString("lrc", "");
      if (lrcUri != null && !lrcUri.isEmpty()) {
        Uri lu = Uri.parse(lrcUri);
        byte[] lb = readHead(lu, 4_000_000);
        String enc = encOf(lb);
        JSObject lo = new JSObject();
        lo.put("name", displayName(lu)); lo.put("size", sizeOf(lu)); lo.put("encoding", enc); lo.put("text", decodeLrc(lb, enc));
        o.put("lrc", lo);
      }
      o.put("tags", tags); o.put("tech", tech); o.put("pics", pics);
      call.resolve(o);
    } catch (Exception e) { Log.w("LiquidNative", "getSongInfo failed: " + e);
      try { JSObject eo = new JSObject(); eo.put("error", String.valueOf(e.getMessage())); eo.put("tags", new JSObject()); eo.put("tech", new JSObject()); eo.put("pics", new JSArray()); call.resolve(eo); }   // BUG-415: the sheet shows the "Unreadable file" tile + the path
      catch (Exception e2) { call.reject("song info: " + e.getMessage()); } }
  }

  // T8: queue edits. The current item (index p.getCurrentMediaItemIndex()) is never moved or removed by the UI.
  @PluginMethod
  public void moveItem(PluginCall call) {
    final int from = call.getInt("from", 0), to = call.getInt("to", 0);
    withPlayer(p -> p.moveMediaItem(from, to));
    call.resolve();
  }

  @PluginMethod
  public void removeItem(PluginCall call) {
    final int index = call.getInt("index", 0);
    withPlayer(p -> p.removeMediaItem(index));
    call.resolve();
  }

  @PluginMethod
  public void clearQueue(PluginCall call) {
    withPlayer(p -> {
      int c = p.getCurrentMediaItemIndex(), n = p.getMediaItemCount();
      if (n - c - 1 > 0) p.removeMediaItems(c + 1, n);   // everything after the current item
      if (c > 0) p.removeMediaItems(0, c);               // and before it
    });
    call.resolve();
  }

  /* ---------- T8-rest: shuffle is done in JS, so the plugin only has to REPLACE the part after the current song; plus session restore + generic JSON files ---------- */
  private List<MediaItem> itemsFrom(JSArray items) throws Exception {
    List<MediaItem> list = new ArrayList<>();
    Map<String, Uri> ready = artReadyFor(items);   // BUG-391
    for (int i = 0; i < items.length(); i++) list.add(itemFrom(items.getJSONObject(i), ready));
    return list;
  }

  /** Remove every item after the current one, then add `items` there. The current song keeps playing (no restart). */
  @PluginMethod
  public void replaceTail(PluginCall call) {
    try {
      final List<MediaItem> list = itemsFrom(call.getArray("items"));
      withPlayer(p -> {
        int c = p.getCurrentMediaItemIndex(), n = p.getMediaItemCount();
        if (c + 1 < n) p.removeMediaItems(c + 1, n);
        if (!list.isEmpty()) p.addMediaItems(list);
      });
      call.resolve();
    } catch (Exception e) { Log.e("LiquidNative", "replaceTail failed", e); call.reject("replaceTail failed: " + e.getMessage()); }
  }

  /** Put a saved queue back WITHOUT playing. If the service outlived the app and already has items, change nothing and report them
   *  ({alive:true, ids, index, pos, playing, repeat}) unless force=true. Resolves only after the player is connected. */
  @PluginMethod
  public void restore(PluginCall call) {
    try {
      final List<MediaItem> list = itemsFrom(call.getArray("items"));
      final int index = call.getInt("index", 0);
      final long posMs = (long) (call.getDouble("pos", 0.0) * 1000);
      final boolean force = call.getBoolean("force", false);
      withPlayer(p -> {
        try {
          JSObject o = new JSObject();
          if (!force && p.getMediaItemCount() > 0) {
            JSArray ids = new JSArray();
            for (int i = 0; i < p.getMediaItemCount(); i++) ids.put(p.getMediaItemAt(i).mediaId);
            int st = p.getPlaybackState(), rm = p.getRepeatMode();
            o.put("alive", true); o.put("ids", ids); o.put("index", p.getCurrentMediaItemIndex());
            o.put("pos", p.getCurrentPosition() / 1000.0);
            o.put("playing", p.getPlayWhenReady() && st != Player.STATE_ENDED && st != Player.STATE_IDLE);
            o.put("repeat", rm == Player.REPEAT_MODE_ONE ? "one" : rm == Player.REPEAT_MODE_ALL ? "all" : "off");
          } else {
            if (!list.isEmpty()) {
              p.setShuffleModeEnabled(false);   // JS owns shuffle; ExoPlayer's own shuffle must stay off
              p.setMediaItems(list, Math.max(0, Math.min(index, list.size() - 1)), posMs);
              p.prepare();                      // loads the song but does not play
            }
            o.put("alive", false);
          }
          call.resolve(o);
        } catch (Exception e) { Log.e("LiquidNative", "restore failed", e); call.reject("restore failed: " + e.getMessage()); }
      });
    } catch (Exception e) { Log.e("LiquidNative", "restore failed", e); call.reject("restore failed: " + e.getMessage()); }
  }

  /* ---------- v150: custom pictures / GIFs / videos (albums, artists, genres, playlists, background, profile): a second copy as plain files in filesDir/lfpics/, written in pieces, renamed when complete. ---------- */
  private File picDir() { File d = new File(getContext().getFilesDir(), "lfpics"); d.mkdirs(); return d; }
  private static boolean picNameOk(String n) { return n != null && n.matches("[a-z0-9]{1,120}"); }
  /** the finished file for a name (any extension), or null. Half-written ".part" files never count. */
  private File picFind(String name) {
    File[] fs = picDir().listFiles();
    if (fs != null) for (File f : fs) { String n = f.getName(); if (f.isFile() && n.startsWith(name + ".") && !n.endsWith(".part")) return f; }
    return null;
  }
  private void picDrop(String name, String keep) {
    File[] fs = picDir().listFiles();
    if (fs != null) for (File f : fs) { String n = f.getName(); if (f.isFile() && n.startsWith(name + ".") && !n.equals(keep) && !f.delete()) Log.w("LiquidNative", "pic: could not delete " + n); }
  }

  /** { name, ext, base64, append, done } -> writes one piece; when done, the finished file replaces any older one of that name. */
  @PluginMethod
  public void putPic(final PluginCall call) {
    LIB_POOL.execute(new Runnable() { @Override public void run() { putPicNow(call); } });   // v156: file writes never block the plugin thread
  }

  private void putPicNow(PluginCall call) {
    final String name = call.getString("name");
    String ext = call.getString("ext", "bin");
    if (!picNameOk(name)) { call.reject("bad name"); return; }
    if (ext == null || !ext.matches("[a-z0-9]{1,5}")) ext = "bin";
    try {
      File part = new File(picDir(), name + "." + ext + ".part");
      boolean append = call.getBoolean("append", false);
      byte[] b = android.util.Base64.decode(call.getString("base64", ""), android.util.Base64.DEFAULT);
      try (FileOutputStream out = new FileOutputStream(part, append)) { out.write(b); }
      JSObject o = new JSObject();
      if (call.getBoolean("done", false)) {
        picDrop(name, part.getName());
        File fin = new File(picDir(), name + "." + ext);
        if (!part.renameTo(fin)) throw new Exception("rename failed");
        o.put("path", fin.getAbsolutePath());
      }
      call.resolve(o);
    } catch (Exception e) { Log.e("LiquidNative", "putPic failed", e); call.reject("putPic failed: " + e.getMessage()); }
  }

  /** { name } -> { path } when a finished copy exists */
  @PluginMethod
  public void picPath(PluginCall call) {
    final String name = call.getString("name");
    if (!picNameOk(name)) { call.reject("bad name"); return; }
    JSObject o = new JSObject();
    File f = picFind(name);
    if (f != null) o.put("path", f.getAbsolutePath());
    call.resolve(o);
  }

  @PluginMethod
  public void delPic(PluginCall call) {
    final String name = call.getString("name");
    if (!picNameOk(name)) { call.reject("bad name"); return; }
    picDrop(name, "");
    try { File[] old = new File(getContext().getFilesDir(), "lfart").listFiles(); if (old != null) for (File o : old) if (o.getName().startsWith(name + "_")) o.delete(); } catch (Throwable ignored) {}   // BUG-259: the notification copies of a removed picture go too
    call.resolve();
  }

  /** -> { names: [file names without extension], files: [{ n: name, p: full path }] } of every finished copy. v151: JS reads this ONCE at start and knows every saved picture's address at once (no call per picture). */
  @PluginMethod
  public void listPics(final PluginCall call) {
    LIB_POOL.execute(new Runnable() { @Override public void run() { listPicsNow(call); } });
  }

  private void listPicsNow(PluginCall call) {
    org.json.JSONArray arr = new org.json.JSONArray(), fl = new org.json.JSONArray();
    File[] fs = picDir().listFiles();
    if (fs != null) for (File f : fs) {
      String n = f.getName(); int i = n.indexOf('.');
      if (f.isFile() && n.endsWith(".part") && f.lastModified() < System.currentTimeMillis() - 24L * 60 * 60 * 1000) { f.delete(); continue; }   // BUG-258: a failed upload leaves no .part for ever
      if (f.isFile() && i > 0 && !n.endsWith(".part") && f.length() > 0) {
        arr.put(n.substring(0, i));
        try { fl.put(new org.json.JSONObject().put("n", n.substring(0, i)).put("p", f.getAbsolutePath())); } catch (Exception ignored) { }
      }
    }
    JSObject o = new JSObject();
    o.put("names", arr); o.put("files", fl);
    call.resolve(o);
  }

  // Generic JSON files: filesDir/<name>.json. name = a-z 0-9 _ - (1..40). Existing playlists.json / canvas.json keep their own methods and formats.
  private File jsonFile(String name) throws Exception {
    if (name == null || !name.matches("[a-z0-9_-]{1,40}")) throw new Exception("bad name");
    // BUG-398: canvas and playlists have their own methods (backup, prune, temp file); a generic call must not reach them
    if (name.equals("canvas") || name.equals("playlists")) throw new Exception("reserved name");
    return new File(getContext().getFilesDir(), name + ".json");
  }

  /** -> { data } (data is left out when the file does not exist or cannot be read) */
  @PluginMethod
  public void readJson(PluginCall call) {
    final File f;
    try { f = jsonFile(call.getString("name")); } catch (Exception e) { call.reject("bad name"); return; }
    JSObject o = new JSObject();
    try {
      if (f.exists()) {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        try (FileInputStream in = new FileInputStream(f)) { byte[] b = new byte[16384]; int n; while ((n = in.read(b)) > 0) bo.write(b, 0, n); }
        Object v = new org.json.JSONTokener(bo.toString("UTF-8")).nextValue();
        o.put("data", v);
      }
    } catch (Exception e) { Log.w("LiquidNative", "readJson failed: " + e); call.reject("could not read " + call.getString("name") + ": the file is there but unreadable"); return; }   // BUG-395: an error, never 'no data' (the JS side would save empty defaults over it)
    call.resolve(o);
  }

  /** { name, data } -> writes data (any JSON value) safely: temp file, then rename, so a crash never leaves half a file. */
  @PluginMethod
  public void writeJson(PluginCall call) {
    final File f;
    try { f = jsonFile(call.getString("name")); } catch (Exception e) { call.reject("bad name"); return; }
    try {
      Object d = call.getData().opt("data");
      String txt = d == null ? "null" : d instanceof String ? JSONObject.quote((String) d) : String.valueOf(d);
      File tmp = new File(f.getParentFile(), f.getName() + ".tmp");
      try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(txt.getBytes(StandardCharsets.UTF_8)); out.getFD().sync(); }
      if (!tmp.renameTo(f)) { f.delete(); if (!tmp.renameTo(f)) throw new Exception("rename failed"); }
      call.resolve();
    } catch (Exception e) { Log.e("LiquidNative", "writeJson failed", e); call.reject("writeJson failed: " + e.getMessage()); }
  }

  @PluginMethod
  public void play(PluginCall call) {
    try {
      JSArray items = call.getArray("items"); final int index = call.getInt("index", 0);
      final List<MediaItem> list = new ArrayList<>();
      final Map<String, Uri> ready = artReadyFor(items);   // BUG-391
      for (int i = 0; i < items.length(); i++) {
        JSONObject it = items.getJSONObject(i);
        if (!it.has("uri")) throw new IllegalArgumentException("item without uri");
        list.add(itemFrom(it, ready));
      }
      withPlayer(p -> { p.setMediaItems(list, index, 0); p.prepare(); p.play(); });
      call.resolve();
    } catch (Exception e) { Log.e("LiquidNative", "play failed", e); call.reject("play failed: " + e.getMessage()); }
  }

  @PluginMethod public void pause(PluginCall call) { withPlayer(p -> p.pause()); call.resolve(); }
  @PluginMethod public void resume(PluginCall call) { withPlayer(p -> p.play()); call.resolve(); }
  @PluginMethod public void next(PluginCall call) { withPlayer(p -> p.seekToNextMediaItem()); call.resolve(); }
  @PluginMethod public void prev(PluginCall call) { withPlayer(p -> p.seekToPrevious()); call.resolve(); }
  @PluginMethod public void seek(PluginCall call) {
    final double sec = call.getDouble("sec", 0.0); final boolean loop = Boolean.TRUE.equals(call.getBoolean("loop", false));
    withPlayer(p -> { if (loop) ListenTracker.noteLoopSeek(); p.seekTo((long) (sec * 1000)); });   // v149: the A-B loop jump closes the finished pass and starts a new play (ListenTracker)
    call.resolve();
  }
  // LOCKED name. Since T8-rest the JS side no longer calls this (shuffle = JS reorder + replaceTail); kept so old callers still work.
  @PluginMethod public void setShuffle(PluginCall call) { final boolean on = call.getBoolean("on", false); withPlayer(p -> p.setShuffleModeEnabled(on)); call.resolve(); }
  @PluginMethod public void setRepeat(PluginCall call) {
    final String m = call.getString("mode", "off");
    final int mode = "one".equals(m) ? Player.REPEAT_MODE_ONE : "all".equals(m) ? Player.REPEAT_MODE_ALL : Player.REPEAT_MODE_OFF;
    withPlayer(p -> p.setRepeatMode(mode)); call.resolve();
  }

  /* ---------- T27: the Equalizer row opens Settings > Sound & vibration > Real Sound Technology (v59). ----------
   * On ColorOS (OPPO / Realme / OnePlus) Real Sound Technology is a row INSIDE Sound & vibration, so it is two levels down.
   * Its page class name is not public, so it is found at run time by name or label:
   *   1. an EXPORTED page of the Settings app named "Real Sound" is opened straight away
   *   2. otherwise Sound & vibration is opened (android.settings.SOUND_SETTINGS) and the user taps Real Sound Technology once
   * The sound-related Settings pages found are written to the app log as "equalizer: candidate ...", so the real page name
   * can be read there if step 1 finds nothing. Every try is also written to the app log as "equalizer: ...". */
  private boolean eqStart(Intent i, String what) {
    try { getActivity().startActivity(i); Log.i("LiquidNative", "equalizer: opened " + what); return true; }
    catch (Exception e) { Log.i("LiquidNative", "equalizer: " + what + " did not open (" + e.getClass().getSimpleName() + ")"); return false; }
  }

  /** Lower case, no spaces or underscores: "Real Sound", "real_sound" and "RealSound" all become "realsound". */
  private static String eqNorm(String s) { return s == null ? "" : s.toLowerCase(Locale.ROOT).replace(" ", "").replace("_", ""); }

  /** The exported Real Sound Technology page of the phone's Settings app, or null when there is none. */
  private Intent realSoundRoute() {
    android.content.pm.PackageManager pm = getContext().getPackageManager();
    List<android.content.pm.PackageInfo> all;
    try { all = pm.getInstalledPackages(android.content.pm.PackageManager.GET_ACTIVITIES); }
    catch (Exception e) { Log.i("LiquidNative", "equalizer: cannot list the apps"); return null; }
    ComponentName soundEffects = null;   // weaker match (a page called "Sound effects"), used only when no page says Real Sound
    List<String> candidates = new ArrayList<>();
    for (android.content.pm.PackageInfo pi : all) {
      String pkg = eqNorm(pi.packageName);
      if (pi.activities == null || !(pkg.contains("settings") || pkg.contains("oplus") || pkg.contains("coloros") || pkg.contains("dolby"))) continue;
      for (android.content.pm.ActivityInfo ai : pi.activities) {
        if (ai.name == null) continue;
        String label = "";
        try { label = eqNorm(String.valueOf(ai.loadLabel(pm))); } catch (Exception e) { /* no label: match by class name only */ }
        String name = eqNorm(ai.name);
        if (!(name.contains("sound") || label.contains("sound") || name.contains("effect") || label.contains("effect"))) continue;
        if (candidates.size() < 30) candidates.add(ai.packageName + "/" + ai.name + " label=" + label + " exported=" + ai.exported);
        if (!ai.exported || !ai.enabled) continue;
        ComponentName c = new ComponentName(ai.packageName, ai.name);
        if (name.contains("realsound") || label.contains("realsound")) {
          for (String d : candidates) Log.i("LiquidNative", "equalizer: candidate " + d);
          return new Intent(Intent.ACTION_MAIN).setComponent(c);
        }
        if (soundEffects == null && (name.contains("soundeffect") || label.contains("soundeffect"))) soundEffects = c;
      }
    }
    for (String d : candidates) Log.i("LiquidNative", "equalizer: candidate " + d);
    return soundEffects == null ? null : new Intent(Intent.ACTION_MAIN).setComponent(soundEffects);
  }

  /* ---------- Equalizer per phone brand (the Real Sound route above is for OPPO / Realme and is NOT changed) ----------
   *   OPPO / Realme : Real Sound Technology (realSoundRoute, unchanged).
   *   OnePlus       : the "Dirac Audio Tuner" page (Smart / Movie / Game / Music), found at run time by name or label (diracRoute).
   *   Every other   : that phone's own sound-effects page (Samsung "Sound quality and effects", Vivo / iQOO, Xiaomi, Huawei / Honor, Motorola...):
   *   brand          1. an exported sound-effects / equalizer page of a PRE-INSTALLED app (effectsRoute)
   *                  2. else Android's standard equalizer panel, only when a pre-installed app answers it (eqPanel)
   *                  3. else Sound & vibration (android.settings.SOUND_SETTINGS) and the user taps the row once.
   * Only pre-installed (system) apps are used, so a Play Store equalizer is never opened by mistake.
   * Every candidate page found is written to the app log as "equalizer: candidate ...", every try as "equalizer: ...". */

  /** "oneplus", "oppo" (OPPO and Realme) or "other". OnePlus is checked first. */
  private static String eqBrand() {
    String s = ((Build.MANUFACTURER == null ? "" : Build.MANUFACTURER) + " " + (Build.BRAND == null ? "" : Build.BRAND)).toLowerCase(Locale.ROOT);
    if (s.contains("oneplus")) return "oneplus";
    if (s.contains("oppo") || s.contains("realme")) return "oppo";
    return "other";
  }

  /** True for a pre-installed app (or an updated pre-installed app). */
  private static boolean eqSystemApp(android.content.pm.ApplicationInfo a) {
    return a != null && (a.flags & (android.content.pm.ApplicationInfo.FLAG_SYSTEM | android.content.pm.ApplicationInfo.FLAG_UPDATED_SYSTEM_APP)) != 0;
  }

  /** OnePlus: the exported "Dirac Audio Tuner" page of a pre-installed app, or null when there is none. Best match first: a page called "Dirac Audio Tuner", then any "Dirac" page, then an "audio / sound tuner" page. */
  private Intent diracRoute() {
    android.content.pm.PackageManager pm = getContext().getPackageManager();
    List<android.content.pm.PackageInfo> all;
    try { all = pm.getInstalledPackages(android.content.pm.PackageManager.GET_ACTIVITIES); }
    catch (Exception e) { Log.i("LiquidNative", "equalizer: cannot list the apps"); return null; }
    ComponentName best = null; int bestRank = 99;
    List<String> candidates = new ArrayList<>();
    for (android.content.pm.PackageInfo pi : all) {
      if (pi.activities == null || !eqSystemApp(pi.applicationInfo)) continue;
      for (android.content.pm.ActivityInfo ai : pi.activities) {
        if (ai.name == null) continue;
        String label = "";
        try { label = eqNorm(String.valueOf(ai.loadLabel(pm))); } catch (Exception e) { /* no label: match by class name only */ }
        String name = eqNorm(ai.name);
        boolean dirac = name.contains("dirac") || label.contains("dirac");
        boolean tuner = name.contains("audiotuner") || label.contains("audiotuner") || name.contains("soundtuner") || label.contains("soundtuner");
        if (!dirac && !tuner) continue;
        if (candidates.size() < 30) candidates.add(ai.packageName + "/" + ai.name + " label=" + label + " exported=" + ai.exported);
        if (!ai.exported || !ai.enabled) continue;
        int rank = (name.contains("diracaudiotuner") || label.contains("diracaudiotuner")) ? 0 : dirac ? 1 : 2;
        if (rank < bestRank) { bestRank = rank; best = new ComponentName(ai.packageName, ai.name); }
      }
    }
    for (String d : candidates) Log.i("LiquidNative", "equalizer: candidate " + d);
    return best == null ? null : new Intent(Intent.ACTION_MAIN).setComponent(best);
  }

  /** Words (normalised, see eqNorm) that mark a sound-effects page, best first. */
  private static final String[] EQ_KEYS = { "equalizer", "soundalive", "soundqualityandeffects", "soundquality", "audioeffect", "soundeffect", "musiceffect", "dolby" };

  /** Other brands: the exported sound-effects / equalizer page of a pre-installed app (not this app), or null when there is none. */
  private Intent effectsRoute() {
    android.content.pm.PackageManager pm = getContext().getPackageManager();
    List<android.content.pm.PackageInfo> all;
    try { all = pm.getInstalledPackages(android.content.pm.PackageManager.GET_ACTIVITIES); }
    catch (Exception e) { Log.i("LiquidNative", "equalizer: cannot list the apps"); return null; }
    String own = getContext().getPackageName();
    ComponentName best = null; int bestRank = EQ_KEYS.length;
    List<String> candidates = new ArrayList<>();
    for (android.content.pm.PackageInfo pi : all) {
      if (pi.activities == null || own.equals(pi.packageName) || !eqSystemApp(pi.applicationInfo)) continue;
      for (android.content.pm.ActivityInfo ai : pi.activities) {
        if (ai.name == null) continue;
        String label = "";
        try { label = eqNorm(String.valueOf(ai.loadLabel(pm))); } catch (Exception e) { /* no label: match by class name only */ }
        String name = eqNorm(ai.name);
        int rank = -1;
        for (int k = 0; k < EQ_KEYS.length; k++) { if (name.contains(EQ_KEYS[k]) || label.contains(EQ_KEYS[k])) { rank = k; break; } }
        if (rank < 0) continue;
        if (candidates.size() < 30) candidates.add(ai.packageName + "/" + ai.name + " label=" + label + " exported=" + ai.exported);
        if (!ai.exported || !ai.enabled) continue;
        if (rank < bestRank) { bestRank = rank; best = new ComponentName(ai.packageName, ai.name); }
      }
    }
    for (String d : candidates) Log.i("LiquidNative", "equalizer: candidate " + d);
    return best == null ? null : new Intent(Intent.ACTION_MAIN).setComponent(best);
  }

  /** Android's standard "audio effect control panel" for the song that is playing, only when a pre-installed app answers it. Built fresh every time (the audio session changes). */
  private Intent eqPanel() {
    try {
      Intent i = new Intent(android.media.audiofx.AudioEffect.ACTION_DISPLAY_AUDIO_EFFECT_CONTROL_PANEL);
      int session = PlaybackService.audioSession();
      if (session != 0) i.putExtra(android.media.audiofx.AudioEffect.EXTRA_AUDIO_SESSION, session);
      i.putExtra(android.media.audiofx.AudioEffect.EXTRA_PACKAGE_NAME, getContext().getPackageName());
      i.putExtra(android.media.audiofx.AudioEffect.EXTRA_CONTENT_TYPE, android.media.audiofx.AudioEffect.CONTENT_TYPE_MUSIC);
      android.content.pm.ResolveInfo ri = getContext().getPackageManager().resolveActivity(i, 0);
      if (ri == null || ri.activityInfo == null || !eqSystemApp(ri.activityInfo.applicationInfo)) return null;
      return i;
    } catch (Throwable t) { return null; }
  }

  /** Opens the phone's own equalizer page for its brand (see the block above), otherwise Sound & vibration.
   *  Resolves { via: "real-sound" | "dirac" | "effects" | "panel" | "settings", brand: "oppo" | "oneplus" | "other" }. */
  /** BUG-399: the page found by the package scan is remembered for the session, so the scan runs at most until it finds the page once. */
  private volatile Intent eqRouteCache;
  private volatile String eqRouteVia = "";

  @PluginMethod
  public void openEqualizer(final PluginCall call) {
    // BUG-399: the package scan is slow and used to run on the plugin thread, holding up every other plugin call. It now runs on LIB_POOL; the screen is opened on the main thread.
    LIB_POOL.execute(new Runnable() { @Override public void run() {
      final String brand = eqBrand();
      Intent rs = eqRouteCache; String found = eqRouteVia;
      if (rs == null) {
        try {
          if ("oppo".equals(brand)) { rs = realSoundRoute(); found = "real-sound"; }
          else if ("oneplus".equals(brand)) { rs = diracRoute(); found = "dirac"; }
          else { rs = effectsRoute(); found = "effects"; }
        } catch (Throwable t) { Log.w("LiquidNative", "equalizer: scan failed " + t); rs = null; }
        if (rs != null) { eqRouteVia = found; eqRouteCache = rs; }
      }
      final Intent route = rs; final String routeVia = found;
      Runnable open = new Runnable() { @Override public void run() {
        if (route != null && eqStart(new Intent(route), route.getComponent().flattenToShortString())) { JSObject o = new JSObject(); o.put("via", routeVia); o.put("brand", brand); call.resolve(o); return; }
        if (route != null) eqRouteCache = null;   // the remembered page no longer opens: scan again next time
        if ("other".equals(brand)) {
          Intent panel = eqPanel();
          if (panel != null && eqStart(panel, "system equalizer panel")) { JSObject o = new JSObject(); o.put("via", "panel"); o.put("brand", brand); call.resolve(o); return; }
        }
        if (eqStart(new Intent("android.settings.SOUND_SETTINGS"), "Sound & vibration")) { JSObject o = new JSObject(); o.put("via", "settings"); o.put("brand", brand); call.resolve(o); return; }
        call.reject("Could not open Sound settings on this phone");
      } };
      try { getActivity().runOnUiThread(open); } catch (Throwable t) { call.reject("Could not open Sound settings on this phone"); }
    } });
  }

  /* ---------- v77: Bluetooth. openBluetooth opens the phone's Bluetooth settings; getBluetooth lists connected Bluetooth audio devices and starts watching:
   * event onBluetooth { devices:[{name,type}], change:"connected"|"disconnected", name } fires whenever one connects or leaves. No permission needed (AudioManager). ---------- */
  private AudioDeviceCallback btCb; private final java.util.Set<String> btKnown = java.util.Collections.synchronizedSet(new java.util.HashSet<String>());   // BUG-54

  private static boolean isBt(AudioDeviceInfo d) {
    int t = d.getType();
    if (t == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || t == AudioDeviceInfo.TYPE_BLUETOOTH_SCO) return true;
    if (Build.VERSION.SDK_INT >= 28 && t == AudioDeviceInfo.TYPE_HEARING_AID) return true;
    if (Build.VERSION.SDK_INT >= 31 && (t == AudioDeviceInfo.TYPE_BLE_HEADSET || t == AudioDeviceInfo.TYPE_BLE_SPEAKER || t == AudioDeviceInfo.TYPE_BLE_BROADCAST)) return true;
    return false;
  }

  /** v82: battery % of a connected Bluetooth device, -1 when the phone does not report it. Needs the Bluetooth permission (Android 12+). BluetoothDevice.getBatteryLevel() is hidden API, so it is called by reflection and any failure just means "unknown". */
  private boolean btPerm() { return Build.VERSION.SDK_INT < 31 || ContextCompat.checkSelfPermission(getContext(), "android.permission.BLUETOOTH_CONNECT") == android.content.pm.PackageManager.PERMISSION_GRANTED; }

  private int btBattery(AudioDeviceInfo d) {
    try {
      if (Build.VERSION.SDK_INT < 28 || !btPerm()) return -1;
      String addr = d.getAddress(); if (addr == null || addr.isEmpty()) return -1;
      android.bluetooth.BluetoothAdapter ad = android.bluetooth.BluetoothAdapter.getDefaultAdapter(); if (ad == null) return -1;
      android.bluetooth.BluetoothDevice dev = ad.getRemoteDevice(addr);
      Object r = android.bluetooth.BluetoothDevice.class.getMethod("getBatteryLevel").invoke(dev);
      int v = r instanceof Integer ? (Integer) r : -1;
      return v >= 0 && v <= 100 ? v : -1;
    } catch (Throwable t) { return -1; }
  }

  private android.content.BroadcastReceiver btBat;

  /** BUG-260: a Bluetooth output is tracked by its Android device id, not by its name; the name is only what the person sees. */
  private static String btKey(AudioDeviceInfo d) { return String.valueOf(d.getId()); }
  private static String btName(AudioDeviceInfo d) { String n = d.getProductName() == null ? "" : d.getProductName().toString().trim(); return n.isEmpty() ? "Bluetooth device" : n; }

  private JSArray btList(AudioDeviceInfo[] ds) {
    JSArray a = new JSArray(); java.util.Set<String> seen = new java.util.HashSet<>();
    for (AudioDeviceInfo d : ds) {
      if (!isBt(d)) continue;
      String n = d.getProductName() == null ? "" : d.getProductName().toString().trim(); if (n.isEmpty()) n = "Bluetooth device";
      if (!seen.add(n)) continue;
      JSObject o = new JSObject(); o.put("name", n); o.put("type", d.getType() == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ? "call" : "audio");
      int bl = btBattery(d); if (bl >= 0) o.put("battery", bl);
      a.put(o);
    }
    return a;
  }

  private void btEmit(String change, String name) {
    AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    JSObject o = new JSObject(); o.put("devices", btList(am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)));
    if (change != null) { o.put("change", change); o.put("name", name); }
    notifyListeners("onBluetooth", o);
  }

  private void btWatch() {
    if (btCb != null || Build.VERSION.SDK_INT < 23) return;
    AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    btCb = new AudioDeviceCallback() {
      @Override public void onAudioDevicesAdded(AudioDeviceInfo[] added) {   // BUG-260: every Bluetooth entry of the batch, keyed by device id (two pairs with the same name stay two devices)
        boolean fresh = false;
        for (AudioDeviceInfo d : added) { if (!isBt(d)) continue; if (btKnown.add(btKey(d))) { fresh = true; btEmit("connected", btName(d)); } }
        if (fresh) { ui.postDelayed(new Runnable() { @Override public void run() { btEmit(null, null); } }, 3000); ui.postDelayed(new Runnable() { @Override public void run() { btEmit(null, null); } }, 9000); }
      }
      @Override public void onAudioDevicesRemoved(AudioDeviceInfo[] gone) { for (AudioDeviceInfo d : gone) { if (!isBt(d)) continue; btKnown.remove(btKey(d)); btEmit("disconnected", btName(d)); } }
    };
    am.registerAudioDeviceCallback(btCb, ui);
    btBat = new android.content.BroadcastReceiver() { @Override public void onReceive(Context c, Intent i) { btEmit(null, null); } };   // the phone reports a (new) battery level
    try { ContextCompat.registerReceiver(getContext(), btBat, new android.content.IntentFilter("android.bluetooth.device.action.BATTERY_LEVEL_CHANGED"), ContextCompat.RECEIVER_NOT_EXPORTED); } catch (Throwable t) { btBat = null; }
  }

  /** Scan worker threads: 4 per CPU core (the work mostly waits on storage, so more threads than cores keep every core busy), with no fixed cap.
   *  A worker can briefly hold a cover picture (up to ~16 MB) plus its decoded copy, so the count is also kept inside the app's heap (about 32 MB per worker)
   *  and a big library can never run the phone out of memory. The heap budget always wins: a small heap (under 256 MB) gets fewer than 8 workers, never fewer than 1. */
  /** BUG-052: worst case of ONE scan worker = a picture of up to 12 MB in memory (folder picture cap, see folderCover) + its sampled decode (about 600 px = 1.5 MB) + the JPEG copy, plus tag buffers: about 18 MB. 20 MB per worker, so the heap guard now matches what a worker can really hold. */
  private static final long SCAN_WORKER_MB = 20;
  private static int scanThreads() {
    long heapMb = Runtime.getRuntime().maxMemory() / (1024 * 1024);
    return ScanSizing.threads(Runtime.getRuntime().availableProcessors(), heapMb);   // BUG-052 / BUG-277: same formula, now a pure function (ScanSizing.WORKER_MB == SCAN_WORKER_MB)
  }

  /** CPU cores, processor name, RAM (total / free) and the app's heap size, for Settings > Performance. */
  @PluginMethod
  public void getDeviceInfo(PluginCall call) {
    JSObject o = new JSObject();
    try {
      android.app.ActivityManager am = (android.app.ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
      android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo(); am.getMemoryInfo(mi);
      String cpu = "";
      if (Build.VERSION.SDK_INT >= 31) cpu = (Build.SOC_MANUFACTURER + " " + Build.SOC_MODEL).trim();
      if (cpu.isEmpty() || cpu.toLowerCase(Locale.ROOT).contains("unknown")) cpu = (Build.HARDWARE + (Build.BOARD != null && !Build.BOARD.equalsIgnoreCase(Build.HARDWARE) ? " / " + Build.BOARD : "")).trim();
      o.put("cores", Runtime.getRuntime().availableProcessors());
      o.put("scanThreads", scanThreads());
      o.put("processor", cpu);
      o.put("abi", Build.SUPPORTED_ABIS != null && Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "");
      o.put("ramMb", mi.totalMem / (1024 * 1024));
      o.put("availMb", mi.availMem / (1024 * 1024));
      o.put("heapMb", Runtime.getRuntime().maxMemory() / (1024 * 1024));
      o.put("cpuMs", android.os.Process.getElapsedCpuTime());   // CPU time this app has used so far (all threads); the JS side turns the growth into a live %
      try { String[] th = new java.io.File("/proc/self/task").list(); if (th != null) o.put("threads", th.length); } catch (Exception ignored) { }   // live thread count of this app
    } catch (Exception e) { Log.w("LiquidNative", "device info: " + e); }
    call.resolve(o);
  }

  @PluginMethod
  public void getBluetooth(PluginCall call) {
    JSObject o = new JSObject();
    if (Build.VERSION.SDK_INT < 23) { o.put("devices", new JSArray()); call.resolve(o); return; }
    AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    JSArray l = btList(am.getDevices(AudioManager.GET_DEVICES_OUTPUTS));
    for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) if (isBt(d)) btKnown.add(btKey(d));   // BUG-260: by device id
    btWatch(); o.put("devices", l); call.resolve(o);
  }

  /** Asks for the Bluetooth permission (Android 12+) so the battery % can be read; resolves { granted }. */
  @PluginMethod
  public void requestBluetooth(PluginCall call) {
    if (btPerm()) { JSObject o = new JSObject(); o.put("granted", true); call.resolve(o); return; }
    requestPermissionForAlias("bluetooth", call, "btPermResult");
  }

  @PermissionCallback
  private void btPermResult(PluginCall call) { JSObject o = new JSObject(); o.put("granted", btPerm()); btEmit(null, null); call.resolve(o); }

  @PluginMethod
  public void openBluetooth(PluginCall call) {
    try {
      Intent i = new Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(i); btWatch(); call.resolve();
    } catch (Exception e) { call.reject("Could not open Bluetooth settings"); }
  }

  /* ---------- T22: sleep timer. The timer runs in PlaybackService; the plugin only starts / cancels it and forwards its events (onSleepTimer). ---------- */
  private void hookSleep() {
    PlaybackService.sleepListener = new PlaybackService.SleepListener() {
      @Override public void onSleep(boolean active, boolean endOfSong, long endsInMs, boolean fired) { notifyListeners("onSleepTimer", sleepJson(active, endOfSong, endsInMs, fired)); }
    };
  }

  private static JSObject sleepJson(boolean active, boolean endOfSong, long endsInMs, boolean fired) {
    JSObject o = new JSObject(); o.put("active", active); o.put("endOfSong", endOfSong); o.put("endsInMs", endsInMs); o.put("fired", fired); return o;
  }

  /** { minutes: 15 | 30 | 45 | 60 ... } or { endOfSong: true }. Rejects "Nothing is playing" when the playback service is not running. */
  @PluginMethod
  public void setSleepTimer(PluginCall call) {
    final int minutes = call.getInt("minutes", 0); final boolean song = call.getBoolean("endOfSong", false);
    final long exact = call.getLong("ms", 0L);   // optional: the exact time left (resuming a timer after the app was killed), 1 s .. 24 h; otherwise whole minutes
    if (!song && SleepTimer.minutesToMs(minutes) == 0L) { call.reject("bad minutes"); return; }
    final long ms = !song && exact >= 1000L && exact <= 24L * 60L * 60_000L ? exact : SleepTimer.minutesToMs(minutes);
    hookSleep();
    if (!PlaybackService.startSleep(song ? 0L : ms, song)) { call.reject("Nothing is playing"); return; }
    call.resolve();   // the real state follows as an onSleepTimer event
  }

  @PluginMethod
  public void cancelSleepTimer(PluginCall call) { hookSleep(); PlaybackService.cancelSleep(); call.resolve(); }

  /** Current state, for when the app was closed and reopened while the timer kept running. */
  @PluginMethod
  public void getSleepTimer(PluginCall call) {
    hookSleep();
    long[] st = PlaybackService.sleepState();
    call.resolve(sleepJson(st[0] != 0L, st[0] == 2L, st[1], false));
  }

  /* ---------- T16: phone-side log. An app can only read its OWN logcat lines (no permission needed), warnings and errors only. ---------- */
  @PluginMethod
  public void getNativeLog(PluginCall call) {
    JSObject o = new JSObject(); StringBuilder sb = new StringBuilder();
    Process pr = null;
    try {
      pr = new ProcessBuilder("logcat", "-d", "-v", "time", "*:W").redirectErrorStream(true).start();
      try (java.io.BufferedReader br = new java.io.BufferedReader(new java.io.InputStreamReader(pr.getInputStream(), StandardCharsets.UTF_8))) {
        String ln; while ((ln = br.readLine()) != null) { sb.append(ln).append('\n'); if (sb.length() > 400000) sb.delete(0, sb.length() - 200000); }   // BUG-400: keep the last ~200 KB
      }
    } catch (Exception e) { sb.append("(could not read the phone log: ").append(e).append(')'); }
    finally { if (pr != null) pr.destroy(); }
    o.put("log", sb.toString()); call.resolve(o);
  }

  /* ---------- notifications: status, system permission prompt (Android 13+), test notification ---------- */
  private boolean notifOn() { return NotificationManagerCompat.from(getContext()).areNotificationsEnabled(); }

  /** v53: status bar / navigation bar heights in CSS px (the app is drawn edge-to-edge, see MainActivity). */
  @PluginMethod
  public void insets(PluginCall call) { JSObject o = new JSObject(); o.put("top", (double) MainActivity.insetTop); o.put("bottom", (double) MainActivity.insetBottom); call.resolve(o); }

  @PluginMethod
  public void notificationStatus(PluginCall call) { JSObject o = new JSObject(); o.put("granted", notifOn()); call.resolve(o); }

  @PluginMethod
  public void requestNotifications(PluginCall call) {
    if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) { notificationStatus(call); return; }
    requestPermissionForAlias("notifications", call, "notifResult");
  }

  @PermissionCallback
  private void notifResult(PluginCall call) { notificationStatus(call); }

  /** v208: the app's own Notifications page in Android settings. Used by the "Allow notifications" card when the system prompt cannot be shown (Android 12 and older, or the person already refused it twice). */
  @PluginMethod
  public void openNotificationSettings(PluginCall call) {
    String pkg = getContext().getPackageName();
    boolean ok = false;
    if (Build.VERSION.SDK_INT >= 26) { Intent i = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS); i.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, pkg); ok = tryStart(i); }
    if (!ok) ok = tryStart(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)));
    JSObject o = new JSObject(); o.put("ok", ok); call.resolve(o);
  }

  @PluginMethod
  public void notificationTest(PluginCall call) {
    Context c = getContext();
    if (!notifOn()) { call.reject("notifications not allowed"); return; }
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel ch = new NotificationChannel("liquid_test", "Diagnostics", NotificationManager.IMPORTANCE_DEFAULT);
      c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }
    Intent li = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
    PendingIntent pi = PendingIntent.getActivity(c, 0, li, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    Notification n = new NotificationCompat.Builder(c, "liquid_test").setSmallIcon(android.R.drawable.ic_media_play)
        .setContentTitle("Liquid Dark").setContentText("Test notification").setContentIntent(pi).setAutoCancel(true).build();
    NotificationManagerCompat.from(c).notify(7001, n);
    call.resolve();
  }
}
