package com.liquid.flacplayer;

/** BUG-394: the "which download is current" state of UpdateDownloadService, moved out unchanged so it can be tested without Android. Callers keep holding their own lock around multi-step use. */
final class UpdateGeneration {
  private volatile long generation = 0;
  private volatile String activeId = "";
  private volatile boolean running = false;

  boolean isRunning() { return running; }
  synchronized boolean isActive(String id) { return running && id.equals(activeId); }

  /** Starts a new generation for id; returns -1 when the same id is already running (a repeat start). */
  synchronized long begin(String id) {
    if (running && id.equals(activeId)) return -1;
    long token = ++generation;
    activeId = id;
    running = true;
    return token;
  }

  boolean current(long token, String id) { return generation == token && id.equals(activeId); }

  /** Marks the download finished, only if this token is still the current one. */
  synchronized boolean finish(long token, String id) {
    if (!current(token, id)) return false;
    running = false;
    activeId = "";
    return true;
  }
}
