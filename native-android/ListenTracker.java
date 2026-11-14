package com.liquid.flacplayer;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import java.util.TimeZone;
import java.util.UUID;

/**
 * Records real listening time. Attached to the player INSIDE PlaybackService (the MediaSessionService), never to the activity or the WebView, so it keeps counting
 * when the app is in the background, the screen is off, or the app was swiped away from Recent Apps while the service still plays. It stops counting exactly when
 * isPlaying() turns false (pause, buffering, audio focus loss, end of queue, service destroyed). Duration uses the monotonic clock, so clock/time-zone changes cannot distort it.
 * A segment is closed on: pause/stop, track change, repeat, foreground<->background change. A heartbeat every 5 s (first one after 1.5 s) keeps the open segment current, so the stats screen and widgets are never more than 5 s behind (process death loses < 5 s).
 * Qualified play = 10 s of listening or half the song if shorter, once per play (one segment of the play gets qualified=1). It is decided by an exact timer (not by the next heartbeat), and the play is ALSO written to the "plays" list that feeds Recently / Most Played,
 * so plays are counted even when the app, the WebView or the whole activity is gone.
 * The player callbacks and the timers run on the main thread. BUG-225: every database write (insert, save, event, startup repair) runs on ONE background thread
 * (DB_IO), in the order it was queued. A segment is named by (play, seq), the table's UNIQUE key, so its saves never need the row id; they simply queue behind its insert.
 * The closing save waits (up to 5 s) so nothing older can land after it. Plain APIs only; no UI.
 * LOOPS (v149): a loop pass is its own play. Repeat-one / repeat-all-with-one-song arrive as onMediaItemTransition(REPEAT) or only as an AUTO_TRANSITION position discontinuity,
 * a seek back to 0 at the end of the song is caught as a discontinuity too, and the heartbeat is a last-resort check (position wrapped between two beats). The A-B loop is a plain seek inside
 * one song: the page tags that seek (noteLoopSeek) and the pass is closed there. Inside an A-B loop a pass qualifies after min(10 s, half the loop span). All signals go through
 * loopWrap(), which ignores a second signal for the same wrap (LoopWatch.duplicate). The rules live in LoopWatch (pure, tested with real javac).
 * A segment whose first insert failed is written by the next save (saveOrInsert), so a play is never lost because the database was busy once.
 */
final class ListenTracker implements Player.Listener {
  private static final long QUALIFY_MS = 10_000, HEARTBEAT = 5_000, FIRST_BEAT = 1_500, WIDGET_EVERY = 60_000, SESSION_GAP = 30 * 60_000L;
  static final Object PLAYS_LOCK = new Object();   // guards the "plays" list in SharedPreferences (also used by LiquidNative.takePlays)
  /** Set by LiquidNative while the app is alive: called (main thread) right after a play was counted, so the page can take it at once. */
  static volatile Runnable onPlayCounted;
  private static ListenTracker inst;
  static volatile boolean fg = false;   // set from the activity's start/stop (LiquidNative)
  private static volatile long abSeekMono = 0;   // when the page last jumped back for the A-B loop (SystemClock.elapsedRealtime), 0 = never
  /** The page is about to seek because the A-B loop reached B: the discontinuity that follows closes the pass and starts a new play. */
  static void noteLoopSeek() { abSeekMono = SystemClock.elapsedRealtime(); }

  /** BUG-225: all database writes of the tracker, one at a time, in the order they were queued. */
  private static final java.util.concurrent.ExecutorService DB_IO = java.util.concurrent.Executors.newSingleThreadExecutor(new java.util.concurrent.ThreadFactory() {
    @Override public Thread newThread(Runnable r) { Thread t = new Thread(r, "lf-listen-db"); t.setDaemon(true); return t; }
  });

  private final Context ctx; private final ListenDb db; private final Player p; private final Handler h = new Handler(Looper.getMainLooper());
  private String session, play, song, title, artist, album, albumArtist;
  private int seq; private long playedBefore; private boolean playQualified;
  // BUG-225: "open" = a segment is running. Its (play, segSeq) names it in the database; its insert may still be on DB_IO (the saves queue behind it).
  private boolean open; private int segSeq; private long insertToken;
  private volatile boolean syncClose;   // BUG-225: only the final save (service teardown, detach) waits for the database; a pause / skip just queues, so a busy database (big import) can no longer freeze the main thread
  private long segStartWall, segStartMono, segStartPos; private boolean segFg, segQual, repeatClose, trackClose;   // trackClose (BUG-122): the flush belongs to a track change, so the current item is already the NEXT one
  private long lastWidgetMono;
  private long lastPosMono, lastWrapMono, loopRegion, closePos = -1;   // loopRegion: length of the A-B span while an A-B loop runs (0 = whole song); closePos: where the closing pass really ended (-1 = read the player)
  private long lastEndWall, curDur, lastPos;   // curDur = length of the track of the open segment, remembered at start (at a track change getDuration() already reports the NEXT track)

  private final Runnable beat = new Runnable() {
    @Override public void run() {
      if (open) {   // last-resort loop check: the position wrapped between two beats and no callback said so
        try { long now = SystemClock.elapsedRealtime(), pos = Math.max(0, p.getCurrentPosition()); if (LoopWatch.passedEnd(lastPos, pos, now - lastPosMono, curDur) && !LoopWatch.duplicate(now, lastWrapMono)) { loopWrap(false, lastPos, pos); return; } } catch (Throwable ignored) { }   // loopWrap restarts the segment and its beat
      }
      if (open) flush(false);
      else if (p.isPlaying()) { start(); return; }   // no open segment (its insert failed): try again (start() schedules the next beat itself)
      if (!open) return;
      long mono = SystemClock.elapsedRealtime();
      if (mono - lastWidgetMono >= WIDGET_EVERY) { lastWidgetMono = mono; StatsWidgets.refresh(ctx); }   // the home screen widgets follow long playback too
      h.postDelayed(this, HEARTBEAT);
    }
  };
  /** Fires exactly when the current play reaches 10 s of listening (or half of a short song). */
  private final Runnable qual = new Runnable() { @Override public void run() { if (open && !playQualified) { qualifyNow(); flush(false); } } };

  static void attach(Context c, Player p) {
    detach();
    final ListenDb db = ListenDb.get(c);
    DB_IO.execute(new Runnable() { @Override public void run() { db.repairOpen(); } });   // closes segments left open by a killed process; queued before any new insert
    inst = new ListenTracker(c.getApplicationContext(), db, p); p.addListener(inst);
    if (p.isPlaying()) inst.start();
  }
  static void detach() { if (inst != null) { inst.syncClose = true; inst.stop("detach"); inst.h.removeCallbacksAndMessages(null); inst.p.removeListener(inst); inst = null; } }
  /** The activity became visible / hidden: split the open segment so foreground and background time stay separate. */
  static void setForeground(boolean f) {
    if (fg == f) return; fg = f;
    final ListenTracker t = inst; if (t == null) return;
    t.h.post(() -> { if (t == inst && t.open) { t.stop("vis"); t.start(); } });
  }

  private ListenTracker(Context c, ListenDb db, Player p) { this.ctx = c; this.db = db; this.p = p; }

  private void start() {
    if (open || !p.isPlaying()) return;
    MediaItem cur = p.getCurrentMediaItem(); if (cur == null) return;
    final String curId = idOf(cur); if (curId.isEmpty()) return;   // v149: an item without a mediaId is still recorded (under its address) instead of being skipped silently
    final long now = System.currentTimeMillis();
    if (session == null || now - lastEndWall > SESSION_GAP) {
      session = UUID.randomUUID().toString();
      final String fs = session;
      DB_IO.execute(new Runnable() { @Override public void run() { db.event(now, fs, "session_start"); } });
    }
    if (play == null || !curId.equals(song)) {
      play = UUID.randomUUID().toString(); song = curId; seq = 0; playedBefore = 0; playQualified = false;
      MediaMetadata m = cur.mediaMetadata;
      title = str(m.title); artist = str(m.artist); album = str(m.albumTitle); albumArtist = str(m.albumArtist);
    }
    segStartWall = now; segStartMono = SystemClock.elapsedRealtime(); segStartPos = Math.max(0, p.getCurrentPosition()); lastPos = segStartPos; lastPosMono = segStartMono; segFg = fg; segQual = false;
    long td = p.getDuration(); if (td < 0) td = 0; curDur = td;
    int tz = TimeZone.getDefault().getOffset(now) / 60000;
    segSeq = seq++; open = true; final long token = ++insertToken;
    final String fSession = session, fPlay = play, fSong = song, fTitle = title, fArtist = artist, fAlbum = album, fAlbumArtist = albumArtist;
    final int fSeq = segSeq, ftz = tz; final long fPos = segStartPos, fTd = td; final boolean fFg = segFg;
    DB_IO.execute(new Runnable() { @Override public void run() {
      boolean ok = db.insertSegment(fSession, fPlay, fSeq, fSong, fTitle, fArtist, fAlbum, fAlbumArtist, now, fPos, fTd, fFg, ftz)
        || db.insertSegment(fSession, fPlay, fSeq, fSong, fTitle, fArtist, fAlbum, fAlbumArtist, now, fPos, fTd, fFg, ftz);   // one immediate retry
      if (ok) { db.event(now, fSession, "play"); return; }
      h.post(new Runnable() { @Override public void run() { if (token == insertToken) open = false; } });   // the next beat starts a new segment
    } });
    h.removeCallbacks(beat); h.postDelayed(beat, FIRST_BEAT);   // first save after 1.5 s: the new stretch shows up in the stats right away
    h.removeCallbacks(qual);
    if (!playQualified) { long thr = LoopWatch.threshold(loopRegion > 0 ? loopRegion : td); h.postDelayed(qual, Math.max(0, thr - playedBefore) + 30); }
  }

  /** The play reached its threshold: flag it and hand it to Recently / Most Played. Runs once per play. */
  private void qualifyNow() {
    if (playQualified) return;
    playQualified = true; segQual = true;
    recordPlay(ctx, song, System.currentTimeMillis());
  }

  private void flush(boolean closing) {
    if (!open) return;
    long dur = Math.max(0, SystemClock.elapsedRealtime() - segStartMono), end = segStartWall + dur, pos = 0;
    try { long td = p.getDuration(); if (td > 0 && !closing) { boolean learned = curDur <= 0; curDur = td; if (learned && !playQualified) { h.removeCallbacks(qual); h.postDelayed(qual, Math.max(0, LoopWatch.threshold(loopRegion > 0 ? loopRegion : td) - playedBefore - dur) + 30); } } MediaItem mi = p.getCurrentMediaItem(); boolean same = !trackClose && mi != null && song != null && song.equals(mi.mediaId); pos = (closing && closePos >= 0) ? closePos : (closing && repeatClose) ? (curDur > 0 ? curDur : lastPos) : (closing && !same) ? lastPos : Math.max(0, p.getCurrentPosition()); if (!closing) { lastPos = pos; lastPosMono = SystemClock.elapsedRealtime(); } } catch (Throwable ignored) { }   // a closing flush (track change / pause) must not read the next track's length
    if (!closing && loopRegion > 0 && playedBefore + dur > loopRegion + 2_500) loopRegion = 0;   // the A-B loop was switched off: back to the song's own length
    long thr = LoopWatch.threshold(loopRegion > 0 ? loopRegion : curDur);
    if (!playQualified && playedBefore + dur >= thr) qualifyNow();
    // BUG-225: the save is queued on DB_IO (the closing save waits for it, so nothing older can land after it)
    final String fPlay = play, fSession = session; final int fSeq = segSeq; final long fEnd = end, fDur = dur, fPos = pos; final boolean fQual = segQual, fClosing = closing;
    final String fSong = song, fTitle = title, fArtist = artist, fAlbum = album, fAlbumArtist = albumArtist; final long fStart = segStartWall, fStartPos = segStartPos, fTd = curDur; final boolean fFg = segFg; final int fTz = TimeZone.getDefault().getOffset(segStartWall) / 60000;
    Runnable write = new Runnable() { @Override public void run() {
      // v149: when the segment's first insert failed (busy database), this save writes the whole row instead of updating nothing
      if (!db.updateSegment(fPlay, fSeq, fEnd, fDur, fPos, fQual, fClosing, fSession)
        && !(fClosing && fDur < 500 && !fQual)
        && db.insertSegment(fSession, fPlay, fSeq, fSong, fTitle, fArtist, fAlbum, fAlbumArtist, fStart, fStartPos, fTd, fFg, fTz)) {
        db.updateSegment(fPlay, fSeq, fEnd, fDur, fPos, fQual, fClosing, fSession);
      }
    } };
    if (closing && syncClose) { try { DB_IO.submit(write).get(5, java.util.concurrent.TimeUnit.SECONDS); } catch (Exception e) { android.util.Log.w("ListenTracker", "closing save: " + e); } }
    else DB_IO.execute(write);
    lastEndWall = end;
    if (closing) { playedBefore += dur; open = false; closePos = -1; h.removeCallbacks(beat); h.removeCallbacks(qual); }
  }

  /** BUG-267: the saved-plays write (parse, add, commit) runs here, not on the main thread. One thread, so the plays keep their order. */
  private static final java.util.concurrent.ExecutorService PLAYS_IO = java.util.concurrent.Executors.newSingleThreadExecutor(new java.util.concurrent.ThreadFactory() {
    @Override public Thread newThread(Runnable r) { Thread t = new Thread(r, "lf-plays"); t.setDaemon(true); return t; }
  });

  /** Appends a counted play ({id, ts}, no limit: the list is only emptied when the page has saved them) for the page to take with LiquidNative.takePlays(). Works with no UI alive. */
  static void recordPlay(final Context c, final String id, final long ts) {
    PLAYS_IO.execute(new Runnable() { @Override public void run() { synchronized (PLAYS_LOCK) {
      try {
        android.content.SharedPreferences sp = c.getSharedPreferences("liquid", Context.MODE_PRIVATE);
        org.json.JSONArray all = new org.json.JSONArray(sp.getString("plays", "[]"));
        org.json.JSONObject o = new org.json.JSONObject(); o.put("id", id); o.put("ts", ts); all.put(o);
        sp.edit().putString("plays", all.toString()).commit();   // commit, not apply: apply() writes later in the background, so a process kill right after a counted play could lose it
      } catch (Throwable t) { android.util.Log.w("ListenTracker", "could not save a counted play: " + t); }
    }
    // The page is told only AFTER the play is saved, so its takePlays() always sees it (it used to be told at once and could read the list too early).
    Runnable r = onPlayCounted; if (r != null) { try { r.run(); } catch (Throwable ignored) { } } } });
  }

  private void stop(String why) {
    if (!open) return;
    flush(true);
    final long ts = System.currentTimeMillis(); final String fs = session;
    DB_IO.execute(new Runnable() { @Override public void run() { db.event(ts, fs, why); } });
    StatsWidgets.refresh(ctx);   // home screen listening-stats widgets
  }

  private static String str(CharSequence s) { return s == null ? "" : s.toString(); }
  private static String idOf(MediaItem m) {
    if (m.mediaId != null && !m.mediaId.isEmpty()) return m.mediaId;
    return m.localConfiguration != null && m.localConfiguration.uri != null ? m.localConfiguration.uri.toString() : "";
  }

  /** One loop pass ended. The finished pass is closed (ended where it really ended) and the next pass is a NEW play of the same song. ab = A-B jump (the span is how far it went back). */
  private void loopWrap(boolean ab, long prevPos, long newPos) {
    final long mono = SystemClock.elapsedRealtime();
    if (LoopWatch.duplicate(mono, lastWrapMono)) return;
    lastWrapMono = mono;
    if (!open) return;
    long dur = curDur;
    closePos = ab ? Math.max(0, prevPos) : (dur > 0 ? dur : Math.max(0, prevPos));
    repeatClose = !ab; trackClose = false;
    stop(ab ? "abloop" : "loop");
    repeatClose = false; closePos = -1;
    play = null; loopRegion = ab ? LoopWatch.region(true, prevPos, newPos, dur) : 0;
    if (p.isPlaying()) start();
  }

  /** The player jumped inside the same song: a repeat (auto transition back to the start, or a seek back to 0 from the end) or the A-B loop jump the page tagged. */
  @Override public void onPositionDiscontinuity(Player.PositionInfo oldP, Player.PositionInfo newP, int reason) {
    if (!open || oldP == null || newP == null || oldP.mediaItemIndex != newP.mediaItemIndex) return;   // a different item is a normal track change (onMediaItemTransition)
    long a = oldP.positionMs, b = newP.positionMs;
    boolean abTag = reason == Player.DISCONTINUITY_REASON_SEEK && abSeekMono > 0 && SystemClock.elapsedRealtime() - abSeekMono < 1_500;
    if (abTag) { abSeekMono = 0; if (LoopWatch.abWrap(a, b)) loopWrap(true, a, b); }
    else if (reason == Player.DISCONTINUITY_REASON_AUTO_TRANSITION) { if (b < a) loopWrap(false, a, b); }   // the song restarted by itself (repeat one, or repeat all with one song)
    else if (reason == Player.DISCONTINUITY_REASON_SEEK && LoopWatch.endWrap(a, b, curDur)) loopWrap(false, a, b);   // scrubbed / seeked from the end back to the start = a replay
  }

  @Override public void onIsPlayingChanged(boolean playing) { if (playing) start(); else stop("pause"); }
  @Override public void onMediaItemTransition(MediaItem m, int reason) {   // every transition (skip, auto-advance, repeat-one) is a new play
    if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT) {
      if (LoopWatch.duplicate(SystemClock.elapsedRealtime(), lastWrapMono)) return;   // onPositionDiscontinuity already closed this pass
      lastWrapMono = SystemClock.elapsedRealtime();
      repeatClose = true; trackClose = false; stop("loop"); repeatClose = false; play = null; loopRegion = 0; if (p.isPlaying()) start();
      return;
    }
    trackClose = true; stop("track"); trackClose = false; play = null; loopRegion = 0; if (p.isPlaying()) start();
  }
  @Override public void onPlaybackStateChanged(int st) { if (st == Player.STATE_ENDED) { stop("ended"); play = null; loopRegion = 0; } }
}
