package com.liquid.flacplayer;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.File;

/** Direct target for the Install action on the completed-download notification. */
public final class UpdateInstallActivity extends Activity {
  // BUG-182: while the "install unknown apps" page is open this activity waits for the user to come back, then carries on
  private boolean waitingForPermission; private long pBuild; private String pSha = "", pId = "";

  @Override protected void onResume() {
    super.onResume();
    if (!waitingForPermission) return;
    waitingForPermission = false;
    if (Build.VERSION.SDK_INT >= 26 && getPackageManager().canRequestPackageInstalls()) proceed(pBuild, pSha, pId, null);
    else { Toast.makeText(this, "Allow Liquid Dark to install unknown apps to finish the update.", Toast.LENGTH_LONG).show(); finish(); }
  }

  @Override protected void onCreate(Bundle state) {
    super.onCreate(state);
    long build = getIntent().getLongExtra("build", 0);
    String sha = getIntent().getStringExtra("sha256");
    if (sha == null) sha = "";
    String id = UpdateSupport.identity(build, sha);
    // BUG-29 / 180: a stale notification for a build that is already installed is just removed, never re-downloaded
    long inst = 0; try { inst = UpdateSupport.installedVersionCode(this); } catch (Exception ignored) { }
    if (build > 0 && inst >= build) {
      try { ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE)).cancel(4107); } catch (Exception ignored) { } UpdateSupport.cleanInstalled(this);
      Toast.makeText(this, "Liquid Dark is already up to date.", Toast.LENGTH_SHORT).show();
      finish();
      return;
    }
    // BUG-28: the full SHA-256 of the APK is computed on a worker thread (a big APK on a slow phone could freeze the UI / ANR)
    final long fBuild = build; final String fSha = sha, fId = id;
    new Thread(() -> {
      final String err = UpdateSupport.verifyApk(UpdateInstallActivity.this, fBuild, fSha);
      runOnUiThread(() -> { if (!isFinishing()) proceed(fBuild, fSha, fId, err); });
    }, "update-verify").start();
  }

  private void proceed(long build, String sha, String id, String error) {
    if (error != null) {
      UpdateSupport.markFailed(this, id, error);
      // This action may have come from the system notification rather than the WebView.
      // Recover here too, so a stale/missing notification APK never leaves the app in a
      // permanent ready/install loop; the service will re-download the exact manifest build.
      try {
        if (!id.equals(UpdateSupport.targetId(this))) throw new Exception("this notification belongs to an older update");   // BUG-29: never fetch a different build's URL
        UpdateDownloadService.enqueue(this, UpdateSupport.targetUrl(this), build, sha);
        Toast.makeText(this, "The update file failed verification. Downloading it again in the background.", Toast.LENGTH_LONG).show();
      } catch (Exception retryError) {
        Toast.makeText(this, "The update file failed verification. Open Liquid Dark to retry: " +
          (retryError.getMessage() == null ? "download could not start" : retryError.getMessage()), Toast.LENGTH_LONG).show();
      }
      openApp();
      finish();
      return;
    }
    if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
      try {
        Intent settings = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:" + getPackageName()));
        pBuild = build; pSha = sha == null ? "" : sha; pId = id == null ? "" : id; waitingForPermission = true;
        startActivity(settings);
        return;   // stays open: onResume() continues the install once the permission is granted
      } catch (Exception e) {
        waitingForPermission = false;
        Toast.makeText(this, "Allow Liquid Dark to install unknown apps in Android Settings.", Toast.LENGTH_LONG).show();
        openApp();
      }
      finish();
      return;
    }
    try {
      File apk = UpdateSupport.apkFile(this, build, sha);
      Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apk);
      Intent installer = new Intent(Intent.ACTION_VIEW);
      installer.setDataAndType(uri, "application/vnd.android.package-archive");
      installer.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      startActivity(installer);
    } catch (Exception e) {
      Toast.makeText(this, "Could not open Android installer: " + (e.getMessage() == null ? "unknown error" : e.getMessage()), Toast.LENGTH_LONG).show();
      openApp();
    }
    finish();
  }

  private void openApp() {
    try {
      Intent app = getPackageManager().getLaunchIntentForPackage(getPackageName());
      if (app != null) { app.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP); startActivity(app); }
    } catch (Exception ignored) { }
  }
}
