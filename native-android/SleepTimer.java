package com.liquid.flacplayer;

/** T22: the pure rule of the sleep-timer fade. NO Android imports (tests/java-probe-gain.py runs it for real). */
public final class SleepTimer {
  private SleepTimer() {}

  /** Volume factor 0..1 for the last `fadeMs` before the stop: 1.0 until then, then a straight line down to 0. Unknown / huge remaining time = 1.0. */
  static float fade(long remainingMs, long fadeMs) {
    if (fadeMs <= 0 || remainingMs >= fadeMs) return 1f;
    if (remainingMs <= 0) return 0f;
    return (float) remainingMs / (float) fadeMs;
  }

  /** Minutes -> milliseconds, only for sane values (1 minute .. 24 hours); anything else = 0 (= "no timer"). */
  static long minutesToMs(int minutes) {
    return minutes >= 1 && minutes <= 24 * 60 ? minutes * 60_000L : 0L;
  }
}
