package com.liquid.flacplayer;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

// v53: the app is drawn edge-to-edge (under the status bar and the navigation bar, both transparent) and the web UI is told
// how tall the two bars are (CSS px) through LiquidNative.insets() + the "lf-insets" event, so it can keep content clear of them.
public class MainActivity extends BridgeActivity {
  /** Status bar / camera cut-out height and navigation bar height in CSS px. Read by LiquidNative.insets(). */
  static volatile float insetTop = 0f, insetBottom = 0f;

  /** v107: the tab a home screen widget asked for (read once by LiquidNative.getLaunch()). */
  static volatile String pendTab = "";
  private static void grabLaunch(android.content.Intent i) { if (i != null && i.hasExtra("lfTab")) { pendTab = i.getStringExtra("lfTab"); i.removeExtra("lfTab"); } }
  @Override protected void onNewIntent(android.content.Intent i) { super.onNewIntent(i); setIntent(i); grabLaunch(i); }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(LiquidNative.class);
    super.onCreate(savedInstanceState);
    grabLaunch(getIntent());
    final Window w = getWindow();
    WindowCompat.setDecorFitsSystemWindows(w, false);
    w.setStatusBarColor(Color.TRANSPARENT);
    w.setNavigationBarColor(Color.TRANSPARENT);
    if (Build.VERSION.SDK_INT >= 29) w.setNavigationBarContrastEnforced(false);
    if (Build.VERSION.SDK_INT >= 28) {
      WindowManager.LayoutParams lp = w.getAttributes();
      lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
      w.setAttributes(lp);
    }
    w.getDecorView().setBackgroundColor(Color.BLACK);
    WindowInsetsControllerCompat ctl = WindowCompat.getInsetsController(w, w.getDecorView());
    if (ctl != null) { ctl.setAppearanceLightStatusBars(false); ctl.setAppearanceLightNavigationBars(false); }   // white icons on black

    final View content = findViewById(android.R.id.content);
    ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
      Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
      float d = getResources().getDisplayMetrics().density;
      boolean keyboard = ime.bottom > bars.bottom;
      insetTop = bars.top / d;
      insetBottom = keyboard ? 0f : bars.bottom / d;
      // edge-to-edge windows are not resized by the keyboard any more: lift the web view by the keyboard height ourselves
      v.setPadding(0, 0, 0, keyboard ? ime.bottom : 0);
      pushInsets();
      return insets;
    });
    ViewCompat.requestApplyInsets(content);

    // Smoothness: prefer the phone's highest refresh rate at the current resolution. This is only a preference (the system keeps the right to
    // lower it, e.g. in battery saver) and it is NOT a forced display-mode change, so the screen does not flicker or go black while switching.
    try {
      if (Build.VERSION.SDK_INT >= 23) {
        android.view.Display dd = Build.VERSION.SDK_INT >= 30 ? getDisplay() : getWindowManager().getDefaultDisplay();
        if (dd != null) {
          android.view.Display.Mode cur = dd.getMode(); float best = cur.getRefreshRate();
          for (android.view.Display.Mode m : dd.getSupportedModes())
            if (m.getPhysicalWidth() == cur.getPhysicalWidth() && m.getPhysicalHeight() == cur.getPhysicalHeight() && m.getRefreshRate() > best) best = m.getRefreshRate();
          WindowManager.LayoutParams rl = w.getAttributes(); rl.preferredRefreshRate = best; w.setAttributes(rl);
        }
      }
    } catch (Throwable ignored) { }
    try {
      WebView web = getBridge() != null ? getBridge().getWebView() : null;
      if (web != null && Build.VERSION.SDK_INT >= 26) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
    } catch (Throwable ignored) { }
    // v151: run like a game. The screen is drawn on the GPU, the page is rastered ahead of the scroll, the UI thread gets display priority,
    // and the saved pictures / covers are served from cache first. Memory and CPU use are deliberately not limited.
    try {
      WebView web = getBridge() != null ? getBridge().getWebView() : null;
      if (web != null) {
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        // BUG-224 (checked, owner decision): kept on purpose so saved pictures / GIFs load at once from cache. Every request to GitHub in src/ already sends { cache: 'no-store' }, so stale GitHub answers cannot happen. Do not change this without asking the owner.
        web.getSettings().setCacheMode(android.webkit.WebSettings.LOAD_CACHE_ELSE_NETWORK);
        if (Build.VERSION.SDK_INT >= 23) web.getSettings().setOffscreenPreRaster(true);
      }
    } catch (Throwable ignored) { }
    try { android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_DISPLAY); } catch (Throwable ignored) { }
    try { w.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED); } catch (Throwable ignored) { }
    // v156: game-style performance. The phone is asked to keep the CPU / GPU at a steady high clock (not the short bursts it throttles down from), when it supports that.
    try {
      if (Build.VERSION.SDK_INT >= 24) {
        android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null && pm.isSustainedPerformanceModeSupported()) w.setSustainedPerformanceMode(true);
      }
    } catch (Throwable ignored) { }
  }

  @Override public void onResume() {
    super.onResume();
    try { android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_DISPLAY); } catch (Throwable ignored) { }   // v151: back on top of the scheduler every time the app comes to the front
    try {   // v156: the web view is told it is in front again and redraws at once (pictures decoded again by the page: see rewarmAll in main.js)
      WebView web = getBridge() != null ? getBridge().getWebView() : null;
      if (web != null) { web.onResume(); web.resumeTimers(); web.postInvalidateOnAnimation(); }
    } catch (Throwable ignored) { }
  }

  private void pushInsets() {
    try {
      final WebView web = getBridge() != null ? getBridge().getWebView() : null;
      if (web == null) return;
      final String js = "window.dispatchEvent(new CustomEvent('lf-insets',{detail:{top:" + insetTop + ",bottom:" + insetBottom + "}}))";
      web.post(new Runnable() { @Override public void run() { web.evaluateJavascript(js, null); } });
    } catch (Throwable ignored) { }
  }
}
