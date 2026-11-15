package com.liquid.flacplayer;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.List;

/** v210: battery helper. Runs only when the person turns it on in Settings > Accessibility, and only after Allow on the background card
 *  (LiquidNative.openBackgroundSettings arms it for 30 s). It finds "Battery usage" on Liquid Dark's own App info page and taps it once.
 *  It never flips the background switch: that stays the person's choice. It ignores every other app. */
public class BatteryAssistService extends AccessibilityService {
  @Override public void onAccessibilityEvent(AccessibilityEvent e) {
    long armed = LiquidNative.batteryAssistArmedUntil;
    if (armed == 0 || System.currentTimeMillis() > armed) return;
    if (e == null || e.getPackageName() == null) return;
    String p = e.getPackageName().toString();
    if (!(p.startsWith("com.android.settings") || p.startsWith("com.oplus.") || p.startsWith("com.oneplus.") || p.startsWith("com.coloros.") || p.startsWith("com.oppo."))) return;
    AccessibilityNodeInfo root = getRootInActiveWindow();
    if (root == null) return;
    List<AccessibilityNodeInfo> ours = root.findAccessibilityNodeInfosByText("Liquid Dark");
    if (ours == null || ours.isEmpty()) return;   // only on this app's own App info page
    List<AccessibilityNodeInfo> hits = root.findAccessibilityNodeInfosByText("Battery usage");
    if (hits == null) return;
    for (AccessibilityNodeInfo n : hits) {
      AccessibilityNodeInfo c = n;
      while (c != null && !c.isClickable()) c = c.getParent();
      if (c != null && c.performAction(AccessibilityNodeInfo.ACTION_CLICK)) { LiquidNative.batteryAssistArmedUntil = 0; return; }
    }
  }

  @Override public void onInterrupt() { }
}
