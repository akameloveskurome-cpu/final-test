package com.liquid.flacplayer;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.widget.RemoteViews;

/** v148: large Now Playing widget (4 x 2): album cover, song, artist, album and prev / play-pause / next.
 *  The state is the same one the small widget uses (LiquidWidget.push saves it; this widget is redrawn from there), and the three buttons send the same broadcasts to
 *  LiquidWidget, so PlaybackService.widgetCmd is the only place that drives the player. Tapping the cover or the text opens the app. */
public class NowPlayingWidget extends AppWidgetProvider {
  private static String lastPath = ""; private static Bitmap lastBmp = null;   // the cover is decoded once per song, not once per redraw

  @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) { try { m.updateAppWidget(id, build(c)); } catch (Throwable ignored) { } } }

  /** Cover file (max ~600 px, saved by the library scan) shrunk to about 300 px: a widget bitmap travels through Binder, so it must stay small. null = no cover. */
  static synchronized Bitmap cover(String path) {
    if (path == null || path.isEmpty()) return null;
    java.io.File cf = new java.io.File(path); String key = path + "|" + cf.lastModified() + "|" + cf.length();   // BUG-155: a replaced picture keeps its file name, so the cache key also holds the file time and size
    if (key.equals(lastPath) && lastBmp != null) return lastBmp;
    try {
      BitmapFactory.Options o = new BitmapFactory.Options(); o.inJustDecodeBounds = true; BitmapFactory.decodeFile(path, o);
      int s = 1; while (o.outWidth / (s * 2) >= 300 && o.outHeight / (s * 2) >= 300) s *= 2;
      if (o.outWidth <= 0 || o.outHeight <= 0) return null;
      while (Math.max(o.outWidth, o.outHeight) / s > 600) s *= 2;   // BUG-172: long side at most 600 px (RGB_565 = under 0.75 MB; was 1200 = 2.9 MB, near the RemoteViews limit). BUG-80: a very wide or tall picture is also sampled by its LONG side (the widget bitmap must stay small for Binder)
      o = new BitmapFactory.Options(); o.inSampleSize = s; o.inPreferredConfig = Bitmap.Config.RGB_565;
      Bitmap b = BitmapFactory.decodeFile(path, o);
      lastPath = b == null ? "" : key; lastBmp = b; return b;
    } catch (Throwable t) { return null; }
  }

  static RemoteViews build(Context c) {
    SharedPreferences p = c.getSharedPreferences("liquid", Context.MODE_PRIVATE);
    String title = p.getString("wTitle", ""), artist = p.getString("wArtist", ""), album = p.getString("wAlbum", ""), cover = p.getString("wCover", ""); boolean playing = p.getBoolean("wPlaying", false);
    RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.lf_nowplaying);
    v.setTextViewText(R.id.lfn_title, title.isEmpty() ? "Not playing" : title);
    v.setTextViewText(R.id.lfn_artist, title.isEmpty() ? "Tap to open" : artist);
    v.setTextViewText(R.id.lfn_album, title.isEmpty() ? "" : album);
    Bitmap b = title.isEmpty() ? null : cover(cover);
    if (b != null) v.setImageViewBitmap(R.id.lfn_cover, b); else v.setImageViewResource(R.id.lfn_cover, R.drawable.lf_w_playlist);
    v.setImageViewResource(R.id.lfn_play, playing ? R.drawable.lf_w_pause : R.drawable.lf_w_play);
    v.setOnClickPendingIntent(R.id.lfn_play, LiquidWidget.act(c, LiquidWidget.A_PLAY, 1));
    v.setOnClickPendingIntent(R.id.lfn_next, LiquidWidget.act(c, LiquidWidget.A_NEXT, 2));
    v.setOnClickPendingIntent(R.id.lfn_prev, LiquidWidget.act(c, LiquidWidget.A_PREV, 3));
    Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
    if (open != null) { PendingIntent pi = PendingIntent.getActivity(c, 5, open, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)); v.setOnClickPendingIntent(R.id.lfn_cover, pi); v.setOnClickPendingIntent(R.id.lfn_info, pi); }
    return v;
  }

  /** Redraws every large Now Playing widget on the home screen (called from LiquidWidget.push). */
  static void refresh(Context c) {
    try {
      AppWidgetManager m = AppWidgetManager.getInstance(c);
      int[] ids = m.getAppWidgetIds(new ComponentName(c, NowPlayingWidget.class));
      if (ids != null && ids.length > 0) m.updateAppWidget(ids, build(c));
    } catch (Throwable ignored) { }
  }
}
