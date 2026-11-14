package com.liquid.flacplayer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** A foreground service keeps APK downloads alive after the WebView/app task is closed. */
public final class UpdateDownloadService extends Service {
  private static final String TAG = "LiquidUpdateDownload";
  private static final String CHANNEL_ID = "liquid_update_download";
  private static final int NOTIFICATION_ID = 4107;
  private static final String ACTION_DOWNLOAD = "com.liquid.flacplayer.action.DOWNLOAD_UPDATE";
  private static final Object LOCK = new Object();
  private static final ExecutorService WORKER = Executors.newSingleThreadExecutor(r -> {
    Thread t = new Thread(r, "lf-update-download");
    t.setDaemon(true);
    return t;
  });
  private static final UpdateGeneration GEN = new UpdateGeneration();   // BUG-394: generation / active id / running flag (behaviour-tested)
  private static volatile HttpURLConnection activeConnection;

  public static boolean isRunning() { return GEN.isRunning(); }

  public static void enqueue(Context context, String url, long build, String sha256) {
    if (!UpdateSupport.validTarget(build, sha256)) throw new IllegalArgumentException("The update manifest is missing a valid build number or SHA-256 checksum.");
    if (url == null || !url.startsWith("https://")) throw new IllegalArgumentException("The update link is missing or invalid.");
    String id = UpdateSupport.identity(build, sha256);
    UpdateSupport.saveTarget(context, id, build, sha256, url, UpdateSupport.STATUS_QUEUED, "", 0);
    start(context, url, build, sha256);
  }

  public static void resumeSaved(Context context) {
    String state = UpdateSupport.state(context);
    if (!UpdateSupport.STATUS_QUEUED.equals(state) && !UpdateSupport.STATUS_DOWNLOADING.equals(state)) return;
    long build = UpdateSupport.targetBuild(context);
    String sha = UpdateSupport.targetSha(context);
    String url = UpdateSupport.targetUrl(context);
    if (UpdateSupport.validTarget(build, sha) && url.startsWith("https://")) start(context, url, build, sha);
  }

  private static void start(Context context, String url, long build, String sha) {
    Intent intent = new Intent(context, UpdateDownloadService.class)
      .setAction(ACTION_DOWNLOAD)
      .putExtra("url", url)
      .putExtra("build", build)
      .putExtra("sha256", sha);
    if (Build.VERSION.SDK_INT >= 26) ContextCompat.startForegroundService(context, intent);
    else context.startService(intent);
  }

  @Override public void onCreate() {
    super.onCreate();
    ensureChannel();
  }

  private volatile int lastStartId = 0;   // BUG-27 / 177: the newest start id; stopSelfResult with an older id would leave the service running

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    lastStartId = startId;
    String url = intent == null ? UpdateSupport.targetUrl(this) : intent.getStringExtra("url");
    long build = intent == null ? UpdateSupport.targetBuild(this) : intent.getLongExtra("build", 0);
    String sha = intent == null ? UpdateSupport.targetSha(this) : intent.getStringExtra("sha256");
    if (sha == null) sha = "";
    if (url == null) url = "";
    if (!UpdateSupport.validTarget(build, sha) || !url.startsWith("https://")) {
      String id = UpdateSupport.targetId(this);
      UpdateSupport.markFailed(this, id, "The update manifest is missing a valid APK link, build number or SHA-256 checksum.");
      startForegroundCompat(Math.max(0, build), "Update download stopped", -1, false, null);   // BUG-26 / 176: startForegroundService() must always be answered with startForeground()
      try { stopForeground(true); } catch (Exception ignored) {}
      stopSelfResult(startId);
      return START_NOT_STICKY;
    }

    final String id = UpdateSupport.identity(build, sha);
    boolean dup; synchronized (LOCK) { dup = GEN.isActive(id); }
    if (!dup) startForegroundCompat(build, "Preparing the update download", -1, true, null);   // BUG-27: a repeat start must not overwrite the progress notification
    final long token;
    synchronized (LOCK) {
      token = GEN.begin(id);
      if (token < 0) return START_STICKY;
      HttpURLConnection old = activeConnection;
      activeConnection = null;
      if (old != null) old.disconnect();
    }
    final String targetUrl = url;
    final String targetSha = sha;
    final long targetBuild = build;
    WORKER.execute(() -> download(targetUrl, targetBuild, targetSha, id, token, startId));
    return START_STICKY;
  }

  private boolean current(long token, String id) {
    return GEN.current(token, id);
  }

  private void download(String url, long build, String sha, String id, long token, int startId) {
    HttpURLConnection connection = null;
    File part = UpdateSupport.partFile(this, build, sha);
    try {
      if (!current(token, id)) return;
      File apk = UpdateSupport.apkFile(this, build, sha);
      if (apk.isFile() && UpdateSupport.verifyApk(this, build, sha) == null) {
        UpdateSupport.setState(this, id, UpdateSupport.STATUS_READY, "", 100);
        showReadyNotification(build, sha);
        return;
      }
      // BUG-178 / BUG-340: keep a partial download and resume it (HTTP Range) instead of starting over
      long resumeFrom = part.isFile() ? part.length() : 0;
      // BUG #24: a part file that is already complete (matching SHA-256) is verified directly; a Range request for its full length would get HTTP 416
      boolean alreadyComplete = resumeFrom >= 1_000_000L && sha.equalsIgnoreCase(UpdateSupport.sha256File(part));

      if (!alreadyComplete) {
      connection = (HttpURLConnection) new URL(url).openConnection();
      connection.setConnectTimeout(20_000);
      connection.setReadTimeout(60_000);
      connection.setInstanceFollowRedirects(true);
      connection.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0");
      connection.setRequestProperty("Pragma", "no-cache");
      connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
      if (resumeFrom > 0) connection.setRequestProperty("Range", "bytes=" + resumeFrom + "-");
      synchronized (LOCK) {
        if (!current(token, id)) { connection.disconnect(); throw new InterruptedException("a newer update replaced this download"); }
        activeConnection = connection;
      }
      int response = connection.getResponseCode();
      if (response == 416 && resumeFrom > 0) {
        part.delete();   // the partial file no longer fits the server's file: the next try starts again
        throw new Exception("the partial download did not match the server, press retry to start again");
      }
      boolean partial = response == HttpURLConnection.HTTP_PARTIAL && resumeFrom > 0;
      if (response != HttpURLConnection.HTTP_OK && !partial) {
        if (response == HttpURLConnection.HTTP_NOT_FOUND || response == HttpURLConnection.HTTP_GONE)
          throw new Exception("the APK release file is missing (HTTP " + response + ")");
        throw new Exception("download failed (HTTP " + response + ")");
      }
      if (!partial) resumeFrom = 0;   // the server sent the whole file again: write it from the start

      long remaining = connection.getContentLengthLong();
      long total = remaining > 0 ? remaining + resumeFrom : -1;
      long got = resumeFrom;
      int lastPct = -2;
      UpdateSupport.setState(this, id, UpdateSupport.STATUS_DOWNLOADING, "", 0);
      startForegroundCompat(build, "Downloading Liquid Dark update", 0, true, null);
      try (InputStream in = new BufferedInputStream(connection.getInputStream()); FileOutputStream out = new FileOutputStream(part, partial)) {
        byte[] buffer = new byte[65_536];
        int n;
        while ((n = in.read(buffer)) != -1) {
          if (!current(token, id)) throw new InterruptedException("a newer update replaced this download");
          if (n == 0) continue;
          out.write(buffer, 0, n);
          got += n;
          int pct = total > 0 ? (int) Math.min(100, (got * 100L) / total) : -1;
          if (pct != lastPct) {
            lastPct = pct;
            UpdateSupport.setProgress(this, id, pct);
            startForegroundCompat(build, "Downloading Liquid Dark update", pct, true, null);
          }
        }
        out.flush();
        out.getFD().sync();
      }
      // BUG #25: a stream that ended cleanly but short is incomplete; keep the part file so the next try resumes it
      if (total > 0 && got != total) throw new Exception("the download ended early (" + got + " of " + total + " bytes), press retry to resume");
      }

      if (!current(token, id)) throw new InterruptedException("a newer update replaced this download");
      if (part.length() < 1_000_000L) throw new Exception("the downloaded APK is incomplete (file too small)");
      String actualSha = UpdateSupport.sha256File(part);
      if (!sha.equalsIgnoreCase(actualSha)) { part.delete(); throw new Exception("SHA-256 checksum mismatch. The downloaded file does not match the published update."); }
      long actualBuild = UpdateSupport.archiveVersionCode(this, part);
      if (actualBuild != build) { part.delete(); throw new Exception("downloaded APK build " + actualBuild + " does not match update build " + build); }
      long installed = UpdateSupport.installedVersionCode(this);
      if (actualBuild <= installed) throw new Exception("downloaded APK build " + actualBuild + " is not newer than installed build " + installed);

      if (!current(token, id)) throw new InterruptedException("a newer update replaced this download");
      if (apk.exists() && !apk.delete()) throw new Exception("could not replace the previous APK for this build");
      if (!part.renameTo(apk)) throw new Exception("could not finalize the verified APK");
      String verifyError = UpdateSupport.verifyApk(this, build, sha);
      if (verifyError != null) throw new Exception(verifyError);
      if (!current(token, id)) return;
      UpdateSupport.setState(this, id, UpdateSupport.STATUS_READY, "", 100);
      showReadyNotification(build, sha);
      Log.i(TAG, "Verified update ready: build " + build);
    } catch (InterruptedException cancelled) {
      Log.i(TAG, "Old update download cancelled: " + id);
      if (part.exists()) part.delete();
    } catch (Exception e) {
      // BUG-178 / BUG-340: the partial file is kept, so the next try resumes it
      if (current(token, id)) {
        String message = e.getMessage() == null ? "download failed" : e.getMessage();
        UpdateSupport.markFailed(this, id, message);
        showFailedNotification(message);
        Log.e(TAG, "Download failed for " + id, e);
      } else {
        Log.i(TAG, "Superseded update failed harmlessly: " + id + ": " + e.getMessage());
      }
    } finally {
      if (connection != null) connection.disconnect();
      synchronized (LOCK) {
        if (activeConnection == connection) activeConnection = null;
      }
      if (current(token, id)) {
        synchronized (LOCK) {
          GEN.finish(token, id);
        }
        android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
        handler.post(() -> {
          if (!GEN.isRunning()) {
            try { stopForeground(false); } catch (Exception ignored) {}
            stopSelfResult(lastStartId);
          }
        });
      }
    }
  }

  private void ensureChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager != null && manager.getNotificationChannel(CHANNEL_ID) == null) {
      NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "App updates", NotificationManager.IMPORTANCE_LOW);
      channel.setDescription("Liquid Dark update download progress and install action");
      channel.setShowBadge(false);
      manager.createNotificationChannel(channel);
    }
  }

  private Notification buildNotification(long build, String title, String message, int pct, boolean ongoing, PendingIntent action) {
    int icon = getApplicationInfo().icon;
    if (icon == 0) icon = android.R.drawable.stat_sys_download;
    Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent content = PendingIntent.getActivity(this, 4107, open,
      PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
    NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(icon).setContentTitle(title).setContentText(message)
      .setContentIntent(content).setOnlyAlertOnce(true).setOngoing(ongoing)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS).setPriority(NotificationCompat.PRIORITY_LOW)
      .setAutoCancel(false);
    if (pct >= 0 && pct < 100) b.setProgress(100, pct, false);
    else if (pct < 0 && ongoing) b.setProgress(0, 0, true);
    else b.setProgress(0, 0, false);
    if (action != null) b.addAction(android.R.drawable.ic_menu_view, "Install", action);
    return b.build();
  }

  private void startForegroundCompat(long build, String message, int pct, boolean ongoing, PendingIntent action) {
    Notification n = buildNotification(build, ongoing ? "Liquid Dark update downloading" : "Liquid Dark update ready", message, pct, ongoing, action);
    try {
      if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
      else startForeground(NOTIFICATION_ID, n);
    } catch (Exception e) { Log.e(TAG, "could not update foreground notification", e); }
  }

  private void showReadyNotification(long build, String sha) {
    Intent install = new Intent(this, UpdateInstallActivity.class).putExtra("build", build).putExtra("sha256", sha);
    int request = (int) (build & 0x7fffffff);
    PendingIntent pending = PendingIntent.getActivity(this, request, install,
      PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
    Notification n = buildNotification(build, "Liquid Dark update ready", "Download complete. Tap Install when you're ready.", 100, false, pending);
    try {
      NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, n);
    } catch (SecurityException e) { Log.w(TAG, "notifications are disabled; in-app Install remains available", e); }
  }

  private void showFailedNotification(String error) {
    Notification n = buildNotification(0, "Liquid Dark update download failed", error, -1, false, null);
    try { NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, n); }
    catch (SecurityException e) { Log.w(TAG, "could not show update failure notification", e); }
  }

  @Override public void onTaskRemoved(Intent rootIntent) {
    // Deliberately keep the foreground service running when the user swipes the app task away.
    super.onTaskRemoved(rootIntent);
  }

  @Override public void onDestroy() {
    super.onDestroy();
    // Do not cancel an active request here: Android may recreate a START_STICKY service after process reclaim.
  }

  @Override public IBinder onBind(Intent intent) { return null; }
}
