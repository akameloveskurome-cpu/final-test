package com.liquid.flacplayer;

import android.content.Intent;
import android.util.Log;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/**
 * Ticket T4: owns the ExoPlayer + MediaSession. Media3 draws the notification (cover slot, title, artist line, prev/play/next).
 * T22: the sleep timer lives HERE (not in the WebView), so it works with the screen off.
 * Volume = sleep-timer fade. Everything runs on the main thread (static entry points post to it).
 */
public class PlaybackService extends MediaSessionService {
  /** Told to the plugin (which tells JS): the timer started / was cancelled / fired. endsInMs = time left (time mode only). */
  public interface SleepListener { void onSleep(boolean active, boolean endOfSong, long endsInMs, boolean fired); }

  static volatile PlaybackService instance;
  static volatile SleepListener sleepListener;

  private static final long FADE_MS = 10_000L;      // the volume falls to 0 over the last 10 seconds
  private static final long TICK_MS = 250L;

  private final Handler main = new Handler(Looper.getMainLooper());
  private MediaSession session;
  private ExoPlayer player;
  private volatile int sleepMode = 0;                // 0 = no timer, 1 = minutes, 2 = end of this song
  private volatile long sleepEnd = 0L;               // SystemClock.elapsedRealtime() when mode 1 fires
  private float fade = 1f;
  private volatile int sessionId = 0;                // T27: audio session of the player (0 = not known yet)
  private final Runnable tick = new Runnable() { @Override public void run() { sleepTick(); } };
  /* ---------- v119 part 2: earphone / headset buttons ----------
     What reaches the app (the earbuds + the phone decide this, not the app):
       TRIGGR Kraken X1 / Ultrabuds N5 (Bluetooth touch earbuds): the earbuds work out the gesture themselves and send ONE Bluetooth media command:
         1 tap (either earbud) = PLAY / PAUSE, double tap RIGHT = NEXT, double tap LEFT = PREVIOUS  -> handled below.
         triple tap RIGHT / LEFT = volume up / down  -> the phone's own volume (the app just gets louder / quieter, nothing to do here).
         Kraken: long press 2 s LEFT = voice assistant, long press 2 s RIGHT = Gaming Mode. N5: 4 taps = voice assistant, long press 2 s = Game / Music mode.
         Answer / end / reject call = the phone's call app. Gaming Mode + power off = the earbud itself. None of these are sent to a music app.
       boAt BassHeads 225 (wired, 3.5 mm, one inline button; the Reno 7 needs a USB-C adapter): HEADSETHOOK (or PLAY_PAUSE) per press,
         so the presses are counted inside 400 ms: 1 = play / pause, 2 = next, 3 (or more) = previous (confirmed by the user from the boAt manual: Multifunction
         Button, single / double / triple press). Long press 1.5 s = voice assistant, hold 2 s = reject a call: both belong to the phone, not to this app.
     Nothing loaded (the phone's system started this service because of the button, app closed): the last queue is put back from resume.json. */
  private int keyN = 0;   // presses of ONE button counted inside 400 ms (wired headset, or a USB-C adapter)
  private android.widget.Toast keyToast;   // test build: a small toast for every earphone button, so you can SEE whether the phone sends it to the app (remove once it works)
  private void keyMsg(String t) { if (!t.startsWith("Nothing")) return; try {   // BUG-60: no test toast on every earphone press, only the useful hint
    if (keyToast != null) keyToast.cancel(); keyToast = android.widget.Toast.makeText(this, t, android.widget.Toast.LENGTH_SHORT); keyToast.show(); } catch (Exception ignored) { } }
  private static boolean isOn(ExoPlayer pl) { int st = pl.getPlaybackState(); return pl.getPlayWhenReady() && st != Player.STATE_ENDED && st != Player.STATE_IDLE; }
  /** Play. Queue empty = the service was just started by the button: put the last queue back first. */
  private void keyPlay(ExoPlayer pl) {
    if (pl.getMediaItemCount() == 0 && !resumeFromDisk(pl)) { keyMsg("Nothing to play yet: open Liquid Dark and play a song once"); return; }
    if (pl.getPlaybackState() == Player.STATE_IDLE) pl.prepare();
    if (pl.getPlaybackState() == Player.STATE_ENDED) pl.seekToDefaultPosition(0);   // BUG-433: a finished queue starts again from its first song (play() alone does not leave ENDED)
    pl.play();
  }
  /* v148: the Previous / Next buttons of the notification, the lock screen and the Android media control centre.
     Media3 sends those taps through this same key handler as a KeyEvent it builds ITSELF (event time 0, sent by our own package). Real earphone / Bluetooth
     keys are stamped by the phone (event time > 0) and, while the app is alive, come from the system, so they never match this test and keep their old code below.
     Previous from the notification = ExoPlayer's standard rule: more than 3 s into the song = back to the start of it, otherwise (the next tap) = the previous song;
     on the first song it just restarts it instead of doing nothing. Next stays "next song" (no double tap needed). */
  private boolean fromOwnNotification(android.view.KeyEvent k, MediaSession.ControllerInfo c) {
    return k.getEventTime() == 0L && c != null && getPackageName().equals(c.getPackageName());
  }
  /** The screen the media card opens when you tap it: the app's own launcher activity (brings the running app to the front, or starts it). null = could not build it. */
  private android.app.PendingIntent openAppIntent() {
    try {
      android.content.Intent li = getPackageManager().getLaunchIntentForPackage(getPackageName());
      if (li == null) return null;
      li.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
      return android.app.PendingIntent.getActivity(this, 0, li, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
    } catch (Throwable t) { Log.w("LiquidNative", "open-app intent failed: " + t); return null; }
  }
  private static void notificationPrevious(ExoPlayer pl) { if (pl.getMediaItemCount() > 0) pl.seekToPrevious(); }
  private final Runnable keyDo = new Runnable() { @Override public void run() {
    int n = keyN; keyN = 0; ExoPlayer pl = player; if (pl == null || n < 1) return;
    if (n == 1) { keyMsg("Earphones: play / pause"); if (isOn(pl)) pl.pause(); else keyPlay(pl); }
    else if (n == 2) { keyMsg("Earphones: next song"); if (pl.getMediaItemCount() > 0) pl.seekToNextMediaItem(); }
    else { keyMsg("Earphones: previous song"); if (pl.getMediaItemCount() > 0) pl.seekToPreviousMediaItem(); }
  } };

  @Override
  public void onCreate() {
    super.onCreate();
    // Bigger read-ahead buffer, scaled to the phone's RAM (1/64 of it, between 16 and 128 MB): smoother playback from slow or external storage.
    long ram = 0; try { android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo(); ((android.app.ActivityManager) getSystemService(ACTIVITY_SERVICE)).getMemoryInfo(mi); ram = mi.totalMem; } catch (Exception ignored) { }
    int bufBytes = (int) Math.max(16L << 20, Math.min(128L << 20, ram / 64));
    ExoPlayer p = new ExoPlayer.Builder(this)
        .setLoadControl(new DefaultLoadControl.Builder().setBufferDurationsMs(30_000, 120_000, 1_500, 3_000).setTargetBufferBytes(bufBytes).build())
        .setAudioAttributes(new AudioAttributes.Builder().setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).setUsage(C.USAGE_MEDIA).build(), true)
        .setHandleAudioBecomingNoisy(true)
        .setWakeMode(C.WAKE_MODE_LOCAL)
        .build();
    player = p;
    ListenTracker.attach(this, p);   // statistics: counts real playback inside the service, independent of the app UI
    p.addListener(new Player.Listener() {
      @Override public void onAudioSessionIdChanged(int id) { announce(id); }   // T27: the system equalizer attaches to this session
      @Override public void onMediaItemTransition(@Nullable MediaItem m, int reason) { applyVolume(); widgetPush(); resumeSoon(); }
      @Override public void onIsPlayingChanged(boolean playing) { widgetPush(); if (!playing) resumeSoon(); }   // paused: remember the position
      @Override public void onTimelineChanged(androidx.media3.common.Timeline t, int reason) { resumeSoon(); }   // queue edited
      @Override public void onMediaMetadataChanged(androidx.media3.common.MediaMetadata md) { widgetPush(); }   // T21: every new song gets its own volume
      @Override public void onPlayWhenReadyChanged(boolean playWhenReady, int reason) {
        // T22 "end of this song": ExoPlayer pauses itself exactly at the end of the song; that is our signal
        if (sleepMode == 2 && !playWhenReady && reason == Player.PLAY_WHEN_READY_CHANGE_REASON_END_OF_MEDIA_ITEM) fireSleep();
      }
      @Override public void onPlaybackStateChanged(int state) { if (sleepMode != 0 && state == Player.STATE_ENDED) fireSleep(); }   // queue ran out first: the timer is done too
    });
    MediaSession.Builder sessionBuilder = new MediaSession.Builder(this, p).setCallback(new MediaSession.Callback() {
      /* v119: earphone / headset buttons, wired and Bluetooth (what each earphone sends: see the block above keyN). Every key is written to the phone log
         (Settings > Copy log, lines "earphone key") so you can see if the phone sends it at all. */
      @Override public boolean onMediaButtonEvent(MediaSession s, MediaSession.ControllerInfo c, android.content.Intent i) {
        android.view.KeyEvent k = i == null ? null : (android.view.KeyEvent) i.getParcelableExtra(android.content.Intent.EXTRA_KEY_EVENT);
        if (k == null) return false;
        int kc = k.getKeyCode(), act = k.getAction();
        Log.w("LiquidNative", "earphone key " + android.view.KeyEvent.keyCodeToString(kc) + (act == android.view.KeyEvent.ACTION_DOWN ? " down" : " up") + " repeat=" + k.getRepeatCount());
        boolean ours = kc == android.view.KeyEvent.KEYCODE_HEADSETHOOK || kc == android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE || kc == android.view.KeyEvent.KEYCODE_MEDIA_NEXT
            || kc == android.view.KeyEvent.KEYCODE_MEDIA_PREVIOUS || kc == android.view.KeyEvent.KEYCODE_MEDIA_PLAY || kc == android.view.KeyEvent.KEYCODE_MEDIA_PAUSE
            || kc == android.view.KeyEvent.KEYCODE_MEDIA_STOP || kc == android.view.KeyEvent.KEYCODE_MEDIA_FAST_FORWARD || kc == android.view.KeyEvent.KEYCODE_MEDIA_REWIND;
        if (act != android.view.KeyEvent.ACTION_DOWN || k.getRepeatCount() != 0) return ours;   // key up / auto-repeat: nothing more to do (but do not let the default handler act twice)
        ExoPlayer pl = player; if (pl == null) return false;
        if (kc == android.view.KeyEvent.KEYCODE_MEDIA_PREVIOUS && fromOwnNotification(k, c)) { Log.w("LiquidNative", "notification previous: restart / previous song"); notificationPrevious(pl); return true; }   // v148: notification button only
        switch (kc) {
          case android.view.KeyEvent.KEYCODE_HEADSETHOOK:
          case android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: keyN++; main.removeCallbacks(keyDo); main.postDelayed(keyDo, 400); return true;
          case android.view.KeyEvent.KEYCODE_MEDIA_PLAY: keyMsg("Earphones: play"); keyPlay(pl); return true;
          case android.view.KeyEvent.KEYCODE_MEDIA_PAUSE:
          case android.view.KeyEvent.KEYCODE_MEDIA_STOP: keyMsg("Earphones: pause"); pl.pause(); return true;
          case android.view.KeyEvent.KEYCODE_MEDIA_NEXT: keyMsg("Earphones: next song"); if (pl.getMediaItemCount() > 0) pl.seekToNextMediaItem(); return true;
          case android.view.KeyEvent.KEYCODE_MEDIA_PREVIOUS: keyMsg("Earphones: previous song"); if (pl.getMediaItemCount() > 0) pl.seekToPreviousMediaItem(); return true;
          case android.view.KeyEvent.KEYCODE_MEDIA_FAST_FORWARD: keyMsg("Earphones: forward"); pl.seekForward(); return true;
          case android.view.KeyEvent.KEYCODE_MEDIA_REWIND: keyMsg("Earphones: back"); pl.seekBack(); return true;
          default: return false;
        }
      }
    });
    android.app.PendingIntent openApp = openAppIntent();   // v148: tapping the media card (media control centre, lock screen, notification) opens the app
    if (openApp != null) sessionBuilder.setSessionActivity(openApp);
    session = sessionBuilder.build();
    instance = this;
    announce(p.getAudioSessionId());
  }

  /* ---------- v119 part 2: remember the queue so an earphone button can start playback when the app was closed ----------
     filesDir/resume.json = { index, pos (ms), repeat, items: [ { uri, id, title, artist, album, albumArtist, no, cover } ] } for up to 1000 songs from just before the
     current one. Written (on a helper thread, temp file + rename) 0.8 s after a song change, a pause or a queue edit; read only when a button arrives and the queue is empty. */
  private static final String RESUME_FILE = "resume.json";
  private static final Object RESUME_LOCK = new Object();
  private boolean hadItems = false;
  private final Runnable resumeSave = new Runnable() { @Override public void run() { saveResume(); } };
  private void resumeSoon() { main.removeCallbacks(resumeSave); main.postDelayed(resumeSave, 800); }

  private static String txt(CharSequence c) { return c == null ? "" : c.toString(); }

  private void saveResume() { saveResume(false); }
  private void saveResume(final boolean sync) {   // BUG-62: sync = onDestroy writes the small file on this thread, so it is finished before the service goes away
    ExoPlayer p = player; if (p == null) return;
    int n = p.getMediaItemCount();
    if (n == 0) {   // BUG-435: never wipe the saved queue at a plain service start, but when this player HAD songs and the person emptied it, the saved queue goes too
      if (!hadItems) return;
      hadItems = false;
      final File df = new File(getFilesDir(), RESUME_FILE);
      Runnable del = new Runnable() { @Override public void run() { synchronized (RESUME_LOCK) { try { df.delete(); } catch (Exception e) { Log.w("LiquidNative", "resume clear failed: " + e); } } } };
      if (sync) del.run(); else new Thread(del, "lf-resume").start();
      return;
    }
    hadItems = true;
    try {
      int cur = Math.max(0, Math.min(p.getCurrentMediaItemIndex(), n - 1));
      int from = Math.max(0, cur - 20), to = Math.min(n, from + 1000), idx = 0;
      JSONArray arr = new JSONArray();
      for (int i = from; i < to; i++) {
        MediaItem m = p.getMediaItemAt(i);
        if (m.localConfiguration == null) { if (i == cur) idx = arr.length(); continue; }   // no address = cannot be played again (BUG-61: resume at the next playable item, not item 0)
        if (i == cur) idx = arr.length();
        androidx.media3.common.MediaMetadata md = m.mediaMetadata;
        JSONObject o = new JSONObject();
        o.put("uri", m.localConfiguration.uri.toString()); o.put("id", m.mediaId);
        o.put("title", txt(md.title)); o.put("artist", txt(md.artist)); o.put("album", txt(md.albumTitle)); o.put("albumArtist", txt(md.albumArtist));
        o.put("no", md.trackNumber == null ? 0 : md.trackNumber.intValue());
        if (md.artworkUri != null && "file".equals(md.artworkUri.getScheme()) && md.artworkUri.getPath() != null) o.put("cover", md.artworkUri.getPath());
        arr.put(o);
      }
      if (arr.length() == 0) return;
      JSONObject root = new JSONObject();
      // BUG-434: a song that has ended restarts at 0, not at its end
      root.put("index", idx);
      root.put("pos", p.getPlaybackState() == Player.STATE_ENDED ? 0L : Math.max(0L, p.getCurrentPosition()));
      root.put("repeat", p.getRepeatMode()); root.put("items", arr);
      final byte[] bytes = root.toString().getBytes(StandardCharsets.UTF_8);
      final File dir = getFilesDir();
      Runnable writer = new Runnable() { @Override public void run() {
        synchronized (RESUME_LOCK) {
          try {
            File f = new File(dir, RESUME_FILE), tmp = new File(dir, RESUME_FILE + ".tmp");
            try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(bytes); out.getFD().sync(); }
            if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f); }
          } catch (Exception e) { Log.w("LiquidNative", "resume save failed: " + e); }
        }
      } };
      if (sync) writer.run(); else new Thread(writer, "lf-resume").start();
    } catch (Exception e) { Log.w("LiquidNative", "resume save failed: " + e); }
  }

  /** Load the saved queue into the (empty) player, paused, at the saved song + position. false = nothing saved / unreadable. */
  private boolean resumeFromDisk(ExoPlayer pl) {
    try {
      File f = new File(getFilesDir(), RESUME_FILE);
      if (!f.exists()) return false;
      ByteArrayOutputStream bo = new ByteArrayOutputStream();
      synchronized (RESUME_LOCK) { try (FileInputStream in = new FileInputStream(f)) { byte[] b = new byte[16384]; int r; while ((r = in.read(b)) > 0) bo.write(b, 0, r); } }
      JSONObject root = new JSONObject(new String(bo.toByteArray(), StandardCharsets.UTF_8));
      JSONArray arr = root.getJSONArray("items");
      List<MediaItem> list = new ArrayList<MediaItem>();
      for (int i = 0; i < arr.length(); i++) {
        JSONObject it = arr.getJSONObject(i);
        String ar = it.optString("artist"), al = it.optString("album"), aa = it.optString("albumArtist"), cv = it.optString("cover", "");
        androidx.media3.common.MediaMetadata.Builder mb = new androidx.media3.common.MediaMetadata.Builder().setTitle(it.optString("title")).setArtist(ar).setAlbumTitle(al)
            .setAlbumArtist(aa.isEmpty() ? ar : aa).setTrackNumber(it.optInt("no", 0) > 0 ? Integer.valueOf(it.optInt("no", 0)) : null)
            .setDisplayTitle(it.optString("title")).setSubtitle(ar + (al.isEmpty() ? "" : " \u2022 " + al)).setDescription(al);
        if (!cv.isEmpty()) mb.setArtworkUri(android.net.Uri.fromFile(new File(cv)));
        list.add(new MediaItem.Builder().setUri(it.optString("uri")).setMediaId(it.optString("id")).setMediaMetadata(mb.build()).build());
      }
      if (list.isEmpty()) return false;
      int idx = Math.max(0, Math.min(root.optInt("index", 0), list.size() - 1));
      int rep = root.optInt("repeat", Player.REPEAT_MODE_OFF);
      pl.setShuffleModeEnabled(false);                                       // the app (JS) owns shuffle; ExoPlayer's own shuffle stays off
      pl.setRepeatMode(rep == Player.REPEAT_MODE_ONE || rep == Player.REPEAT_MODE_ALL ? rep : Player.REPEAT_MODE_OFF);
      pl.setMediaItems(list, idx, Math.max(0L, root.optLong("pos", 0L)));
      pl.prepare();
      return true;
    } catch (Exception e) { Log.w("LiquidNative", "resume load failed: " + e); return false; }
  }

  /* ---------- v106: home screen widget ---------- */
  private void widgetPush() {
    ExoPlayer p = player; if (p == null) return;
    androidx.media3.common.MediaMetadata md = p.getMediaMetadata();
    String cover = md.artworkUri != null && "file".equals(md.artworkUri.getScheme()) && md.artworkUri.getPath() != null ? md.artworkUri.getPath() : "";   // v148: for the large Now Playing widget
    LiquidWidget.push(this, md.title == null ? "" : md.title.toString(), md.artist == null ? "" : md.artist.toString(), md.albumTitle == null ? "" : md.albumTitle.toString(), cover, p.isPlaying());
  }

  /** A widget button was tapped. With the service alive, drive the player; otherwise open the app. */
  static void widgetCmd(final android.content.Context c, final String a) {
    new Handler(Looper.getMainLooper()).post(new Runnable() { @Override public void run() {
      PlaybackService s = instance; ExoPlayer p = s == null ? null : s.player;
      if (p == null || p.getMediaItemCount() == 0) {
        Intent i = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (i != null) { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); try { c.startActivity(i); } catch (Exception ignored) { } }
        return;
      }
      if (LiquidWidget.A_PLAY.equals(a)) { if (p.isPlaying()) p.pause(); else { if (p.getPlaybackState() == androidx.media3.common.Player.STATE_IDLE) p.prepare(); p.play(); } }   // BUG-339: restart after a playback error
      else if (LiquidWidget.A_NEXT.equals(a)) p.seekToNextMediaItem();
      else if (LiquidWidget.A_PREV.equals(a)) p.seekToPrevious();
    } });
  }

  @Nullable @Override
  public MediaSession onGetSession(MediaSession.ControllerInfo info) { return session; }

  /** v54: the notification must keep the song, artist and album (and stay on the lock screen) when you PAUSE. By default Media3 leaves the
   *  foreground state on pause, so the system may drop the notification / kill the service and the info disappears. While a song is loaded
   *  we stay in the foreground; when the queue is empty (or playback ended for good) we let the default behaviour remove it. */
  @Override
  public void onUpdateNotification(MediaSession s, boolean startInForegroundRequired) {
    boolean loaded = s != null && s.getPlayer().getMediaItemCount() > 0 && s.getPlayer().getPlaybackState() != Player.STATE_IDLE;
    super.onUpdateNotification(s, startInForegroundRequired || loaded);
  }

  @Override
  public void onDestroy() {
    instance = null;
    main.removeCallbacks(tick); main.removeCallbacks(resumeSave); saveResume(true);
    announce(0);
    ListenTracker.detach();
    try { LiquidWidget.push(this, "", "", "", "", false); } catch (Throwable ignored) { }   // BUG-175: the widgets show the stopped state, not the last song and the pause icon
    if (session != null) { session.getPlayer().release(); session.release(); session = null; }
    player = null;
    super.onDestroy();
  }

  /* ---------- T27: system equalizer. Tell Android which audio session we play on (apps like the system EQ then attach to it); 0 = closing. ---------- */
  private void announce(int id) {
    if (id != 0 && id == sessionId) return;
    int old = sessionId;
    if (old != 0) effectIntent(android.media.audiofx.AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION, old);
    sessionId = id;
    if (id != 0) effectIntent(android.media.audiofx.AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION, id);
  }

  private void effectIntent(String action, int id) {
    android.content.Intent i = new android.content.Intent(action);
    i.putExtra(android.media.audiofx.AudioEffect.EXTRA_AUDIO_SESSION, id);
    i.putExtra(android.media.audiofx.AudioEffect.EXTRA_PACKAGE_NAME, getPackageName());
    i.putExtra(android.media.audiofx.AudioEffect.EXTRA_CONTENT_TYPE, android.media.audiofx.AudioEffect.CONTENT_TYPE_MUSIC);
    sendBroadcast(i);
  }

  /** Audio session id of the running player, 0 when nothing has started. */
  static int audioSession() { PlaybackService s = instance; return s == null ? 0 : s.sessionId; }

  /* ---------- T21: volume ---------- */
  private void applyVolume() {
    if (player == null) return;
    MediaItem m = player.getCurrentMediaItem();
    player.setVolume(fade);
  }

  /* ---------- T22: sleep timer ---------- */
  /** minutes >= 1: stop after that long; endOfSong: stop when the current song ends. Returns false when the service is not running (nothing playing). */
  static boolean startSleep(final long ms, final boolean endOfSong) {   // ms = how long (time mode); ignored for endOfSong
    final PlaybackService s = instance;
    if (s == null) return false;
    s.main.post(new Runnable() { @Override public void run() { s.doStart(ms, endOfSong); } });
    return true;
  }

  static void cancelSleep() {
    final PlaybackService s = instance;
    if (s != null) s.main.post(new Runnable() { @Override public void run() { if (s.sleepMode != 0) { s.clearSleep(); s.notifySleep(false); } } });
  }

  /** { mode (0 none / 1 minutes / 2 end of song), msLeft (mode 1 only) }; safe to call from any thread. */
  static long[] sleepState() {
    PlaybackService s = instance;
    if (s == null || s.sleepMode == 0) return new long[] { 0L, 0L };
    int mode = s.sleepMode;
    return new long[] { mode, mode == 1 ? Math.max(0L, s.sleepEnd - SystemClock.elapsedRealtime()) : 0L };
  }

  private void doStart(long ms, boolean endOfSong) {
    if (player == null) return;
    if (!endOfSong && (ms < 1000L || ms > 24L * 60L * 60_000L)) return;                         // nothing sensible to start
    clearSleep();                                               // a new timer replaces the old one
    if (endOfSong) { sleepMode = 2; player.setPauseAtEndOfMediaItems(true); }
    else { sleepMode = 1; sleepEnd = SystemClock.elapsedRealtime() + ms; }
    notifySleep(false);
    sleepTick();
  }

  private void sleepTick() {
    main.removeCallbacks(tick);
    if (sleepMode == 0 || player == null) return;
    long left;
    if (sleepMode == 1) left = sleepEnd - SystemClock.elapsedRealtime();
    else { long d = player.getDuration(); left = d == C.TIME_UNSET ? Long.MAX_VALUE : d - player.getCurrentPosition(); }   // song length unknown = no fade
    if (sleepMode == 1 && left <= 0L) { fireSleep(); return; }
    float f = SleepTimer.fade(left, FADE_MS);
    if (f != fade) { fade = f; applyVolume(); }
    main.postDelayed(tick, TICK_MS);
  }

  /** Back to "no timer": stop the ticks, normal volume, normal end-of-song behaviour. Does NOT pause. */
  private void clearSleep() {
    main.removeCallbacks(tick);
    sleepMode = 0; fade = 1f;
    if (player != null) { player.setPauseAtEndOfMediaItems(false); applyVolume(); }
  }

  private void fireSleep() {
    if (sleepMode == 0) return;
    if (player != null) player.pause();                         // pause first, THEN restore the volume (so the next play starts at normal volume)
    clearSleep();
    notifySleep(true);
  }

  private void notifySleep(boolean fired) {
    SleepListener l = sleepListener;
    if (l != null) l.onSleep(sleepMode != 0, sleepMode == 2, sleepMode == 1 ? Math.max(0L, sleepEnd - SystemClock.elapsedRealtime()) : 0L, fired);
  }
}
