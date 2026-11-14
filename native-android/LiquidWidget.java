package com.liquid.flacplayer;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

/** v106: home screen widget. Shows the song + artist and prev / play-pause / next. The service pushes the state (LiquidWidget.push); the buttons call PlaybackService.widgetCmd.
 *  v148: push() also keeps the album and the cover path and redraws the large Now Playing widget (NowPlayingWidget), which uses the same buttons. */
public class LiquidWidget extends AppWidgetProvider {
  static final String A_PLAY = "com.liquid.flacplayer.W_PLAY", A_NEXT = "com.liquid.flacplayer.W_NEXT", A_PREV = "com.liquid.flacplayer.W_PREV";

  @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) m.updateAppWidget(id, build(c)); }

  @Override public void onReceive(Context c, Intent i) {
    String a = i == null ? null : i.getAction();
    if (A_PLAY.equals(a) || A_NEXT.equals(a) || A_PREV.equals(a)) { if (tok(c).equals(i.getStringExtra("lfTok"))) PlaybackService.widgetCmd(c, a); return; }   // BUG-57/174: only our own widget buttons carry the private token, so other apps cannot send play / next / previous
    super.onReceive(c, i);
  }

  /** Private random token (stored in this app's own preferences, unreadable by other apps) that every widget button adds to its intent. */
  static synchronized String tok(Context c) {
    SharedPreferences p = c.getSharedPreferences("liquid", Context.MODE_PRIVATE); String t = p.getString("wTok", "");
    if (t.isEmpty()) { t = java.util.UUID.randomUUID().toString(); p.edit().putString("wTok", t).apply(); }
    return t;
  }

  static PendingIntent act(Context c, String a, int code) {
    Intent i = new Intent(c, LiquidWidget.class).setAction(a).putExtra("lfTok", tok(c));
    return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
  }

  static RemoteViews build(Context c) {
    SharedPreferences p = c.getSharedPreferences("liquid", Context.MODE_PRIVATE);
    String title = p.getString("wTitle", ""), artist = p.getString("wArtist", ""); boolean playing = p.getBoolean("wPlaying", false);
    RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.lf_widget);
    v.setTextViewText(R.id.lfw_title, title.isEmpty() ? "Liquid Dark" : title);
    v.setTextViewText(R.id.lfw_artist, title.isEmpty() ? "Tap to open" : artist);
    v.setImageViewResource(R.id.lfw_play, playing ? R.drawable.lf_w_pause : R.drawable.lf_w_play);
    v.setOnClickPendingIntent(R.id.lfw_play, act(c, A_PLAY, 1));
    v.setOnClickPendingIntent(R.id.lfw_next, act(c, A_NEXT, 2));
    v.setOnClickPendingIntent(R.id.lfw_prev, act(c, A_PREV, 3));
    Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
    if (open != null) v.setOnClickPendingIntent(R.id.lfw_open, PendingIntent.getActivity(c, 4, open, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)));
    return v;
  }

  /** Called by the service when the song / play state changes. album / cover (a file path, "" = none) feed the large Now Playing widget. */
  static void push(Context c, String title, String artist, String album, String cover, boolean playing) {
    try {
      c.getSharedPreferences("liquid", Context.MODE_PRIVATE).edit().putString("wTitle", title == null ? "" : title).putString("wArtist", artist == null ? "" : artist)
        .putString("wAlbum", album == null ? "" : album).putString("wCover", cover == null ? "" : cover).putBoolean("wPlaying", playing).apply();
      AppWidgetManager m = AppWidgetManager.getInstance(c);
      int[] ids = m.getAppWidgetIds(new ComponentName(c, LiquidWidget.class));
      if (ids != null && ids.length > 0) m.updateAppWidget(ids, build(c));
    } catch (Exception ignored) { }
    NowPlayingWidget.refresh(c);
  }
}
