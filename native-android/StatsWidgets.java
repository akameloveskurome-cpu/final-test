package com.liquid.flacplayer;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Handler;
import android.os.Looper;
import android.widget.RemoteViews;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.text.Normalizer;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Listening-statistics home screen widgets: Today (small), This week and This month (wide), Everything (large: today / week / month / all time, streak, top song / artist / album,
 * solar-vs-lunar split and a last-7-days chart). They read the listening database (ListenDb) directly, so the numbers are the same as the Listening Stats screen
 * (same rules: time is clipped to the period, a play is counted in the period where its qualified segment started, day = 06:00-17:59, night = 18:00-05:59, local time)
 * and they stay right while the app is closed. Redrawn when playback stops / changes (ListenTracker), after Clear data, by Android about every 30 minutes, and by one alarm just after local midnight (v148) so "Today" rolls over on time.
 * A tap opens the Listening Stats screen.
 * v148: Daily (large): today hour by hour (24 bars, this hour in red), time listened with the change against yesterday, songs / unique songs / artists, top artist and song, day / night split.
 */
public class StatsWidgets {
  static final Class<?>[] ALL = { Day.class, Week.class, Month.class, All.class, Daily.class };   // the index in ALL is the kind
  static final int K_DAY = 0, K_WEEK = 1, K_MONTH = 2, K_ALL = 3, K_DAILY = 4;
  private static final long DAY_MS = 86_400_000L;
  private static long lastRefresh = 0;
  private static boolean trailing = false;   // a delayed redraw is already waiting
  private static final Handler MAIN = new Handler(Looper.getMainLooper());

  /** Numbers for one period [from, to). */
  static final class St {
    long total, dayMs, nightMs; int plays; final Set<String> songs = new HashSet<>(), artists = new HashSet<>(), albums = new HashSet<>();
    final long[] perDay = new long[7]; final long[] hours = new long[24];
    final Map<String, long[]> songAgg = new HashMap<>(), artistAgg = new HashMap<>(), albumAgg = new HashMap<>(); final Map<String, String> names = new HashMap<>();
    int solar() { return total <= 0 ? 0 : (int) Math.round(dayMs * 100.0 / total); }
  }


  // v148: the same artist rules as src/artistnames.js, so the widgets name the same top artist as the app: "A; B", "A feat. B", "A (feat. B)", "feat." names inside the song title, then the album artist.
  // v159: the library rule too: the app sends its known artists (setKnown), so "A, B" / "A & B" split only when one piece is a known artist, like in the app.
  private static final Pattern STRONG = Pattern.compile("\\s*;\\s*|\\s+(?:feat\\.?|ft\\.?|featuring)\\s+", Pattern.CASE_INSENSITIVE);
  private static final Pattern FEAT_OPEN = Pattern.compile("\\s*[(\\[]\\s*(?:feat\\.?|ft\\.?|featuring)\\s+", Pattern.CASE_INSENSITIVE);
  private static final Pattern FEAT_TITLE = Pattern.compile("[(\\[]\\s*(?:feat\\.?|ft\\.?|featuring)\\s+([^)\\]]+)[)\\]]", Pattern.CASE_INSENSITIVE);
  private static final Pattern WEAK = Pattern.compile("\\s*,\\s*|\\s+&\\s+|\\s+and\\s+|\\s+/\\s+|\\s+(?:with|vs\\.?)\\s+|\\s+(?:x|\u00d7)\\s+", Pattern.CASE_INSENSITIVE);
  private static void addArtist(Map<String, String> out, String n) {
    if (n == null) return; n = n.replaceAll("\\s+", " ").trim();
    if (n.isEmpty() || n.equalsIgnoreCase("Unknown Artist")) return;
    String k = keyOf(n); if (k == null || k.isEmpty()) k = n.toLowerCase(Locale.ROOT); if (!out.containsKey(k)) out.put(k, n);   // BUG #23: de-duplicate by the same smart key compute() counts by (JS songArtists does the same)
  }
  // v159: the known artists the app sends (src/data.js widgetArtists): the grouping mode, the names that are certainly ONE artist, and the acts that are never split.
  private static final Pattern VARIOUS = Pattern.compile("^(various artists?|various|va|v\\.a\\.|unknown artist)$", Pattern.CASE_INSENSITIVE);
  private static final Pattern MARKS = Pattern.compile("[\u0300-\u036f]+");
  private static final Pattern LEAD_THE = Pattern.compile("^\\s*the\\s+");
  private static final Pattern LETTER_OR_DIGIT = Pattern.compile("[\\p{L}\\p{N}]");
  private static final Pattern NOT_KEY_CHAR = Pattern.compile("[^\\p{L}\\p{M}\\p{N}]+");
  private static final Pattern CLOSE_BRACKET = Pattern.compile("[)\\]]\\s*$");
  private static String knownRaw = null;
  private static boolean knownSmart = true;
  private static Set<String> knownKeys = new HashSet<>(), knownProtect = new HashSet<>();

  /** Same as artistKey() in src/artistnames.js (smart grouping). */
  static String artistKey(String name) {
    String s = name == null ? "" : name;
    String t = MARKS.matcher(Normalizer.normalize(s, Normalizer.Form.NFD)).replaceAll("");
    t = Normalizer.normalize(t, Normalizer.Form.NFC).toLowerCase(Locale.ROOT).replace("$", "s").replace("&", " and ");
    String noThe = LEAD_THE.matcher(t).replaceFirst("");
    if (LETTER_OR_DIGIT.matcher(noThe).find()) t = noThe;
    String k = NOT_KEY_CHAR.matcher(t).replaceAll("");
    return k.isEmpty() ? s.trim().toLowerCase(Locale.ROOT) : k;
  }
  static String keyOf(String n) { return knownSmart ? artistKey(n) : n.trim().toLowerCase(Locale.ROOT); }

  /** The app's known-artist set, read once per change of the saved text. */
  private static synchronized void loadKnown(Context c) {
    try {
      String raw = c.getSharedPreferences("liquid", Context.MODE_PRIVATE).getString("wKnown", "");
      if (raw.equals(knownRaw)) return;
      Set<String> keys = new HashSet<>(), prot = new HashSet<>(); boolean smart = true;
      if (!raw.isEmpty()) {
        JSONObject o = new JSONObject(raw); smart = o.optBoolean("smart", true);
        JSONArray a = o.optJSONArray("known"); if (a != null) for (int i = 0; i < a.length(); i++) keys.add(a.optString(i, ""));
        JSONArray p = o.optJSONArray("protect"); if (p != null) for (int i = 0; i < p.length(); i++) prot.add(p.optString(i, ""));
      }
      knownKeys = keys; knownProtect = prot; knownSmart = smart; knownRaw = raw;
    } catch (Throwable ignored) { }
  }
  /** Called by LiquidNative.setWidgetArtists with the app's { smart, known, protect }. */
  static void setKnown(Context c, JSONObject data) {
    try {
      c.getSharedPreferences("liquid", Context.MODE_PRIVATE).edit().putString("wKnown", data == null ? "" : data.toString()).apply();
      knownRaw = null; loadKnown(c); refresh(c);
    } catch (Throwable ignored) { }
  }
  /** Port of splitArtists() in src/artistnames.js: a part is split on "," "&" "and" only when one of its pieces is a known artist. */
  static List<String> splitKnown(String raw) {
    List<String> out = new ArrayList<>();
    String s = (FEAT_OPEN.matcher(raw).find() ? CLOSE_BRACKET.matcher(FEAT_OPEN.matcher(raw).replaceAll(" feat. ")).replaceAll("") : raw).trim();   // BUG #22: strip the closing bracket only after a "(feat." opener was replaced (as artistnames.js)
    if (s.isEmpty() || s.equalsIgnoreCase("unknown artist")) return out;
    for (String part : STRONG.split(s)) {
      if (part.trim().isEmpty()) continue;
      List<String> pieces = new ArrayList<>();
      for (String p : WEAK.split(part.trim())) if (!p.trim().isEmpty()) pieces.add(p.trim());
      int known = 0; for (String p : pieces) if (knownKeys.contains(keyOf(p))) known++;
      boolean protectedAct = knownSmart && knownProtect.contains(artistKey(part));
      if (pieces.size() > 1 && !knownKeys.contains(keyOf(part)) && !protectedAct && known > 0 && known * 2 >= pieces.size()) out.addAll(pieces);
      else out.add(part);
    }
    return out;
  }

  static List<String> artistsOf(Context c, String artist, String title, String albumArtist) {
    loadKnown(c);
    Map<String, String> out = new LinkedHashMap<>();
    if (artist != null) {
      String s = (FEAT_OPEN.matcher(artist).find() ? CLOSE_BRACKET.matcher(FEAT_OPEN.matcher(artist).replaceAll(" feat. ")).replaceAll("") : artist).trim();   // BUG #22
      if (!s.isEmpty() && !s.equalsIgnoreCase("Unknown Artist")) for (String part : splitKnown(s)) addArtist(out, part);
    }
    if (title != null) { Matcher m = FEAT_TITLE.matcher(title); while (m.find()) for (String n : WEAK.split(m.group(1))) addArtist(out, n); }
    if (albumArtist != null && knownSmart) { if (!VARIOUS.matcher(albumArtist.trim()).matches()) for (String n : splitKnown(albumArtist)) addArtist(out, n); }
    else addArtist(out, albumArtist);
    return new ArrayList<>(out.values());
  }

  static long startOfDay(Calendar c) { c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0); return c.getTimeInMillis(); }
  /** { from, to } of the local day / Monday-to-Sunday week / calendar month containing now. */
  static long[] range(int kind) {
    Calendar c = Calendar.getInstance(); long from = startOfDay(c), to;
    if (kind == K_DAY) { c.add(Calendar.DAY_OF_MONTH, 1); to = c.getTimeInMillis(); }
    else if (kind == K_WEEK) { c.add(Calendar.DAY_OF_MONTH, -((c.get(Calendar.DAY_OF_WEEK) + 5) % 7)); from = c.getTimeInMillis(); c.add(Calendar.DAY_OF_MONTH, 7); to = c.getTimeInMillis(); }
    else { c.set(Calendar.DAY_OF_MONTH, 1); from = c.getTimeInMillis(); c.add(Calendar.MONTH, 1); to = c.getTimeInMillis(); }
    return new long[] { from, to };
  }

  private static void bump(Map<String, long[]> m, String k, long ms, int q) { long[] e = m.get(k); if (e == null) { e = new long[2]; m.put(k, e); } e[0] += q; e[1] += ms; }
  private static String best(St s, Map<String, long[]> m, String prefix) {
    String bk = null; long[] bv = null;
    for (Map.Entry<String, long[]> e : m.entrySet()) { long[] v = e.getValue(); if (bv == null || v[0] > bv[0] || (v[0] == bv[0] && v[1] > bv[1])) { bk = e.getKey(); bv = v; } }
    if (bk == null) return null; String n = s.names.get(prefix + bk); return n == null || n.isEmpty() ? null : n;
  }

  /** Same maths as listenstats.js aggregate(): clip to the range, split at local hours, qualified play counted where it started. weekStart != 0 also fills perDay (7 days from that midnight). */
  static St compute(Context c, long from, long to, long weekStart) {
    St s = new St();
    long[] ds = new long[8];
    if (weekStart != 0) { Calendar d = Calendar.getInstance(); d.setTimeInMillis(weekStart); for (int i = 0; i < 8; i++) { ds[i] = d.getTimeInMillis(); d.add(Calendar.DAY_OF_MONTH, 1); } }
    try (Cursor q = ListenDb.get(c).getReadableDatabase().rawQuery("SELECT song_id,title,artist,album,start_ms,dur_ms,qualified,album_artist FROM listen_segments WHERE start_ms<? AND start_ms>? AND dur_ms>0 ORDER BY start_ms",
        new String[] { String.valueOf(to), String.valueOf(from - DAY_MS) })) {
      Calendar cal = Calendar.getInstance();
      while (q.moveToNext()) {
        long st = q.getLong(4), dur = q.getLong(5), s0 = Math.max(st, from), e0 = Math.min(st + dur, to); if (e0 <= s0) continue;
        long ms = e0 - s0; int qual = q.getInt(6) == 1 && st >= from && st < to ? 1 : 0;
        s.total += ms; s.plays += qual;
        long cur = s0;
        while (cur < e0) {
          cal.setTimeInMillis(cur); int h = cal.get(Calendar.HOUR_OF_DAY); cal.set(Calendar.MINUTE, 0); cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0); cal.add(Calendar.HOUR_OF_DAY, 1);
          long end = Math.min(e0, Math.max(cal.getTimeInMillis(), cur + 1)), x = end - cur;
          s.hours[h] += x; if (h >= 6 && h < 18) s.dayMs += x; else s.nightMs += x;
          if (weekStart != 0) for (int i = 0; i < 7; i++) if (cur >= ds[i] && cur < ds[i + 1]) { s.perDay[i] += x; break; }
          cur = end;
        }
        String id = q.getString(0), title = q.getString(1), artist = q.getString(2), album = q.getString(3);
        s.songs.add(id); bump(s.songAgg, id, ms, qual); s.names.put("s" + id, title == null ? "" : title);
        for (String a : artistsOf(c, artist, title, q.getString(7))) { String k = keyOf(a); if (k == null || k.isEmpty()) k = a.toLowerCase(Locale.ROOT); s.artists.add(k); bump(s.artistAgg, k, ms, qual); if (!s.names.containsKey("a" + k)) s.names.put("a" + k, a); }   // BUG-184: the artist key is the same smart key as the app ("The Weeknd" = "Weeknd", "Beyonce" = "Beyoncé"); the first spelling is the one shown
        if (album != null && !album.trim().isEmpty() && !album.equalsIgnoreCase("Unknown Album")) { String aaRaw = q.getString(7), who = aaRaw != null && !aaRaw.trim().isEmpty() ? aaRaw : artist, wk = who == null ? "" : keyOf(who.trim()); if (wk == null || wk.isEmpty()) wk = who == null ? "" : who.trim().toLowerCase(Locale.ROOT); String k = wk + "|" + album.trim().toLowerCase(Locale.ROOT); s.albums.add(k); bump(s.albumAgg, k, ms, qual); s.names.put("l" + k, album.trim()); }   // BUG-184/115: albums are keyed by album artist (smart key) + title, so two albums with the same title by different artists stay separate
      }
    } catch (Throwable ignored) { }
    return s;
  }

  /** Current day streak (consecutive days with music, ending today or yesterday), like the app. */
  static int streak(Context c) {
    try {
      JSONArray a = ListenDb.get(c).days(); Set<Long> set = new HashSet<>(); for (int i = 0; i < a.length(); i++) set.add(a.getLong(i));
      long now = System.currentTimeMillis(), today = Math.floorDiv(now / 60000 + java.util.TimeZone.getDefault().getOffset(now) / 60000, 1440L), d = set.contains(today) ? today : today - 1; int n = 0;
      while (set.contains(d)) { n++; d--; } return n;
    } catch (Throwable t) { return 0; }
  }

  static String dur(long ms) { long s = Math.round(ms / 1000.0); if (s < 60) return s + " s"; long m = Math.round(s / 60.0); if (m < 60) return m + " min"; return (m / 60) + " h " + String.format(Locale.US, "%02d", m % 60) + " min"; }
  static String shortDur(long ms) { long m = Math.round(ms / 60000.0); if (m < 1) return Math.round(ms / 1000.0) + "s"; if (m < 60) return m + "m"; return (m / 60) + "h " + String.format(Locale.US, "%02d", m % 60) + "m"; }
  static String nz(String s, String d) { return s == null || s.isEmpty() ? d : s; }
  static String dn(St s) { return s.total <= 0 ? "No listening yet" : "Day " + s.solar() + "% · Night " + (100 - s.solar()) + "%"; }

  /** Last-7-days bars (today in red, the others soft red), drawn into a bitmap because a widget cannot draw. */
  static Bitmap bars(long[] v, int todayIdx) {
    int w = 640, h = 150; Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888); Canvas g = new Canvas(b);
    long mx = 1; for (long x : v) mx = Math.max(mx, x);
    Paint p = new Paint(Paint.ANTI_ALIAS_FLAG), t = new Paint(Paint.ANTI_ALIAS_FLAG); t.setColor(0xB3FFFFFF); t.setTextSize(26); t.setTextAlign(Paint.Align.CENTER);
    String[] L = { "M", "T", "W", "T", "F", "S", "S" }; float cw = w / 7f, bw = cw * 0.52f, top = 6, bot = h - 34;
    for (int i = 0; i < 7; i++) {
      float bh = v[i] <= 0 ? 0 : Math.max(8, (bot - top) * v[i] / mx), x = i * cw + (cw - bw) / 2;
      p.setColor(i == todayIdx ? 0xFFFA243C : 0x66FA243C); if (bh > 0) g.drawRoundRect(new RectF(x, bot - bh, x + bw, bot), 8, 8, p);
      else { p.setColor(0x22FFFFFF); g.drawRoundRect(new RectF(x, bot - 6, x + bw, bot), 3, 3, p); }
      g.drawText(L[i], i * cw + cw / 2, h - 6, t);
    }
    return b;
  }

  /** v148: today's 24 hours as bars (this hour in red, the other hours with music soft red, empty hours a thin line), labelled 0 / 6 / 12 / 18. */
  static Bitmap hourBars(long[] v, int nowHour) {
    int w = 720, h = 150; Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888); Canvas g = new Canvas(b);
    long mx = 1; for (long x : v) mx = Math.max(mx, x);
    Paint p = new Paint(Paint.ANTI_ALIAS_FLAG), t = new Paint(Paint.ANTI_ALIAS_FLAG); t.setColor(0xB3FFFFFF); t.setTextSize(24); t.setTextAlign(Paint.Align.CENTER);
    float cw = w / 24f, bw = cw * 0.62f, top = 6, bot = h - 32;
    for (int i = 0; i < 24; i++) {
      float x = i * cw + (cw - bw) / 2, bh = v[i] <= 0 ? 0 : Math.max(6, (bot - top) * v[i] / mx);
      if (bh > 0) { p.setColor(i == nowHour ? 0xFFFA243C : 0x80FA243C); g.drawRoundRect(new RectF(x, bot - bh, x + bw, bot), 5, 5, p); }
      else { p.setColor(i == nowHour ? 0x66FA243C : 0x22FFFFFF); g.drawRoundRect(new RectF(x, bot - 4, x + bw, bot), 2, 2, p); }
      if (i % 6 == 0) g.drawText(String.valueOf(i), i * cw + cw / 2, h - 6, t);
    }
    return b;
  }

  /** "+12 min vs yesterday" / "-5 min vs yesterday" / "Same as yesterday". Differences under 30 s count as the same. */
  static String vsYesterday(long today, long yesterday) {
    if (yesterday <= 0) return today <= 0 ? "No listening yesterday either" : "Nothing listened yesterday";
    long d = today - yesterday; if (Math.abs(d) < 30_000) return "Same as yesterday";
    return (d > 0 ? "+" : "-") + dur(Math.abs(d)) + " vs yesterday";
  }

  private static RemoteViews daily(Context c) {
    long[] r = range(K_DAY); St s = compute(c, r[0], r[1], 0);
    Calendar y = Calendar.getInstance(); y.add(Calendar.DAY_OF_MONTH, -1); long yFrom = startOfDay(y);
    St ys = compute(c, yFrom, Math.min(r[0], yFrom + Math.max(0L, System.currentTimeMillis() - r[0])), 0);   // BUG-127: yesterday up to the same time of day
    RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.lf_stats_daily);
    v.setTextViewText(R.id.lfs_head, "Listening \u00b7 " + new java.text.SimpleDateFormat("EEE d MMM", Locale.getDefault()).format(new java.util.Date()));
    v.setTextViewText(R.id.lfs_big, s.total <= 0 ? "0 min today" : dur(s.total) + " today");
    v.setTextViewText(R.id.lfs_vs, vsYesterday(s.total, ys.total));
    v.setTextViewText(R.id.lfs_a, String.valueOf(s.plays)); v.setTextViewText(R.id.lfs_b, String.valueOf(s.songs.size())); v.setTextViewText(R.id.lfs_c, String.valueOf(s.artists.size()));
    v.setImageViewBitmap(R.id.lfs_chart, hourBars(s.hours, Calendar.getInstance().get(Calendar.HOUR_OF_DAY)));
    v.setTextViewText(R.id.lfs_t1, s.total <= 0 ? "Play a song to start" : "Top artist: " + nz(best(s, s.artistAgg, "a"), "\u2013"));
    v.setTextViewText(R.id.lfs_t2, s.total <= 0 ? "" : "Top song: " + nz(best(s, s.songAgg, "s"), "\u2013"));
    v.setProgressBar(R.id.lfs_bar, 100, s.solar(), false); v.setTextViewText(R.id.lfs_dn, dn(s));
    return v;
  }

  static RemoteViews build(Context c, int kind) {
    RemoteViews v;
    if (kind == K_ALL) v = big(c); else if (kind == K_DAY) v = small(c); else if (kind == K_DAILY) v = daily(c); else v = wide(c, kind);
    v.setOnClickPendingIntent(R.id.lfs_root, LiquidTiles.open(c, "lstats", 21 + kind));
    return v;
  }

  private static RemoteViews small(Context c) {
    long[] r = range(K_DAY); St s = compute(c, r[0], r[1], 0);
    RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.lf_stats_sm);
    v.setTextViewText(R.id.lfs_head, "Listening · Today");
    v.setTextViewText(R.id.lfs_big, s.total <= 0 ? "0 min" : dur(s.total));
    v.setTextViewText(R.id.lfs_sub, s.plays + (s.plays == 1 ? " song played" : " songs played"));
    v.setProgressBar(R.id.lfs_bar, 100, s.solar(), false); v.setTextViewText(R.id.lfs_dn, dn(s));
    v.setTextViewText(R.id.lfs_top, s.total <= 0 ? "Play a song to start" : nz(best(s, s.artistAgg, "a"), nz(best(s, s.songAgg, "s"), "")));
    return v;
  }

  private static RemoteViews wide(Context c, int kind) {
    long[] r = range(kind); St s = compute(c, r[0], r[1], 0);
    RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.lf_stats);
    v.setTextViewText(R.id.lfs_head, kind == K_WEEK ? "Listening · This week" : "Listening · This month");
    v.setTextViewText(R.id.lfs_a, s.total <= 0 ? "0 min" : dur(s.total)); v.setTextViewText(R.id.lfs_al, "listening");
    v.setTextViewText(R.id.lfs_b, String.valueOf(s.plays)); v.setTextViewText(R.id.lfs_bl, "songs played");
    v.setTextViewText(R.id.lfs_c, String.valueOf(s.songs.size())); v.setTextViewText(R.id.lfs_cl, "unique songs");
    v.setTextViewText(R.id.lfs_top, s.total <= 0 ? "Nothing listened to yet. Play a song to start." : "Top artist: " + nz(best(s, s.artistAgg, "a"), "–") + "\nTop song: " + nz(best(s, s.songAgg, "s"), "–"));
    v.setProgressBar(R.id.lfs_bar, 100, s.solar(), false); v.setTextViewText(R.id.lfs_dn, dn(s));
    return v;
  }

  private static RemoteViews big(Context c) {
    long[] d = range(K_DAY), w = range(K_WEEK), m = range(K_MONTH);
    St day = compute(c, d[0], d[1], 0), week = compute(c, w[0], w[1], w[0]), month = compute(c, m[0], m[1], 0), all = allTime(c);
    RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.lf_stats_big);
    v.setTextViewText(R.id.lfs_head, "Listening stats");
    v.setTextViewText(R.id.lfs_a, shortDur(day.total)); v.setTextViewText(R.id.lfs_b, shortDur(week.total)); v.setTextViewText(R.id.lfs_c, shortDur(month.total)); v.setTextViewText(R.id.lfs_d, shortDur(all.total));
    v.setTextViewText(R.id.lfs_e, String.valueOf(all.plays)); v.setTextViewText(R.id.lfs_f, String.valueOf(all.songs.size())); int sk = streak(c); v.setTextViewText(R.id.lfs_g, sk + (sk == 1 ? " day" : " days"));
    Calendar t = Calendar.getInstance(); int today = (t.get(Calendar.DAY_OF_WEEK) + 5) % 7;
    v.setImageViewBitmap(R.id.lfs_chart, bars(week.perDay, today));
    v.setTextViewText(R.id.lfs_t1, all.total <= 0 ? "Play a song to start" : "Top song: " + nz(best(all, all.songAgg, "s"), "–"));
    v.setTextViewText(R.id.lfs_t2, all.total <= 0 ? "" : "Top artist: " + nz(best(all, all.artistAgg, "a"), "–"));
    v.setTextViewText(R.id.lfs_t3, all.total <= 0 ? "" : "Top album: " + nz(best(all, all.albumAgg, "l"), "–"));
    v.setProgressBar(R.id.lfs_bar, 100, all.solar(), false); v.setTextViewText(R.id.lfs_dn, "Overall · " + dn(all));
    return v;
  }

  private static final Object REDRAW = new Object();   // BUG-116: redraws never run side by side, so an older slow redraw cannot finish last
  static void update(Context c, AppWidgetManager m, int[] ids, int kind) {
    synchronized (REDRAW) {
      RemoteViews rv = null; try { rv = build(c, kind); } catch (Throwable ignored) { }   // built once per kind, not once per widget copy
      if (rv == null) return;
      for (int id : ids) { try { m.updateAppWidget(id, rv); } catch (Throwable ignored) { } }
    }
  }

  /** Redraws every stats widget on the home screen (background thread, at most once per 4 s). A call inside that 4 s is not dropped: one redraw is scheduled for when the pause is over, so the widget always ends on the latest numbers. Safe to call from anywhere. */
  /** BUG-186: the all-time totals read the whole history, so they are kept for a minute (and dropped on every refresh) instead of being rebuilt on each redraw. */
  private static St allCache; private static long allCacheAt;
  private static synchronized St allTime(Context c) {
    long now = System.currentTimeMillis();
    if (allCache == null || now - allCacheAt >= 60_000L) { allCache = compute(c, 0, now + DAY_MS, 0); allCacheAt = now; }
    return allCache;
  }

  static void refresh(final Context ctx) {
    synchronized (StatsWidgets.class) { allCache = null; }   // BUG-186: a refresh (new plays, cleared data, a new day) always recounts
    final Context c = ctx.getApplicationContext();
    synchronized (StatsWidgets.class) {
      long now = System.currentTimeMillis(), wait = 4000 - (now - lastRefresh);
      if (wait > 0) {
        if (!trailing) { trailing = true; MAIN.postDelayed(() -> { synchronized (StatsWidgets.class) { trailing = false; } refresh(c); }, wait + 50); }
        return;
      }
      lastRefresh = now;
    }
    new Thread(() -> updateAll(c), "lf-stats-widgets").start();
  }

  /** Redraws every stats widget now, on the calling thread (no throttle). Returns true when at least one is on the home screen. */
  static boolean updateAll(Context c) {
    boolean any = false;
    try {
      AppWidgetManager m = AppWidgetManager.getInstance(c);
      for (int k = 0; k < ALL.length; k++) { int[] ids = m.getAppWidgetIds(new ComponentName(c, ALL[k])); if (ids != null && ids.length > 0) { any = true; update(c, m, ids, k); } }
    } catch (Throwable ignored) { }
    return any;
  }

  static final String ACTION_MIDNIGHT = "com.liquid.flacplayer.STATS_MIDNIGHT";
  /** v148: one alarm just after the next local midnight, so "Today" / "This week" / "This month" roll over on time instead of waiting for Android's ~30 minute widget timer. Not exact and not a wake-up alarm: it costs no battery and fires when the phone is next awake. */
  static void scheduleMidnight(Context c) {
    try {
      AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE); if (am == null) return;
      Calendar t = Calendar.getInstance(); t.add(Calendar.DAY_OF_MONTH, 1); long at = startOfDay(t) + 5000;
      Intent i = new Intent(c, Day.class).setAction(ACTION_MIDNIGHT);
      PendingIntent pi = PendingIntent.getBroadcast(c, 31, i, PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
      am.set(AlarmManager.RTC, at, pi);   // same PendingIntent: replaces the earlier alarm
    } catch (Throwable ignored) { }
  }

  abstract static class Base extends AppWidgetProvider {
    abstract int kind();
    @Override public void onUpdate(final Context c, final AppWidgetManager m, final int[] ids) {
      final PendingResult pr = goAsync();   // the database read can take a moment: finish off the main thread
      new Thread(() -> { try { update(c, m, ids, kind()); scheduleMidnight(c); } finally { if (pr != null) pr.finish(); } }, "lf-stats-widget").start();
    }
    // v148: resizing a widget used to read the whole history on the main thread (the Everything widget scans all of it): now off the main thread like onUpdate.
    @Override public void onAppWidgetOptionsChanged(final Context c, final AppWidgetManager m, final int id, android.os.Bundle o) {
      final PendingResult pr = goAsync();
      new Thread(() -> { try { update(c, m, new int[] { id }, kind()); } finally { if (pr != null) pr.finish(); } }, "lf-stats-widget").start();
    }
    @Override public void onEnabled(Context c) { scheduleMidnight(c); }
    @Override public void onReceive(final Context c, Intent i) {
      String act = i == null ? null : i.getAction();   // midnight alarm, or the phone's date / time / time zone changed (travel, manual change): "Today" must follow at once
      if (ACTION_MIDNIGHT.equals(act) || Intent.ACTION_DATE_CHANGED.equals(act) || Intent.ACTION_TIME_CHANGED.equals(act) || Intent.ACTION_TIMEZONE_CHANGED.equals(act)) {
        final PendingResult pr = goAsync();
        new Thread(() -> { try { if (updateAll(c)) scheduleMidnight(c); } finally { if (pr != null) pr.finish(); } }, "lf-stats-midnight").start();
        return;
      }
      super.onReceive(c, i);
    }
  }
  public static class Day extends Base { @Override int kind() { return K_DAY; } }
  public static class Week extends Base { @Override int kind() { return K_WEEK; } }
  public static class Month extends Base { @Override int kind() { return K_MONTH; } }
  public static class All extends Base { @Override int kind() { return K_ALL; } }
  public static class Daily extends Base { @Override int kind() { return K_DAILY; } }
}
