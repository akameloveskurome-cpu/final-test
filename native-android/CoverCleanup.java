package com.liquid.flacplayer;

import java.io.File;

/** BUG-378: removes old scan covers from filesDir/covers. Pure java.io so it can be tested without Android.
 *  Rules: only files directly inside the covers folder; a file is kept when its name appears anywhere in refText (the fresh library cache text + the widget picture overrides text);
 *  *.tmp younger than one minute is kept; if refText is empty / not usable, nothing is deleted. Anything else the person uploaded lives elsewhere and is never touched. */
final class CoverCleanup {
  private CoverCleanup() { }

  static final long TMP_GRACE_MS = 60_000L;

  /** Returns how many files were deleted. */
  static int clean(File coversDir, String refText, long nowMs) {
    if (coversDir == null || refText == null || refText.indexOf(".jpg") < 0) return 0;   // no cover is referenced at all: the cache looks empty / unreadable, so delete NOTHING
    File[] files = coversDir.listFiles(); if (files == null) return 0;
    int n = 0;
    for (File f : files) {
      try {
        if (!f.isFile()) continue;
        String name = f.getName();
        if (refText.contains(name)) continue;
        if (name.endsWith(".tmp") && nowMs - f.lastModified() < TMP_GRACE_MS) continue;
        if (f.delete()) n++;
      } catch (Throwable ignored) { }   // when in doubt, keep the file
    }
    return n;
  }
}
