package com.liquid.flacplayer;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Listening history (statistics). One row per CONTINUOUS stretch of real playback (listen_segments): a pause, a skip, a foreground/background change
 * or a track change closes the row, so durations are exact and a song that crosses midnight can be split by the page. A play = all segments sharing play_id;
 * exactly one of them carries qualified=1 (the one in which the play crossed 10 s or half the song). UNIQUE(play_id, seq) makes duplicate writes impossible.
 * Written by ListenTracker inside PlaybackService (no UI needed), so it keeps counting after the app is swiped away. Heartbeat rows (open=1) are repaired at start-up.
 */
final class ListenDb extends SQLiteOpenHelper {
  static final int VERSION = 2;
  private static ListenDb inst;

  static synchronized ListenDb get(Context c) { if (inst == null) inst = new ListenDb(c.getApplicationContext()); return inst; }
  private ListenDb(Context c) { super(c, "listening.db", null, VERSION); setWriteAheadLoggingEnabled(true); }

  @Override public void onCreate(SQLiteDatabase d) { migrate(d, 0, VERSION); }
  @Override public void onUpgrade(SQLiteDatabase d, int from, int to) { migrate(d, from, to); }
  /** Safe, additive migrations: one block per version, never drops data. */
  private void migrate(SQLiteDatabase d, int from, int to) {
    if (from < 1) {
      d.execSQL("CREATE TABLE IF NOT EXISTS listen_sessions(id TEXT PRIMARY KEY, start_ms INTEGER NOT NULL, end_ms INTEGER NOT NULL)");
      d.execSQL("CREATE TABLE IF NOT EXISTS listen_segments(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, play_id TEXT NOT NULL, seq INTEGER NOT NULL,"
        + " song_id TEXT NOT NULL, title TEXT, artist TEXT, album TEXT, album_artist TEXT, start_ms INTEGER NOT NULL, end_ms INTEGER NOT NULL, dur_ms INTEGER NOT NULL,"
        + " fg INTEGER NOT NULL DEFAULT 0, qualified INTEGER NOT NULL DEFAULT 0, start_pos_ms INTEGER, end_pos_ms INTEGER, track_dur_ms INTEGER, tz_off_min INTEGER NOT NULL DEFAULT 0,"
        + " open INTEGER NOT NULL DEFAULT 0, UNIQUE(play_id, seq))");
      d.execSQL("CREATE INDEX IF NOT EXISTS idx_seg_start ON listen_segments(start_ms)");
      d.execSQL("CREATE INDEX IF NOT EXISTS idx_seg_song ON listen_segments(song_id, start_ms)");
      d.execSQL("CREATE TABLE IF NOT EXISTS listen_events(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, session_id TEXT, type TEXT NOT NULL)");
    }
    if (from < 2) { for (String q : V2_SQL) d.execSQL(q); }   // BUG-226: summary tables, filled from the old rows once, then kept up to date by triggers
  }

  /** BUG-226 (version 2, additive, nothing is dropped): two small summary tables so seen() and days() no longer scan every segment.
   *  listen_days = the distinct local day numbers with at least 1 s of listening; songs_seen = the distinct (song, artist, album, album artist, title) heard, with the start of the first play.
   *  Triggers keep them exact on insert, on the first time a segment gets real duration, and on delete (so a deleted history or a dropped tiny segment is removed again).
   *  tests/listendb-summary.test.mjs runs these exact statements in SQLite and compares them with the old DISTINCT queries. */
  static final String SEEN_SQL = "SELECT song_id, NULLIF(artist,''), NULLIF(album,''), NULLIF(album_artist,''), NULLIF(title,'') FROM songs_seen WHERE first_ms<?";
  static final String DAYS_SQL = "SELECT dn FROM listen_days ORDER BY dn DESC";
  private static final String SEEN_KEY_NEW = "song_id=NEW.song_id AND artist=COALESCE(NEW.artist,'') AND album=COALESCE(NEW.album,'') AND album_artist=COALESCE(NEW.album_artist,'') AND title=COALESCE(NEW.title,'')";
  private static final String SEEN_KEY_OLD = "song_id=OLD.song_id AND artist=COALESCE(OLD.artist,'') AND album=COALESCE(OLD.album,'') AND album_artist=COALESCE(OLD.album_artist,'') AND title=COALESCE(OLD.title,'')";
  private static final String SEEN_ADD = "INSERT OR IGNORE INTO songs_seen VALUES(NEW.song_id, COALESCE(NEW.artist,''), COALESCE(NEW.album,''), COALESCE(NEW.album_artist,''), COALESCE(NEW.title,''), NEW.start_ms);"
    + " UPDATE songs_seen SET first_ms=MIN(first_ms, NEW.start_ms) WHERE " + SEEN_KEY_NEW + ";";
  private static final String DAY_NEW = "((NEW.start_ms/60000 + NEW.tz_off_min)/1440)", DAY_OLD = "((OLD.start_ms/60000 + OLD.tz_off_min)/1440)";
  private static final String[] V2_SQL = {
    "CREATE TABLE IF NOT EXISTS listen_days(dn INTEGER PRIMARY KEY)",
    "CREATE TABLE IF NOT EXISTS songs_seen(song_id TEXT NOT NULL, artist TEXT NOT NULL, album TEXT NOT NULL, album_artist TEXT NOT NULL, title TEXT NOT NULL, first_ms INTEGER NOT NULL, PRIMARY KEY(song_id, artist, album, album_artist, title))",
    "CREATE INDEX IF NOT EXISTS idx_seen_first ON songs_seen(first_ms)",
    "INSERT OR IGNORE INTO listen_days SELECT DISTINCT ((start_ms/60000 + tz_off_min)/1440) FROM listen_segments WHERE dur_ms>=1000",
    "INSERT OR IGNORE INTO songs_seen SELECT song_id, COALESCE(artist,''), COALESCE(album,''), COALESCE(album_artist,''), COALESCE(title,''), MIN(start_ms) FROM listen_segments WHERE dur_ms>0 GROUP BY 1,2,3,4,5",
    "CREATE TRIGGER IF NOT EXISTS lf_days_ins AFTER INSERT ON listen_segments WHEN NEW.dur_ms>=1000 BEGIN INSERT OR IGNORE INTO listen_days VALUES(" + DAY_NEW + "); END",
    "CREATE TRIGGER IF NOT EXISTS lf_days_upd AFTER UPDATE ON listen_segments WHEN NEW.dur_ms>=1000 AND OLD.dur_ms<1000 BEGIN INSERT OR IGNORE INTO listen_days VALUES(" + DAY_NEW + "); END",
    "CREATE TRIGGER IF NOT EXISTS lf_days_del AFTER DELETE ON listen_segments WHEN OLD.dur_ms>=1000 BEGIN DELETE FROM listen_days WHERE dn=" + DAY_OLD + " AND NOT EXISTS (SELECT 1 FROM listen_segments WHERE start_ms BETWEEN (" + DAY_OLD + "*1440-1000)*60000 AND (" + DAY_OLD + "*1440+2500)*60000 AND dur_ms>=1000 AND ((start_ms/60000 + tz_off_min)/1440)=" + DAY_OLD + "); END",
    "CREATE TRIGGER IF NOT EXISTS lf_seen_ins AFTER INSERT ON listen_segments WHEN NEW.dur_ms>0 BEGIN " + SEEN_ADD + " END",
    "CREATE TRIGGER IF NOT EXISTS lf_seen_upd AFTER UPDATE ON listen_segments WHEN NEW.dur_ms>0 AND OLD.dur_ms<=0 BEGIN " + SEEN_ADD + " END",
    "CREATE TRIGGER IF NOT EXISTS lf_seen_del AFTER DELETE ON listen_segments WHEN OLD.dur_ms>0 BEGIN"
      + " UPDATE songs_seen SET first_ms=COALESCE((SELECT MIN(start_ms) FROM listen_segments WHERE song_id=OLD.song_id AND dur_ms>0 AND COALESCE(artist,'')=COALESCE(OLD.artist,'') AND COALESCE(album,'')=COALESCE(OLD.album,'') AND COALESCE(album_artist,'')=COALESCE(OLD.album_artist,'') AND COALESCE(title,'')=COALESCE(OLD.title,'')), -1) WHERE " + SEEN_KEY_OLD + ";"
      + " DELETE FROM songs_seen WHERE " + SEEN_KEY_OLD + " AND first_ms=-1; END"
  };

  /** Segments left open by a killed process / reboot keep their last heartbeat end time: close them. */
  void repairOpen() {
    try {
      SQLiteDatabase d = getWritableDatabase();
      d.execSQL("DELETE FROM listen_segments WHERE open=1 AND dur_ms<500");   // killed before the first save: nothing real to keep
      d.execSQL("UPDATE listen_segments SET open=0 WHERE open=1");
    } catch (Throwable t) { failed("repairOpen", t); }   // BUG-043: logged and counted (this runs on the tracker's background thread, so it must not throw)
  }

  /** BUG-043: write errors of the tracker (main thread, so no exception may escape) are logged and counted instead of vanishing. */
  private static volatile int writeFailures = 0; private static volatile String lastWriteError = "";
  private static void failed(String what, Throwable t) { writeFailures++; lastWriteError = what + ": " + t; android.util.Log.w("ListenDb", "write failed, " + lastWriteError); }
  /** Number of tracker writes that failed since the process started (0 = healthy). */
  static int writeFailures() { return writeFailures; }
  static String lastWriteError() { return lastWriteError; }

  /** BUG-225: true when the segment was written (it is named by play + seq, the UNIQUE key). Runs on the tracker's background thread. */
  boolean insertSegment(String session, String play, int seq, String song, String title, String artist, String album, String albumArtist, long start, long startPos, long trackDur, boolean fg, int tzMin) {
    try {
      SQLiteDatabase d = getWritableDatabase();
      ContentValues v = new ContentValues();
      v.put("session_id", session); v.put("play_id", play); v.put("seq", seq); v.put("song_id", song); v.put("title", title); v.put("artist", artist);
      v.put("album", album); v.put("album_artist", albumArtist); v.put("start_ms", start); v.put("end_ms", start); v.put("dur_ms", 0); v.put("fg", fg ? 1 : 0);
      v.put("start_pos_ms", startPos); v.put("end_pos_ms", startPos); v.put("track_dur_ms", trackDur); v.put("tz_off_min", tzMin); v.put("open", 1);
      d.beginTransaction();
      try {
        long id = d.insertWithOnConflict("listen_segments", null, v, SQLiteDatabase.CONFLICT_IGNORE);
        d.execSQL("INSERT OR IGNORE INTO listen_sessions(id,start_ms,end_ms) VALUES(?,?,?)", new Object[] { session, start, start });
        d.setTransactionSuccessful();
        return id >= 0;
      } finally { d.endTransaction(); }
    } catch (Throwable t) { failed("insertSegment", t); return false; }   // BUG-043: false is the failure value (the tracker retries once)
  }

  /** Heartbeat or close. Rows shorter than 0.5 s are deleted when closing. A failed write is tried a second time (a locked database must not lose the stretch). */
  boolean updateSegment(String play, int seq, long end, long dur, long endPos, boolean qualified, boolean closing, String session) {
    if (play == null) return true;   // BUG-225: the segment is named by (play, seq), the table's UNIQUE key
    for (int attempt = 0; attempt < 2; attempt++) {
      try {
        SQLiteDatabase d = getWritableDatabase();
        d.beginTransaction();
        try {
          boolean found = true;
          if (closing && dur < 500 && !qualified) d.execSQL("DELETE FROM listen_segments WHERE play_id=? AND seq=?", new Object[] { play, seq });
          else {   // v149: say whether a row was really updated, so the tracker can write the whole row when the first insert had failed
            android.database.sqlite.SQLiteStatement st = d.compileStatement("UPDATE listen_segments SET end_ms=?, dur_ms=?, end_pos_ms=?, qualified=?, open=? WHERE play_id=? AND seq=?");
            try { st.bindLong(1, end); st.bindLong(2, dur); st.bindLong(3, endPos); st.bindLong(4, qualified ? 1 : 0); st.bindLong(5, closing ? 0 : 1); st.bindString(6, play); st.bindLong(7, seq); found = st.executeUpdateDelete() > 0; }
            finally { st.close(); }
          }
          if (found) d.execSQL("UPDATE listen_sessions SET end_ms=? WHERE id=? AND end_ms<?", new Object[] { end, session, end });
          d.setTransactionSuccessful();
          return found;
        } finally { d.endTransaction(); }
      } catch (Throwable t) {
        if (attempt == 1) failed("updateSegment", t);   // BUG-043: the second failure is logged and counted
        if (attempt == 0) { try { Thread.sleep(60); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); return true; } }   // BUG-44: short pause before the second try (a locked database)
      }
    }
    return true;   // an error is not "row missing": the caller must not insert a second row on top of an unknown state
  }

  void event(long ts, String session, String type) {
    try {
      SQLiteDatabase d = getWritableDatabase();
      d.execSQL("INSERT INTO listen_events(ts,session_id,type) VALUES(?,?,?)", new Object[] { ts, session, type });
      d.execSQL("DELETE FROM listen_events WHERE id < (SELECT MAX(id) FROM listen_events) - 5000");
    } catch (Throwable t) { failed("event", t); }
  }

  /** Segments overlapping [from, to): compact keys for the page. */
  JSONArray query(long from, long to) {
    JSONArray out = new JSONArray();
    try (Cursor c = getReadableDatabase().rawQuery("SELECT song_id,title,artist,album,album_artist,start_ms,dur_ms,fg,qualified,session_id,play_id,start_pos_ms,end_pos_ms,seq,tz_off_min,track_dur_ms FROM listen_segments"
        + " WHERE start_ms<? AND start_ms>? AND end_ms>? AND dur_ms>0 ORDER BY start_ms", new String[] { String.valueOf(to), String.valueOf(from - 86400000L), String.valueOf(from) })) {
      while (c.moveToNext()) {
        JSONObject o = new JSONObject();
        o.put("i", c.getString(0)); o.put("t", c.getString(1)); o.put("a", c.getString(2)); o.put("al", c.getString(3)); o.put("aa", c.getString(4));
        o.put("s", c.getLong(5)); o.put("d", c.getLong(6)); o.put("f", c.getInt(7)); o.put("q", c.getInt(8)); o.put("sid", c.getString(9)); o.put("pid", c.getString(10));
        o.put("p0", c.getLong(11)); o.put("p1", c.getLong(12)); o.put("n", c.getInt(13)); o.put("tz", c.getInt(14)); o.put("l", c.getLong(15));   // BUG-290: the song length (ms) of the play, so exports can carry it
        out.put(o);
      }
    } catch (Throwable t) { throw new RuntimeException("history database: " + t, t); }   // BUG-43: a database failure is no longer an empty result
    return out;
  }

  /** Distinct songs heard before `before` (ms): used to tell new discoveries from songs already known. */
  JSONArray seen(long before) {
    JSONArray out = new JSONArray();
    try (Cursor c = getReadableDatabase().rawQuery(SEEN_SQL, new String[] { String.valueOf(before) })) {
      while (c.moveToNext()) { JSONObject o = new JSONObject(); o.put("i", c.getString(0)); o.put("a", c.getString(1)); o.put("al", c.getString(2)); o.put("aa", c.getString(3)); o.put("t", c.getString(4)); out.put(o); }
    } catch (Throwable t) { throw new RuntimeException("history database: " + t, t); }   // BUG-43: a database failure is no longer an empty result
    return out;
  }

  /** Distinct local day numbers (days since 1970 in the phone's zone at listening time) with at least 1 s of listening, newest first. */
  JSONArray days() {
    JSONArray out = new JSONArray();
    try (Cursor c = getReadableDatabase().rawQuery(DAYS_SQL, null)) {
      while (c.moveToNext()) out.put(c.getLong(0));
    } catch (Throwable t) { throw new RuntimeException("history database: " + t, t); }   // BUG-43: a database failure is no longer an empty result
    return out;
  }

  /**
   * Backup / transfer: inserts finished segments (rows made by src/listenio.js: i,t,a,al,aa,s,d,f,q,sid,pid,n,p0,p1,dur,tz). UNIQUE(play_id, seq) makes it safe to import the same file twice:
   * a row the database already has is ignored. Returns the rows that were really added as [{ i, s, q }] (the page uses them for Recently / Most Played).
   */
  JSONArray importRows(JSONArray rows) {
    JSONArray added = new JSONArray();
    try {
      SQLiteDatabase d = getWritableDatabase(); d.beginTransaction();
      try {
        for (int k = 0; k < rows.length(); k++) {
          JSONObject r = rows.optJSONObject(k); if (r == null) continue;
          long s = r.optLong("s", 0), dur = r.optLong("d", 0); String sid = r.optString("sid", ""), pid = r.optString("pid", ""), song = r.optString("i", "");
          if (s <= 0 || dur <= 0 || sid.isEmpty() || pid.isEmpty() || song.isEmpty()) continue;
          ContentValues v = new ContentValues();
          v.put("session_id", sid); v.put("play_id", pid); v.put("seq", r.optInt("n", 0)); v.put("song_id", song);
          v.put("title", r.optString("t", "")); v.put("artist", r.optString("a", "")); v.put("album", r.optString("al", "")); v.put("album_artist", r.optString("aa", ""));
          v.put("start_ms", s); v.put("end_ms", s + dur); v.put("dur_ms", dur); v.put("fg", r.optInt("f", 0)); v.put("qualified", r.optInt("q", 0));
          v.put("start_pos_ms", r.optLong("p0", 0)); v.put("end_pos_ms", r.optLong("p1", 0)); v.put("track_dur_ms", r.optLong("dur", 0)); v.put("tz_off_min", r.optInt("tz", 0)); v.put("open", 0);
          long id = d.insertWithOnConflict("listen_segments", null, v, SQLiteDatabase.CONFLICT_IGNORE);
          if (id < 0) continue;
          d.execSQL("INSERT OR IGNORE INTO listen_sessions(id,start_ms,end_ms) VALUES(?,?,?)", new Object[] { sid, s, s + dur });
          d.execSQL("UPDATE listen_sessions SET start_ms=MIN(start_ms,?), end_ms=MAX(end_ms,?) WHERE id=?", new Object[] { s, s + dur, sid });
          JSONObject a = new JSONObject(); a.put("i", song); a.put("s", s); a.put("q", r.optInt("q", 0)); added.put(a);
        }
        d.setTransactionSuccessful();
      } finally { d.endTransaction(); }
    } catch (Throwable t) { throw new RuntimeException("history database: " + t, t); }   // BUG-43: a database failure is no longer an empty result
    return added;
  }

  /** Deletes history. Everything null = whole history. from/to (ms) = segments that STARTED in [from,to). ids = only those songs. Sessions without segments and old events are cleaned too. */
  int clear(Long from, Long to, java.util.List<String> ids) {
    int n = 0;
    try {
      SQLiteDatabase d = getWritableDatabase(); d.beginTransaction();
      try {
        String w = ""; java.util.ArrayList<String> a = new java.util.ArrayList<>();
        if (from != null) { w += " AND start_ms>=?"; a.add(String.valueOf(from)); }
        if (to != null) { w += " AND start_ms<?"; a.add(String.valueOf(to)); }
        if (ids == null) n += d.delete("listen_segments", w.isEmpty() ? null : w.substring(5), a.toArray(new String[0]));
        else for (int i = 0; i < ids.size(); i += 400) {
          java.util.List<String> part = ids.subList(i, Math.min(ids.size(), i + 400)); StringBuilder q = new StringBuilder("song_id IN (");
          java.util.ArrayList<String> args = new java.util.ArrayList<>(part); for (int k = 0; k < part.size(); k++) q.append(k > 0 ? ",?" : "?"); q.append(")").append(w); args.addAll(a);
          n += d.delete("listen_segments", q.toString(), args.toArray(new String[0]));
        }
        d.execSQL("DELETE FROM listen_sessions WHERE id NOT IN (SELECT DISTINCT session_id FROM listen_segments)");
        if (from == null && to == null && ids == null) d.execSQL("DELETE FROM listen_events");
        d.setTransactionSuccessful();
      } finally { d.endTransaction(); }
    } catch (Throwable t) { throw new RuntimeException("history database: " + t, t); }   // BUG-43: a database failure is no longer an empty result
    return n;
  }
}
