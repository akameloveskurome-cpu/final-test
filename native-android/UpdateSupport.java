package com.liquid.flacplayer;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.MessageDigest;

/** Persistent, build-specific update files and verification metadata. */
final class UpdateSupport {
  static final String PREFS = "liquid_updates";
  static final String STATUS_UNKNOWN = "unknown";
  static final String STATUS_QUEUED = "queued";
  static final String STATUS_DOWNLOADING = "downloading";
  static final String STATUS_READY = "ready";
  static final String STATUS_FAILED = "failed";

  private UpdateSupport() {}

  static SharedPreferences prefs(Context ctx) {
    return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  static String identity(long build, String sha256) {
    return build + "-" + (sha256 == null ? "" : sha256.toLowerCase(java.util.Locale.US));
  }

  static boolean validTarget(long build, String sha256) {
    return build > 1_000_000_000L && build < 2_147_483_647L && sha256 != null && sha256.matches("(?i)[0-9a-f]{64}");
  }

  static File updateDir(Context ctx) {
    File dir = new File(ctx.getFilesDir(), "update");
    if (!dir.exists()) dir.mkdirs();
    return dir;
  }

  /** BUG-31 / 179: once a build is installed, every downloaded APK (and half-downloaded .part) for that build or an older one is deleted. A newer download is never touched. */
  static void cleanInstalled(Context ctx) {
    try {
      long inst = installedVersionCode(ctx); if (inst <= 0) return;
      File[] fs = updateDir(ctx).listFiles(); if (fs == null) return;
      for (File f : fs) {
        String n = f.getName();
        if (!n.startsWith("liquid-dark-") || !(n.endsWith(".apk") || n.endsWith(".apk.part"))) continue;
        int e = n.indexOf('-', 12); long b;
        try { b = Long.parseLong(n.substring(12, e < 0 ? n.length() : e).replaceAll("[^0-9]", "")); } catch (Exception x) { continue; }
        if (b > 0 && b <= inst) f.delete();
      }
    } catch (Throwable ignored) { }
  }

  static File apkFile(Context ctx, long build, String sha256) {
    return new File(updateDir(ctx), "liquid-dark-" + identity(build, sha256) + ".apk");
  }

  static File partFile(Context ctx, long build, String sha256) {
    return new File(updateDir(ctx), "liquid-dark-" + identity(build, sha256) + ".apk.part");
  }

  static void saveTarget(Context ctx, String id, long build, String sha256, String url, String state, String error, int pct) {
    prefs(ctx).edit()
      .putString("target_id", id)
      .putLong("target_build", build)
      .putString("target_sha256", sha256)
      .putString("target_url", url == null ? "" : url)
      .putString("status", state)
      .putString("error", error == null ? "" : error)
      .putInt("pct", Math.max(-1, Math.min(100, pct)))
      .commit();
  }

  static void setProgress(Context ctx, String id, int pct) {
    SharedPreferences p = prefs(ctx);
    if (!id.equals(p.getString("target_id", ""))) return;
    p.edit().putString("status", STATUS_DOWNLOADING).putInt("pct", Math.max(-1, Math.min(100, pct))).putString("error", "").apply();
  }

  static void setState(Context ctx, String id, String state, String error, int pct) {
    SharedPreferences p = prefs(ctx);
    if (!id.equals(p.getString("target_id", ""))) return;
    p.edit().putString("status", state).putString("error", error == null ? "" : error)
      .putInt("pct", Math.max(-1, Math.min(100, pct))).apply();
  }

  static String state(Context ctx) { return prefs(ctx).getString("status", STATUS_UNKNOWN); }
  static String targetId(Context ctx) { return prefs(ctx).getString("target_id", ""); }
  static String targetUrl(Context ctx) { return prefs(ctx).getString("target_url", ""); }
  static long targetBuild(Context ctx) { return prefs(ctx).getLong("target_build", 0); }
  static String targetSha(Context ctx) { return prefs(ctx).getString("target_sha256", ""); }

  static void markFailed(Context ctx, String id, String message) {
    setState(ctx, id, STATUS_FAILED, message, -1);
  }

  static long packageVersionCode(PackageInfo info) {
    if (info == null) return 0;
    return android.os.Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
  }

  static long installedVersionCode(Context ctx) throws Exception {
    PackageInfo info;
    if (android.os.Build.VERSION.SDK_INT >= 33) {
      info = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), PackageManager.PackageInfoFlags.of(0));
    } else {
      //noinspection deprecation
      info = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
    }
    return packageVersionCode(info);
  }

  static long archiveVersionCode(Context ctx, File apk) throws Exception {
    PackageInfo info;
    if (android.os.Build.VERSION.SDK_INT >= 33) {
      info = ctx.getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.PackageInfoFlags.of(0));
    } else {
      //noinspection deprecation
      info = ctx.getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), 0);
    }
    if (info == null || !ctx.getPackageName().equals(info.packageName)) {
      throw new Exception("the downloaded file is not a Liquid Dark APK");
    }
    long build = packageVersionCode(info);
    if (build <= 0) throw new Exception("the APK has no valid Android build number");
    return build;
  }

  static String sha256File(File file) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    try (InputStream in = new BufferedInputStream(new FileInputStream(file))) {
      byte[] buffer = new byte[65536];
      int n;
      while ((n = in.read(buffer)) > 0) digest.update(buffer, 0, n);
    }
    StringBuilder out = new StringBuilder(64);
    for (byte b : digest.digest()) out.append(String.format(java.util.Locale.US, "%02x", b & 0xff));
    return out.toString();
  }

  /** BUG-183: true when the APK shares a signing certificate with the installed app. Our own certificate unreadable, or an unreadable APK certificate = no objection (Android still decides); only two readable, different certificates count as a mismatch. */
  @SuppressWarnings("deprecation")
  private static boolean sameSigner(Context ctx, File apk) {
    try {
      android.content.pm.PackageManager pm = ctx.getPackageManager();
      boolean p28 = android.os.Build.VERSION.SDK_INT >= 28;
      int flag = p28 ? android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES : android.content.pm.PackageManager.GET_SIGNATURES;
      android.content.pm.PackageInfo a = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flag), i = pm.getPackageInfo(ctx.getPackageName(), flag);
      java.util.Set<String> sa = sigs(a, p28), si = sigs(i, p28);
      // Second chance: some phones fill only the OLD signature list (GET_SIGNATURES) and leave the new one empty. Ask again that way before giving up, so a real mismatch is still caught and an unreadable file is rarer.
      if (sa.isEmpty() && p28) sa = sigs(pm.getPackageArchiveInfo(apk.getAbsolutePath(), android.content.pm.PackageManager.GET_SIGNATURES), false);
      if (si.isEmpty() && p28) si = sigs(pm.getPackageInfo(ctx.getPackageName(), android.content.pm.PackageManager.GET_SIGNATURES), false);
      if (si.isEmpty()) return true;   // our own certificate cannot be read: no objection, Android decides
      if (sa.isEmpty()) return true;   // BUG-032 revised: some phones (V2-only APK, vendor ROMs) cannot read an APK's signature from the archive even though the file is fine. Unreadable = no objection: the SHA-256 and build-number checks above already prove it is our exact APK, and Android's installer still refuses a genuinely different key. Only two READABLE, different certificates are a real mismatch.
      for (String s : sa) if (si.contains(s)) return true;
      return false;
    } catch (Exception e) { return true; }
  }
  @SuppressWarnings("deprecation")
  private static java.util.Set<String> sigs(android.content.pm.PackageInfo pi, boolean p28) {
    java.util.Set<String> out = new java.util.HashSet<String>();
    if (pi == null) return out;
    android.content.pm.Signature[] arr = null;
    if (p28) { if (pi.signingInfo != null) arr = pi.signingInfo.hasMultipleSigners() ? pi.signingInfo.getApkContentsSigners() : pi.signingInfo.getSigningCertificateHistory(); }
    else arr = pi.signatures;
    if (arr != null) for (android.content.pm.Signature s : arr) out.add(s.toCharsString());
    return out;
  }

  /** Returns null only when the file is a complete, exact, newer APK for this manifest. */
  static String verifyApk(Context ctx, long expectedBuild, String expectedSha) {
    try {
      if (!validTarget(expectedBuild, expectedSha)) return "the update manifest is missing a valid build number or SHA-256 checksum";
      File apk = apkFile(ctx, expectedBuild, expectedSha);
      if (!apk.isFile() || apk.length() < 1_000_000L) return "the downloaded APK is missing or incomplete";
      String actualSha = sha256File(apk);
      if (!expectedSha.equalsIgnoreCase(actualSha)) return "the downloaded APK failed its SHA-256 check";
      long actualBuild = archiveVersionCode(ctx, apk);
      if (actualBuild != expectedBuild) return "downloaded APK build " + actualBuild + " does not match update build " + expectedBuild;
      if (!sameSigner(ctx, apk)) return "the downloaded APK is signed with a different key than the installed app, so Android would refuse it";   // BUG-183
      long installed = installedVersionCode(ctx);
      if (actualBuild <= installed) return "downloaded APK build " + actualBuild + " is not newer than installed build " + installed;
      return null;
    } catch (Exception e) {
      String message = e.getMessage();
      return message == null || message.isEmpty() ? "could not verify the downloaded APK" : message;
    }
  }
}
