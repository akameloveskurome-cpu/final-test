package com.liquid.flacplayer;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.widget.RemoteViews;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** v107: extra home screen widgets. Albums + Artists (4 covers each, from a small summary of the library) and tiles: Shuffle, Search, Favorites.
 *  Every tap opens MainActivity with the extra "lfTab"; the web UI reads it with LiquidNative.getLaunch().
 *  v148: Genres widget: up to 6 genre chips (most songs first, from the same library summary). A chip opens "genre:<name>", the title opens "genres". */
public class LiquidTiles {
  static final Class<?>[] ALL = { Albums.class, Artists.class, Shuffle.class, Search.class, Favorites.class, Recent.class, Playlists.class, Genres.class };
  static final int[] SLOTS_IMG = { R.id.lfg_i0, R.id.lfg_i1, R.id.lfg_i2, R.id.lfg_i3 }, SLOTS_TXT = { R.id.lfg_t0, R.id.lfg_t1, R.id.lfg_t2, R.id.lfg_t3 };

  static PendingIntent open(Context c, String tab, int code) {
    Intent i = new Intent(c, MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).putExtra("lfTab", tab).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
  }

  static RemoteViews tile(Context c, int icon, String label, String tab, int code) {
    RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.lf_tile);
    v.setImageViewResource(R.id.lft_icon, icon); v.setTextViewText(R.id.lft_label, label);
    v.setOnClickPendingIntent(R.id.lft_root, open(c, tab, code));
    return v;
  }

  /** v157: the app tells the widgets which albums / artists have a custom picture: { alb: { "title in lower case": file path }, art: { "name in lower case": file path } }. */
  static void setOverrides(Context c, JSONObject o) {
    try { c.getSharedPreferences("liquid", Context.MODE_PRIVATE).edit().putString("wOv", o == null ? "{}" : o.toString()).apply(); refresh(c); } catch (Throwable ignored) { }
  }
  private static String ovPath(Context c, boolean artists, String name, String orig) {
    try {
      JSONObject o = new JSONObject(c.getSharedPreferences("liquid", Context.MODE_PRIVATE).getString("wOv", "{}"));
      JSONObject m = o.optJSONObject(artists ? "art" : "alb"); if (m == null || name == null) return orig;
      String p = m.optString(name.toLowerCase(Locale.ROOT), "");   // the key is already title + artist for albums
      if (p.isEmpty() && artists) { String nk = StatsWidgets.keyOf(name); java.util.Iterator<String> it = m.keys(); while (it.hasNext() && p.isEmpty()) { String k = it.next(); if (nk != null && nk.equals(StatsWidgets.keyOf(k))) p = m.optString(k, ""); } }   // BUG-173: a picture saved under another spelling of the same grouped artist
      return !p.isEmpty() && new java.io.File(p).exists() ? p : orig;
    } catch (Exception e) { return orig; }
  }

  static RemoteViews grid(Context c, boolean artists) {
    RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.lf_grid);
    String tab = artists ? "artists" : "albums";
    v.setTextViewText(R.id.lfg_head, artists ? "Artists" : "Albums");
    v.setOnClickPendingIntent(R.id.lfg_root, open(c, tab, artists ? 11 : 12));
    List<String[]> items = new ArrayList<>();
    try {
      JSONArray a = new JSONArray(c.getSharedPreferences("liquid", Context.MODE_PRIVATE).getString(artists ? "wArt" : "wAlb", "[]"));
      for (int i = 0; i < a.length(); i++) { JSONObject o = a.getJSONObject(i); String n = o.optString("n"); String key = artists ? n : n + "\u0001" + o.optString("a"); items.add(new String[] { n, ovPath(c, artists, key, o.optString("c")) }); }   // v163: albums are looked up by title + album artist   // v157: a custom picture wins over the original cover
    } catch (Exception ignored) { }
    Collections.shuffle(items, new java.util.Random(System.currentTimeMillis() / 3600000L + (artists ? 1 : 2)));   // BUG-171: the order changes once an hour, not on every redraw, and two widgets of one kind show the same covers
    for (int s = 0; s < 4; s++) {
      boolean has = s < items.size();
      v.setViewVisibility(SLOTS_IMG[s], has ? android.view.View.VISIBLE : android.view.View.INVISIBLE);
      v.setTextViewText(SLOTS_TXT[s], has ? items.get(s)[0] : "");
      if (!has) continue;
      try {
        BitmapFactory.Options o = new BitmapFactory.Options(); o.inJustDecodeBounds = true; BitmapFactory.decodeFile(items.get(s)[1], o);
        if (o.outWidth <= 0 || o.outHeight <= 0) { v.setImageViewResource(SLOTS_IMG[s], R.drawable.lf_widget_bg); continue; }
        int ss = 1; while (Math.max(o.outWidth, o.outHeight) / ss > 300) ss *= 2;   // BUG-143 / BUG-172: the sample size comes from the real size of the file (no fixed start of 4), so the long side ends at 300 px or less (RGB_565, 4 slots = under 0.8 MB in total)
        o = new BitmapFactory.Options(); o.inSampleSize = ss; o.inPreferredConfig = Bitmap.Config.RGB_565;
        Bitmap b = BitmapFactory.decodeFile(items.get(s)[1], o);
        if (b != null) v.setImageViewBitmap(SLOTS_IMG[s], b); else v.setImageViewResource(SLOTS_IMG[s], R.drawable.lf_widget_bg);
      } catch (Throwable ignored) { v.setImageViewResource(SLOTS_IMG[s], R.drawable.lf_widget_bg); }
    }
    return v;
  }

  static final int[] G_BOX = { R.id.lfgn_c0, R.id.lfgn_c1, R.id.lfgn_c2, R.id.lfgn_c3, R.id.lfgn_c4, R.id.lfgn_c5 }, G_NAME = { R.id.lfgn_n0, R.id.lfgn_n1, R.id.lfgn_n2, R.id.lfgn_n3, R.id.lfgn_n4, R.id.lfgn_n5 }, G_COUNT = { R.id.lfgn_k0, R.id.lfgn_k1, R.id.lfgn_k2, R.id.lfgn_k3, R.id.lfgn_k4, R.id.lfgn_k5 };

  /** v148: the Genres widget. Names come from the song tags (saved by save()); a tap on a chip asks the app to open that genre, which the app matches case-insensitively. */
  static RemoteViews genres(Context c) {
    RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.lf_genres);
    v.setOnClickPendingIntent(R.id.lfgn_root, open(c, "genres", 40));
    v.setOnClickPendingIntent(R.id.lfgn_head, open(c, "genres", 40));
    List<String[]> items = new ArrayList<>();
    try {
      JSONArray a = new JSONArray(c.getSharedPreferences("liquid", Context.MODE_PRIVATE).getString("wGen", "[]"));
      for (int i = 0; i < a.length() && items.size() < 6; i++) { JSONObject o = a.getJSONObject(i); String n = o.optString("n"); if (!n.isEmpty()) items.add(new String[] { n, String.valueOf(o.optInt("k")) }); }
    } catch (Exception ignored) { }
    v.setViewVisibility(R.id.lfgn_rows, items.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
    v.setViewVisibility(R.id.lfgn_empty, items.isEmpty() ? android.view.View.VISIBLE : android.view.View.GONE);
    for (int s = 0; s < 6; s++) {
      boolean has = s < items.size();
      v.setViewVisibility(G_BOX[s], has ? android.view.View.VISIBLE : android.view.View.INVISIBLE);
      if (!has) continue;
      int n = 0; try { n = Integer.parseInt(items.get(s)[1]); } catch (Exception ignored) { }
      v.setTextViewText(G_NAME[s], items.get(s)[0]); v.setTextViewText(G_COUNT[s], n + (n == 1 ? " song" : " songs"));
      v.setOnClickPendingIntent(G_BOX[s], open(c, "genre:" + items.get(s)[0], 41 + s));   // a different request code per chip: PendingIntents that differ only in extras would otherwise be the same one
    }
    return v;
  }

  /** v148: the library's genres, most songs first (a song's tag may hold several: "Rock; Pop" or "Rock / Pop", like the app splits them). Case-insensitive; the first spelling seen is kept; max 12. */
  static JSONArray topGenres(JSONArray tracks) {
    Map<String, Object[]> m = new LinkedHashMap<>();
    for (int i = 0; i < tracks.length(); i++) {
      JSONObject t = tracks.optJSONObject(i); if (t == null) continue;
      Set<String> seen = new HashSet<>();
      for (String part : t.optString("genre", "").split("\\s*;\\s*|\\s+/\\s+")) {
        String n = part.trim(), k = n.toLowerCase(Locale.ROOT);
        if (n.isEmpty() || k.equals("unknown") || !seen.add(k)) continue;
        Object[] e = m.get(k); if (e == null) { e = new Object[] { n, 0 }; m.put(k, e); } e[1] = (Integer) e[1] + 1;
      }
    }
    List<Object[]> l = new ArrayList<>(m.values());
    Collections.sort(l, (x, y) -> { int d = (Integer) y[1] - (Integer) x[1]; return d != 0 ? d : ((String) x[0]).compareToIgnoreCase((String) y[0]); });
    JSONArray out = new JSONArray();
    try { for (int i = 0; i < l.size() && i < 12; i++) out.put(new JSONObject().put("n", l.get(i)[0]).put("k", l.get(i)[1])); } catch (Exception ignored) { }
    return out;
  }

  static RemoteViews build(Context c, Class<?> k) {
    if (k == Genres.class) return genres(c);
    if (k == Albums.class) return grid(c, false);
    if (k == Artists.class) return grid(c, true);
    if (k == Shuffle.class) return tile(c, R.drawable.lf_w_shuffle, "Shuffle all", "shuffle", 13);
    if (k == Search.class) return tile(c, R.drawable.lf_w_search, "Search", "search", 14);
    if (k == Recent.class) return tile(c, R.drawable.lf_w_recent, "Recently played", "recent", 16);
    if (k == Playlists.class) return tile(c, R.drawable.lf_w_playlist, "Playlists", "playlists", 17);
    return tile(c, R.drawable.lf_w_heart, "Favorites", "favorites", 15);
  }

  static void update(Context c, AppWidgetManager m, int[] ids, Class<?> k) { for (int id : ids) m.updateAppWidget(id, build(c, k)); }

  /** Re-draws every extra widget that is on the home screen. */
  static void refresh(Context c) {
    try {
      AppWidgetManager m = AppWidgetManager.getInstance(c);
      for (Class<?> k : ALL) { int[] ids = m.getAppWidgetIds(new ComponentName(c, k)); if (ids != null && ids.length > 0) update(c, m, ids, k); }
    } catch (Exception ignored) { }
  }

  /** Called with the library's tracks: keeps up to 40 albums and 40 artists that have a cover, then redraws the widgets. */
  static void save(Context c, JSONArray tracks) {
    try {
      JSONArray alb = new JSONArray(), art = new JSONArray(); Set<String> sa = new HashSet<>(), sr = new HashSet<>();
      java.util.List<Integer> order = new java.util.ArrayList<>(); for (int q = 0; q < tracks.length(); q++) order.add(q); Collections.shuffle(order);   // BUG-144: the 40 are picked at random across the whole library
      for (int oi = 0; oi < order.size() && (alb.length() < 40 || art.length() < 40); oi++) {
        JSONObject t = tracks.optJSONObject(order.get(oi)); if (t == null) continue;
        String cv = t.optString("cover", ""); if (cv.isEmpty() || !new java.io.File(cv).exists()) continue;
        String al = t.optString("album", ""), aa = t.optString("albumArtist", ""); if (aa.isEmpty()) aa = t.optString("artist", "");
        if (!al.isEmpty() && !al.equals("Unknown Album") && alb.length() < 40 && sa.add((aa + "|" + al).toLowerCase(java.util.Locale.ROOT))) alb.put(new JSONObject().put("n", al).put("a", aa).put("c", cv));   // v163: the album artist goes with the title (the picture key)
        for (String ar0 : StatsWidgets.splitKnown(aa)) {   // BUG-173: the app's artist grouping (collaborations split, spelling variants merged), not a raw split here
          String ar = ar0.trim(), ak = ar.isEmpty() ? "" : StatsWidgets.keyOf(ar); if (ak == null || ak.isEmpty()) ak = ar.toLowerCase(java.util.Locale.ROOT);
          if (!ar.isEmpty() && !ar.equals("Unknown Artist") && art.length() < 40 && sr.add(ak)) art.put(new JSONObject().put("n", ar).put("c", cv));
        }
      }
      c.getSharedPreferences("liquid", Context.MODE_PRIVATE).edit().putString("wAlb", alb.toString()).putString("wArt", art.toString()).putString("wGen", topGenres(tracks).toString()).apply();
      refresh(c);
    } catch (Throwable ignored) { }
  }

  public static class Albums extends AppWidgetProvider { @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { update(c, m, ids, Albums.class); } }
  public static class Artists extends AppWidgetProvider { @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { update(c, m, ids, Artists.class); } }
  public static class Shuffle extends AppWidgetProvider { @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { update(c, m, ids, Shuffle.class); } }
  public static class Search extends AppWidgetProvider { @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { update(c, m, ids, Search.class); } }
  public static class Recent extends AppWidgetProvider { @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { update(c, m, ids, Recent.class); } }
  public static class Playlists extends AppWidgetProvider { @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { update(c, m, ids, Playlists.class); } }
  public static class Genres extends AppWidgetProvider { @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { update(c, m, ids, Genres.class); } }
  public static class Favorites extends AppWidgetProvider { @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { update(c, m, ids, Favorites.class); } }
}
